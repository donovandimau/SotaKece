-- Synthetic local fixture only; run with node tests/run-talanoa-wall-db.cjs.
-- Ana, Bo and Cy are three members who are NOT friends: the wall is for every member.
BEGIN;
CREATE FUNCTION pg_temp.ok(p_value boolean,p_label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 IF p_value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %',p_label; END IF;
 RETURN 'PASS '||p_label;
END; $$;
CREATE FUNCTION pg_temp.fails(p_sql text,p_code text,p_label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  IF SQLSTATE<>p_code THEN RAISE EXCEPTION 'FAIL %: expected %, got % (%)',p_label,p_code,SQLSTATE,SQLERRM; END IF;
  RETURN 'PASS '||p_label;
 END;
 RAISE EXCEPTION 'FAIL %: expected error %',p_label,p_code;
END; $$;
CREATE FUNCTION pg_temp.as_member(p_who text) RETURNS void LANGUAGE sql AS $$
 SELECT set_config('request.jwt.claim.sub',
  CASE p_who WHEN 'ana' THEN '11111111-1111-1111-1111-111111111111'
             WHEN 'bo'  THEN '22222222-2222-2222-2222-222222222222'
             WHEN 'cy'  THEN '33333333-3333-3333-3333-333333333333' ELSE '' END,true);
$$;

-- anon: nothing
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.bv_talanoa_feed()$$,'42501','anon cannot call the feed');
SELECT pg_temp.fails($$SELECT public.bv_talanoa_post('hi')$$,'42501','anon cannot post');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.talanoa_posts$$,'42501','anon cannot read the table');
RESET ROLE;

-- authenticated without a sub claim: refused by the function itself
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.fails($$SELECT public.bv_talanoa_feed()$$,'P0001','a session without a user is refused');

-- Ana posts, Bo (not a friend) sees it
SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((public.bv_talanoa_post('first line on the wall')->>'handle')='ana','posting returns the card with the author handle');
SELECT pg_temp.ok((public.bv_talanoa_post('first line on the wall  ')->>'body') IS NOT NULL,'body is trimmed and accepted');
SELECT pg_temp.fails($$SELECT public.bv_talanoa_post('   ')$$,'P0001','blank body is EMPTY');
SELECT pg_temp.fails($$SELECT public.bv_talanoa_post(repeat('x',281))$$,'P0001','281 characters is TOO_LONG');
SELECT pg_temp.ok((public.bv_talanoa_post(repeat('y',280))->>'id') IS NOT NULL,'280 characters is accepted');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok(jsonb_array_length(public.bv_talanoa_feed('latest'))=3,'a stranger reads every root post');
SELECT pg_temp.ok((public.bv_talanoa_feed('latest')->0->>'i_liked')='false','viewer state starts false');
SELECT pg_temp.ok((public.bv_talanoa_feed('latest')->0->>'mine')='false','someone else''s post is not mine');

-- like toggles and counts in one call
-- (a scalar subquery in the same statement would read the pre-call snapshot, so the row counter is checked in its own statement)
SELECT pg_temp.ok((public.bv_talanoa_like(1)->>'liked')='true','like adds one');
SELECT pg_temp.ok((SELECT like_count FROM bulavata.talanoa_posts WHERE id=1)=1,'the row counter follows the like');
SELECT pg_temp.ok((public.bv_talanoa_like(1)->>'liked')='false','like again removes it');
SELECT pg_temp.ok((SELECT like_count FROM bulavata.talanoa_posts WHERE id=1)=0,'the row counter follows the unlike');
SELECT pg_temp.ok((public.bv_talanoa_like(1)->>'like_count')='1','the toggle returns the fresh count');
SELECT pg_temp.ok((public.bv_talanoa_feed('latest',now(),50,0,null,null,null,1)->0->>'i_liked')='true','feed shows my like');
SELECT pg_temp.fails($$SELECT public.bv_talanoa_like(999)$$,'P0001','liking a missing post is GONE');

-- repost and quote are separate things
SELECT pg_temp.ok((public.bv_talanoa_repost(1)->>'repost_count')='1','repost adds one');
SELECT pg_temp.ok((SELECT repost_count FROM bulavata.talanoa_posts WHERE id=1)=1,'the row counter follows the repost');
SELECT pg_temp.ok((public.bv_talanoa_post('this, exactly',1)->'quote'->>'handle')='ana','a quote embeds the quoted author');
SELECT pg_temp.ok((SELECT repost_count FROM bulavata.talanoa_posts WHERE id=1)=1,'a quote does not count as a repost');
SELECT pg_temp.fails($$SELECT public.bv_talanoa_post('quoting nothing',999)$$,'P0001','quoting a missing post is GONE');

-- replies: counted, threaded one level, kept out of the wall
SELECT pg_temp.ok((public.bv_talanoa_post('reply one',null,1)->>'reply_to')='1','a reply records its parent');
SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok((public.bv_talanoa_post('reply to the reply',null,5)->>'reply_to')='1','a reply to a reply joins the root thread');
SELECT pg_temp.ok((SELECT reply_count FROM bulavata.talanoa_posts WHERE id=1)=2,'reply count follows');
SELECT pg_temp.ok(jsonb_array_length(public.bv_talanoa_feed('latest'))=4,'replies stay off the wall');
SELECT pg_temp.ok((SELECT string_agg(x->>'id',',') FROM jsonb_array_elements(public.bv_talanoa_feed('latest',now(),50,0,null,null,null,null,1)) x)='5,6','a thread reads oldest first');
SELECT pg_temp.ok((public.bv_talanoa_feed('latest')->0->>'reply_count')='0' AND (SELECT x->>'reply_count' FROM jsonb_array_elements(public.bv_talanoa_feed('latest')) x WHERE (x->>'id')='1')='2','cards carry the reply count');

