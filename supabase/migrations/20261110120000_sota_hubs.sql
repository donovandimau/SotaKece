-- Sota Kece — starter Koro ("hubs") and people to meet (10 November 2026).
-- A new member lands on an empty wall with no friends. A hub is an OPEN Koro any member can join
-- with one tap (Suva, Nadi & Lautoka, UK & overseas). Every other Koro stays invite-only: nothing
-- here changes how a Koro made by a member is joined or read.
--   bv_hubs()                 the hubs, how many members each has, and whether the caller is in
--   bv_hub_join(slug)         join (the Koro is made the first time anyone joins)
--   bv_people_to_meet(limit)  up to 12 members to greet: hub-mates first, then recent wall voices
-- Additive only: one new table and three functions. No existing table, policy or grant is changed.
begin;

create table bulavata.hubs (
  slug    text primary key check (slug ~ '^[a-z0-9-]{2,24}$'),
  name    text not null check (char_length(name) between 1 and 40),
  emoji   text not null default '🪸',
  blurb   text not null default '',
  sort    smallint not null default 0,
  crew_id bigint unique references bulavata.crews(id) on delete set null
);
alter table bulavata.hubs enable row level security;
revoke all on table bulavata.hubs from public, anon, authenticated;

insert into bulavata.hubs (slug, name, emoji, blurb, sort) values
  ('suva',     'Suva',            '🌴', 'The capital and the Central side',        1),
  ('west',     'Nadi & Lautoka',  '🌅', 'The West, from the airport to Sugar City', 2),
  ('diaspora', 'UK & overseas',   '✈️', 'Viti away from home',                      3);

create or replace function bulavata.hub_row(p_slug text, p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'slug', h.slug, 'name', h.name, 'emoji', h.emoji, 'blurb', h.blurb, 'crew_id', h.crew_id,
    'members', (select count(*) from bulavata.crew_members m where m.crew_id = h.crew_id),
    'joined', exists (select 1 from bulavata.crew_members m where m.crew_id = h.crew_id and m.member = p_uid))
  from bulavata.hubs h where h.slug = p_slug;
$$;
revoke all on function bulavata.hub_row(text, uuid) from public, anon, authenticated;

create or replace function public.bv_hubs() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  return coalesce((select jsonb_agg(bulavata.hub_row(h.slug, v_uid) order by h.sort, h.slug) from bulavata.hubs h), '[]'::jsonb);
end; $$;

create or replace function public.bv_hub_join(p_slug text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_hub bulavata.hubs%rowtype; v_owner uuid;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from bulavata.profiles p where p.id = v_uid) then raise exception 'NO_ROOM'; end if;
  -- The row lock makes two first joiners queue, so a hub never gets two Koro.
  select * into v_hub from bulavata.hubs h where h.slug = lower(btrim(coalesce(p_slug, ''))) for update;
  if not found then raise exception 'NO_SUCH_HUB'; end if;
  if v_hub.crew_id is null then
    -- A hub Koro is looked after by the longest-standing member (the founder), never by whoever
    -- happened to tap first, so no ordinary member gains owner controls over an open room.
    select p.id into v_owner from bulavata.profiles p order by p.created_at, p.id limit 1;
    insert into bulavata.crews (name, emoji, owner, about)
      values (v_hub.name, v_hub.emoji, v_owner, v_hub.blurb) returning id into v_hub.crew_id;
    update bulavata.hubs set crew_id = v_hub.crew_id where slug = v_hub.slug;
  end if;
  insert into bulavata.crew_members (crew_id, member) values (v_hub.crew_id, v_uid) on conflict do nothing;
  return bulavata.hub_row(v_hub.slug, v_uid);
end; $$;

-- People to greet. Hub-mates first, then members who posted on the wall in the last 30 days, then
-- the most recently seen. Never the caller, never anyone they already have a friendship row with
-- (asked, asking or accepted). Only what the wall already shows about a member is returned.
create or replace function public.bv_people_to_meet(p_limit int default 3) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_limit int := least(greatest(coalesce(p_limit, 3), 1), 12);
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'handle', x.handle, 'display_name', x.display_name,
             'avatar_emoji', x.avatar_emoji, 'accent', x.room_accent, 'posts', x.posts, 'hub', x.hub)
             order by (x.hub is not null) desc, x.posts desc, x.last_seen desc nulls last, x.handle)
    from (
      select p.id, p.handle, p.display_name, p.avatar_emoji, p.room_accent, p.last_seen,
        (select count(*) from bulavata.talanoa_posts t
          where t.author = p.id and t.reply_to is null and t.created_at > now() - interval '30 days') as posts,
        (select h.name from bulavata.hubs h
          join bulavata.crew_members theirs on theirs.crew_id = h.crew_id and theirs.member = p.id
          join bulavata.crew_members mine on mine.crew_id = h.crew_id and mine.member = v_uid
          order by h.sort limit 1) as hub
      from bulavata.profiles p
      where p.id <> v_uid
        and not exists (select 1 from bulavata.friendships f
          where (f.requester = v_uid and f.addressee = p.id) or (f.requester = p.id and f.addressee = v_uid))
      order by 7 nulls last, 6 desc, p.last_seen desc nulls last, p.handle
      limit v_limit
    ) x), '[]'::jsonb);
end; $$;

revoke all on function public.bv_hubs(), public.bv_hub_join(text), public.bv_people_to_meet(int) from public, anon;
grant execute on function public.bv_hubs(), public.bv_hub_join(text), public.bv_people_to_meet(int) to authenticated;

commit;
