-- Read-only export of Sota Kece's storage buckets, storage policies, realtime tables and pg_cron job.
-- Output column c is the text of ../sota_kece_platform.sql. See ../README.md.
with pol as (select p.oid, p.polname, p.polpermissive, p.polcmd, p.polroles, p.polqual, p.polwithcheck, p.polrelid from pg_policy p where p.polrelid='storage.objects'::regclass and p.polname in ('sere_audio_owner_insert','sere_images_owner_insert','sere_inputs_owner_read','talanoa_voice_owner_insert','talanoa_voice_owner_delete','sota_room_media_owner_insert','sota_room_media_owner_delete','sota_room_media_friends_read'))
select
'-- Sota Kece platform objects outside its own schema, exported from live dimau-core-sydney on ' || to_char(now() at time zone 'utc','YYYY-MM-DD HH24:MI') || E' UTC.\n-- Supabase-only (storage, realtime, pg_cron); not loaded by the PGlite rebuild test. Run after sota_kece_schema.sql.\n-- Policy expressions below name public.bv_* views without a schema, so public must be on the search path.\nset search_path = public, extensions;\n\n-- Storage buckets (files themselves are not included)\n' ||
(select string_agg(format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %s, %s) on conflict (id) do nothing;', id, name, public, coalesce(file_size_limit::text,'null'), coalesce(quote_literal(allowed_mime_types::text)||'::text[]','null')), E'\n' order by id) from storage.buckets where id in ('bv-room-media','talanoa-voice','sere-audio','sere-images','sere-video','sere-inputs')) ||
E'\n\n-- Storage policies\n' ||
(select string_agg(format('drop policy if exists %1$I on storage.objects;' || E'\n' || 'create policy %1$I on storage.objects as %2$s for %3$s to %4$s%5$s%6$s;', polname,
  case when polpermissive then 'permissive' else 'restrictive' end,
  case polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
  (select string_agg(case when x=0 then 'public' else quote_ident(pg_get_userbyid(x)) end, ', ') from unnest(polroles) x),
  coalesce(' using (' || pg_get_expr(polqual, polrelid) || ')', ''), coalesce(' with check (' || pg_get_expr(polwithcheck, polrelid) || ')', '')), E'\n\n' order by polname) from pol) ||
E'\n\n-- Realtime\n' ||
(select string_agg(format('alter publication supabase_realtime add table %I.%I;', schemaname, tablename), E'\n' order by tablename) from pg_publication_tables where pubname='supabase_realtime' and schemaname='bulavata') ||
E'\n\n-- Scheduled jobs (pg_cron)\n' ||
(select string_agg(format('select cron.schedule(%L, %L, %L);', jobname, schedule, command), E'\n' order by jobname) from cron.job where jobname='sota-koro-vanish-sweep') || E'\n' as c;