-- inside one transaction now() never moves, so give the six posts real, distinct times before testing order
RESET ROLE;
UPDATE bulavata.talanoa_posts SET created_at=now()-(interval '1 minute')*(7-id) WHERE id BETWEEN 1 AND 6;
SET ROLE authenticated; SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok((SELECT string_agg(x->>'id',',') FROM jsonb_array_elements(public.bv_talanoa_feed('latest',now(),50,0,null,null,null,null,1)) x)='5,6','a thread still reads oldest first with distinct times');

-- latest: keyset paging has no gaps and no duplicates
SELECT pg_temp.ok(jsonb_array_length(public.bv_talanoa_feed('latest',now(),2))=2,'page size is honoured');
SELECT pg_temp.ok((
  WITH p1 AS (SELECT public.bv_talanoa_feed('latest',now(),2) j),
       last AS (SELECT (j->1->>'created_at')::timestamptz c,(j->1->>'id')::bigint i FROM p1),
       p2 AS (SELECT public.bv_talanoa_feed('latest',now(),2,0,(SELECT c FROM last),(SELECT i FROM last)) j)
  SELECT (SELECT string_agg(x->>'id',',') FROM p1,jsonb_array_elements(p1.j) x)||'|'||(SELECT string_agg(x->>'id',',') FROM p2,jsonb_array_elements(p2.j) x))='4,3|2,1','two keyset pages cover 4,3 then 2,1');
SELECT pg_temp.ok(jsonb_array_length(public.bv_talanoa_feed('latest',now(),50,0,null,null,(SELECT created_at FROM bulavata.talanoa_posts WHERE id=3)))=1,'since returns only newer root posts');

-- hot: engagement beats recency, and the as_of freeze keeps offset pages stable
RESET ROLE;
UPDATE bulavata.talanoa_posts SET created_at=now()-interval '3 hours' WHERE id=1;
UPDATE bulavata.talanoa_posts SET created_at=now()-interval '2 hours' WHERE id=2;
UPDATE bulavata.talanoa_posts SET created_at=now()-interval '1 hour'  WHERE id=3;
SET ROLE authenticated; SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((public.bv_talanoa_feed('hot',now())->0->>'id')='1','the liked and reposted post ranks first in hot');
SELECT pg_temp.ok((public.bv_talanoa_feed('latest',now())->0->>'id')='4','latest is still pure recency');
SELECT pg_temp.ok((
  WITH t AS (SELECT now()-interval '1 second' AS asof)
  SELECT (public.bv_talanoa_feed('hot',(SELECT asof FROM t),2,0)->1->>'id')<>(public.bv_talanoa_feed('hot',(SELECT asof FROM t),2,2)->0->>'id')
  FROM t),'offset pages do not repeat a post');
RESET ROLE; INSERT INTO bulavata.talanoa_posts(author,body,created_at) VALUES ('11111111-1111-1111-1111-111111111111','four days old',now()-interval '4 days'); SET ROLE authenticated;
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM jsonb_array_elements(public.bv_talanoa_feed('hot',now())) x WHERE x->>'body'='four days old'),'hot only considers the last 72 hours');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM jsonb_array_elements(public.bv_talanoa_feed('latest',now())) x WHERE x->>'body'='four days old'),'latest still reaches older posts');
SELECT pg_temp.ok((public.bv_talanoa_feed('hot',now())->0->>'hot')::numeric > (public.bv_talanoa_feed('hot',now())->1->>'hot')::numeric,'hot scores are exposed and descending');

-- delete: only the author, and the wall tidies after it
SELECT pg_temp.fails($$SELECT public.bv_talanoa_delete(1)$$,'P0001','deleting someone else''s post is NOT_YOURS');
SELECT pg_temp.as_member('ana');
SELECT public.bv_talanoa_delete(1);
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM bulavata.talanoa_posts WHERE id IN (1,5,6)),'deleting a post removes its replies');
SELECT pg_temp.ok((SELECT quote_of FROM bulavata.talanoa_posts WHERE id=4) IS NULL,'a quote of a deleted post keeps the quote text but drops the link');
SELECT pg_temp.ok((public.bv_talanoa_feed('latest',now(),50,0,null,null,null,4)->0->'quote') = 'null'::jsonb,'the card shows no quote once the original is gone');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM bulavata.talanoa_likes WHERE post_id=1),'likes of a deleted post are gone too');

-- direct writes are closed even to members
SELECT pg_temp.fails($$INSERT INTO bulavata.talanoa_posts(author,body) VALUES ('11111111-1111-1111-1111-111111111111','x')$$,'42501','members cannot insert into the table directly');
SELECT pg_temp.fails($$UPDATE bulavata.talanoa_posts SET like_count=99$$,'42501','members cannot touch counters directly');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_posts)>0,'members can still read the table (Realtime needs this)');
RESET ROLE;
SELECT 'PASS suite completed';
ROLLBACK;
