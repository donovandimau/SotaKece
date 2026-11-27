-- Run after the native-calls and call-push migrations; the transaction rolls back every fixture.
begin;
insert into auth.users(id,email) values
('62700000-0000-4000-8000-000000000001','push-host@example.invalid'),
('62700000-0000-4000-8000-000000000002','push-guest@example.invalid'),
('62700000-0000-4000-8000-000000000003','push-third@example.invalid'),
('62700000-0000-4000-8000-000000000004','push-outsider@example.invalid');
insert into bulavata.profiles(id,handle,display_name,age_band) values
('62700000-0000-4000-8000-000000000001','push_host','Sina','adult'),
('62700000-0000-4000-8000-000000000002','push_guest','Guest','adult'),
('62700000-0000-4000-8000-000000000003','push_third','Third','adult'),
('62700000-0000-4000-8000-000000000004','push_outsider','Outsider','adult');
insert into bulavata.crews(id,name,owner) values (62700001,'Family Koro','62700000-0000-4000-8000-000000000001');
insert into bulavata.crew_members(crew_id,member) values
(62700001,'62700000-0000-4000-8000-000000000001'),(62700001,'62700000-0000-4000-8000-000000000002'),(62700001,'62700000-0000-4000-8000-000000000003');
create function pg_temp.assert_true(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',message; end if; end$$;
create function pg_temp.assert_denied(command text,message text) returns void language plpgsql security invoker as $$begin
  begin execute command; exception when others then return; end;
  raise exception 'FAIL: %',message;
end$$;
create function pg_temp.key(n text) returns text language sql as $$ select repeat(n,87) $$;     -- 87 chars, like a real p256dh
create function pg_temp.sec(n text) returns text language sql as $$ select repeat(n,22) $$;     -- 22 chars, like a real auth secret

-- no direct table access, and anonymous visitors cannot call any of it
select pg_temp.assert_true(not has_table_privilege('authenticated','bulavata.push_subscriptions','select,insert,update,delete'),'subscriptions table has no member grants');
select pg_temp.assert_true((select bool_and(relrowsecurity) from pg_class where oid in ('bulavata.push_subscriptions'::regclass,'bulavata.call_push_sent'::regclass)),'row security on both tables');
select pg_temp.assert_true(not has_function_privilege('anon','public.bv_push_save(text,text,text)','execute') and not has_function_privilege('anon','public.bv_call_push_targets(uuid)','execute')
  and not has_function_privilege('anon','public.bv_push_remove(text)','execute') and not has_function_privilege('anon','public.bv_push_prune(uuid,text[])','execute'),'anonymous cannot call the push functions');

set local role authenticated;
-- guest and third turn alerts on; the outsider too (but is not in the Koro)
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000002',true);
select public.bv_push_save('https://push.example.com/guest',pg_temp.key('A'),pg_temp.sec('a'));
select pg_temp.assert_denied($q$select public.bv_push_save('http://push.example.com/insecure',repeat('A',87),repeat('a',22))$q$,'plain http endpoint refused');
select pg_temp.assert_denied($q$select public.bv_push_save('https://push.example.com/x','short',repeat('a',22))$q$,'short key refused');
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000003',true);
select public.bv_push_save('https://push.example.com/third',pg_temp.key('B'),pg_temp.sec('b'));
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000004',true);
select public.bv_push_save('https://push.example.com/outsider',pg_temp.key('C'),pg_temp.sec('c'));

-- the host starts a call
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000001',true);
select set_config('push.call',public.bv_call_start(62700001,'video',false,6,'62700000-0000-4000-8000-000000000021')->'call'->>'id',true);

-- a guest cannot ask for the targets of someone else's call; the host can, once
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true(public.bv_call_push_targets(current_setting('push.call')::uuid)='{}'::jsonb,'only the host gets targets');
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000001',true);
select set_config('push.targets',public.bv_call_push_targets(current_setting('push.call')::uuid)::text,true);
select pg_temp.assert_true((current_setting('push.targets')::jsonb->>'from')='Sina' and (current_setting('push.targets')::jsonb->>'group')='Family Koro' and (current_setting('push.targets')::jsonb->>'mode')='video','message details come from the call');
select pg_temp.assert_true(jsonb_array_length(current_setting('push.targets')::jsonb->'targets')=2,'the two Koro members are alerted');
select pg_temp.assert_true((select count(*) from jsonb_array_elements(current_setting('push.targets')::jsonb->'targets') t where t->>'endpoint' like '%outsider%')=0,'someone outside the Koro is never alerted');
select pg_temp.assert_true((select count(*) from jsonb_array_elements(current_setting('push.targets')::jsonb->'targets') t where t->>'endpoint' like '%host%')=0,'the caller is not alerted');
select pg_temp.assert_true(public.bv_call_push_targets(current_setting('push.call')::uuid)='{}'::jsonb,'a second request for the same call sends nothing');

-- a guest who answered is not alerted again by a fresh call; people who declined are skipped
reset role;
update bulavata.call_people set state='declined' where call_id=current_setting('push.call')::uuid and member='62700000-0000-4000-8000-000000000003';
delete from bulavata.call_push_sent where call_id=current_setting('push.call')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000001',true);
select pg_temp.assert_true(jsonb_array_length(public.bv_call_push_targets(current_setting('push.call')::uuid)->'targets')=1,'someone who declined is skipped');

-- pruning: only the host, only people on that call
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000002',true);
select public.bv_push_prune(current_setting('push.call')::uuid,array['https://push.example.com/third']);
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000001',true);
select public.bv_push_prune(current_setting('push.call')::uuid,array['https://push.example.com/third','https://push.example.com/outsider']);
reset role;
select pg_temp.assert_true((select count(*) from bulavata.push_subscriptions where endpoint like '%/third')=0,'host pruned a dead address of a call member');
select pg_temp.assert_true((select count(*) from bulavata.push_subscriptions where endpoint like '%/outsider')=1,'host cannot prune someone not on the call');
select pg_temp.assert_true((select count(*) from bulavata.push_subscriptions where endpoint like '%/guest')=1,'a guest cannot prune another person''s addresses');

-- the same browser signing in as someone else takes the subscription over; removing is per member
set local role authenticated;
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000003',true);
select public.bv_push_save('https://push.example.com/guest',pg_temp.key('D'),pg_temp.sec('d'));
reset role;
select pg_temp.assert_true((select member::text from bulavata.push_subscriptions where endpoint like '%/guest')='62700000-0000-4000-8000-000000000003','the browser now belongs to the person signed in');
set local role authenticated;
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000002',true);
select public.bv_push_remove('https://push.example.com/guest');
reset role;
select pg_temp.assert_true((select count(*) from bulavata.push_subscriptions where endpoint like '%/guest')=1,'removing needs to be the owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000003',true);
select public.bv_push_remove('https://push.example.com/guest');
reset role;
select pg_temp.assert_true((select count(*) from bulavata.push_subscriptions where endpoint like '%/guest')=0,'the owner removed it');

-- only the newest eight per member are kept
set local role authenticated;
select set_config('request.jwt.claim.sub','62700000-0000-4000-8000-000000000003',true);
select public.bv_push_save('https://push.example.com/many'||g,pg_temp.key('E'),pg_temp.sec('e')) from generate_series(1,11) g;
reset role;
select pg_temp.assert_true((select count(*) from bulavata.push_subscriptions where member='62700000-0000-4000-8000-000000000003')=8,'at most eight browsers per member');

-- "Delete my data" removes them with the profile
delete from bulavata.crew_members where member='62700000-0000-4000-8000-000000000003';
delete from bulavata.profiles where id='62700000-0000-4000-8000-000000000003';
select pg_temp.assert_true((select count(*) from bulavata.push_subscriptions where member='62700000-0000-4000-8000-000000000003')=0,'subscriptions go with the profile');
select 'PASS: call alerts - table and function access, host-only targets, once per call, Koro members only, pruning, browser hand-over, limit and deletion' as result;
rollback;
