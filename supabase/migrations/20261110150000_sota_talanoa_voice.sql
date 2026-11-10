-- Sota Kece — voice notes on the Talanoa Wall (10 Nov 2026).
-- A post or reply may carry one short recording (60 seconds at most). The file lives in a new
-- public bucket, like singing-photo videos: the wall is open to every member, and a file can only be
-- found through its long random name. A member can only add or remove files in their own folder.
-- Nothing here changes existing posts. Safe to run twice.

alter table bulavata.talanoa_posts
  add column if not exists voice_path text,
  add column if not exists voice_seconds smallint;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'talanoa_posts_voice_ok') then
    alter table bulavata.talanoa_posts add constraint talanoa_posts_voice_ok check (
      (voice_path is null and voice_seconds is null)
      or (voice_path is not null and voice_seconds is not null and voice_seconds between 1 and 60
          and voice_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|m4a|ogg)$'
          and split_part(voice_path, '/', 1) = author::text));
  end if;
end $$;
create unique index if not exists talanoa_posts_voice_idx on bulavata.talanoa_posts (voice_path) where voice_path is not null;

-- ---------------------------------------------------------------- posting a voice note
create or replace function public.bv_talanoa_post_voice(p_path text, p_seconds integer, p_body text default null, p_reply_to bigint default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  b text := btrim(coalesce(p_body, ''));
  parent bulavata.talanoa_posts%rowtype;
  target bigint := p_reply_to;
  nid bigint;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_path is null or p_seconds is null or p_seconds < 1 or p_seconds > 60
     or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|m4a|ogg)$'
     or split_part(p_path, '/', 1) <> me::text then
    raise exception 'VOICE_BAD';
  end if;
  -- the recording must already be uploaded, by this member, and not attached to another post
  if not exists (select 1 from storage.objects o where o.bucket_id = 'talanoa-voice' and o.name = p_path and (o.owner = me or o.owner_id = me::text)) then
    raise exception 'VOICE_BAD';
  end if;
  if exists (select 1 from bulavata.talanoa_posts t where t.voice_path = p_path) then raise exception 'VOICE_BAD'; end if;
  if (select count(*) from bulavata.talanoa_posts t
      where t.author = me and t.voice_path is not null and t.created_at > now() - interval '24 hours') >= 30 then
    raise exception 'VOICE_LIMIT';
  end if;
  if b = '' then b := '🎙️ Voice note'; end if;
  if char_length(b) > 280 then raise exception 'TOO_LONG'; end if;
  if target is not null then
    select * into parent from bulavata.talanoa_posts where id = target;
    if not found then raise exception 'GONE'; end if;
    if parent.reply_to is not null then target := parent.reply_to; end if;
  end if;
  insert into bulavata.talanoa_posts (author, body, reply_to, voice_path, voice_seconds)
    values (me, b, target, p_path, p_seconds::smallint) returning id into nid;
  return public.bv_talanoa_feed('latest', now(), 1, 0, null, null, null, nid, null) -> 0;
end $$;

revoke execute on function public.bv_talanoa_post_voice(text, integer, text, bigint) from public, anon;
grant execute on function public.bv_talanoa_post_voice(text, integer, text, bigint) to authenticated;

-- ---------------------------------------------------------------- the feed now carries the voice note
-- Same function as before (20261109200000_sota_sere.sql) with one more field, 'voice'.
create or replace function public.bv_talanoa_feed(
  p_mode text default 'latest', p_as_of timestamptz default now(), p_limit integer default 20, p_offset integer default 0,
  p_cursor_created timestamptz default null, p_cursor_id bigint default null, p_since timestamptz default null,
  p_post_id bigint default null, p_reply_to bigint default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me  uuid := (select auth.uid());
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  hot boolean := p_mode = 'hot' and p_post_id is null and p_reply_to is null and p_since is null;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  return coalesce((
    with page as (
      select t.*,
        case when hot then (t.like_count + 2 * t.repost_count + 1.5 * t.reply_count + 1)::float8
                          / power(greatest(extract(epoch from (p_as_of - t.created_at)), 0) / 3600.0 + 2, 1.4)
             else 0::float8 end as hot_score
      from bulavata.talanoa_posts t
      where case when p_post_id  is not null then t.id = p_post_id
                 when p_reply_to is not null then t.reply_to = p_reply_to
                 else t.reply_to is null end
        and (p_post_id is not null or p_since is not null or t.created_at <= p_as_of)
        and (p_since is null or t.created_at > p_since)
        and (not hot or t.created_at > p_as_of - interval '72 hours')
        and (p_cursor_created is null or (t.created_at, t.id) < (p_cursor_created, p_cursor_id))
      order by hot_score desc,
               case when p_reply_to is not null then t.created_at end asc,
               case when p_reply_to is not null then t.id end asc,
               t.created_at desc, t.id desc
      limit lim offset case when hot then greatest(coalesce(p_offset, 0), 0) else 0 end)
    select jsonb_agg(jsonb_build_object(
        'id', x.id, 'author', x.author, 'handle', pr.handle, 'display_name', pr.display_name,
        'avatar_emoji', pr.avatar_emoji, 'accent', pr.room_accent,
        'body', x.body, 'created_at', x.created_at, 'reply_to', x.reply_to, 'quote_of', x.quote_of,
        'like_count', x.like_count, 'repost_count', x.repost_count, 'reply_count', x.reply_count,
        'hot', round(x.hot_score::numeric, 4),
        'mine', x.author = me,
        'i_liked',    exists (select 1 from bulavata.talanoa_likes   l where l.post_id = x.id and l.member = me),
        'i_reposted', exists (select 1 from bulavata.talanoa_reposts r where r.post_id = x.id and r.member = me),
        'quote', (select jsonb_build_object('id', q.id, 'body', q.body, 'created_at', q.created_at,
                                            'handle', qp.handle, 'display_name', qp.display_name, 'avatar_emoji', qp.avatar_emoji)
                  from bulavata.talanoa_posts q join bulavata.profiles qp on qp.id = q.author where q.id = x.quote_of),
        'sere', (select jsonb_build_object('id', s.id, 'video', s.output_video_url, 'poster', s.output_poster_url,
                                           'plays', s.plays, 'tips', s.tips_count, 'scene', s.scene_id,
                                           'seconds', round((s.render_end_ms - s.render_start_ms) / 1000.0),
                                           'remix_of', s.remix_of)
                 from bulavata.sere_media_generations s where s.id = x.sere_id and s.status = 'completed'),
        'voice', case when x.voice_path is not null then jsonb_build_object('path', x.voice_path, 'seconds', x.voice_seconds) end
      ) order by x.hot_score desc, case when p_reply_to is not null then x.created_at end asc, case when p_reply_to is not null then x.id end asc, x.created_at desc, x.id desc)
    from page x join bulavata.profiles pr on pr.id = x.author), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- storage
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('talanoa-voice', 'talanoa-voice', true, 1572864, array['audio/webm', 'audio/mp4', 'audio/ogg'])
    on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
    drop policy if exists "talanoa_voice_owner_insert" on storage.objects;
    create policy "talanoa_voice_owner_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'talanoa-voice' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "talanoa_voice_owner_delete" on storage.objects;
    create policy "talanoa_voice_owner_delete" on storage.objects for delete to authenticated
      using (bucket_id = 'talanoa-voice' and (storage.foldername(name))[1] = (select auth.uid())::text);
    drop policy if exists "talanoa_voice_public_read" on storage.objects;
    create policy "talanoa_voice_public_read" on storage.objects for select to anon, authenticated
      using (bucket_id = 'talanoa-voice');
  end if;
end $$;
