-- Synthetic local fixture only; run with node tests/run-hubs-db.cjs.
-- Ana is the longest-standing member. Bo owns one private Koro. Nobody is friends yet.
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
             WHEN 'di'  THEN '44444444-4444-4444-4444-444444444444'
             WHEN 'ghost' THEN '99999999-9999-9999-9999-999999999999' ELSE '' END,true);
$$;

SET ROLE anon;
SELECT pg_temp.fails($$SELECT public.bv_hubs()$$,'42501','anon cannot list hubs');
SELECT pg_temp.fails($$SELECT public.bv_hub_join('suva')$$,'42501','anon cannot join a hub');
SELECT pg_temp.fails($$SELECT public.bv_people_to_meet()$$,'42501','anon cannot list people');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.hubs$$,'42501','anon cannot read the hubs table');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT pg_temp.fails($$SELECT public.bv_hubs()$$,'P0001','a session without a user is refused');
SELECT pg_temp.fails($$SELECT count(*) FROM bulavata.hubs$$,'42501','members cannot read the hubs table directly');
SELECT pg_temp.fails($$SELECT bulavata.hub_row('suva','11111111-1111-1111-1111-111111111111')$$,'42501','the row helper is not callable by members');

SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok(jsonb_array_length(public.bv_hubs())=3,'three starter hubs are listed');
SELECT pg_temp.ok((public.bv_hubs()->0->>'slug')='suva' AND (public.bv_hubs()->2->>'slug')='diaspora','hubs come in their set order');
SELECT pg_temp.ok((public.bv_hubs()->0->>'members')='0' AND (public.bv_hubs()->0->>'joined')='false','an untouched hub has no members and no Koro');
SELECT pg_temp.fails($$SELECT public.bv_hub_join('nowhere')$$,'P0001','an unknown hub is refused');

-- Cy is the first to join Suva: the Koro is made, owned by the founder (Ana), and Cy is a member.
SELECT pg_temp.ok((public.bv_hub_join(' SUVA ')->>'joined')='true','joining returns the hub as joined');
SELECT pg_temp.ok((public.bv_hub_join('suva')->>'members')='1','joining twice does not add a second membership');
RESET ROLE;
SELECT pg_temp.ok((SELECT c.owner='11111111-1111-1111-1111-111111111111' AND c.name='Suva' FROM bulavata.crews c JOIN bulavata.hubs h ON h.crew_id=c.id WHERE h.slug='suva'),'the hub Koro belongs to the founder, not the first joiner');
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.crews)=2,'one Koro was made for the hub');
SET ROLE authenticated;

SELECT pg_temp.as_member('di');
SELECT pg_temp.ok((public.bv_hub_join('suva')->>'members')='2','a second member joins the same Koro');
RESET ROLE;
SELECT pg_temp.ok((SELECT count(*) FROM bulavata.crews)=2,'no second Koro for the same hub');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM bulavata.crew_members WHERE crew_id=1 AND member<>'22222222-2222-2222-2222-222222222222'),'a private Koro gains no members');
SET ROLE authenticated;

SELECT pg_temp.as_member('ghost');
SELECT pg_temp.fails($$SELECT public.bv_hub_join('suva')$$,'P0001','a sign-in with no room cannot join');

-- People to meet: Bo has posted, Di shares Cy's hub.
RESET ROLE;
INSERT INTO bulavata.talanoa_posts(author,body) VALUES ('22222222-2222-2222-2222-222222222222','bula'),('22222222-2222-2222-2222-222222222222','again');
INSERT INTO bulavata.talanoa_posts(author,body,created_at) VALUES ('11111111-1111-1111-1111-111111111111','old',now()-interval '60 days');
SET ROLE authenticated;
SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok(jsonb_array_length(public.bv_people_to_meet())=3,'three people are suggested by default');
SELECT pg_temp.ok((public.bv_people_to_meet()->0->>'handle')='di' AND (public.bv_people_to_meet()->0->>'hub')='Suva','a hub-mate comes first, with the hub named');
SELECT pg_temp.ok((public.bv_people_to_meet()->1->>'handle')='bo' AND (public.bv_people_to_meet()->1->>'posts')='2','then the member with recent wall posts');
SELECT pg_temp.ok((public.bv_people_to_meet()->2->>'posts')='0','posts older than 30 days do not count');
SELECT pg_temp.ok(NOT (public.bv_people_to_meet(12) @> '[{"handle":"cy"}]'),'the caller is never suggested');
SELECT pg_temp.ok(jsonb_array_length(public.bv_people_to_meet(1))=1 AND jsonb_array_length(public.bv_people_to_meet(999))=3,'the limit is honoured and capped');
RESET ROLE;
INSERT INTO bulavata.friendships(requester,addressee) VALUES ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444'),('22222222-2222-2222-2222-222222222222','33333333-3333-3333-3333-333333333333');
SET ROLE authenticated;
SELECT pg_temp.as_member('cy');
SELECT pg_temp.ok(public.bv_people_to_meet(12)::text NOT LIKE '%"di"%' AND public.bv_people_to_meet(12)::text NOT LIKE '%"bo"%','anyone already asked, asking or accepted is left out');
SELECT pg_temp.ok(jsonb_array_length(public.bv_people_to_meet(12))=1,'only Ana is left to meet');
RESET ROLE;
SELECT 'PASS suite completed';
ROLLBACK;
