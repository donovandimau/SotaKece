-- Sota Kece -> other Dimau apps (first: Mataka).
-- A member can let another app SHOW their Sota Kece activity and Koro messages. Read only:
-- the other app can never post, react, or see anything the member cannot see themselves.
-- The member approves on sotakece.com/link.html; we hand back a random key once and keep only its hash.
-- The other app calls bv_app_feed(key). Disconnecting (either side) deletes the key.

create extension if not exists pgcrypto with schema extensions;

create table if not exists bulavata.app_links (
  member       uuid not null references bulavata.profiles(id) on delete cascade,
  app          text not null check (app in ('mataka')),
  token_hash   text not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (member, app)
);
alter table bulavata.app_links enable row level security;   -- no policies: only the functions below touch it
revoke all on bulavata.app_links from public, anon, authenticated;

-- Signed-in member creates (or replaces) the key for one app. Returns the key; it is never shown again.
create or replace function public.bv_link_app(p_app text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); tok text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if p_app is distinct from 'mataka' then raise exception 'Unknown app'; end if;
  if not exists (select 1 from bulavata.profiles where id = me) then raise exception 'Make your Sota Kece room first'; end if;
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into bulavata.app_links(member, app, token_hash)
    values (me, p_app, encode(extensions.digest(tok, 'sha256'), 'hex'))
    on conflict (member, app) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return tok;
end $$;

-- Signed-in member removes a link from the Sota Kece side.
create or replace function public.bv_unlink_app(p_app text)
returns boolean language sql volatile security definer set search_path = '' as $$
  with d as (delete from bulavata.app_links where member = (select auth.uid()) and app = p_app returning 1)
  select exists (select 1 from d);
$$;

-- The other app removes its own link with the key it holds.
create or replace function public.bv_app_unlink(p_token text)
returns boolean language sql volatile security definer set search_path = '' as $$
  with d as (delete from bulavata.app_links
             where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') returning 1)
  select exists (select 1 from d);
$$;

-- The feed: latest activity (reactions, replies, friend requests ...) and the newest message in each Koro.
-- Blocked people are left out. Vanished and deleted messages are left out. Returns null for an unknown key.
create or replace function public.bv_app_feed(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare me uuid; out jsonb;
begin
  if p_token is null or length(p_token) <> 48 then return null; end if;
  update bulavata.app_links set last_used_at = now()
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    returning member into me;
  if me is null then return null; end if;

  select jsonb_build_object(
    'name', (select coalesce(nullif(display_name, ''), handle) from bulavata.profiles where id = me),
    'unread', (select count(*) from bulavata.notifications n where n.recipient = me and n.read_at is null
                 and not exists (select 1 from bulavata.blocks b where b.blocker = me and b.blocked = n.actor)),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'snippet', left(coalesce(n.snippet, ''), 140),
               'at', n.created_at, 'read', n.read_at is not null,
               'who', coalesce(nullif(p.display_name, ''), p.handle), 'emoji', p.avatar_emoji, 'accent', p.room_accent)
             order by n.created_at desc)
      from (select * from bulavata.notifications x
             where x.recipient = me
               and not exists (select 1 from bulavata.blocks b where b.blocker = me and b.blocked = x.actor)
             order by x.created_at desc limit 12) n
      join bulavata.profiles p on p.id = n.actor), '[]'::jsonb),
    'koro', coalesce((
      select jsonb_agg(k order by k->>'at' desc)
      from (
        select jsonb_build_object('crew', c.id, 'koro', c.name, 'kemoji', c.emoji,
                 'who', coalesce(nullif(p.display_name, ''), p.handle), 'emoji', p.avatar_emoji,
                 'body', left(m.body, 140), 'at', m.created_at) k
        from bulavata.crew_members cm
        join bulavata.crews c on c.id = cm.crew_id
        join lateral (
          select * from bulavata.crew_messages x
           where x.crew_id = cm.crew_id and not x.deleted and x.kind is distinct from 'system'
             and x.author <> me and (x.expires_at is null or x.expires_at > now())
             and x.created_at > now() - interval '14 days'
             and not exists (select 1 from bulavata.blocks b where b.blocker = me and b.blocked = x.author)
           order by x.created_at desc limit 1) m on true
        join bulavata.profiles p on p.id = m.author
        where cm.member = me
        order by m.created_at desc limit 8) s), '[]'::jsonb)
  ) into out;
  return out;
end $$;

revoke execute on function public.bv_link_app(text), public.bv_unlink_app(text), public.bv_app_unlink(text), public.bv_app_feed(text) from public;
grant execute on function public.bv_link_app(text), public.bv_unlink_app(text) to authenticated;
grant execute on function public.bv_app_unlink(text), public.bv_app_feed(text) to anon, authenticated;
