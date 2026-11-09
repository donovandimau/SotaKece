-- Synthetic local fixture only; run with node tests/run-sere-db.cjs.
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
             WHEN 'bo'  THEN '22222222-2222-2222-2222-222222222222'
             WHEN 'cy'  THEN '33333333-3333-3333-3333-333333333333' ELSE '' END,true);
$$;
CREATE TABLE pg_temp.keep(k text PRIMARY KEY, v text);
GRANT ALL ON pg_temp.keep TO anon,authenticated;

-- anon: nothing
SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.bv_sere_create('jpg',30000)$$,'42501','anon cannot start a sere');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.sere_media_generations$$,'42501','anon cannot read generations');
SELECT pg_temp.fails($$SELECT count(*) FROM public.bv_sere_media_generations$$,'42501','anon cannot read the view');
RESET ROLE;

-- Ana makes one
SET ROLE authenticated;
SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_sere_create('gif',30000)$$,'BAD_IMAGE','only jpg or png');
SELECT pg_temp.fails($$SELECT public.bv_sere_create('jpg',700000)$$,'BAD_AUDIO','audio over ten minutes is refused');
SELECT pg_temp.fails($$SELECT public.bv_sere_create('jpg',30000,0,'disco')$$,'BAD_SCENE','unknown scene is refused');
INSERT INTO pg_temp.keep SELECT 'ana1',(public.bv_sere_create('jpg',185000,120000,'golden-hour','Vude night'))::text;
SELECT pg_temp.ok((v::jsonb->>'audio_path') LIKE '11111111-1111-1111-1111-111111111111/%.wav','audio path is in Ana''s folder') FROM pg_temp.keep WHERE k='ana1';
SELECT pg_temp.ok((v::jsonb->>'image_path') LIKE '11111111-1111-1111-1111-111111111111/%.jpg','image path is in Ana''s folder') FROM pg_temp.keep WHERE k='ana1';
SELECT pg_temp.ok((v::jsonb->>'left')::int=4,'four left today after the first') FROM pg_temp.keep WHERE k='ana1';
SELECT pg_temp.ok((v::jsonb->>'engine')='quick','default engine is quick') FROM pg_temp.keep WHERE k='ana1';
INSERT INTO pg_temp.keep SELECT 'ana-life',(public.bv_sere_create('jpg',5000,0,'none',NULL,NULL,'lifelike'))::text;
SELECT pg_temp.ok((SELECT engine FROM public.bv_sere_media_generations WHERE id=(v::jsonb->>'id')::uuid)='lifelike','lifelike engine is recorded') FROM pg_temp.keep WHERE k='ana-life';
SELECT pg_temp.ok((public.bv_sere_create('jpg',5000,0,'none',NULL,NULL,'nonsense'))->>'engine'='quick','unknown engine falls back to quick');
SELECT pg_temp.ok((SELECT render_end_ms-render_start_ms FROM public.bv_sere_media_generations WHERE id=(v::jsonb->>'id')::uuid)=60000,'window is capped at 60 s') FROM pg_temp.keep WHERE k='ana1';
SELECT pg_temp.ok((SELECT render_start_ms FROM public.bv_sere_media_generations WHERE id=(v::jsonb->>'id')::uuid)=120000,'window starts where asked') FROM pg_temp.keep WHERE k='ana1';
SELECT pg_temp.ok((SELECT status FROM public.bv_sere_media_generations WHERE id=(v::jsonb->>'id')::uuid)='pending','starts pending') FROM pg_temp.keep WHERE k='ana1';
SELECT pg_temp.ok(jsonb_array_length(public.bv_sere_mine())=3,'mine lists all three');
-- a short clip keeps its own length
INSERT INTO pg_temp.keep SELECT 'ana2',(public.bv_sere_create('png',9000))::text;
SELECT pg_temp.ok((SELECT render_end_ms FROM public.bv_sere_media_generations WHERE id=(v::jsonb->>'id')::uuid)=9000,'short clip window is the whole clip') FROM pg_temp.keep WHERE k='ana2';
-- allowance: five a day
SELECT public.bv_sere_create('jpg',5000);
SELECT pg_temp.fails($$SELECT public.bv_sere_create('jpg',5000)$$,'OUT_OF_SERE','sixth in a day is refused');
SELECT pg_temp.fails($$UPDATE bulavata.sere_media_generations SET status='completed'$$,'42501','members cannot update the table');
SELECT pg_temp.fails($$UPDATE public.bv_sere_media_generations SET status='completed'$$,'42501','members cannot update through the view');

