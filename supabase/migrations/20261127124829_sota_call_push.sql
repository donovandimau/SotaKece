-- Web Push for calls: a phone that has the site closed can still be told "Sina is calling".
--
-- Each member's browser gives us a subscription (an address on the browser maker's push service plus
-- two keys). Those are stored here. When someone starts a call, /api/push asks bv_call_push_targets
-- for the subscriptions of the people who are being rung, encrypts a short message for each browser
-- and sends it. A subscription is useless to anyone without the site's VAPID private key, which only
-- the Worker holds (VAPID_PRIVATE_KEY); it is never stored in the database or the repository.
--
-- Members reach this only through the functions below: the tables have no grants.

create table if not exists bulavata.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  member     uuid not null references bulavata.profiles(id) on delete cascade,   -- removed with "Delete my data"
  endpoint   text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) between 80 and 100),            -- 65 bytes, base64url
  auth       text not null check (length(auth) between 20 and 40),               -- 16 bytes, base64url
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_member on bulavata.push_subscriptions(member);
alter table bulavata.push_subscriptions enable row level security;

-- one push per call, so a host cannot ring a phone over and over
create table if not exists bulavata.call_push_sent (
  call_id uuid primary key references bulavata.call_rooms(id) on delete cascade,
  sent_at timestamptz not null default now()
);
alter table bulavata.call_push_sent enable row level security;

-- This browser wants call alerts. The same browser signing in as someone else takes the subscription over.
create or replace function public.bv_push_save(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from bulavata.profiles where id = me) then raise exception 'NO_ROOM'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or length(p_endpoint) > 1000
     or p_p256dh is null or length(p_p256dh) not between 80 and 100
     or p_auth is null or length(p_auth) not between 20 and 40 then raise exception 'BAD_SUBSCRIPTION'; end if;
  insert into bulavata.push_subscriptions (member, endpoint, p256dh, auth) values (me, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set member = excluded.member, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
  -- keep the newest eight per member
  delete from bulavata.push_subscriptions s where s.member = me and s.id not in
    (select id from bulavata.push_subscriptions where member = me order by created_at desc limit 8);
end $$;

-- This browser no longer wants call alerts.
create or replace function public.bv_push_remove(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  delete from bulavata.push_subscriptions where member = me and endpoint = p_endpoint;
end $$;

-- Who should be alerted for this call. Only the person who started it, only while it is still ringing,
-- and only once per call. Returns {} when there is nothing to send.
create or replace function public.bv_call_push_targets(p_call uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  r bulavata.call_rooms%rowtype;
  who text; grp text; added integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into r from bulavata.call_rooms where id = p_call and host = me and status = 'ringing' and ring_expires_at > clock_timestamp();
  if not found then return '{}'::jsonb; end if;
  insert into bulavata.call_push_sent (call_id) values (p_call) on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then return '{}'::jsonb; end if;
  select coalesce(nullif(btrim(display_name), ''), handle) into who from bulavata.profiles where id = me;
  select name into grp from bulavata.crews where id = r.crew_id;
  return jsonb_build_object(
    'from', coalesce(who, 'Someone'), 'group', coalesce(grp, 'your Koro'), 'mode', r.mode,
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from bulavata.call_people p
        join bulavata.push_subscriptions s on s.member = p.member
        join bulavata.crew_members m on m.crew_id = r.crew_id and m.member = p.member
       where p.call_id = p_call and p.state = 'ringing' and p.member <> me), '[]'::jsonb));
end $$;

-- The push service said these addresses are gone (404 or 410). The caller may clear them, but only for
-- people on their own call.
create or replace function public.bv_push_prune(p_call uuid, p_endpoints text[])
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from bulavata.call_rooms where id = p_call and host = me) then return; end if;
  delete from bulavata.push_subscriptions s
   using bulavata.call_people p
   where p.call_id = p_call and p.member = s.member and p.member <> me and s.endpoint = any (p_endpoints);
end $$;

revoke execute on function public.bv_push_save(text, text, text), public.bv_push_remove(text),
  public.bv_call_push_targets(uuid), public.bv_push_prune(uuid, text[]) from public, anon;
grant execute on function public.bv_push_save(text, text, text), public.bv_push_remove(text),
  public.bv_call_push_targets(uuid), public.bv_push_prune(uuid, text[]) to authenticated;
