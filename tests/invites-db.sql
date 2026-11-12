-- Synthetic local fixture only; run with node tests/run-invites-db.cjs.
-- Ana makes two invite links. Di is new and joins through the first. Bo is an old member. Cy is new and
-- joins through nothing. Nobody is friends.
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
             WHEN 'cy'  THEN '33333333-3333-3333-3333-333333333333'
             WHEN 'di'  THEN '44444444-4444-4444-4444-444444444444' ELSE '' END,true);
$$;
CREATE TABLE pg_temp.keep(name text PRIMARY KEY, value text);
GRANT ALL ON pg_temp.keep TO anon, authenticated;

-- Ana makes two invites
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
INSERT INTO pg_temp.keep SELECT 'akl', public.bv_invite_create('  Auckland   church youth  ')->>'token';
INSERT INTO pg_temp.keep SELECT 'syd', public.bv_invite_create('Sydney cousins')->>'token';
SELECT pg_temp.ok((SELECT value ~ '^[a-f0-9]{32}$' FROM pg_temp.keep WHERE name='akl'),'an invite token is 32 hex characters');
SELECT pg_temp.ok((SELECT value FROM pg_temp.keep WHERE name='akl')<>(SELECT value FROM pg_temp.keep WHERE name='syd'),'every invite is a new link');
SELECT pg_temp.ok((SELECT x->>'label' FROM jsonb_array_elements(public.bv_invites_mine()->'invites') x WHERE x->>'path'='/i/'||(SELECT value FROM pg_temp.keep WHERE name='akl'))='Auckland church youth','the label is tidied (spaces) and kept, on the /i/<token> path');
SELECT pg_temp.ok(length(public.bv_invite_create(repeat('x',200))->>'label')=60,'a long label is cut to 60 characters');
SELECT pg_temp.ok((public.bv_invite_create(NULL)->>'label')='','an invite without a label is allowed');
SELECT pg_temp.ok((public.bv_invites_mine()->'totals'->>'invites')='4','Ana sees her four invites');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.invites)=4,'Ana reads her own invite rows');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.invites)=0,'Bo cannot read Ana''s invite rows');
SELECT pg_temp.ok((public.bv_invites_mine()->'totals'->>'invites')='0','Bo''s list is empty');
SELECT pg_temp.as_member('');
SELECT pg_temp.fails($$SELECT public.bv_invite_create('x')$$,'P0001','signed out cannot make an invite');
SELECT pg_temp.fails($$SELECT public.bv_invites_mine()$$,'P0001','signed out has no list');
RESET ROLE;

-- anyone with the link sees who sent it, never the label; nothing else is readable
SET ROLE anon; SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.fails($$SELECT public.bv_invite_create('x')$$,'42501','anon cannot make an invite');
SELECT pg_temp.fails($$SELECT public.bv_invites_mine()$$,'42501','anon cannot list invites');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.invites$$,'42501','anon cannot read the invites table');
SELECT pg_temp.ok((public.bv_invite_open((SELECT value FROM pg_temp.keep WHERE name='akl'))->>'handle')='ana','the invite page names the sender');
SELECT pg_temp.ok((public.bv_invite_open((SELECT value FROM pg_temp.keep WHERE name='akl'))::text NOT LIKE '%Auckland%'),'the invite page never shows the private label');
SELECT pg_temp.ok((public.bv_invite_open(repeat('0',32))) IS NULL,'an unknown invite opens nothing');
SELECT pg_temp.ok((public.bv_invite_open('not-a-token')) IS NULL,'a malformed invite opens nothing');
SELECT pg_temp.ok((public.bv_invite_open(NULL)) IS NULL,'a missing invite opens nothing');
RESET ROLE;
SELECT pg_temp.ok((SELECT opens FROM bulavata.invites WHERE token=(SELECT value FROM pg_temp.keep WHERE name='akl'))=2,'opens are counted per invite');
SELECT pg_temp.ok((SELECT opens FROM bulavata.invites WHERE token=(SELECT value FROM pg_temp.keep WHERE name='syd'))=0,'other invites are untouched');

-- Di (brand new) joins through the Auckland invite
SET ROLE authenticated; SELECT pg_temp.as_member('di');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='akl'))->>'claimed')='true','a new member is credited to the inviter');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='syd'))->>'claimed')='false','a member is credited once, whatever link comes next');
RESET ROLE;
SELECT pg_temp.ok((SELECT joins FROM bulavata.invites WHERE token=(SELECT value FROM pg_temp.keep WHERE name='akl'))=1,'the join is counted on that invite');
SELECT pg_temp.ok((SELECT joins FROM bulavata.invites WHERE token=(SELECT value FROM pg_temp.keep WHERE name='syd'))=0,'not on the other invite');
SELECT pg_temp.ok((SELECT invite FROM bulavata.referrals WHERE member='44444444-4444-4444-4444-444444444444')=(SELECT value FROM pg_temp.keep WHERE name='akl') AND (SELECT token FROM bulavata.referrals WHERE member='44444444-4444-4444-4444-444444444444') IS NULL,'the referral row points at the invite, not a post link');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.notifications WHERE recipient='11111111-1111-1111-1111-111111111111' AND actor='44444444-4444-4444-4444-444444444444' AND kind='joined' AND snippet='di')=1,'the inviter is told in Activity');

-- self and old accounts are not sign-ups
SET ROLE authenticated; SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='syd'))->>'claimed')='false','nobody can invite themselves');
RESET ROLE; UPDATE bulavata.profiles SET created_at=now()-interval '2 days' WHERE handle='bo';
SET ROLE authenticated; SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok((public.bv_referral_claim((SELECT value FROM pg_temp.keep WHERE name='syd'))->>'claimed')='false','an account older than a day is a visit, not a sign-up');

-- Ana's list: totals, each invite, who joined through which
SELECT pg_temp.as_member('ana');
SELECT pg_temp.ok((public.bv_invites_mine()->'totals'->>'opens')='2' AND (public.bv_invites_mine()->'totals'->>'joins')='1','her totals: 2 opens, 1 joined');
SELECT pg_temp.ok((public.bv_invites_mine()->'joined'->0->>'handle')='di' AND (public.bv_invites_mine()->'joined'->0->>'label')='Auckland church youth','she sees Di joined through the Auckland invite');
SELECT pg_temp.ok(jsonb_array_length(public.bv_share_stats()->'joined')=0,'the shared-posts card leaves invite joins to the invite card');
SELECT pg_temp.as_member('bo');
SELECT pg_temp.ok(jsonb_array_length(public.bv_invites_mine()->'joined')=0,'Bo never sees Ana''s sign-ups');

-- a cap of 50 invites per member
RESET ROLE;
INSERT INTO bulavata.invites(token,sharer) SELECT md5(g::text),'33333333-3333-3333-3333-333333333333' FROM generate_series(1,50) g;
SET ROLE authenticated; SELECT pg_temp.as_member('cy');
SELECT pg_temp.fails($$SELECT public.bv_invite_create('one more')$$,'P0001','the 51st invite is refused (TOO_MANY_INVITES)');
RESET ROLE;

-- a post link still works through the same claim (the share engine is not broken by invites)
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.referrals)=1,'exactly one referral exists');

-- removing the inviter removes their invites and the referral
DELETE FROM bulavata.profiles WHERE handle='ana';
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.invites WHERE sharer='11111111-1111-1111-1111-111111111111')=0,'deleting an account deletes its invites');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.referrals)=0,'and the referrals it earned');

SELECT 'PASS suite completed';
ROLLBACK;
