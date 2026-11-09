-- Sere: two render engines ("quick" = SadTalker, "lifelike" = MEMO) and the "Say it" path
-- (typed words → voice → sere). bv_sere_create gains p_engine; the old signature is dropped so
-- the API has exactly one function of that name.
alter table bulavata.sere_media_generations
  add column engine text not null default 'quick' check (engine in ('quick','lifelike'));
-- the view was built from "select *" at creation time, so it has to be rebuilt to see the new column
create or replace view public.bv_sere_media_generations with (security_invoker = true) as
  select * from bulavata.sere_media_generations;

drop function if exists public.bv_sere_create(text, integer, integer, text, text, uuid);

create or replace function public.bv_sere_create(
  p_image_ext text, p_duration_ms integer, p_start_ms integer default 0,
  p_scene text default 'none', p_caption text default null, p_remix_of uuid default null,
  p_engine text default 'quick')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  nid uuid := gen_random_uuid();
  ext text := lower(coalesce(p_image_ext, 'jpg'));
  eng text := case when p_engine in ('quick','lifelike') then p_engine else 'quick' end;
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
    audio_path := parent.audio_url;
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
    (id, user_id, audio_url, source_image_url, scene_id, caption, audio_duration_ms, render_start_ms, render_end_ms, remix_of, engine)
  values (nid, me, audio_path, me::text || '/' || nid::text || '.' || ext, coalesce(p_scene, 'none'),
          nullif(btrim(left(coalesce(p_caption, ''), 140)), ''),
          coalesce(parent.audio_duration_ms, p_duration_ms), s, e, p_remix_of, eng);
  return jsonb_build_object('id', nid, 'audio_path', audio_path, 'image_path', me::text || '/' || nid::text || '.' || ext,
                            'remix', p_remix_of is not null, 'engine', eng, 'left', greatest(0, 4 - used));
end $$;
revoke execute on function public.bv_sere_create(text, integer, integer, text, text, uuid, text) from public, anon;
grant execute on function public.bv_sere_create(text, integer, integer, text, text, uuid, text) to authenticated;
