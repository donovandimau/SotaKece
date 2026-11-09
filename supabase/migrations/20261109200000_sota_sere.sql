-- Sota Kece — Sere (singing photo): a portrait that sings to a clip of audio.
-- The member picks a photo and a sound, the app trims a window of up to 60 seconds, the render runs
-- on a lip-sync model behind /api/sere (Replicate by default), and when it is done a Talanoa Wall
-- post appears by itself with the video on it. Mates can tip the maker (a free gift, same rules as
-- the gift shelf) and anyone can remix the sound with their own photo. Storage: three buckets —
-- sere-audio and sere-images (private, one folder per member) and sere-video (public, read-only
-- for members; only the server writes to it). Every read and write goes through bv_sere_* or the
-- security-invoker view; the rules live here, not in the browser.

-- ---------------------------------------------------------------- scenes (background / lighting presets)
create table bulavata.sere_scenes (
  id     text primary key check (id ~ '^[a-z0-9-]{2,32}$'),
  label  text not null,
  params jsonb not null default '{}'::jsonb,
  sort   integer not null default 0
);
insert into bulavata.sere_scenes (id, label, params, sort) values
  ('none',        'As it is',    '{}'::jsonb,                                         1),
  ('studio-soft', 'Studio',      '{"bg":"studio","light":"soft"}'::jsonb,             2),
  ('golden-hour', 'Golden hour', '{"bg":"keep","light":"warm"}'::jsonb,               3),
  ('neon',        'Neon night',  '{"bg":"neon","light":"rim"}'::jsonb,                4),
  ('bure-night',  'Bure night',  '{"bg":"bure","light":"lantern"}'::jsonb,            5),
  ('beach-day',   'Beach day',   '{"bg":"beach","light":"sun"}'::jsonb,               6);
alter table bulavata.sere_scenes enable row level security;
create policy sere_scenes_read on bulavata.sere_scenes for select to authenticated using (true);
grant select on bulavata.sere_scenes to authenticated;

-- ---------------------------------------------------------------- generations
create table bulavata.sere_media_generations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references bulavata.profiles(id) on delete cascade,
  audio_url         text not null,                       -- object path inside sere-audio  (<uid>/<id>.wav)
  source_image_url  text not null,                       -- object path inside sere-images (<uid>/<id>.jpg)
  output_video_url  text,                                -- public URL inside sere-video
  output_poster_url text,
  status            text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  scene_id          text not null default 'none' references bulavata.sere_scenes(id),
  caption           text check (caption is null or char_length(caption) <= 140),
  audio_duration_ms integer check (audio_duration_ms is null or audio_duration_ms between 1 and 600000),
  render_start_ms   integer not null default 0,
  render_end_ms     integer,
  provider          text,
  provider_job_id   text unique,
  progress          smallint not null default 0 check (progress between 0 and 100),
  error             text,
  attempts          smallint not null default 0,
  remix_of          uuid references bulavata.sere_media_generations(id) on delete set null,
  post_id           bigint,
  plays             integer not null default 0,
  tips_count        integer not null default 0,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz,
  check (render_end_ms is null or render_end_ms - render_start_ms between 1000 and 60000)
);
create index sere_gen_owner_idx  on bulavata.sere_media_generations (user_id, created_at desc);
create index sere_gen_open_idx   on bulavata.sere_media_generations (status, created_at) where status in ('pending','processing');
create index sere_gen_remix_idx  on bulavata.sere_media_generations (remix_of) where remix_of is not null;

alter table bulavata.talanoa_posts add column sere_id uuid references bulavata.sere_media_generations(id) on delete cascade;
create index talanoa_posts_sere_idx on bulavata.talanoa_posts (sere_id) where sere_id is not null;
alter table bulavata.sere_media_generations
  add constraint sere_gen_post_fk foreign key (post_id) references bulavata.talanoa_posts(id) on delete set null;

alter table bulavata.gifts add column sere_id uuid references bulavata.sere_media_generations(id) on delete set null;

-- Members read their own rows (also what Realtime checks before it delivers progress) and anything finished.
-- No insert/update/delete grants: writes go through bv_sere_* (members) or the service role (/api/sere).
alter table bulavata.sere_media_generations enable row level security;
create policy sere_gen_read on bulavata.sere_media_generations for select to authenticated
  using (user_id = (select auth.uid()) or status = 'completed');
