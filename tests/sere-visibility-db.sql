-- Synthetic local fixture only; run with node tests/run-sere-db.cjs (after the Sere suite).
BEGIN;
CREATE FUNCTION pg_temp.ok(p_value boolean,p_label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 IF p_value IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %',p_label; END IF;
 RETURN 'PASS '||p_label;
END; $$;
CREATE FUNCTION pg_temp.fails(p_sql text,p_needle text,p_label text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
  EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  IF position(p_needle in SQLERRM)=0 AND SQLSTATE<>p_needle THEN RAISE EXCEPTION 'FAIL %: expected %, got % (%)',p_label,p_needle,SQLSTATE,SQLERRM; END IF;
  RETURN 'PASS '||p_label;
 END;
 RAISE EXCEPTION 'FAIL %: expected error %',p_label,p_needle;
END; $$;
CREATE FUNCTION pg_temp.as_member(p_who text) RETURNS void LANGUAGE sql AS $$
 SELECT set_config('request.jwt.claim.sub',
  CASE p_who WHEN 'ana' THEN '11111111-1111-1111-1111-111111111111'
             WHEN 'bo'  THEN '22222222-2222-2222-2222-222222222222' ELSE '' END,true);
$$;
CREATE TABLE pg_temp.keep(k text PRIMARY KEY, v text);
GRANT ALL ON pg_temp.keep TO anon,authenticated;

-- Ana starts a sere: it is private by default
SET ROLE authenticated;
SELECT pg_temp.as_member('ana');
INSERT INTO pg_temp.keep SELECT 'id',(public.bv_sere_create('jpg',30000)->>'id');
SELECT pg_temp.ok((SELECT visibility FROM bulavata.sere_media_generations WHERE id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))='private','a new sere is private');
RESET ROLE;

-- the render lands (service side): a private sere writes no wall post
UPDATE bulavata.sere_media_generations SET status='completed',output_video_url='v.mp4',output_poster_url='p.jpg' WHERE id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id');
SELECT pg_temp.ok((SELECT post_id FROM bulavata.sere_media_generations WHERE id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id')) IS NULL
  AND (SELECT count(*) FROM bulavata.talanoa_posts WHERE sere_id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))=0,'a finished private sere is not posted');

SET ROLE authenticated;
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.sere_media_generations WHERE id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))=0,'another member cannot read a private sere');
SELECT pg_temp.fails($$SELECT public.bv_sere_set_visibility((SELECT v::uuid FROM pg_temp.keep WHERE k='id'),'wall')$$,'NOT_YOURS','only the maker can change visibility');
SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_sere_set_visibility((SELECT v::uuid FROM pg_temp.keep WHERE k='id'),'everyone')$$,'BAD_VISIBILITY','unknown visibility is refused');
SELECT pg_temp.ok((SELECT (public.bv_sere_mine()->0->>'visibility'))='private','the maker list shows visibility');

-- Ana posts it
SELECT public.bv_sere_set_visibility((SELECT v::uuid FROM pg_temp.keep WHERE k='id'),'wall');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_posts WHERE sere_id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))=1,'posting writes one wall post');
SELECT public.bv_sere_set_visibility((SELECT v::uuid FROM pg_temp.keep WHERE k='id'),'wall');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_posts WHERE sere_id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))=1,'posting twice does not duplicate');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.sere_media_generations WHERE id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))=1,'members can read a posted sere');

-- and takes it back
SELECT pg_temp.as_member('ana');
SELECT public.bv_sere_set_visibility((SELECT v::uuid FROM pg_temp.keep WHERE k='id'),'private');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_posts WHERE sere_id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))=0
  AND (SELECT post_id FROM bulavata.sere_media_generations WHERE id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id')) IS NULL,'taking it back removes the wall post');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.sere_media_generations WHERE id=(SELECT v::uuid FROM pg_temp.keep WHERE k='id'))=0,'it is private again');
RESET ROLE;

-- anon cannot change visibility
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.bv_sere_set_visibility(gen_random_uuid(),'wall')$$,'42501','anon cannot change visibility');
SELECT pg_temp.fails($$SELECT public.bv_prefs_get()$$,'42501','anon cannot read saved design');
RESET ROLE;

-- saved page design
SET ROLE authenticated;
SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok(public.bv_prefs_get()='{}'::jsonb,'no saved design to start with');
SELECT public.bv_prefs_save('{"version":1,"pages":{"home":{"accent":"#112233"}}}'::jsonb);
SELECT pg_temp.ok((public.bv_prefs_get()->'page_design'->'pages'->'home'->>'accent')='#112233','the design is saved');
SELECT public.bv_prefs_save('{"version":1,"pages":{"home":{"accent":"#445566"}}}'::jsonb);
SELECT pg_temp.ok((public.bv_prefs_get()->'page_design'->'pages'->'home'->>'accent')='#445566','saving again replaces it');
SELECT pg_temp.fails($$SELECT public.bv_prefs_save('[1]'::jsonb)$$,'BAD_DESIGN','the design must be an object');
SELECT pg_temp.fails($$SELECT public.bv_prefs_save(jsonb_build_object('x',repeat('a',25000)))$$,'BAD_DESIGN','an oversized design is refused');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok(public.bv_prefs_get()='{}'::jsonb,'another member sees none of it');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.member_prefs$$,'42501','the table is not readable directly');
RESET ROLE;
SELECT 'PASS visibility and prefs suite completed';
ROLLBACK;
