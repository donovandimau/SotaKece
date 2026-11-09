-- Sere: the server (/api/sere, service role) reads and updates jobs through the view, so it needs
-- the grants too. Applied by Donovan in the SQL editor on dimau-core-sydney, 9 Nov 2026 19:57 UTC.
grant usage on schema bulavata to service_role;
grant select, update on bulavata.sere_media_generations to service_role;
grant select on bulavata.sere_scenes to service_role;
grant select, update on public.bv_sere_media_generations to service_role;
grant select on public.bv_sere_scenes to service_role;
