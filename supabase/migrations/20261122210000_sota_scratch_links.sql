-- Sota Kece — shareable scratch links (22 Nov 2026).
-- A Song Scratch story can leave the app as a link that works for anyone, signed in or not:
-- the friend scratches the cover away, hears the song, and is asked to join. A scratch link IS an
-- invite (bulavata.invites, 20261112180000): same /i/<token> page, same open and join counts, and a
-- new member who joins through it is credited to the sender, who hears about it in Activity.
-- The three still layers live in a PUBLIC bucket under the sender's folder with random names (like
-- Talanoa voice notes and singing-photo videos): the link has to work for people with no account.
-- Nothing here changes existing invites. Safe to run twice.

set search_path = '';

alter table bulavata.invites
  add column if not exists scratch_stem text,
  add column if not exists song_id      text,
  add column if not exists song_start   integer,
  add column if not exists caption      text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'invites_scratch_ok') then
    alter table bulavata.invites add constraint invites_scratch_ok check (
      (scratch_stem is null and song_id is null and song_start is null and caption is null)
      or (scratch_stem ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and split_part(scratch_stem, '/', 1) = sharer::text
          and song_id ~ '^[a-z0-9][a-z0-9-]{0,79}$' and song_start between 0 and 3600
          and (caption is null or char_length(caption) <= 140)));
  end if;
end $$;
create unique index if not exists invites_scratch_stem_idx on bulavata.invites (scratch_stem) where scratch_stem is not null;

-- ---------------------------------------------------------------- make a scratch link (member)
-- The three files must already be uploaded by the member. 30 a day. Errors: NOT_SIGNED_IN, MEDIA_BAD,
-- MEDIA_MISSING, SONG_BAD, TOO_LONG, LINK_LIMIT.
create or replace function public.bv_scratch_link_create(
  p_stem text, p_song_id text, p_song_start integer default 0, p_caption text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  c text := nullif(btrim(regexp_replace(coalesce(p_caption, ''), '\s+', ' ', 'g')), '');
  t text;
  p record;
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
  insert into bulavata.invites (token, sharer, label, scratch_stem, song_id, song_start, caption)
    values (t, me, 'Song Scratch', p_stem, p_song_id, p_song_start, c);
  return jsonb_build_object('token', t, 'path', '/i/' || t, 'handle', p.handle, 'display_name', p.display_name);
end $$;

-- ---------------------------------------------------------------- named invites keep their own limit
-- Same as the live bv_invite_create (20261112180000) except that scratch links do not count towards the 50.
create or replace function public.bv_invite_create(p_label text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  t text;
  l text := left(btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g')), 60);
  p record;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select handle, display_name into p from bulavata.profiles where id = me;
  if not found then raise exception 'NOT_SIGNED_IN'; end if;
  if (select count(*) from bulavata.invites where sharer = me and scratch_stem is null) >= 50 then raise exception 'TOO_MANY_INVITES'; end if;
  t := md5(gen_random_uuid()::text || clock_timestamp()::text || me::text);
  insert into bulavata.invites (token, sharer, label) values (t, me, l);
  return jsonb_build_object('token', t, 'path', '/i/' || t, 'label', l, 'opens', 0, 'joins', 0,
    'handle', p.handle, 'display_name', p.display_name);
end $$;

-- ---------------------------------------------------------------- open an invite (anyone)
-- Same as before (20261112180000) plus, for a scratch link, the three file names, the song and the words.
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
  return card;
end $$;

revoke execute on function public.bv_scratch_link_create(text, text, integer, text), public.bv_invite_create(text), public.bv_invite_open(text) from public, anon;
grant execute on function public.bv_scratch_link_create(text, text, integer, text), public.bv_invite_create(text) to authenticated;
grant execute on function public.bv_invite_open(text) to anon, authenticated;

-- ---------------------------------------------------------------- storage
-- Public to read (the link works without an account); a member adds or removes files only in their own
-- folder. No list rule for anyone else, so the bucket cannot be browsed.
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('sota-scratch-links', 'sota-scratch-links', true, 8388608, array['image/png', 'image/webp', 'image/jpeg'])
    on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    drop policy if exists "sota_scratch_links_owner_insert" on storage.objects;
    create policy "sota_scratch_links_owner_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'sota-scratch-links' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "sota_scratch_links_owner_read" on storage.objects;
    create policy "sota_scratch_links_owner_read" on storage.objects for select to authenticated
      using (bucket_id = 'sota-scratch-links' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "sota_scratch_links_owner_delete" on storage.objects;
    create policy "sota_scratch_links_owner_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'sota-scratch-links' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;
