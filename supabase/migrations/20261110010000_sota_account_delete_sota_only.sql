-- Account deletion, corrected (10 Nov 2026). Three faults in 20261109240000:
--  1. It deleted auth.users. The login is shared with the other Dimau apps
--     (FijiLearn, FHTB, MyFiji, BulaCars), so that wiped the member's data in
--     all of them and failed for anyone with a BulaCars listing. Owner
--     decision: the button removes Sota Kece and Sere only; the login stays.
--  2. It deleted from storage.objects. Supabase blocks direct deletes there
--     (storage.protect_delete), so every call failed. Files are removed
--     through the storage API by /api/account-delete, before and after.
--  3. It named the three circle tables directly; they are not in the live
--     database, so every call failed. They are now cleared only where present.
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

  if to_regclass('public.bv_circle_comments') is not null then
    execute 'delete from public.bv_circle_comments where author = $1' using me;
  end if;
  if to_regclass('public.bv_circle_people') is not null then
    execute 'delete from public.bv_circle_people where member = $1' using me;
  end if;
  if to_regclass('public.bv_circles') is not null then
    execute 'delete from public.bv_circles where host = $1' using me;
  end if;

  -- Every bulavata table hangs off the profile with ON DELETE CASCADE.
  delete from bulavata.profiles where id = me;
end
$$;

revoke execute on function public.bv_account_delete() from public, anon;
grant execute on function public.bv_account_delete() to authenticated;
