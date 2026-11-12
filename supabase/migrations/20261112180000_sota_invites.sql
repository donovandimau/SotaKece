-- Sota Kece — invite links (12 November 2026).
-- A member makes a named invite link (the name, e.g. "Auckland church youth", is only for them) and
-- sends it. Opening it shows a small public page; tapping through goes to sign-up with the link
-- remembered, exactly like a shared wall post (index.html rememberReferral/claimReferral). Each link
-- counts its opens and the people who joined through it, so the member can see which invite worked.
-- Builds on the share engine (20261110160000): a join is one row in bulavata.referrals, credited once,
-- never to oneself, only for an account under a day old, and the sharer hears about it in Activity.
-- No table is readable by anon; the public page reads one card through bv_invite_open, where the
-- token is the key.

create table bulavata.invites (
  token      text primary key check (token ~ '^[a-f0-9]{32}$'),
  sharer     uuid not null references bulavata.profiles(id) on delete cascade,
  label      text not null default '' check (length(label) <= 60),
  opens      integer not null default 0,
  joins      integer not null default 0,
  created_at timestamptz not null default now()
);
create index invites_sharer_idx on bulavata.invites (sharer, created_at desc);

alter table bulavata.invites enable row level security;
-- A member sees their own invite links; nothing else, nobody else.
create policy invites_own on bulavata.invites for select to authenticated using (sharer = (select auth.uid()));
grant select on bulavata.invites to authenticated;

-- A join through an invite is recorded on the same referrals row, pointing at the invite instead of a post link.
alter table bulavata.referrals add column invite text references bulavata.invites(token) on delete set null;

-- ---------------------------------------------------------------- make an invite (member)
-- A new link every time, so each group or person gets their own and the counts say which worked.
-- At most 50 per member. Errors: NOT_SIGNED_IN, TOO_MANY_INVITES.
create or replace function public.bv_invite_create(p_label text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  t text;
  l text := left(btrim(regexp_replace(coalesce(p_label, ''), '\s+', ' ', 'g')), 60);
  p record;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select handle, display_name into p from bulavata.profiles where id = me;
  if not found then raise exception 'NOT_SIGNED_IN'; end if;
  if (select count(*) from bulavata.invites where sharer = me) >= 50 then raise exception 'TOO_MANY_INVITES'; end if;
  t := md5(gen_random_uuid()::text || clock_timestamp()::text || me::text);
  insert into bulavata.invites (token, sharer, label) values (t, me, l);
  return jsonb_build_object('token', t, 'path', '/i/' || t, 'label', l, 'opens', 0, 'joins', 0,
    'handle', p.handle, 'display_name', p.display_name);
end $$;

-- ---------------------------------------------------------------- open an invite (anyone)
-- Who sent it, for the public page. Never the label. Counts the open. Null for anything that does not
-- match, so tokens cannot be probed.
create or replace function public.bv_invite_open(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i bulavata.invites%rowtype;
  card jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then return null; end if;
  select * into i from bulavata.invites where token = p_token;
  if not found then return null; end if;
  update bulavata.invites set opens = opens + 1 where token = i.token;
  select jsonb_build_object('handle', pr.handle, 'display_name', pr.display_name,
                            'avatar_emoji', pr.avatar_emoji, 'accent', pr.room_accent)
    into card from bulavata.profiles pr where pr.id = i.sharer;
  return card;
end $$;

-- ---------------------------------------------------------------- my invites (member)
--   bv_invites_mine() -> { totals: {invites, opens, joins},
--                          invites: [{label, path, opens, joins, created_at}]  newest first, 50 at most,
--                          joined:  [{handle, display_name, avatar_emoji, accent, label, created_at}]  newest first, 50 at most }
create or replace function public.bv_invites_mine()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  return jsonb_build_object(
    'totals', (select jsonb_build_object('invites', count(*), 'opens', coalesce(sum(i.opens), 0), 'joins', coalesce(sum(i.joins), 0))
                 from bulavata.invites i where i.sharer = me),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('label', x.label, 'path', '/i/' || x.token, 'opens', x.opens, 'joins', x.joins, 'created_at', x.created_at)
             order by x.created_at desc, x.token)
        from (select * from bulavata.invites where sharer = me order by created_at desc, token limit 50) x), '[]'::jsonb),
    'joined', coalesce((
      select jsonb_agg(jsonb_build_object('handle', pr.handle, 'display_name', pr.display_name, 'avatar_emoji', pr.avatar_emoji,
                                          'accent', pr.room_accent, 'label', i.label, 'created_at', r.created_at)
             order by r.created_at desc, r.id desc)
        from (select * from bulavata.referrals where sharer = me and invite is not null order by created_at desc, id desc limit 50) r
        join bulavata.profiles pr on pr.id = r.member
        join bulavata.invites i on i.token = r.invite), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------- credit a sign-up (new member)
-- Same rules as before, now for either kind of link: a shared wall post (talanoa_shares) or an invite.
create or replace function public.bv_referral_claim(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  s bulavata.talanoa_shares%rowtype;
  i bulavata.invites%rowtype;
  who uuid;
  h text;
  done boolean := false;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then return jsonb_build_object('claimed', false); end if;
  select * into s from bulavata.talanoa_shares where token = p_token;
  if found then
    who := s.sharer;
  else
    select * into i from bulavata.invites where token = p_token;
    if not found then return jsonb_build_object('claimed', false); end if;
    who := i.sharer;
  end if;
  if who = me then return jsonb_build_object('claimed', false); end if;
  if (select created_at from bulavata.profiles where id = me) < now() - interval '1 day' then
    return jsonb_build_object('claimed', false);
  end if;
  insert into bulavata.referrals (member, sharer, token, invite) values (me, who, s.token, i.token)
    on conflict (member) do nothing;
  done := found;
  if done then
    if s.token is not null then update bulavata.talanoa_shares set joins = joins + 1 where token = s.token;
    else update bulavata.invites set joins = joins + 1 where token = i.token; end if;
    select handle into h from bulavata.profiles where id = me;
    perform bulavata.notify(who, me, 'joined', 'profile', 0, coalesce(h, ''));
  end if;
  return jsonb_build_object('claimed', done, 'sharer', (select handle from bulavata.profiles where id = who));
end $$;

-- ---------------------------------------------------------------- share stats: wall-post joins only
-- People who joined through an invite are listed on the invite card, so "Your shared posts" leaves them out.
-- Same function as 20261112120000_sota_share_stats.sql except the `invite is null` filter.
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
        from (select * from bulavata.referrals where sharer = me and invite is null order by created_at desc, id desc limit 50) r
        join bulavata.profiles pr on pr.id = r.member
        left join bulavata.talanoa_shares sh on sh.token = r.token), '[]'::jsonb));
end $$;


revoke execute on function
  public.bv_invite_create(text), public.bv_invite_open(text), public.bv_invites_mine(), public.bv_referral_claim(text)
  from public, anon;
grant execute on function public.bv_invite_create(text), public.bv_invites_mine(), public.bv_referral_claim(text) to authenticated;
grant execute on function public.bv_invite_open(text) to anon, authenticated;