grant select on bulavata.sere_media_generations to authenticated;

-- The server reads and updates through this view (service role bypasses RLS); members only ever see
-- what the policy above allows because the view runs as the caller.
create view public.bv_sere_media_generations with (security_invoker = true) as
  select * from bulavata.sere_media_generations;
grant select on public.bv_sere_media_generations to authenticated;
create view public.bv_sere_scenes with (security_invoker = true) as
  select id, label, params, sort from bulavata.sere_scenes order by sort;
grant select on public.bv_sere_scenes to authenticated;

-- ---------------------------------------------------------------- the post writes itself when the render lands
create or replace function bulavata.sere_autopost() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nid bigint;
begin
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    if new.post_id is null then
      insert into bulavata.talanoa_posts (author, body, sere_id)
        values (new.user_id, coalesce(nullif(btrim(new.caption), ''), '🎤 Sere'), new.id)
        returning id into nid;
      new.post_id := nid;
    end if;
  end if;
  return new;
end $$;
create trigger sere_autopost before update on bulavata.sere_media_generations
  for each row execute function bulavata.sere_autopost();

-- A tip is a gift with sere_id set; the counter lives on the generation row.
create or replace function bulavata.sere_count_tip() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update bulavata.sere_media_generations set tips_count = tips_count + 1 where id = new.sere_id;
  return new;
end $$;
create trigger sere_tip_count after insert on bulavata.gifts
  for each row when (new.sere_id is not null) execute function bulavata.sere_count_tip();

-- ---------------------------------------------------------------- member functions
-- Start a sere: checks the daily allowance (5 a day), writes the pending row, returns the paths the
-- browser uploads to. The audio is always a 16 kHz WAV the browser cut to the chosen window.
create or replace function public.bv_sere_create(
  p_image_ext text, p_duration_ms integer, p_start_ms integer default 0,
  p_scene text default 'none', p_caption text default null, p_remix_of uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  nid uuid := gen_random_uuid();
  ext text := lower(coalesce(p_image_ext, 'jpg'));
  used integer;
  s integer := greatest(coalesce(p_start_ms, 0), 0);
  e integer;
  parent bulavata.sere_media_generations%rowtype;
  audio_path text;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if ext not in ('jpg', 'png') then raise exception 'BAD_IMAGE'; end if;
  if p_duration_ms is null or p_duration_ms < 1000 or p_duration_ms > 600000 then raise exception 'BAD_AUDIO'; end if;
  if not exists (select 1 from bulavata.sere_scenes where id = coalesce(p_scene, 'none')) then raise exception 'BAD_SCENE'; end if;
  if p_remix_of is not null then
    select * into parent from bulavata.sere_media_generations where id = p_remix_of and status = 'completed';
    if not found then raise exception 'GONE'; end if;
    audio_path := parent.audio_url;                         -- /api/sere copies it into this member's folder
    s := parent.render_start_ms; e := parent.render_end_ms;
  else
    audio_path := me::text || '/' || nid::text || '.wav';
    e := least(s + 60000, p_duration_ms);
    if e - s < 1000 then raise exception 'BAD_WINDOW'; end if;
  end if;
  perform pg_advisory_xact_lock(hashtext('bv_sere:' || me::text));
  select count(*) into used from bulavata.sere_media_generations
    where user_id = me and created_at > now() - interval '24 hours' and status <> 'failed';
  if used >= 5 then raise exception 'OUT_OF_SERE'; end if;
  insert into bulavata.sere_media_generations
    (id, user_id, audio_url, source_image_url, scene_id, caption, audio_duration_ms, render_start_ms, render_end_ms, remix_of)
  values (nid, me, audio_path, me::text || '/' || nid::text || '.' || ext, coalesce(p_scene, 'none'),
          nullif(btrim(left(coalesce(p_caption, ''), 140)), ''),
          coalesce(parent.audio_duration_ms, p_duration_ms), s, e, p_remix_of);
  return jsonb_build_object('id', nid, 'audio_path', audio_path, 'image_path', me::text || '/' || nid::text || '.' || ext,
                            'remix', p_remix_of is not null, 'left', greatest(0, 4 - used));
end $$;

-- The maker's own list (resume after the app was closed): newest first, last 20.
create or replace function public.bv_sere_mine()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'status', g.status, 'progress', g.progress, 'error', g.error, 'caption', g.caption,
      'video', g.output_video_url, 'poster', g.output_poster_url, 'post_id', g.post_id, 'created_at', g.created_at)
    order by g.created_at desc), '[]'::jsonb)
  from (select * from bulavata.sere_media_generations where user_id = (select auth.uid())
        order by created_at desc limit 20) g;
