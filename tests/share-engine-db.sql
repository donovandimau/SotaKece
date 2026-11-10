-- Synthetic local fixture only; run with node tests/run-share-engine-db.cjs.
-- Ana shares a post. Cy is new and joins through Ana's link. Bo is an old member. Nobody is friends.
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
CREATE TABLE pg_temp.keep(name text PRIMARY KEY, value text);
GRANT ALL ON pg_temp.keep TO anon, authenticated;

-- Ana posts, then mints a link
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((public.bv_talanoa_post('bula from Suva <b>')->>'id')='1','post 1 exists');
SELECT pg_temp.ok((public.bv_talanoa_post('a quoted one',1)->>'id')='2','post 2 quotes post 1');
INSERT INTO pg_temp.keep SELECT 'ana_token', public.bv_talanoa_share(1)->>'token';
SELECT pg_temp.ok((SELECT value ~ '^[a-f0-9]{32}$' FROM pg_temp.keep WHERE name='ana_token'),'a minted token is 32 hex characters');
SELECT pg_temp.ok((public.bv_talanoa_share(1)->>'token')=(SELECT value FROM pg_temp.keep WHERE name='ana_token'),'sharing the same post again gives the same link');
SELECT pg_temp.ok((public.bv_talanoa_share(1)->>'path')='/p/1/'||(SELECT value FROM pg_temp.keep WHERE name='ana_token'),'the path is /p/<post>/<token>');
SELECT pg_temp.ok((public.bv_talanoa_share(1)->>'handle')='ana' AND (public.bv_talanoa_share(1)->>'body') LIKE 'bula%','minting returns the words and the author for the share text');
SELECT pg_temp.fails($$SELECT public.bv_talanoa_share(999)$$,'P0001','sharing a missing post is GONE');

-- Bo gets a different link to the same post
SELECT pg_temp.as_member('bo');
INSERT INTO pg_temp.keep SELECT 'bo_token', public.bv_talanoa_share(1)->>'token';
SELECT pg_temp.ok((SELECT value FROM pg_temp.keep WHERE name='bo_token')<>(SELECT value FROM pg_temp.keep WHERE name='ana_token'),'each sharer has their own token');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_shares)=1,'a member sees only their own share rows');

-- anyone with the link reads the card; nothing else is readable
SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.fails($$SELECT public.bv_talanoa_share(1)$$,'42501','anon cannot mint');
SELECT pg_temp.fails($$SELECT public.bv_referral_claim('x')$$,'42501','anon cannot claim');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.talanoa_shares$$,'42501','anon cannot read the shares table');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.referrals$$,'42501','anon cannot read referrals');
SELECT pg_temp.ok((public.bv_talanoa_shared(1,(SELECT value FROM pg_temp.keep WHERE name='ana_token'))->>'handle')='ana','the link opens the card for anyone');
SELECT pg_temp.ok((public.bv_talanoa_shared(1,(SELECT value FROM pg_temp.keep WHERE name='ana_token'))->'sharer'->>'handle')='ana','the card names the sharer');
SELECT pg_temp.ok((public.bv_talanoa_shared(2,(SELECT value FROM pg_temp.keep WHERE name='ana_token'))) IS NULL,'a token only opens its own post');
SELECT pg_temp.ok((public.bv_talanoa_shared(1,repeat('0',32))) IS NULL,'a wrong token opens nothing');
SELECT pg_temp.ok((public.bv_talanoa_shared(1,'not-a-token')) IS NULL,'a malformed token opens nothing');
SELECT pg_temp.ok((public.bv_talanoa_shared(1,NULL)) IS NULL,'a missing token opens nothing');
RESET ROLE;
SELECT pg_temp.ok((SELECT opens FROM bulavata.talanoa_shares WHERE token=(SELECT value FROM pg_temp.keep WHERE name='ana_token'))=2,'opens are counted per link');
SELECT pg_temp.ok((SELECT opens FROM bulavata.talanoa_shares WHERE token=(SELECT value FROM pg_temp.keep WHERE name='bo_token'))=0,'the other sharer''s count is untouched');

-- Cy (brand new) joins through Ana's link
SET ROLE authenticated; SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok((public.bv_referral_claim('bad')->>'claimed')='false','a malformed token credits nobody');
SELECT pg_temp.ok((public.bv_referral_claim(repeat('0',32))->>'claimed')='false','an unknown token credits nobody');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='ana_token'))->>'claimed')='true','a new member is credited to the sharer');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='ana_token'))->>'sharer')='ana','the claim names the sharer for the welcome toast');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='bo_token'))->>'claimed')='false','a member is credited once, whatever link comes next');
RESET ROLE;
SELECT pg_temp.ok((SELECT joins FROM bulavata.talanoa_shares WHERE token=(SELECT value FROM pg_temp.keep WHERE name='ana_token'))=1,'joins are counted on the link');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.referrals WHERE member='33333333-3333-3333-3333-333333333333' AND sharer='11111111-1111-1111-1111-111111111111')=1,'the referral row records who brought whom');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.notifications WHERE recipient='11111111-1111-1111-1111-111111111111' AND actor='33333333-3333-3333-3333-333333333333' AND kind='joined' AND snippet='cy')=1,'the sharer is told in Activity');
-- self and old accounts are not sign-ups
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='ana_token'))->>'claimed')='false','nobody can refer themselves');
RESET ROLE; UPDATE bulavata.profiles SET created_at=now()-interval '2 days' WHERE handle='bo';
SET ROLE authenticated; SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='ana_token'))->>'claimed')='false','an account older than a day is a visit, not a sign-up');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.referrals)=0,'a member sees only referrals they earned');
SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.referrals)=1,'the sharer sees the referral they earned');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.referrals)=1,'exactly one referral exists');

-- removing the post removes its links; the referral stays, without the link
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT public.bv_talanoa_delete(1);
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.talanoa_shares WHERE post_id=1)=0,'deleting a post deletes its share links');
SELECT pg_temp.ok((SELECT token IS NULL FROM bulavata.referrals LIMIT 1),'the referral keeps its credit after the link is gone');
SET ROLE anon;
SELECT pg_temp.ok((public.bv_talanoa_shared(1,(SELECT value FROM pg_temp.keep WHERE name='ana_token'))) IS NULL,'the public page goes with the post');
RESET ROLE;
SELECT 'PASS suite completed';
ROLLBACK;
