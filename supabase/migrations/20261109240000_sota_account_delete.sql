-- Self-service account deletion for Sota Kece / Sere (privacy page
-- /data-deletion.html; Meta's data-deletion requirement). The signed-in
-- member deletes their own account and everything stored with it. Tables
-- that reference bulavata.profiles(id) cascade; the three public circle
-- tables do not, so they are cleared first. Storage objects under the
-- member's folders and any they own are removed here as rows; the file bytes
-- are removed through the storage API by /api/account-delete, which calls
-- this function after the sweep and sweeps once more afterwards.
create or replace function public.bv_account_delete()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;

  delete from public.bv_circle_comments where author = me;
  delete from public.bv_circle_people where member = me;
  delete from public.bv_circles where host = me;

  delete from storage.objects
   where owner = me
      or owner_id = me::text
      or split_part(name, '/', 1) = me::text;

  delete from bulavata.profiles where id = me;
  delete from auth.users where id = me;
end
$$;

revoke execute on function public.bv_account_delete() from public, anon;
grant execute on function public.bv_account_delete() to authenticated;
