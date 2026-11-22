-- Close three table-rule holes found in the 22 Nov 2026 security review (after the move to the shared
-- dimau-core-ireland database). Each was confirmed on live in a rolled-back transaction, signed in as an
-- ordinary member, writing through the public bv_* views the app already uses:
--
-- 1. Join any Koro without its code. crew_members let a member insert a row for any crew_id as long as
--    member = themselves, so they could add themselves to any private Koro and read its messages.
--    The app joins and creates Koros only through bv_join_circle / bv_circle_create_group (and the
--    hub and old bv_join_crew functions), which run as the owner and check the code. Direct inserts and
--    updates are now closed; leaving (delete your own row) still works.
-- 2. Be anyone's friend. friendships let the requester insert a row already marked 'accepted', and
--    either side change any column. A member could make themselves a friend of anyone and see their
--    friends-only posts, stories, room and gifts. Now a request is always 'pending', only the person
--    asked can accept it, and the two people on a row cannot be changed.
-- 3. Tick your own "verified" badge. profiles let a member set human_verified and verify_method on
--    their own row; nothing else sets them. Members can still edit every other profile column.
--
-- Also: bv_join_crew was callable without signing in (it then failed on the empty member id).

-- 1. Koro membership only through the join and create functions ------------------------------------
drop policy if exists cm_ins on bulavata.crew_members;
revoke insert, update on bulavata.crew_members from anon, authenticated;

revoke execute on function public.bv_join_crew(text) from public, anon;
grant execute on function public.bv_join_crew(text) to authenticated;

-- 2. Friend requests start pending; only the person asked accepts --------------------------------------
drop policy if exists f_ins on bulavata.friendships;
create policy f_ins on bulavata.friendships for insert to authenticated
  with check (requester = (select auth.uid()) and status = 'pending');

drop policy if exists f_upd on bulavata.friendships;
create policy f_upd on bulavata.friendships for update to authenticated
  using (addressee = (select auth.uid()))
  with check (addressee = (select auth.uid()) and status = 'accepted');

revoke insert, update on bulavata.friendships from anon, authenticated;
grant insert (requester, addressee, status) on bulavata.friendships to authenticated;
grant update (status) on bulavata.friendships to authenticated;

-- 3. The verified badge is not self-service ------------------------------------------------------------
revoke insert, update on bulavata.profiles from anon, authenticated;
grant insert (id, handle, display_name, pronouns, bio, avatar_emoji, room_theme, room_accent, room_css,
              room_song, birth_year, age_band, room_bg, room_bg2, room_font)
  on bulavata.profiles to authenticated;
grant update (handle, display_name, pronouns, bio, avatar_emoji, room_theme, room_accent, room_css,
              room_song, birth_year, age_band, room_bg, room_bg2, room_font)
  on bulavata.profiles to authenticated;

-- 4. New members can make their profile again ----------------------------------------------------------
-- Found during the same review: public.bv_profiles shows age_band (and birth_year) only to the member
-- themself, through a CASE expression, so Postgres cannot write that column through the view. Every
-- sign-up path sends age_band (index.html sign-up and "make your room", revised/backend.mjs setup), so
-- every new profile insert failed with "cannot insert into column age_band of view bv_profiles".
-- This trigger does the insert into the table as the signed-in member, so the table's own rules still
-- apply (own row only, no verified badge). Columns left out keep their table defaults.
create or replace function bulavata.bv_profiles_insert()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  insert into bulavata.profiles (id, handle, display_name, pronouns, bio, avatar_emoji, room_theme,
                                 room_accent, room_css, room_song, birth_year, age_band)
  values (new.id, new.handle, coalesce(new.display_name, ''), coalesce(new.pronouns, ''),
          coalesce(new.bio, ''), coalesce(new.avatar_emoji, '🌺'), coalesce(new.room_theme, 'lagoon'),
          coalesce(new.room_accent, '#4FA8D8'), coalesce(new.room_css, ''), coalesce(new.room_song, ''),
          new.birth_year, coalesce(new.age_band, 'unconfirmed'))
  returning id, handle, display_name, pronouns, bio, avatar_emoji, room_theme, room_accent, room_css,
            room_song, human_verified, verify_method, birth_year, age_band, created_at, last_seen
  into new.id, new.handle, new.display_name, new.pronouns, new.bio, new.avatar_emoji, new.room_theme,
       new.room_accent, new.room_css, new.room_song, new.human_verified, new.verify_method,
       new.birth_year, new.age_band, new.created_at, new.last_seen;
  return new;
end $$;
revoke all on function bulavata.bv_profiles_insert() from public, anon, authenticated;

drop trigger if exists bv_profiles_insert on public.bv_profiles;
create trigger bv_profiles_insert instead of insert on public.bv_profiles
  for each row execute function bulavata.bv_profiles_insert();
