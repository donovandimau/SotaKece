-- Sota Kece platform objects outside its own schema, exported from live dimau-core-sydney on 2026-11-21 18:24 UTC.
-- Supabase-only (storage, realtime, pg_cron); not loaded by the PGlite rebuild test. Run after sota_kece_schema.sql.
-- Policy expressions below name public.bv_* views without a schema, so public must be on the search path.
set search_path = public, extensions;

-- Storage buckets (files themselves are not included)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('bv-room-media', 'bv-room-media', 'f', 6291456, '{audio/mpeg,audio/mp4,audio/ogg,audio/wav,image/jpeg,image/png,image/webp}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('sere-audio', 'sere-audio', 'f', 4194304, '{audio/wav}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('sere-images', 'sere-images', 'f', 4928307, '{image/jpeg,image/png}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('sere-video', 'sere-video', 't', 52428800, '{video/mp4,image/jpeg}'::text[]) on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('talanoa-voice', 'talanoa-voice', 't', 1572864, '{audio/webm,audio/mp4,audio/ogg}'::text[]) on conflict (id) do nothing;

-- Storage policies
drop policy if exists sere_audio_owner_insert on storage.objects;
create policy sere_audio_owner_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'sere-audio'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

drop policy if exists sere_images_owner_insert on storage.objects;
create policy sere_images_owner_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'sere-images'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

drop policy if exists sere_inputs_owner_read on storage.objects;
create policy sere_inputs_owner_read on storage.objects as permissive for select to authenticated using (((bucket_id = ANY (ARRAY['sere-audio'::text, 'sere-images'::text])) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

drop policy if exists sota_room_media_friends_read on storage.objects;
create policy sota_room_media_friends_read on storage.objects as permissive for select to authenticated using (((bucket_id = 'bv-room-media'::text) AND (((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) OR (EXISTS ( SELECT 1
   FROM bv_friendships friendship
  WHERE ((friendship.status = 'accepted'::text) AND (((friendship.requester = ( SELECT auth.uid() AS uid)) AND ((friendship.addressee)::text = (storage.foldername(objects.name))[1])) OR ((friendship.addressee = ( SELECT auth.uid() AS uid)) AND ((friendship.requester)::text = (storage.foldername(objects.name))[1])))))))));

drop policy if exists sota_room_media_owner_delete on storage.objects;
create policy sota_room_media_owner_delete on storage.objects as permissive for delete to authenticated using (((bucket_id = 'bv-room-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

drop policy if exists sota_room_media_owner_insert on storage.objects;
create policy sota_room_media_owner_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'bv-room-media'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text) AND ((storage.foldername(name))[2] = ANY (ARRAY['music'::text, 'covers'::text]))));

drop policy if exists talanoa_voice_owner_delete on storage.objects;
create policy talanoa_voice_owner_delete on storage.objects as permissive for delete to authenticated using (((bucket_id = 'talanoa-voice'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

drop policy if exists talanoa_voice_owner_insert on storage.objects;
create policy talanoa_voice_owner_insert on storage.objects as permissive for insert to authenticated with check (((bucket_id = 'talanoa-voice'::text) AND ((storage.foldername(name))[1] = (( SELECT auth.uid() AS uid))::text)));

-- Realtime
alter publication supabase_realtime add table bulavata.sere_media_generations;
alter publication supabase_realtime add table bulavata.talanoa_posts;

-- Scheduled jobs (pg_cron)
select cron.schedule('sota-koro-vanish-sweep', '*/10 * * * *', 'delete from bulavata.crew_messages where expires_at < now()');
