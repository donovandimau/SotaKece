-- Sota Kece — Stories with real media (22 Nov 2026).
-- Stories already exist (20261031140000_sota_social_plus.sql): friends-only, close friends, 24 hours,
-- reactions, views, highlights. Until now a story could only be text or a pasted image link.
-- This adds stories made in Song Scratch:
--   video   : the saved story video (with the music)          files: <stem>.mp4 | <stem>.webm
--   image   : a picture                                        files: <stem>.png | .webp | .jpg
--   scratch : friends scratch it themselves to hear the song   files: <stem>-under.*, <stem>-cover.*, <stem>-over.*
-- Files live in a new PRIVATE bucket. A file can be read only while its story can be seen
-- (the author always; friends / close friends until it expires, or for good once it is a highlight).
-- A file is named "<member id>/<story uuid>…", so a member can only add or remove their own.
-- Nothing here changes existing rows. Safe to run twice.

set search_path = '';

alter table bulavata.stories
  add column if not exists media_path text,
  add column if not exists media_kind text,
  add column if not exists song_id    text,
  add column if not exists song_start integer;

do $$ begin
  -- a story needs words, a link or a file
  if exists (select 1 from pg_constraint where conname = 'stories_check' and conrelid = 'bulavata.stories'::regclass) then
    alter table bulavata.stories drop constraint stories_check;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stories_has_content') then
    alter table bulavata.stories add constraint stories_has_content
      check (body is not null or media_url is not null or media_path is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stories_media_ok') then
    alter table bulavata.stories add constraint stories_media_ok check (
      (media_path is null and media_kind is null)
      or (media_kind in ('video', 'image', 'scratch')
          and media_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and split_part(media_path, '/', 1) = author::text));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'stories_song_ok') then
    alter table bulavata.stories add constraint stories_song_ok check (
      (song_id is null and song_start is null)
      or (song_id ~ '^[a-z0-9][a-z0-9-]{0,79}$' and song_start between 0 and 3600));
  end if;
end $$;
create unique index if not exists stories_media_path_idx on bulavata.stories (media_path) where media_path is not null;

-- ---------------------------------------------------------------- who may read a story file
-- p_name is the object name in the bucket: "<member id>/<story uuid><suffix>".
create or replace function bulavata.can_see_story_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from bulavata.stories s
    where s.media_path = split_part(p_name, '/', 1) || '/' || left(split_part(p_name, '/', 2), 36)
      and (s.author = (select auth.uid())
           or ((s.expires_at > now() or s.highlight_title is not null)
               and bulavata.can_see_moment(s.author, s.audience))));
$$;
revoke execute on function bulavata.can_see_story_file(text) from public, anon;
grant execute on function bulavata.can_see_story_file(text) to authenticated;

