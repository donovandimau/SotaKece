-- Sere visibility + saved page design.
--
-- 1. A sere used to post itself to the Talanoa Wall the moment it finished, so a member could not try one
--    privately and a mocking sere made from someone else's photo went straight to every member.
--    Now each sere has a visibility: 'private' (only the maker; the default for new ones) or 'wall'.
--    Seres made before this migration keep 'wall' (they are already on the wall).
--    Members change it with bv_sere_set_visibility; going to 'wall' writes the wall post, going back to
--    'private' removes it. Private seres are no longer readable by other members.
-- 2. The page design (colours, font, density...) lived only in the browser. bulavata.member_prefs keeps one
--    JSON copy per member so it follows them to another phone. Wallpaper pictures stay on the device.

-- ---------------------------------------------------------------- 1. sere visibility
alter table bulavata.sere_media_generations
  add column if not exists visibility text not null default 'wall'
  check (visibility in ('private', 'wall'));
alter table bulavata.sere_media_generations alter column visibility set default 'private';

drop policy if exists sere_gen_read on bulavata.sere_media_generations;
create policy sere_gen_read on bulavata.sere_media_generations for select to authenticated
  using (user_id = (select auth.uid()) or (status = 'completed' and visibility = 'wall'));

create or replace function bulavata.sere_autopost() returns trigger
language plpgsql security definer set search_path = '' as $$
declare nid bigint;
begin
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    if new.post_id is null and new.visibility = 'wall' then
      insert into bulavata.talanoa_posts (author, body, sere_id)
        values (new.user_id, coalesce(nullif(btrim(new.caption), ''), '🎤 Sere'), new.id)
        returning id into nid;
      new.post_id := nid;
    end if;
  end if;
  return new;
end $$;

create or replace function public.bv_sere_set_visibility(p_id uuid, p_visibility text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  g bulavata.sere_media_generations%rowtype;
  nid bigint;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_visibility is null or p_visibility not in ('private', 'wall') then raise exception 'BAD_VISIBILITY'; end if;
  select * into g from bulavata.sere_media_generations where id = p_id and user_id = me for update;
  if not found then raise exception 'NOT_YOURS'; end if;
  if p_visibility = 'wall' and g.status = 'completed' and g.post_id is null then
    insert into bulavata.talanoa_posts (author, body, sere_id)
      values (me, coalesce(nullif(btrim(g.caption), ''), '🎤 Sere'), g.id)
      returning id into nid;
    update bulavata.sere_media_generations set visibility = 'wall', post_id = nid where id = g.id;
  elsif p_visibility = 'private' and g.post_id is not null then
    delete from bulavata.talanoa_posts where id = g.post_id;   -- sere_gen_post_fk sets post_id back to null
    update bulavata.sere_media_generations set visibility = 'private', post_id = null where id = g.id;
  else
    update bulavata.sere_media_generations set visibility = p_visibility where id = g.id;
  end if;
  return jsonb_build_object('id', g.id, 'visibility', p_visibility);
end $$;
revoke execute on function public.bv_sere_set_visibility(uuid, text) from public, anon;
grant execute on function public.bv_sere_set_visibility(uuid, text) to authenticated;

-- same list as before, plus visibility
create or replace function public.bv_sere_mine()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'status', g.status, 'progress', g.progress, 'error', g.error, 'caption', g.caption,
      'video', g.output_video_url, 'poster', g.output_poster_url, 'post_id', g.post_id,
      'visibility', g.visibility, 'created_at', g.created_at)
    order by g.created_at desc), '[]'::jsonb)
  from (select * from bulavata.sere_media_generations where user_id = (select auth.uid())
        order by created_at desc limit 20) g;
$$;

-- ---------------------------------------------------------------- 2. saved page design
create table if not exists bulavata.member_prefs (
  user_id     uuid primary key references bulavata.profiles(id) on delete cascade,  -- removed with "Delete my data"
  page_design jsonb not null default '{}'::jsonb check (pg_column_size(page_design) <= 20000),
  updated_at  timestamptz not null default now()
);
alter table bulavata.member_prefs enable row level security;
-- no table grants: members only go through the two functions below

create or replace function public.bv_prefs_get()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select jsonb_build_object('page_design', page_design, 'updated_at', updated_at)
                     from bulavata.member_prefs where user_id = (select auth.uid())), '{}'::jsonb);
$$;

create or replace function public.bv_prefs_save(p_page_design jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_page_design is null or jsonb_typeof(p_page_design) <> 'object' or pg_column_size(p_page_design) > 20000 then
    raise exception 'BAD_DESIGN';
  end if;
  insert into bulavata.member_prefs (user_id, page_design) values (me, p_page_design)
    on conflict (user_id) do update set page_design = excluded.page_design, updated_at = now();
end $$;
revoke execute on function public.bv_prefs_get(), public.bv_prefs_save(jsonb) from public, anon;
grant execute on function public.bv_prefs_get(), public.bv_prefs_save(jsonb) to authenticated;