-- Bo cannot see Ana's pending work
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((SELECT count(*) FROM public.bv_sere_media_generations)=0,'pending rows are private to their maker');
SELECT pg_temp.fails($$SELECT public.bv_sere_tip((SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'),'bilo')$$,'GONE','cannot tip an unfinished sere');
RESET ROLE;

-- the server finishes it (service role bypasses RLS: plain superuser here)
UPDATE bulavata.sere_media_generations SET status='completed',progress=100,
  output_video_url='https://x/sere-video/a/v.mp4',output_poster_url='https://x/sere-video/a/p.jpg'
  WHERE id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1');
SELECT pg_temp.ok((SELECT post_id IS NOT NULL FROM bulavata.sere_media_generations WHERE id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1')),'completion writes the wall post');
SELECT pg_temp.ok((SELECT body FROM bulavata.talanoa_posts WHERE sere_id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'))='Vude night','the caption is the post body');
SELECT pg_temp.ok((SELECT completed_at IS NOT NULL FROM bulavata.sere_media_generations WHERE id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1')),'completed_at is stamped');
UPDATE bulavata.sere_media_generations SET progress=100 WHERE id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_posts WHERE sere_id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'))=1,'a second update does not post twice');
-- a caption-less one gets a default body
UPDATE bulavata.sere_media_generations SET status='completed',output_video_url='https://x/v2.mp4' WHERE id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana2');
SELECT pg_temp.ok((SELECT body FROM bulavata.talanoa_posts WHERE sere_id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana2'))='🎤 Sere','no caption gets the default body');

-- the wall carries the video
SET ROLE authenticated;
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((SELECT count(*) FROM public.bv_sere_media_generations)=2,'finished seres are visible to everyone');
SELECT pg_temp.ok((public.bv_talanoa_feed()->0->'sere'->>'video')='https://x/v2.mp4','feed returns the sere video');
SELECT pg_temp.ok((public.bv_talanoa_feed()->1->'sere'->>'scene')='golden-hour','feed returns the scene');
SELECT pg_temp.ok((public.bv_talanoa_feed()->1->'sere'->>'seconds')='60','feed returns the length in seconds');
SELECT pg_temp.ok((public.bv_talanoa_feed()->0->'sere'->>'seconds')='9','short clip length is right');

-- tipping: mates only, three a day, never yourself
SELECT public.bv_sere_tip((SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'),'bilo','ka loa');
SELECT pg_temp.ok((public.bv_talanoa_feed()->1->'sere'->>'tips')='1','tip counts on the feed');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.gifts WHERE giver='22222222-2222-2222-2222-222222222222' AND receiver='11111111-1111-1111-1111-111111111111' AND sere_id IS NOT NULL)=1,'a tip is a gift to the maker');
SET ROLE authenticated;
SELECT pg_temp.as_member('cy');
SELECT pg_temp.fails($$SELECT public.bv_sere_tip((SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'),'bilo')$$,'NOT_FRIENDS','not a mate, no tip');
SELECT pg_temp.as_member('ana');
SELECT pg_temp.fails($$SELECT public.bv_sere_tip((SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'),'bilo')$$,'SELF_GIFT','no tipping yourself');
SELECT public.bv_sere_play((SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'));
SELECT pg_temp.ok((public.bv_talanoa_feed()->1->'sere'->>'plays')='1','a play is counted');

-- remix: Bo takes Ana's sound
SELECT pg_temp.as_member('bo');
INSERT INTO pg_temp.keep SELECT 'bo1',(public.bv_sere_create('jpg',1000,0,'none',NULL,(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1')))::text;
SELECT pg_temp.ok((SELECT remix_of IS NOT NULL AND audio_url LIKE '11111111-%' AND render_start_ms=120000 AND render_end_ms=180000 FROM public.bv_sere_media_generations WHERE id=(SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='bo1')),'remix points at the parent sound and window');
SELECT pg_temp.fails($$SELECT public.bv_sere_create('jpg',1000,0,'none',NULL,'99999999-9999-4999-8999-999999999999')$$,'GONE','remix of nothing is refused');

-- remove: only yours, and the wall post goes with it
SELECT pg_temp.fails($$SELECT public.bv_sere_remove((SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'))$$,'NOT_YOURS','cannot remove another member''s sere');
SELECT pg_temp.as_member('ana');
SELECT public.bv_sere_remove((SELECT (v::jsonb->>'id')::uuid FROM pg_temp.keep WHERE k='ana1'));
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_posts WHERE body='Vude night')=0,'removing the sere removes its post');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.gifts WHERE sere_id IS NOT NULL)=0,'the tip no longer points at the sere');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.gifts)=1,'the gift itself is kept');
SELECT 'PASS suite completed';
ROLLBACK;
