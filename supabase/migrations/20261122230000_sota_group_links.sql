-- Sota Kece — group scratch links (22 Nov 2026).
-- Builds on scratch links (20261122210000). The sender can attach one of their own Koro to a link and
-- choose to be friends with whoever accepts it. Post the link in a church, family or team WhatsApp
-- group and everyone who comes in lands in the same Koro with the sender, instead of an empty app.
-- Accepting (bv_invite_accept) works for a brand-new member right after their room is made AND for an
-- existing member who opens the link, so nobody is left out. A block either way stops everything.
-- The Koro must be one the sender is in: nobody can pull people into a Koro they do not belong to.
-- Nothing here changes existing invites. Safe to run twice.

set search_path = '';

alter table bulavata.invites
  add column if not exists crew_id  bigint references bulavata.crews(id) on delete set null,
  add column if not exists befriend boolean not null default false;

-- ---------------------------------------------------------------- make a scratch link (member)
-- Same as 20261122210000 with two more choices: p_crew (a Koro the sender is in) and p_befriend.
drop function if exists public.bv_scratch_link_create(text, text, integer, text);
create or replace function public.bv_scratch_link_create(
  p_stem text, p_song_id text, p_song_start integer default 0, p_caption text default null,
  p_crew bigint default null, p_befriend boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c text := nullif(btrim(regexp_replace(coalesce(p_caption, ''), '\s+', ' ', 'g')), '');
  t text;
  p record;
  kid bigint; kname text; kemoji text;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select handle, display_name into p from bulavata.profiles where id = me;
  if not found then raise exception 'NOT_SIGNED_IN'; end if;
  if p_stem is null
     or p_stem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or split_part(p_stem, '/', 1) <> me::text then
    raise exception 'MEDIA_BAD';
  end if;
  if p_song_id is null or p_song_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' or coalesce(p_song_start, -1) not between 0 and 3600 then
    raise exception 'SONG_BAD';
  end if;
  if c is not null and char_length(c) > 140 then raise exception 'TOO_LONG'; end if;
  if p_crew is not null then
    select cr.id, cr.name, cr.emoji into kid, kname, kemoji from bulavata.crews cr
      where cr.id = p_crew and exists (select 1 from bulavata.crew_members m where m.crew_id = cr.id and m.member = me);
    if kid is null then raise exception 'NOT_IN_KORO'; end if;
  end if;
  if exists (select 1 from unnest(array['-under', '-cover', '-over']) n
             where not exists (select 1 from storage.objects o
                               where o.bucket_id = 'sota-scratch-links'
                                 and o.name ~ ('^' || p_stem || n || '\.(png|webp|jpg)$')
                                 and (o.owner = me or o.owner_id = me::text))) then
    raise exception 'MEDIA_MISSING';
  end if;
  if exists (select 1 from bulavata.invites where scratch_stem = p_stem) then raise exception 'MEDIA_BAD'; end if;
  if (select count(*) from bulavata.invites where sharer = me and scratch_stem is not null and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'LINK_LIMIT';
  end if;
  t := md5(gen_random_uuid()::text || clock_timestamp()::text || me::text);
  insert into bulavata.invites (token, sharer, label, scratch_stem, song_id, song_start, caption, crew_id, befriend)
    values (t, me, case when kid is not null then left('Song Scratch · ' || kname, 60) else 'Song Scratch' end,
            p_stem, p_song_id, p_song_start, c, p_crew, coalesce(p_befriend, false));
  return jsonb_build_object('token', t, 'path', '/i/' || t, 'handle', p.handle, 'display_name', p.display_name,
    'koro', case when kid is not null then jsonb_build_object('id', kid, 'name', kname, 'emoji', kemoji) end);
end $$;

-- ---------------------------------------------------------------- open an invite (anyone)
-- Same as 20261122210000 plus, when the link carries a Koro, its name, emoji and size, and whether
-- accepting makes you friends with the sender (so the page can say so before anyone joins).
create or replace function public.bv_invite_open(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i bulavata.invites%rowtype;
  card jsonb;
  files jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then return null; end if;
  select * into i from bulavata.invites where token = p_token;
  if not found then return null; end if;
  update bulavata.invites set opens = opens + 1 where token = i.token;
  select jsonb_build_object('handle', pr.handle, 'display_name', pr.display_name,
                            'avatar_emoji', pr.avatar_emoji, 'accent', pr.room_accent)
    into card from bulavata.profiles pr where pr.id = i.sharer;
  if i.scratch_stem is not null then
    select jsonb_object_agg(substring(o.name from '-(under|cover|over)\.[a-z]+$'), o.name) into files
      from storage.objects o
     where o.bucket_id = 'sota-scratch-links' and o.name ~ ('^' || i.scratch_stem || '-(under|cover|over)\.(png|webp|jpg)$');
    if files ? 'under' and files ? 'cover' and files ? 'over' then
      card := card || jsonb_build_object('scratch', jsonb_build_object(
        'files', files, 'song_id', i.song_id, 'song_start', i.song_start, 'caption', i.caption));
    end if;
  end if;
  if i.crew_id is not null then
    card := card || jsonb_build_object('koro', (select jsonb_build_object('name', cr.name, 'emoji', cr.emoji,
      'members', (select count(*) from bulavata.crew_members m where m.crew_id = cr.id))
      from bulavata.crews cr where cr.id = i.crew_id));
  end if;
  if i.befriend then card := card || jsonb_build_object('befriend', true); end if;
  return card;
end $$;

-- ---------------------------------------------------------------- accept an invite (member)
-- Called by the app once the person has a room: right after sign-up, or on their next visit if they
-- were already a member. Joins the link's Koro and, if the sender chose it, makes them friends.
-- Never for the sender themself; nothing at all if either has blocked the other.
-- Returns {koro: {id, name, emoji} | null, friends: bool, sharer: handle} or {} for a link that does nothing.
create or replace function public.bv_invite_accept(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  i bulavata.invites%rowtype;
  kid bigint; kname text; kemoji text;
  fr bulavata.friendships%rowtype;
  made_friends boolean := false;
  h text;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from bulavata.profiles where id = me) then raise exception 'NO_ROOM'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then return '{}'::jsonb; end if;
  select * into i from bulavata.invites where token = p_token;
  if not found or i.sharer = me or (i.crew_id is null and not i.befriend) then return '{}'::jsonb; end if;
  if exists (select 1 from bulavata.blocks b where (b.blocker = i.sharer and b.blocked = me) or (b.blocker = me and b.blocked = i.sharer)) then
    return '{}'::jsonb;
  end if;
  if i.crew_id is not null then
    select cr.id, cr.name, cr.emoji into kid, kname, kemoji from bulavata.crews cr where cr.id = i.crew_id;
    if kid is not null then
      insert into bulavata.crew_members (crew_id, member) values (kid, me) on conflict do nothing;
    end if;
  end if;
  if i.befriend then
    select * into fr from bulavata.friendships f
      where (f.requester = i.sharer and f.addressee = me) or (f.requester = me and f.addressee = i.sharer)
      limit 1;
    if not found then
      insert into bulavata.friendships (requester, addressee, status) values (i.sharer, me, 'accepted');
      made_friends := true;
    elsif fr.status = 'pending' then
      update bulavata.friendships set status = 'accepted' where id = fr.id;
      made_friends := true;
    end if;
    if made_friends then
      select handle into h from bulavata.profiles where id = me;
      perform bulavata.notify(i.sharer, me, 'friend_accepted', 'profile', 0, coalesce(h, ''));
    end if;
  end if;
  return jsonb_build_object(
    'koro', case when kid is not null then jsonb_build_object('id', kid, 'name', kname, 'emoji', kemoji) end,
    'friends', made_friends or exists (select 1 from bulavata.friendships f
                                       where f.status = 'accepted'
                                         and ((f.requester = i.sharer and f.addressee = me) or (f.requester = me and f.addressee = i.sharer))),
    'sharer', (select handle from bulavata.profiles where id = i.sharer));
end $$;

-- the Koro a member can attach to a link: the ones they are in (hubs included)
create or replace function public.bv_my_koro_for_links()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'emoji', c.emoji,
      'members', (select count(*) from bulavata.crew_members m2 where m2.crew_id = c.id)) order by c.name)
    from bulavata.crews c
    where c.id in (select m.crew_id from bulavata.crew_members m where m.member = (select auth.uid()))), '[]'::jsonb);
$$;

revoke execute on function
  public.bv_scratch_link_create(text, text, integer, text, bigint, boolean), public.bv_invite_open(text),
  public.bv_invite_accept(text), public.bv_my_koro_for_links()
  from public, anon;
grant execute on function
  public.bv_scratch_link_create(text, text, integer, text, bigint, boolean), public.bv_invite_accept(text), public.bv_my_koro_for_links()
  to authenticated;
grant execute on function public.bv_invite_open(text) to anon, authenticated;
