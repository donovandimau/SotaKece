-- Sere: two render engines ("quick" = SadTalker, "lifelike" = MEMO) and the "Say it" path.
-- Kept short so it can be typed into the SQL editor: the 6-argument bv_sere_create stays as it is,
-- and a 7-argument version (with p_engine) wraps it and records the engine on the new row.
alter table bulavata.sere_media_generations
  add column if not exists engine text not null default 'quick' check (engine in ('quick','lifelike'));
-- the view was built from "select *" at creation time, so it has to be rebuilt to see the new column
create or replace view public.bv_sere_media_generations with (security_invoker = true) as
  select * from bulavata.sere_media_generations;
grant select, update on public.bv_sere_media_generations to service_role;

create or replace function public.bv_sere_create(
  p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid, p_engine text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb; eng text := case when p_engine in ('quick','lifelike') then p_engine else 'quick' end;
begin
  r := public.bv_sere_create(p_image_ext, p_duration_ms, p_start_ms, p_scene, p_caption, p_remix_of);
  update bulavata.sere_media_generations set engine = eng where id = (r->>'id')::uuid;
  return r || jsonb_build_object('engine', eng);
end $$;
revoke execute on function public.bv_sere_create(text, integer, integer, text, text, uuid, text) from public, anon;
grant execute on function public.bv_sere_create(text, integer, integer, text, text, uuid, text) to authenticated;