$$;

-- Tip the maker: a free gift that points at the sere. Same rules as the gift shelf — mates only,
-- three a day, never yourself. Returns how many gifts are left today.
create or replace function public.bv_sere_tip(p_sere uuid, p_gift text, p_note text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  g bulavata.sere_media_generations%rowtype;
  used integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into g from bulavata.sere_media_generations where id = p_sere and status = 'completed';
  if not found then raise exception 'GONE'; end if;
  if g.user_id = me then raise exception 'SELF_GIFT'; end if;
  if not bulavata.gift_friends(me, g.user_id) then raise exception 'NOT_FRIENDS'; end if;
  perform pg_advisory_xact_lock(hashtext('bv_gift:' || me::text));
  used := bulavata.gifts_used(me);
  if used >= 3 then raise exception 'OUT_OF_GIFTS'; end if;
  insert into bulavata.gifts (giver, receiver, gift, note, sere_id)
    values (me, g.user_id, p_gift, nullif(btrim(left(coalesce(p_note, ''), 80)), ''), g.id);
  return greatest(0, 2 - used);
end $$;

-- One play, counted on the row (the browser calls this once per card per session).
create or replace function public.bv_sere_play(p_sere uuid)
returns void language sql security definer set search_path = '' as $$
  update bulavata.sere_media_generations set plays = plays + 1
   where id = p_sere and status = 'completed' and (select auth.uid()) is not null;
$$;

-- Remove your own sere: the wall post goes with it (cascade). Files are cleared by /api/sere.
create or replace function public.bv_sere_remove(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  delete from bulavata.sere_media_generations where id = p_id and user_id = me;
  if not found then raise exception 'NOT_YOURS'; end if;
end $$;

revoke execute on function
  public.bv_sere_create(text, integer, integer, text, text, uuid), public.bv_sere_mine(),
  public.bv_sere_tip(uuid, text, text), public.bv_sere_play(uuid), public.bv_sere_remove(uuid),
  bulavata.sere_autopost(), bulavata.sere_count_tip()
  from public, anon;
grant execute on function
  public.bv_sere_create(text, integer, integer, text, text, uuid), public.bv_sere_mine(),
  public.bv_sere_tip(uuid, text, text), public.bv_sere_play(uuid), public.bv_sere_remove(uuid)
  to authenticated;

-- ---------------------------------------------------------------- the wall shows the video
-- Same function as 20261109000000, plus a 'sere' object on posts that carry one.
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
                 from bulavata.sere_media_generations s where s.id = x.sere_id and s.status = 'completed')
      ) order by x.hot_score desc, case when p_reply_to is not null then x.created_at end asc, case when p_reply_to is not null then x.id end asc, x.created_at desc, x.id desc)
    from page x join bulavata.profiles pr on pr.id = x.author), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------- storage
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
      ('sere-audio',  'sere-audio',  false, 4194304, array['audio/wav']),
      ('sere-images', 'sere-images', false, 4928307, array['image/jpeg','image/png']),
      ('sere-video',  'sere-video',  true,  52428800, array['video/mp4','image/jpeg'])
    on conflict (id) do nothing;
    create policy "sere_audio_owner_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'sere-audio' and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy "sere_images_owner_insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'sere-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy "sere_inputs_owner_read" on storage.objects for select to authenticated
      using (bucket_id in ('sere-audio', 'sere-images') and (storage.foldername(name))[1] = (select auth.uid())::text);
    create policy "sere_video_public_read" on storage.objects for select to anon, authenticated
      using (bucket_id = 'sere-video');
  end if;
end $$;

-- ---------------------------------------------------------------- realtime (progress to the maker's phone)
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table bulavata.sere_media_generations;
  end if;
end $$;