-- ---------------------------------------------------------------- posting
create or replace function public.bv_story_post_media(
  p_stem text, p_kind text, p_body text default null, p_audience text default 'friends',
  p_song_id text default null, p_song_start integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  b text := nullif(btrim(coalesce(p_body, '')), '');
  sid bigint;
  need text[];
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_kind not in ('video', 'image', 'scratch') then raise exception 'MEDIA_BAD'; end if;
  if p_audience not in ('friends', 'close') then raise exception 'AUDIENCE_BAD'; end if;
  if b is not null and char_length(b) > 300 then raise exception 'TOO_LONG'; end if;
  if p_stem is null
     or p_stem !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or split_part(p_stem, '/', 1) <> me::text then
    raise exception 'MEDIA_BAD';
  end if;
  if (p_song_id is null) <> (p_song_start is null)
     or (p_song_id is not null and (p_song_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' or p_song_start not between 0 and 3600)) then
    raise exception 'SONG_BAD';
  end if;
  if p_kind = 'scratch' and p_song_id is null then raise exception 'SONG_BAD'; end if;
  -- the files must already be uploaded by this member
  need := case p_kind when 'scratch' then array['-under', '-cover', '-over'] else array[''] end;
  if exists (select 1 from unnest(need) n
             where not exists (select 1 from storage.objects o
                               where o.bucket_id = 'sota-stories'
                                 and o.name ~ ('^' || p_stem || n || '\.(mp4|webm|png|webp|jpg)$')
                                 and (o.owner = me or o.owner_id = me::text))) then
    raise exception 'MEDIA_MISSING';
  end if;
  if exists (select 1 from bulavata.stories where media_path = p_stem) then raise exception 'MEDIA_BAD'; end if;
  if (select count(*) from bulavata.stories where author = me and created_at > now() - interval '24 hours') >= 30 then
    raise exception 'STORY_LIMIT';
  end if;
  insert into bulavata.stories (author, kind, body, media_path, media_kind, song_id, song_start, audience)
    values (me, 'story', b, p_stem, p_kind, p_song_id, p_song_start, p_audience)
    returning id into sid;
  return jsonb_build_object('id', sid);
end $$;

-- Expired stories that are not highlights: their rows go, and the caller gets the file stems back
-- so the app can remove the files too (members can delete only their own folder).
create or replace function public.bv_story_tidy()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid()); stems jsonb;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  with gone as (
    delete from bulavata.stories
    where author = me and expires_at < now() - interval '1 hour' and highlight_title is null
    returning media_path)
  select coalesce(jsonb_agg(media_path) filter (where media_path is not null), '[]'::jsonb) into stems from gone;
  return stems;
end $$;

-- Who has seen my story (author only), with their reaction.
create or replace function public.bv_story_viewers(p_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_agg(jsonb_build_object(
      'handle', p.handle, 'display_name', p.display_name, 'avatar_emoji', p.avatar_emoji, 'seen_at', v.seen_at,
      'reaction', (select r.reaction from bulavata.reactions r where r.target_kind = 'story' and r.target_id = v.story_id and r.giver = v.viewer))
      order by v.seen_at desc)
    from bulavata.story_views v join bulavata.profiles p on p.id = v.viewer
    where v.story_id = p_id
      and exists (select 1 from bulavata.stories s where s.id = p_id and s.author = (select auth.uid()))), '[]'::jsonb);
$$;

-- ---------------------------------------------------------------- reads now carry the media
-- Same as the live bv_stories (baseline 20261121195543) with four more fields on each item.
create or replace function public.bv_stories()
returns jsonb language sql stable security definer set search_path = '' as $$
  with live as (
    select s.* from bulavata.stories s
    where s.expires_at > now()
      and (s.author = (select auth.uid()) or s.author in (select c.id from bulavata.my_circle() c))
      and bulavata.can_see_moment(s.author, s.audience))
  select coalesce((select jsonb_agg(person order by (person->>'latest') desc) from (
    select jsonb_build_object('author', l.author, 'handle', p.handle, 'display_name', p.display_name,
      'avatar_emoji', p.avatar_emoji, 'accent', p.room_accent, 'is_me', l.author = (select auth.uid()),
      'latest', max(l.created_at),
      'all_seen', bool_and(exists (select 1 from bulavata.story_views v where v.story_id = l.id and v.viewer = (select auth.uid()))),
      'note', (select jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at) from live n
               where n.author = l.author and n.kind = 'note' order by n.created_at desc limit 1),
      'items', (select jsonb_agg(jsonb_build_object('id', i.id, 'body', i.body, 'media_url', i.media_url, 'audience', i.audience,
                  'media_path', i.media_path, 'media_kind', i.media_kind, 'song_id', i.song_id, 'song_start', i.song_start,
                  'created_at', i.created_at, 'expires_at', i.expires_at,
                  'seen', exists (select 1 from bulavata.story_views v where v.story_id = i.id and v.viewer = (select auth.uid())),
                  'views', case when i.author = (select auth.uid()) then (select count(*) from bulavata.story_views v where v.story_id = i.id) end,
                  'reactions', bulavata.reaction_summary('story', i.id)) order by i.created_at)
                from live i where i.author = l.author and i.kind = 'story')) person
    from live l join bulavata.profiles p on p.id = l.author group by l.author, p.handle, p.display_name, p.avatar_emoji, p.room_accent) x), '[]'::jsonb);
$$;

create or replace function public.bv_highlights(p_owner uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.highlight_title, 'body', s.body, 'media_url', s.media_url,
      'media_path', s.media_path, 'media_kind', s.media_kind, 'song_id', s.song_id, 'song_start', s.song_start,
      'created_at', s.created_at) order by s.created_at desc)
    from bulavata.stories s where s.author = p_owner and s.highlight_title is not null and bulavata.can_see_moment(s.author, s.audience)), '[]'::jsonb);
$$;

revoke execute on function
  public.bv_story_post_media(text, text, text, text, text, integer), public.bv_story_tidy(), public.bv_story_viewers(bigint),
  public.bv_stories(), public.bv_highlights(uuid)
  from public, anon;
grant execute on function
  public.bv_story_post_media(text, text, text, text, text, integer), public.bv_story_tidy(), public.bv_story_viewers(bigint),
  public.bv_stories(), public.bv_highlights(uuid)
  to authenticated;

-- ---------------------------------------------------------------- storage
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('sota-stories', 'sota-stories', false, 26214400, array['video/mp4', 'video/webm', 'image/png', 'image/webp', 'image/jpeg'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    drop policy if exists "sota_stories_owner_insert" on storage.objects;
    create policy "sota_stories_owner_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'sota-stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "sota_stories_owner_delete" on storage.objects;
    create policy "sota_stories_owner_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'sota-stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "sota_stories_read" on storage.objects;
    create policy "sota_stories_read" on storage.objects for select to authenticated
      using (bucket_id = 'sota-stories'
             and ((storage.foldername(name))[1] = (select auth.uid())::text or bulavata.can_see_story_file(name)));
  end if;
end $$;
