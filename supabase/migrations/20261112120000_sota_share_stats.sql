-- Share stats (12 November 2026): a member's own shared wall posts, how often each link was opened,
-- and who joined Sota Kece through them. Read-only. Everything here was already readable by the
-- member through the table policies on bulavata.talanoa_shares and bulavata.referrals; this function
-- just gathers it in one call, because the bulavata schema is not exposed to the app's API.
--
--   bv_share_stats()  ->  { totals: {links, opens, joins},
--                           links:  [{post_id, path, body, opens, joins, created_at}]  newest first, 50 at most
--                           joined: [{handle, display_name, avatar_emoji, accent, post_id, created_at}]  newest first, 50 at most }
-- Errors: NOT_SIGNED_IN.

create or replace function public.bv_share_stats()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  return jsonb_build_object(
    'totals', (select jsonb_build_object('links', count(*), 'opens', coalesce(sum(s.opens), 0), 'joins', coalesce(sum(s.joins), 0))
                 from bulavata.talanoa_shares s where s.sharer = me),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
               'post_id', x.post_id, 'path', '/p/' || x.post_id::text || '/' || x.token,
               'body', left(coalesce(p.body, ''), 80), 'opens', x.opens, 'joins', x.joins, 'created_at', x.created_at)
             order by x.created_at desc, x.post_id desc)
        from (select * from bulavata.talanoa_shares where sharer = me order by created_at desc, post_id desc limit 50) x
        join bulavata.talanoa_posts p on p.id = x.post_id), '[]'::jsonb),
    'joined', coalesce((
      select jsonb_agg(jsonb_build_object(
               'handle', pr.handle, 'display_name', pr.display_name, 'avatar_emoji', pr.avatar_emoji, 'accent', pr.room_accent,
               'post_id', sh.post_id, 'created_at', r.created_at)
             order by r.created_at desc, r.id desc)
        from (select * from bulavata.referrals where sharer = me order by created_at desc, id desc limit 50) r
        join bulavata.profiles pr on pr.id = r.member
        left join bulavata.talanoa_shares sh on sh.token = r.token), '[]'::jsonb));
end $$;

revoke all on function public.bv_share_stats() from public, anon;
grant execute on function public.bv_share_stats() to authenticated;
