-- Sota Kece database schema, exported from live dimau-core-sydney (aqfzpaczyodhugsgqvxi) on 2026-11-21 18:31 UTC.
-- Generated from the system catalogue by a read-only query (see supabase/baseline/README.md). Do not hand-edit: re-export instead.
-- Covers schemas bulavata and bulavata_talanoa_private plus the public bv_*/sota_* functions, views and tables. Storage, realtime and cron are in sota_kece_platform.sql.
-- Needs: roles anon, authenticated, service_role; auth.uid(); auth.users(id); extensions.digest / extensions.gen_random_bytes (pgcrypto); storage.objects.

set check_function_bodies = off;
-- Column defaults call pgcrypto without a schema (as Supabase allows), so extensions must be on the path.
set search_path = public, extensions;
create schema if not exists bulavata;
create schema if not exists bulavata_talanoa_private;

create sequence if not exists bulavata.friendships_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.pulses_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.moments_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.wall_posts_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.luv_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.crews_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.crew_messages_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.sparks_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.spark_answers_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create sequence if not exists bulavata.pinned_items_id_seq as bigint start 1 increment 1 minvalue 1 maxvalue 9223372036854775807 cache 1;

create table if not exists bulavata.profiles (
  id uuid not null,
  handle text not null,
  display_name text default ''::text not null,
  pronouns text default ''::text,
  bio text default ''::text,
  avatar_emoji text default '🌺'::text,
  room_theme text default 'lagoon'::text not null,
  room_accent text default '#4FA8D8'::text not null,
  room_css text default ''::text,
  room_song text default ''::text,
  human_verified boolean default false not null,
  verify_method text,
  birth_year integer,
  age_band text default 'unconfirmed'::text not null,
  created_at timestamp with time zone default now() not null,
  last_seen timestamp with time zone default now() not null,
  room_bg text default '#87CEEB'::text not null,
  room_bg2 text default '#CFEEFB'::text not null,
  room_font text default 'Lexend'::text not null
);

create table if not exists bulavata.friendships (
  id bigint default nextval('bulavata.friendships_id_seq'::regclass) not null,
  requester uuid not null,
  addressee uuid not null,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.top_friends (
  owner uuid not null,
  friend uuid not null,
  slot integer not null
);

create table if not exists bulavata.pulses (
  id bigint default nextval('bulavata.pulses_id_seq'::regclass) not null,
  author uuid not null,
  mood text default ''::text,
  text text not null,
  created_at timestamp with time zone default now() not null,
  luv_count integer default 0 not null
);

create table if not exists bulavata.moments (
  id bigint default nextval('bulavata.moments_id_seq'::regclass) not null,
  author uuid not null,
  body text default ''::text not null,
  media_url text,
  caption text,
  created_at timestamp with time zone default now() not null,
  luv_count integer default 0 not null,
  audience text default 'friends'::text not null,
  edited_at timestamp with time zone,
  edit_count integer default 0 not null,
  repost_of bigint
);

create table if not exists bulavata.wall_posts (
  id bigint default nextval('bulavata.wall_posts_id_seq'::regclass) not null,
  wall_owner uuid not null,
  author uuid not null,
  body text not null,
  ink text default '#1B4965'::text not null,
  created_at timestamp with time zone default now() not null,
  hidden boolean default false not null,
  luv_count integer default 0 not null
);

create table if not exists bulavata.luv (
  id bigint default nextval('bulavata.luv_id_seq'::regclass) not null,
  giver uuid not null,
  target_kind text not null,
  target_id bigint,
  target_profile uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.crews (
  id bigint default nextval('bulavata.crews_id_seq'::regclass) not null,
  name text not null,
  emoji text default '🪸'::text,
  accent text default '#4FA8D8'::text,
  owner uuid not null,
  join_code text default encode(gen_random_bytes(5), 'hex'::text) not null,
  created_at timestamp with time zone default now() not null,
  kind text default 'koro'::text not null,
  about text default ''::text not null,
  vanish_seconds integer,
  broadcast boolean default false not null,
  pinned_message bigint
);

create table if not exists bulavata.crew_members (
  crew_id bigint not null,
  member uuid not null,
  joined_at timestamp with time zone default now() not null
);

create table if not exists bulavata.crew_messages (
  id bigint default nextval('bulavata.crew_messages_id_seq'::regclass) not null,
  crew_id bigint not null,
  author uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone,
  reply_to bigint,
  deleted boolean default false not null,
  kind text default 'text'::text not null
);

create table if not exists bulavata.sparks (
  id bigint default nextval('bulavata.sparks_id_seq'::regclass) not null,
  for_date date default CURRENT_DATE not null,
  question text not null
);

create table if not exists bulavata.spark_answers (
  id bigint default nextval('bulavata.spark_answers_id_seq'::regclass) not null,
  spark_id bigint not null,
  author uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.wallets (
  id uuid default gen_random_uuid() not null,
  owner uuid not null,
  currency character(3) default 'FJD'::bpchar not null,
  balance_minor bigint default 0 not null,
  pending_minor bigint default 0 not null,
  status text default 'dormant'::text not null,
  kyc_tier integer default 0 not null,
  kyc_ref text,
  daily_limit_minor bigint default 100000 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists bulavata.transactions (
  id uuid default gen_random_uuid() not null,
  wallet_id uuid not null,
  counterparty_wallet uuid,
  direction text not null,
  kind text not null,
  amount_minor bigint not null,
  currency character(3) default 'FJD'::bpchar not null,
  balance_after_minor bigint,
  status text default 'pending'::text not null,
  reference text,
  external_ref text,
  memo text,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default now() not null,
  settled_at timestamp with time zone,
  leg_group uuid
);

create table if not exists bulavata.pinned_items (
  id bigint default nextval('bulavata.pinned_items_id_seq'::regclass) not null,
  owner uuid not null,
  slot integer not null,
  kind text not null,
  label text default ''::text not null,
  value text default ''::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.call_rooms (
  id uuid default gen_random_uuid() not null,
  crew_id bigint not null,
  host uuid not null,
  mode text not null,
  status text default 'ringing'::text not null,
  lobby boolean default false not null,
  capacity integer default 6 not null,
  created_at timestamp with time zone default clock_timestamp() not null,
  ring_expires_at timestamp with time zone default (clock_timestamp() + '00:00:45'::interval) not null,
  ended_at timestamp with time zone,
  end_reason text
);

create table if not exists bulavata.call_people (
  call_id uuid not null,
  member uuid not null,
  state text default 'ringing'::text not null,
  device_id uuid,
  joined_at timestamp with time zone,
  last_seen timestamp with time zone,
  recording boolean default false not null,
  spatial_x real default 0.5 not null,
  spatial_y real default 0.5 not null
);

create table if not exists bulavata.call_signals (
  id bigint generated always as identity not null,
  call_id uuid not null,
  sender uuid not null,
  sender_device uuid not null,
  recipient uuid not null,
  kind text not null,
  payload jsonb,
  created_at timestamp with time zone default clock_timestamp() not null,
  expires_at timestamp with time zone default (clock_timestamp() + '00:02:00'::interval) not null
);

create table if not exists bulavata.call_callbacks (
  id uuid default gen_random_uuid() not null,
  crew_id bigint not null,
  requester uuid not null,
  note text default ''::text not null,
  state text default 'queued'::text not null,
  created_at timestamp with time zone default clock_timestamp() not null,
  updated_at timestamp with time zone default clock_timestamp() not null
);

create table if not exists bulavata.call_availability (
  crew_id bigint not null,
  available boolean default false not null,
  updated_at timestamp with time zone default clock_timestamp() not null
);

create table if not exists bulavata.talanoa_group_settings (
  crew_id bigint not null,
  circle_type text default 'koro'::text not null,
  graph_visibility text default 'private'::text not null
);

create table if not exists bulavata.talanoa_member_graph_settings (
  crew_id bigint not null,
  member uuid not null,
  show_on_graph boolean default false not null
);

create table if not exists bulavata.talanoa_personal_graph_settings (
  member uuid not null,
  graph_visibility text default 'private'::text not null
);

create table if not exists bulavata.gifts (
  id bigint generated always as identity not null,
  giver uuid not null,
  receiver uuid not null,
  gift text not null,
  note text,
  hidden boolean default false not null,
  created_at timestamp with time zone default now() not null,
  sere_id uuid
);

create table if not exists bulavata.moment_edits (
  id bigint generated always as identity not null,
  moment_id bigint not null,
  old_body text,
  old_media_url text,
  edited_at timestamp with time zone default now() not null
);

create table if not exists bulavata.close_friends (
  owner uuid not null,
  friend uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.reactions (
  id bigint generated always as identity not null,
  giver uuid not null,
  target_kind text not null,
  target_id bigint not null,
  reaction text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.comments (
  id bigint generated always as identity not null,
  target_kind text not null,
  target_id bigint not null,
  author uuid not null,
  parent_id bigint,
  body text not null,
  created_at timestamp with time zone default now() not null,
  deleted boolean default false not null
);

create table if not exists bulavata.bookmarks (
  id bigint generated always as identity not null,
  owner uuid not null,
  target_kind text not null,
  target_id bigint not null,
  folder text default ''::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.polls (
  id bigint generated always as identity not null,
  moment_id bigint not null,
  question text not null,
  options text[] not null,
  closes_at timestamp with time zone default (now() + '24:00:00'::interval) not null
);

create table if not exists bulavata.poll_votes (
  poll_id bigint not null,
  voter uuid not null,
  choice integer not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.stories (
  id bigint generated always as identity not null,
  author uuid not null,
  kind text default 'story'::text not null,
  body text,
  media_url text,
  audience text default 'friends'::text not null,
  created_at timestamp with time zone default now() not null,
  expires_at timestamp with time zone default (now() + '24:00:00'::interval) not null,
  highlight_title text
);

create table if not exists bulavata.story_views (
  story_id bigint not null,
  viewer uuid not null,
  seen_at timestamp with time zone default now() not null
);

create table if not exists bulavata.events (
  id bigint generated always as identity not null,
  host uuid not null,
  crew_id bigint,
  title text not null,
  about text,
  place text,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  audience text default 'friends'::text not null,
  created_at timestamp with time zone default now() not null,
  cancelled boolean default false not null
);

create table if not exists bulavata.event_rsvps (
  event_id bigint not null,
  person uuid not null,
  status text not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists bulavata.notifications (
  id bigint generated always as identity not null,
  recipient uuid not null,
  actor uuid not null,
  kind text not null,
  target_kind text default ''::text not null,
  target_id bigint default 0 not null,
  snippet text default ''::text not null,
  created_at timestamp with time zone default now() not null,
  read_at timestamp with time zone
);

create table if not exists bulavata.talanoa_posts (
  id bigint generated by default as identity not null,
  author uuid not null,
  body text not null,
  quote_of bigint,
  reply_to bigint,
  like_count integer default 0 not null,
  repost_count integer default 0 not null,
  reply_count integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  sere_id uuid,
  tip_count integer default 0 not null,
  tip_coins integer default 0 not null,
  voice_path text,
  voice_seconds smallint
);

create table if not exists bulavata.talanoa_likes (
  post_id bigint not null,
  member uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.talanoa_reposts (
  post_id bigint not null,
  member uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.sere_scenes (
  id text not null,
  label text not null,
  params jsonb default '{}'::jsonb not null,
  sort integer default 0 not null
);

create table if not exists bulavata.sere_media_generations (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  audio_url text not null,
  source_image_url text not null,
  output_video_url text,
  output_poster_url text,
  status text default 'pending'::text not null,
  scene_id text default 'none'::text not null,
  caption text,
  audio_duration_ms integer,
  render_start_ms integer default 0 not null,
  render_end_ms integer,
  provider text,
  provider_job_id text,
  progress smallint default 0 not null,
  error text,
  attempts smallint default 0 not null,
  remix_of uuid,
  post_id bigint,
  plays integer default 0 not null,
  tips_count integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  completed_at timestamp with time zone,
  engine text default 'quick'::text not null
);

create table if not exists bulavata.hubs (
  slug text not null,
  name text not null,
  emoji text default '🪸'::text not null,
  blurb text default ''::text not null,
  sort smallint default 0 not null,
  crew_id bigint
);

create table if not exists bulavata.talanoa_shares (
  token text not null,
  post_id bigint not null,
  sharer uuid not null,
  opens integer default 0 not null,
  joins integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.referrals (
  id bigint generated by default as identity not null,
  member uuid not null,
  sharer uuid not null,
  token text,
  created_at timestamp with time zone default now() not null,
  invite text
);

create table if not exists bulavata.coin_settings (
  id boolean default true not null,
  coin_sene integer default 10 not null,
  fee_bps integer default 3000 not null,
  tips_on boolean default true not null,
  buy_on boolean default false not null,
  payout_on boolean default false not null,
  payout_min_coins integer default 100 not null,
  max_tip integer default 500 not null,
  daily_tip_cap integer default 500 not null,
  platform_fees bigint default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists bulavata.coin_bundles (
  id text not null,
  coins integer not null,
  bonus integer default 0 not null,
  price_minor integer not null,
  active boolean default true not null,
  sort integer default 0 not null
);

create table if not exists bulavata.coin_accounts (
  owner uuid not null,
  balance integer default 0 not null,
  earned integer default 0 not null,
  bought integer default 0 not null,
  tipped integer default 0 not null,
  received integer default 0 not null,
  paid_out integer default 0 not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists bulavata.coin_ledger (
  id bigint generated by default as identity not null,
  owner uuid,
  kind text not null,
  delta integer not null,
  group_id uuid not null,
  counterparty uuid,
  post_id bigint,
  reference text,
  memo text,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.coin_tips (
  id bigint generated by default as identity not null,
  post_id bigint not null,
  giver uuid not null,
  author uuid not null,
  coins integer not null,
  net integer not null,
  note text,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.blocks (
  blocker uuid not null,
  blocked uuid not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.reports (
  id bigint generated by default as identity not null,
  reporter uuid not null,
  target_kind text not null,
  target_id text not null,
  reason text not null,
  note text,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.invites (
  token text not null,
  sharer uuid not null,
  label text default ''::text not null,
  opens integer default 0 not null,
  joins integer default 0 not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists bulavata.app_links (
  member uuid not null,
  app text not null,
  token_hash text not null,
  created_at timestamp with time zone default now() not null,
  last_used_at timestamp with time zone
);

create table if not exists public.bv_circles (
  id uuid default gen_random_uuid() not null,
  crew_id bigint not null,
  host uuid not null,
  title text not null,
  topic text default ''::text not null,
  capacity integer default 6 not null,
  status text default 'planned'::text not null,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.bv_circle_people (
  circle_id uuid not null,
  member uuid not null,
  seat integer,
  requested boolean default false not null,
  comments_paused boolean default false not null,
  joined_at timestamp with time zone default now() not null
);

create table if not exists public.bv_circle_comments (
  id uuid default gen_random_uuid() not null,
  circle_id uuid not null,
  author uuid not null,
  body text not null,
  created_at timestamp with time zone default now() not null
);

alter sequence bulavata.friendships_id_seq owned by bulavata.friendships.id;

alter sequence bulavata.pulses_id_seq owned by bulavata.pulses.id;

alter sequence bulavata.moments_id_seq owned by bulavata.moments.id;

alter sequence bulavata.wall_posts_id_seq owned by bulavata.wall_posts.id;

alter sequence bulavata.luv_id_seq owned by bulavata.luv.id;

alter sequence bulavata.crews_id_seq owned by bulavata.crews.id;

alter sequence bulavata.crew_messages_id_seq owned by bulavata.crew_messages.id;

alter sequence bulavata.sparks_id_seq owned by bulavata.sparks.id;

alter sequence bulavata.spark_answers_id_seq owned by bulavata.spark_answers.id;

alter sequence bulavata.pinned_items_id_seq owned by bulavata.pinned_items.id;

alter table only bulavata.profiles add constraint profiles_pkey PRIMARY KEY (id);

alter table only bulavata.friendships add constraint friendships_pkey PRIMARY KEY (id);

alter table only bulavata.top_friends add constraint top_friends_pkey PRIMARY KEY (owner, slot);

alter table only bulavata.pulses add constraint pulses_pkey PRIMARY KEY (id);

alter table only bulavata.moments add constraint moments_pkey PRIMARY KEY (id);

alter table only bulavata.wall_posts add constraint wall_posts_pkey PRIMARY KEY (id);

alter table only bulavata.luv add constraint luv_pkey PRIMARY KEY (id);

alter table only bulavata.crews add constraint crews_pkey PRIMARY KEY (id);

alter table only bulavata.crew_members add constraint crew_members_pkey PRIMARY KEY (crew_id, member);

alter table only bulavata.crew_messages add constraint crew_messages_pkey PRIMARY KEY (id);

alter table only bulavata.sparks add constraint sparks_pkey PRIMARY KEY (id);

alter table only bulavata.spark_answers add constraint spark_answers_pkey PRIMARY KEY (id);

alter table only bulavata.wallets add constraint wallets_pkey PRIMARY KEY (id);

alter table only bulavata.transactions add constraint transactions_pkey PRIMARY KEY (id);

alter table only bulavata.pinned_items add constraint pinned_items_pkey PRIMARY KEY (id);

alter table only bulavata.call_rooms add constraint call_rooms_pkey PRIMARY KEY (id);

alter table only bulavata.call_people add constraint call_people_pkey PRIMARY KEY (call_id, member);

alter table only bulavata.call_signals add constraint call_signals_pkey PRIMARY KEY (id);

alter table only bulavata.call_callbacks add constraint call_callbacks_pkey PRIMARY KEY (id);

alter table only bulavata.call_availability add constraint call_availability_pkey PRIMARY KEY (crew_id);

alter table only bulavata.talanoa_group_settings add constraint talanoa_group_settings_pkey PRIMARY KEY (crew_id);

alter table only bulavata.talanoa_member_graph_settings add constraint talanoa_member_graph_settings_pkey PRIMARY KEY (crew_id, member);

alter table only bulavata.talanoa_personal_graph_settings add constraint talanoa_personal_graph_settings_pkey PRIMARY KEY (member);

alter table only bulavata.gifts add constraint gifts_pkey PRIMARY KEY (id);

alter table only bulavata.moment_edits add constraint moment_edits_pkey PRIMARY KEY (id);

alter table only bulavata.close_friends add constraint close_friends_pkey PRIMARY KEY (owner, friend);

alter table only bulavata.reactions add constraint reactions_pkey PRIMARY KEY (id);

alter table only bulavata.comments add constraint comments_pkey PRIMARY KEY (id);

alter table only bulavata.bookmarks add constraint bookmarks_pkey PRIMARY KEY (id);

alter table only bulavata.polls add constraint polls_pkey PRIMARY KEY (id);

alter table only bulavata.poll_votes add constraint poll_votes_pkey PRIMARY KEY (poll_id, voter);

alter table only bulavata.stories add constraint stories_pkey PRIMARY KEY (id);

alter table only bulavata.story_views add constraint story_views_pkey PRIMARY KEY (story_id, viewer);

alter table only bulavata.events add constraint events_pkey PRIMARY KEY (id);

alter table only bulavata.event_rsvps add constraint event_rsvps_pkey PRIMARY KEY (event_id, person);

alter table only bulavata.notifications add constraint notifications_pkey PRIMARY KEY (id);

alter table only bulavata.talanoa_posts add constraint talanoa_posts_pkey PRIMARY KEY (id);

alter table only bulavata.talanoa_likes add constraint talanoa_likes_pkey PRIMARY KEY (post_id, member);

alter table only bulavata.talanoa_reposts add constraint talanoa_reposts_pkey PRIMARY KEY (post_id, member);

alter table only bulavata.sere_scenes add constraint sere_scenes_pkey PRIMARY KEY (id);

alter table only bulavata.sere_media_generations add constraint sere_media_generations_pkey PRIMARY KEY (id);

alter table only bulavata.hubs add constraint hubs_pkey PRIMARY KEY (slug);

alter table only bulavata.talanoa_shares add constraint talanoa_shares_pkey PRIMARY KEY (token);

alter table only bulavata.referrals add constraint referrals_pkey PRIMARY KEY (id);

alter table only bulavata.coin_settings add constraint coin_settings_pkey PRIMARY KEY (id);

alter table only bulavata.coin_bundles add constraint coin_bundles_pkey PRIMARY KEY (id);

alter table only bulavata.coin_accounts add constraint coin_accounts_pkey PRIMARY KEY (owner);

alter table only bulavata.coin_ledger add constraint coin_ledger_pkey PRIMARY KEY (id);

alter table only bulavata.coin_tips add constraint coin_tips_pkey PRIMARY KEY (id);

alter table only bulavata.blocks add constraint blocks_pkey PRIMARY KEY (blocker, blocked);

alter table only bulavata.reports add constraint reports_pkey PRIMARY KEY (id);

alter table only bulavata.invites add constraint invites_pkey PRIMARY KEY (token);

alter table only bulavata.app_links add constraint app_links_pkey PRIMARY KEY (member, app);

alter table only public.bv_circles add constraint bv_circles_pkey PRIMARY KEY (id);

alter table only public.bv_circle_people add constraint bv_circle_people_pkey PRIMARY KEY (circle_id, member);

alter table only public.bv_circle_comments add constraint bv_circle_comments_pkey PRIMARY KEY (id);

alter table only bulavata.profiles add constraint profiles_handle_key UNIQUE (handle);

alter table only bulavata.friendships add constraint friendships_requester_addressee_key UNIQUE (requester, addressee);

alter table only bulavata.top_friends add constraint top_friends_owner_friend_key UNIQUE (owner, friend);

alter table only bulavata.crews add constraint crews_join_code_key UNIQUE (join_code);

alter table only bulavata.sparks add constraint sparks_for_date_key UNIQUE (for_date);

alter table only bulavata.spark_answers add constraint spark_answers_spark_id_author_key UNIQUE (spark_id, author);

alter table only bulavata.wallets add constraint wallets_owner_key UNIQUE (owner);

alter table only bulavata.transactions add constraint transactions_reference_key UNIQUE (reference);

alter table only bulavata.pinned_items add constraint pinned_items_owner_slot_key UNIQUE (owner, slot);

alter table only bulavata.reactions add constraint reactions_giver_target_kind_target_id_key UNIQUE (giver, target_kind, target_id);

alter table only bulavata.bookmarks add constraint bookmarks_owner_target_kind_target_id_key UNIQUE (owner, target_kind, target_id);

alter table only bulavata.polls add constraint polls_moment_id_key UNIQUE (moment_id);

alter table only bulavata.notifications add constraint notifications_recipient_actor_kind_target_kind_target_id_key UNIQUE (recipient, actor, kind, target_kind, target_id);

alter table only bulavata.sere_media_generations add constraint sere_media_generations_provider_job_id_key UNIQUE (provider_job_id);

alter table only bulavata.hubs add constraint hubs_crew_id_key UNIQUE (crew_id);

alter table only bulavata.talanoa_shares add constraint talanoa_shares_post_id_sharer_key UNIQUE (post_id, sharer);

alter table only bulavata.referrals add constraint referrals_member_key UNIQUE (member);

alter table only bulavata.coin_ledger add constraint coin_ledger_reference_key UNIQUE (reference);

alter table only bulavata.reports add constraint reports_reporter_target_kind_target_id_key UNIQUE (reporter, target_kind, target_id);

alter table only bulavata.app_links add constraint app_links_token_hash_key UNIQUE (token_hash);

alter table only public.bv_circle_people add constraint bv_circle_people_circle_id_seat_key UNIQUE (circle_id, seat);

alter table only bulavata.profiles add constraint profiles_handle_check CHECK ((handle ~ '^[a-z0-9_]{3,20}$'::text));

alter table only bulavata.profiles add constraint profiles_age_band_check CHECK ((age_band = ANY (ARRAY['unconfirmed'::text, 'under16'::text, 'teen'::text, 'adult'::text])));

alter table only bulavata.friendships add constraint friendships_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'blocked'::text])));

alter table only bulavata.friendships add constraint friendships_check CHECK ((requester <> addressee));

alter table only bulavata.pulses add constraint pulses_text_check CHECK ((char_length(text) <= 140));

alter table only bulavata.wall_posts add constraint wall_posts_body_check CHECK ((char_length(body) <= 500));

alter table only bulavata.luv add constraint luv_target_kind_check CHECK ((target_kind = ANY (ARRAY['moment'::text, 'wall'::text, 'pulse'::text, 'profile'::text])));

alter table only bulavata.spark_answers add constraint spark_answers_body_check CHECK ((char_length(body) <= 300));

alter table only bulavata.wallets add constraint wallets_balance_minor_check CHECK ((balance_minor >= 0));

alter table only bulavata.wallets add constraint wallets_pending_minor_check CHECK ((pending_minor >= 0));

alter table only bulavata.wallets add constraint wallets_status_check CHECK ((status = ANY (ARRAY['dormant'::text, 'active'::text, 'frozen'::text, 'closed'::text])));

alter table only bulavata.wallets add constraint wallets_kyc_tier_check CHECK (((kyc_tier >= 0) AND (kyc_tier <= 3)));

alter table only bulavata.transactions add constraint transactions_direction_check CHECK ((direction = ANY (ARRAY['credit'::text, 'debit'::text])));

alter table only bulavata.transactions add constraint transactions_amount_minor_check CHECK ((amount_minor > 0));

alter table only bulavata.transactions add constraint transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'settled'::text, 'failed'::text, 'reversed'::text])));

alter table only bulavata.pinned_items add constraint pinned_items_slot_check CHECK (((slot >= 1) AND (slot <= 6)));

alter table only bulavata.pinned_items add constraint pinned_items_kind_check CHECK ((kind = ANY (ARRAY['moment'::text, 'link'::text, 'note'::text, 'song'::text, 'photo'::text])));

alter table only bulavata.crews add constraint crews_kind_check CHECK ((kind = ANY (ARRAY['koro'::text, 'mataqali'::text])));

alter table only bulavata.top_friends add constraint top_friends_slot_check CHECK (((slot >= 1) AND (slot <= 16)));

alter table only bulavata.call_rooms add constraint call_rooms_mode_check CHECK ((mode = ANY (ARRAY['audio'::text, 'video'::text])));

alter table only bulavata.call_rooms add constraint call_rooms_status_check CHECK ((status = ANY (ARRAY['ringing'::text, 'active'::text, 'ended'::text])));

alter table only bulavata.call_rooms add constraint call_rooms_capacity_check CHECK (((capacity >= 2) AND (capacity <= 6)));

alter table only bulavata.call_people add constraint call_people_state_check CHECK ((state = ANY (ARRAY['ringing'::text, 'waiting'::text, 'joined'::text, 'declined'::text, 'busy'::text, 'missed'::text, 'left'::text, 'kicked'::text, 'rejected'::text])));

alter table only bulavata.call_people add constraint call_people_spatial_x_check CHECK (((spatial_x >= (0)::double precision) AND (spatial_x <= (1)::double precision)));

alter table only bulavata.call_people add constraint call_people_spatial_y_check CHECK (((spatial_y >= (0)::double precision) AND (spatial_y <= (1)::double precision)));

alter table only bulavata.call_signals add constraint call_signals_kind_check CHECK ((kind = ANY (ARRAY['offer'::text, 'answer'::text, 'ice'::text])));

alter table only bulavata.call_signals add constraint call_signals_check CHECK ((sender <> recipient));

alter table only bulavata.call_signals add constraint call_signals_payload_check CHECK ((octet_length(COALESCE((payload)::text, 'null'::text)) <= 98304));

alter table only bulavata.call_callbacks add constraint call_callbacks_note_check CHECK ((char_length(note) <= 300));

alter table only bulavata.call_callbacks add constraint call_callbacks_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'claimed'::text, 'done'::text, 'cancelled'::text])));

alter table only bulavata.talanoa_group_settings add constraint talanoa_group_settings_circle_type_check CHECK ((circle_type = ANY (ARRAY['kava'::text, 'tale'::text, 'kakase'::text, 'lotu'::text, 'koro'::text, 'mataqali'::text, 'school'::text, 'old-boys'::text, 'old-girls'::text, 'family'::text, 'music'::text, 'other'::text])));

alter table only bulavata.talanoa_group_settings add constraint talanoa_group_settings_graph_visibility_check CHECK ((graph_visibility = ANY (ARRAY['private'::text, 'public'::text])));

alter table only bulavata.talanoa_personal_graph_settings add constraint talanoa_personal_graph_settings_graph_visibility_check CHECK ((graph_visibility = ANY (ARRAY['private'::text, 'public'::text])));

alter table only bulavata.gifts add constraint gifts_gift_check CHECK ((gift = ANY (ARRAY['bilo'::text, 'salusalu'::text, 'lovo'::text, 'bua'::text, 'niu'::text, 'drua'::text, 'rugby'::text, 'sigidrigi'::text])));

alter table only bulavata.gifts add constraint gifts_note_check CHECK (((note IS NULL) OR (char_length(note) <= 80)));

alter table only bulavata.gifts add constraint gifts_check CHECK ((giver <> receiver));

alter table only bulavata.moments add constraint moments_audience_check CHECK ((audience = ANY (ARRAY['friends'::text, 'close'::text])));

alter table only bulavata.reactions add constraint reactions_reaction_check CHECK ((reaction = ANY (ARRAY['bula'::text, 'vinaka'::text, 'haha'::text, 'wow'::text, 'sad'::text, 'fire'::text])));

alter table only bulavata.comments add constraint comments_target_kind_check CHECK ((target_kind = ANY (ARRAY['moment'::text, 'pulse'::text, 'wall'::text, 'story'::text])));

alter table only bulavata.comments add constraint comments_body_check CHECK (((length(body) >= 1) AND (length(body) <= 1000)));

alter table only bulavata.bookmarks add constraint bookmarks_target_kind_check CHECK ((target_kind = ANY (ARRAY['moment'::text, 'pulse'::text, 'wall'::text])));

alter table only bulavata.polls add constraint polls_question_check CHECK (((length(question) >= 1) AND (length(question) <= 200)));

alter table only bulavata.polls add constraint polls_options_check CHECK (((array_length(options, 1) >= 2) AND (array_length(options, 1) <= 4)));

alter table only bulavata.poll_votes add constraint poll_votes_choice_check CHECK (((choice >= 0) AND (choice <= 3)));

alter table only bulavata.stories add constraint stories_kind_check CHECK ((kind = ANY (ARRAY['story'::text, 'note'::text])));

alter table only bulavata.stories add constraint stories_body_check CHECK ((length(body) <= 300));

alter table only bulavata.stories add constraint stories_audience_check CHECK ((audience = ANY (ARRAY['friends'::text, 'close'::text])));

alter table only bulavata.stories add constraint stories_check CHECK (((body IS NOT NULL) OR (media_url IS NOT NULL)));

alter table only bulavata.events add constraint events_title_check CHECK (((length(title) >= 1) AND (length(title) <= 120)));

alter table only bulavata.events add constraint events_about_check CHECK ((length(about) <= 2000));

alter table only bulavata.events add constraint events_place_check CHECK ((length(place) <= 200));

alter table only bulavata.events add constraint events_audience_check CHECK ((audience = ANY (ARRAY['friends'::text, 'close'::text, 'crew'::text])));

alter table only bulavata.event_rsvps add constraint event_rsvps_status_check CHECK ((status = ANY (ARRAY['going'::text, 'maybe'::text, 'no'::text])));

alter table only bulavata.crews add constraint crews_vanish_seconds_check CHECK (((vanish_seconds IS NULL) OR ((vanish_seconds >= 60) AND (vanish_seconds <= 2592000))));

alter table only bulavata.crew_messages add constraint crew_messages_kind_check CHECK ((kind = ANY (ARRAY['text'::text, 'system'::text])));

alter table only bulavata.reactions add constraint reactions_target_kind_check CHECK ((target_kind = ANY (ARRAY['moment'::text, 'pulse'::text, 'wall'::text, 'comment'::text, 'story'::text, 'message'::text])));

alter table only bulavata.notifications add constraint notifications_snippet_check CHECK ((length(snippet) <= 140));

alter table only bulavata.talanoa_posts add constraint talanoa_posts_body_check CHECK (((char_length(btrim(body)) >= 1) AND (char_length(btrim(body)) <= 280)));

alter table only bulavata.sere_scenes add constraint sere_scenes_id_check CHECK ((id ~ '^[a-z0-9-]{2,32}$'::text));

alter table only bulavata.sere_media_generations add constraint sere_media_generations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])));

alter table only bulavata.sere_media_generations add constraint sere_media_generations_caption_check CHECK (((caption IS NULL) OR (char_length(caption) <= 140)));

alter table only bulavata.sere_media_generations add constraint sere_media_generations_audio_duration_ms_check CHECK (((audio_duration_ms IS NULL) OR ((audio_duration_ms >= 1) AND (audio_duration_ms <= 600000))));

alter table only bulavata.sere_media_generations add constraint sere_media_generations_progress_check CHECK (((progress >= 0) AND (progress <= 100)));

alter table only bulavata.sere_media_generations add constraint sere_media_generations_check CHECK (((render_end_ms IS NULL) OR (((render_end_ms - render_start_ms) >= 1000) AND ((render_end_ms - render_start_ms) <= 60000))));

alter table only bulavata.sere_media_generations add constraint sere_media_generations_engine_check CHECK ((engine = ANY (ARRAY['quick'::text, 'lifelike'::text])));

alter table only bulavata.hubs add constraint hubs_slug_check CHECK ((slug ~ '^[a-z0-9-]{2,24}$'::text));

alter table only bulavata.hubs add constraint hubs_name_check CHECK (((char_length(name) >= 1) AND (char_length(name) <= 40)));

alter table only bulavata.talanoa_shares add constraint talanoa_shares_token_check CHECK ((token ~ '^[a-f0-9]{32}$'::text));

alter table only bulavata.referrals add constraint referrals_check CHECK ((member <> sharer));

alter table only bulavata.coin_settings add constraint coin_settings_id_check CHECK (id);

alter table only bulavata.coin_settings add constraint coin_settings_coin_sene_check CHECK (((coin_sene >= 1) AND (coin_sene <= 1000)));

alter table only bulavata.coin_settings add constraint coin_settings_fee_bps_check CHECK (((fee_bps >= 0) AND (fee_bps <= 9000)));

alter table only bulavata.coin_settings add constraint coin_settings_payout_min_coins_check CHECK ((payout_min_coins >= 1));

alter table only bulavata.coin_settings add constraint coin_settings_max_tip_check CHECK ((max_tip >= 1));

alter table only bulavata.coin_settings add constraint coin_settings_daily_tip_cap_check CHECK ((daily_tip_cap >= 1));

alter table only bulavata.coin_bundles add constraint coin_bundles_id_check CHECK ((id ~ '^[a-z0-9_-]{2,32}$'::text));

alter table only bulavata.coin_bundles add constraint coin_bundles_coins_check CHECK ((coins > 0));

alter table only bulavata.coin_bundles add constraint coin_bundles_bonus_check CHECK ((bonus >= 0));

alter table only bulavata.coin_bundles add constraint coin_bundles_price_minor_check CHECK ((price_minor > 0));

alter table only bulavata.coin_accounts add constraint coin_accounts_balance_check CHECK ((balance >= 0));

alter table only bulavata.coin_accounts add constraint coin_accounts_earned_check CHECK ((earned >= 0));

alter table only bulavata.coin_ledger add constraint coin_ledger_kind_check CHECK ((kind = ANY (ARRAY['buy'::text, 'tip_out'::text, 'tip_in'::text, 'fee'::text, 'payout'::text, 'adjust'::text])));

alter table only bulavata.coin_ledger add constraint coin_ledger_delta_check CHECK ((delta <> 0));

alter table only bulavata.coin_ledger add constraint coin_ledger_memo_check CHECK (((memo IS NULL) OR (char_length(memo) <= 80)));

alter table only bulavata.coin_tips add constraint coin_tips_coins_check CHECK ((coins > 0));

alter table only bulavata.coin_tips add constraint coin_tips_net_check CHECK ((net >= 0));

alter table only bulavata.coin_tips add constraint coin_tips_note_check CHECK (((note IS NULL) OR (char_length(note) <= 60)));

alter table only bulavata.coin_tips add constraint coin_tips_check CHECK ((giver <> author));

alter table only bulavata.transactions add constraint transactions_kind_check CHECK ((kind = ANY (ARRAY['topup'::text, 'withdrawal'::text, 'p2p_send'::text, 'p2p_receive'::text, 'gift'::text, 'subscription'::text, 'refund'::text, 'fee'::text, 'adjustment'::text, 'coin_buy'::text, 'coin_payout'::text])));

alter table only bulavata.blocks add constraint blocks_check CHECK ((blocker <> blocked));

alter table only bulavata.reports add constraint reports_target_kind_check CHECK ((target_kind = ANY (ARRAY['post'::text, 'profile'::text])));

alter table only bulavata.reports add constraint reports_target_id_check CHECK (((char_length(target_id) >= 1) AND (char_length(target_id) <= 64)));

alter table only bulavata.reports add constraint reports_reason_check CHECK ((reason = ANY (ARRAY['spam'::text, 'bullying'::text, 'hate'::text, 'sexual'::text, 'violence'::text, 'underage'::text, 'scam'::text, 'other'::text])));

alter table only bulavata.reports add constraint reports_note_check CHECK (((note IS NULL) OR (char_length(note) <= 500)));

alter table only bulavata.reports add constraint reports_status_check CHECK ((status = ANY (ARRAY['open'::text, 'actioned'::text, 'dismissed'::text])));

alter table only bulavata.talanoa_posts add constraint talanoa_posts_voice_ok CHECK ((((voice_path IS NULL) AND (voice_seconds IS NULL)) OR ((voice_path IS NOT NULL) AND (voice_seconds IS NOT NULL) AND ((voice_seconds >= 1) AND (voice_seconds <= 60)) AND (voice_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|m4a|ogg)$'::text) AND (split_part(voice_path, '/'::text, 1) = (author)::text))));

alter table only bulavata.notifications add constraint notifications_kind_check CHECK ((kind = ANY (ARRAY['reaction'::text, 'reply'::text, 'mention'::text, 'friend_request'::text, 'friend_accepted'::text, 'wall'::text, 'rsvp'::text, 'joined'::text, 'tip'::text, 'top_mate'::text])));

alter table only bulavata.invites add constraint invites_token_check CHECK ((token ~ '^[a-f0-9]{32}$'::text));

alter table only bulavata.invites add constraint invites_label_check CHECK ((length(label) <= 60));

alter table only bulavata.app_links add constraint app_links_app_check CHECK ((app = 'mataka'::text));

alter table only public.bv_circles add constraint bv_circles_title_check CHECK (((char_length(TRIM(BOTH FROM title)) >= 1) AND (char_length(TRIM(BOTH FROM title)) <= 80)));

alter table only public.bv_circles add constraint bv_circles_topic_check CHECK ((char_length(topic) <= 500));

alter table only public.bv_circles add constraint bv_circles_capacity_check CHECK (((capacity >= 4) AND (capacity <= 6)));

alter table only public.bv_circles add constraint bv_circles_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'open'::text, 'ended'::text])));

alter table only public.bv_circle_people add constraint bv_circle_people_seat_check CHECK (((seat >= 1) AND (seat <= 6)));

alter table only public.bv_circle_comments add constraint bv_circle_comments_body_check CHECK (((char_length(TRIM(BOTH FROM body)) >= 1) AND (char_length(TRIM(BOTH FROM body)) <= 900)));

alter table only bulavata.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

alter table only bulavata.friendships add constraint friendships_requester_fkey FOREIGN KEY (requester) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.friendships add constraint friendships_addressee_fkey FOREIGN KEY (addressee) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.top_friends add constraint top_friends_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.top_friends add constraint top_friends_friend_fkey FOREIGN KEY (friend) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.pulses add constraint pulses_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.moments add constraint moments_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.wall_posts add constraint wall_posts_wall_owner_fkey FOREIGN KEY (wall_owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.wall_posts add constraint wall_posts_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.luv add constraint luv_giver_fkey FOREIGN KEY (giver) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.luv add constraint luv_target_profile_fkey FOREIGN KEY (target_profile) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.crews add constraint crews_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.crew_members add constraint crew_members_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE CASCADE;

alter table only bulavata.crew_members add constraint crew_members_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.crew_messages add constraint crew_messages_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE CASCADE;

alter table only bulavata.crew_messages add constraint crew_messages_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.spark_answers add constraint spark_answers_spark_id_fkey FOREIGN KEY (spark_id) REFERENCES bulavata.sparks(id) ON DELETE CASCADE;

alter table only bulavata.spark_answers add constraint spark_answers_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.wallets add constraint wallets_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.transactions add constraint transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES bulavata.wallets(id) ON DELETE RESTRICT;

alter table only bulavata.transactions add constraint transactions_counterparty_wallet_fkey FOREIGN KEY (counterparty_wallet) REFERENCES bulavata.wallets(id) ON DELETE SET NULL;

alter table only bulavata.pinned_items add constraint pinned_items_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.call_rooms add constraint call_rooms_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE CASCADE;

alter table only bulavata.call_rooms add constraint call_rooms_host_fkey FOREIGN KEY (host) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.call_people add constraint call_people_call_id_fkey FOREIGN KEY (call_id) REFERENCES bulavata.call_rooms(id) ON DELETE CASCADE;

alter table only bulavata.call_people add constraint call_people_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.call_signals add constraint call_signals_call_id_fkey FOREIGN KEY (call_id) REFERENCES bulavata.call_rooms(id) ON DELETE CASCADE;

alter table only bulavata.call_signals add constraint call_signals_sender_fkey FOREIGN KEY (sender) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.call_signals add constraint call_signals_recipient_fkey FOREIGN KEY (recipient) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.call_callbacks add constraint call_callbacks_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE CASCADE;

alter table only bulavata.call_callbacks add constraint call_callbacks_requester_fkey FOREIGN KEY (requester) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.call_availability add constraint call_availability_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_group_settings add constraint talanoa_group_settings_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_member_graph_settings add constraint talanoa_member_graph_settings_crew_id_member_fkey FOREIGN KEY (crew_id, member) REFERENCES bulavata.crew_members(crew_id, member) ON DELETE CASCADE;

alter table only bulavata.talanoa_personal_graph_settings add constraint talanoa_personal_graph_settings_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.gifts add constraint gifts_giver_fkey FOREIGN KEY (giver) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.gifts add constraint gifts_receiver_fkey FOREIGN KEY (receiver) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.moments add constraint moments_repost_of_fkey FOREIGN KEY (repost_of) REFERENCES bulavata.moments(id) ON DELETE SET NULL;

alter table only bulavata.moment_edits add constraint moment_edits_moment_id_fkey FOREIGN KEY (moment_id) REFERENCES bulavata.moments(id) ON DELETE CASCADE;

alter table only bulavata.close_friends add constraint close_friends_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.close_friends add constraint close_friends_friend_fkey FOREIGN KEY (friend) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.reactions add constraint reactions_giver_fkey FOREIGN KEY (giver) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.comments add constraint comments_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.comments add constraint comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES bulavata.comments(id) ON DELETE CASCADE;

alter table only bulavata.bookmarks add constraint bookmarks_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.polls add constraint polls_moment_id_fkey FOREIGN KEY (moment_id) REFERENCES bulavata.moments(id) ON DELETE CASCADE;

alter table only bulavata.poll_votes add constraint poll_votes_poll_id_fkey FOREIGN KEY (poll_id) REFERENCES bulavata.polls(id) ON DELETE CASCADE;

alter table only bulavata.poll_votes add constraint poll_votes_voter_fkey FOREIGN KEY (voter) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.stories add constraint stories_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.story_views add constraint story_views_story_id_fkey FOREIGN KEY (story_id) REFERENCES bulavata.stories(id) ON DELETE CASCADE;

alter table only bulavata.story_views add constraint story_views_viewer_fkey FOREIGN KEY (viewer) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.events add constraint events_host_fkey FOREIGN KEY (host) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.events add constraint events_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE SET NULL;

alter table only bulavata.event_rsvps add constraint event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES bulavata.events(id) ON DELETE CASCADE;

alter table only bulavata.event_rsvps add constraint event_rsvps_person_fkey FOREIGN KEY (person) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.crew_messages add constraint crew_messages_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES bulavata.crew_messages(id) ON DELETE SET NULL;

alter table only bulavata.notifications add constraint notifications_recipient_fkey FOREIGN KEY (recipient) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.notifications add constraint notifications_actor_fkey FOREIGN KEY (actor) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_posts add constraint talanoa_posts_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_posts add constraint talanoa_posts_quote_of_fkey FOREIGN KEY (quote_of) REFERENCES bulavata.talanoa_posts(id) ON DELETE SET NULL;

alter table only bulavata.talanoa_posts add constraint talanoa_posts_reply_to_fkey FOREIGN KEY (reply_to) REFERENCES bulavata.talanoa_posts(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_likes add constraint talanoa_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES bulavata.talanoa_posts(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_likes add constraint talanoa_likes_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_reposts add constraint talanoa_reposts_post_id_fkey FOREIGN KEY (post_id) REFERENCES bulavata.talanoa_posts(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_reposts add constraint talanoa_reposts_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.sere_media_generations add constraint sere_media_generations_user_id_fkey FOREIGN KEY (user_id) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.sere_media_generations add constraint sere_media_generations_scene_id_fkey FOREIGN KEY (scene_id) REFERENCES bulavata.sere_scenes(id);

alter table only bulavata.sere_media_generations add constraint sere_media_generations_remix_of_fkey FOREIGN KEY (remix_of) REFERENCES bulavata.sere_media_generations(id) ON DELETE SET NULL;

alter table only bulavata.talanoa_posts add constraint talanoa_posts_sere_id_fkey FOREIGN KEY (sere_id) REFERENCES bulavata.sere_media_generations(id) ON DELETE CASCADE;

alter table only bulavata.sere_media_generations add constraint sere_gen_post_fk FOREIGN KEY (post_id) REFERENCES bulavata.talanoa_posts(id) ON DELETE SET NULL;

alter table only bulavata.gifts add constraint gifts_sere_id_fkey FOREIGN KEY (sere_id) REFERENCES bulavata.sere_media_generations(id) ON DELETE SET NULL;

alter table only bulavata.hubs add constraint hubs_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE SET NULL;

alter table only bulavata.talanoa_shares add constraint talanoa_shares_post_id_fkey FOREIGN KEY (post_id) REFERENCES bulavata.talanoa_posts(id) ON DELETE CASCADE;

alter table only bulavata.talanoa_shares add constraint talanoa_shares_sharer_fkey FOREIGN KEY (sharer) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.referrals add constraint referrals_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.referrals add constraint referrals_sharer_fkey FOREIGN KEY (sharer) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.referrals add constraint referrals_token_fkey FOREIGN KEY (token) REFERENCES bulavata.talanoa_shares(token) ON DELETE SET NULL;

alter table only bulavata.coin_accounts add constraint coin_accounts_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.coin_ledger add constraint coin_ledger_owner_fkey FOREIGN KEY (owner) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.coin_ledger add constraint coin_ledger_counterparty_fkey FOREIGN KEY (counterparty) REFERENCES bulavata.profiles(id) ON DELETE SET NULL;

alter table only bulavata.coin_ledger add constraint coin_ledger_post_id_fkey FOREIGN KEY (post_id) REFERENCES bulavata.talanoa_posts(id) ON DELETE SET NULL;

alter table only bulavata.coin_tips add constraint coin_tips_post_id_fkey FOREIGN KEY (post_id) REFERENCES bulavata.talanoa_posts(id) ON DELETE CASCADE;

alter table only bulavata.coin_tips add constraint coin_tips_giver_fkey FOREIGN KEY (giver) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.coin_tips add constraint coin_tips_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.blocks add constraint blocks_blocker_fkey FOREIGN KEY (blocker) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.blocks add constraint blocks_blocked_fkey FOREIGN KEY (blocked) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.reports add constraint reports_reporter_fkey FOREIGN KEY (reporter) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.invites add constraint invites_sharer_fkey FOREIGN KEY (sharer) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only bulavata.referrals add constraint referrals_invite_fkey FOREIGN KEY (invite) REFERENCES bulavata.invites(token) ON DELETE SET NULL;

alter table only bulavata.app_links add constraint app_links_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id) ON DELETE CASCADE;

alter table only public.bv_circles add constraint bv_circles_crew_id_fkey FOREIGN KEY (crew_id) REFERENCES bulavata.crews(id) ON DELETE CASCADE;

alter table only public.bv_circles add constraint bv_circles_host_fkey FOREIGN KEY (host) REFERENCES bulavata.profiles(id);

alter table only public.bv_circle_people add constraint bv_circle_people_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES bv_circles(id) ON DELETE CASCADE;

alter table only public.bv_circle_people add constraint bv_circle_people_member_fkey FOREIGN KEY (member) REFERENCES bulavata.profiles(id);

alter table only public.bv_circle_comments add constraint bv_circle_comments_circle_id_fkey FOREIGN KEY (circle_id) REFERENCES bv_circles(id) ON DELETE CASCADE;

alter table only public.bv_circle_comments add constraint bv_circle_comments_author_fkey FOREIGN KEY (author) REFERENCES bulavata.profiles(id);

CREATE INDEX friendships_addressee_status_idx ON bulavata.friendships USING btree (addressee, status);

CREATE INDEX friendships_requester_status_idx ON bulavata.friendships USING btree (requester, status);

CREATE INDEX pulses_author_created_at_idx ON bulavata.pulses USING btree (author, created_at DESC);

CREATE INDEX moments_author_created_at_idx ON bulavata.moments USING btree (author, created_at DESC);

CREATE INDEX wall_posts_wall_owner_created_at_idx ON bulavata.wall_posts USING btree (wall_owner, created_at DESC);

CREATE INDEX luv_giver_created_at_idx ON bulavata.luv USING btree (giver, created_at DESC);

CREATE INDEX luv_target_kind_target_id_idx ON bulavata.luv USING btree (target_kind, target_id);

CREATE INDEX crew_messages_crew_id_created_at_idx ON bulavata.crew_messages USING btree (crew_id, created_at DESC);

CREATE INDEX tx_wallet_time ON bulavata.transactions USING btree (wallet_id, created_at DESC);

CREATE INDEX tx_pending ON bulavata.transactions USING btree (status) WHERE (status = 'pending'::text);

CREATE INDEX crew_members_member_idx ON bulavata.crew_members USING btree (member);

CREATE INDEX crew_messages_author_idx ON bulavata.crew_messages USING btree (author);

CREATE INDEX crews_owner_idx ON bulavata.crews USING btree (owner);

CREATE INDEX luv_target_profile_idx ON bulavata.luv USING btree (target_profile);

CREATE INDEX spark_answers_author_idx ON bulavata.spark_answers USING btree (author);

CREATE INDEX top_friends_friend_idx ON bulavata.top_friends USING btree (friend);

CREATE INDEX transactions_counterparty_idx ON bulavata.transactions USING btree (counterparty_wallet);

CREATE INDEX wall_posts_author_idx ON bulavata.wall_posts USING btree (author);

CREATE UNIQUE INDEX luv_once_idx ON bulavata.luv USING btree (giver, target_kind, target_id);

CREATE INDEX luv_giver_target_idx ON bulavata.luv USING btree (giver, target_kind, target_id);

CREATE INDEX tx_leg_group_idx ON bulavata.transactions USING btree (leg_group);

CREATE INDEX tx_daily_idx ON bulavata.transactions USING btree (wallet_id, direction, created_at DESC) WHERE (status = 'settled'::text);

CREATE UNIQUE INDEX call_rooms_one_open_crew ON bulavata.call_rooms USING btree (crew_id) WHERE (status <> 'ended'::text);

CREATE INDEX call_rooms_crew_created ON bulavata.call_rooms USING btree (crew_id, created_at DESC);

CREATE INDEX call_rooms_host_created ON bulavata.call_rooms USING btree (host, created_at DESC);

CREATE INDEX call_people_member ON bulavata.call_people USING btree (member, call_id);

CREATE INDEX call_signals_recipient_cursor ON bulavata.call_signals USING btree (call_id, recipient, id);

CREATE INDEX call_signals_expiry ON bulavata.call_signals USING btree (expires_at);

CREATE UNIQUE INDEX call_callbacks_one_pending ON bulavata.call_callbacks USING btree (crew_id, requester) WHERE (state = ANY (ARRAY['queued'::text, 'claimed'::text]));

CREATE INDEX call_callbacks_crew_created ON bulavata.call_callbacks USING btree (crew_id, created_at DESC);

CREATE INDEX call_callbacks_requester ON bulavata.call_callbacks USING btree (requester);

CREATE INDEX gifts_receiver_idx ON bulavata.gifts USING btree (receiver, created_at DESC);

CREATE INDEX gifts_giver_idx ON bulavata.gifts USING btree (giver, created_at DESC);

CREATE INDEX fk_call_signals_recipient_fkey ON bulavata.call_signals USING btree (recipient);

CREATE INDEX fk_call_signals_sender_fkey ON bulavata.call_signals USING btree (sender);

CREATE INDEX reactions_target ON bulavata.reactions USING btree (target_kind, target_id);

CREATE INDEX comments_target ON bulavata.comments USING btree (target_kind, target_id, created_at);

CREATE INDEX stories_live ON bulavata.stories USING btree (author, expires_at);

CREATE INDEX crew_messages_expiry ON bulavata.crew_messages USING btree (expires_at) WHERE (expires_at IS NOT NULL);

CREATE INDEX notifications_inbox ON bulavata.notifications USING btree (recipient, read_at, created_at DESC);

CREATE INDEX talanoa_posts_wall_idx ON bulavata.talanoa_posts USING btree (created_at DESC, id DESC) WHERE (reply_to IS NULL);

CREATE INDEX talanoa_posts_author_idx ON bulavata.talanoa_posts USING btree (author, created_at DESC);

CREATE INDEX talanoa_posts_reply_idx ON bulavata.talanoa_posts USING btree (reply_to, created_at) WHERE (reply_to IS NOT NULL);

CREATE INDEX talanoa_posts_quote_idx ON bulavata.talanoa_posts USING btree (quote_of) WHERE (quote_of IS NOT NULL);

CREATE INDEX talanoa_likes_member_idx ON bulavata.talanoa_likes USING btree (member, created_at DESC);

CREATE INDEX talanoa_reposts_member_idx ON bulavata.talanoa_reposts USING btree (member, created_at DESC);

CREATE INDEX sere_gen_owner_idx ON bulavata.sere_media_generations USING btree (user_id, created_at DESC);

CREATE INDEX sere_gen_open_idx ON bulavata.sere_media_generations USING btree (status, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'processing'::text]));

CREATE INDEX sere_gen_remix_idx ON bulavata.sere_media_generations USING btree (remix_of) WHERE (remix_of IS NOT NULL);

CREATE INDEX talanoa_posts_sere_idx ON bulavata.talanoa_posts USING btree (sere_id) WHERE (sere_id IS NOT NULL);

CREATE INDEX talanoa_shares_sharer_idx ON bulavata.talanoa_shares USING btree (sharer, created_at DESC);

CREATE INDEX referrals_sharer_idx ON bulavata.referrals USING btree (sharer, created_at DESC);

CREATE INDEX coin_ledger_owner_idx ON bulavata.coin_ledger USING btree (owner, created_at DESC);

CREATE INDEX coin_ledger_group_idx ON bulavata.coin_ledger USING btree (group_id);

CREATE INDEX coin_tips_post_idx ON bulavata.coin_tips USING btree (post_id, created_at DESC);

CREATE INDEX coin_tips_giver_idx ON bulavata.coin_tips USING btree (giver, created_at DESC);

CREATE INDEX blocks_blocked_idx ON bulavata.blocks USING btree (blocked);

CREATE INDEX reports_open_idx ON bulavata.reports USING btree (status, created_at DESC);

CREATE UNIQUE INDEX talanoa_posts_voice_idx ON bulavata.talanoa_posts USING btree (voice_path) WHERE (voice_path IS NOT NULL);

CREATE INDEX invites_sharer_idx ON bulavata.invites USING btree (sharer, created_at DESC);

CREATE INDEX ix_moments_moments_repost_of_fkey ON bulavata.moments USING btree (repost_of);

CREATE INDEX ix_sere_media_generations_sere_gen_post_fk ON bulavata.sere_media_generations USING btree (post_id);

CREATE INDEX ix_sere_media_generations_sere_media_generations_scene_id_fkey ON bulavata.sere_media_generations USING btree (scene_id);

CREATE INDEX ix_referrals_referrals_invite_fkey ON bulavata.referrals USING btree (invite);

CREATE INDEX ix_referrals_referrals_token_fkey ON bulavata.referrals USING btree (token);

CREATE INDEX ix_coin_ledger_coin_ledger_counterparty_fkey ON bulavata.coin_ledger USING btree (counterparty);

CREATE INDEX ix_coin_ledger_coin_ledger_post_id_fkey ON bulavata.coin_ledger USING btree (post_id);

CREATE INDEX ix_coin_tips_coin_tips_author_fkey ON bulavata.coin_tips USING btree (author);

CREATE INDEX ix_gifts_gifts_sere_id_fkey ON bulavata.gifts USING btree (sere_id);

CREATE INDEX ix_moment_edits_moment_edits_moment_id_fkey ON bulavata.moment_edits USING btree (moment_id);

CREATE INDEX ix_comments_comments_author_fkey ON bulavata.comments USING btree (author);

CREATE INDEX ix_comments_comments_parent_id_fkey ON bulavata.comments USING btree (parent_id);

CREATE INDEX ix_close_friends_close_friends_friend_fkey ON bulavata.close_friends USING btree (friend);

CREATE INDEX ix_poll_votes_poll_votes_voter_fkey ON bulavata.poll_votes USING btree (voter);

CREATE INDEX ix_story_views_story_views_viewer_fkey ON bulavata.story_views USING btree (viewer);

CREATE INDEX ix_events_events_crew_id_fkey ON bulavata.events USING btree (crew_id);

CREATE INDEX ix_events_events_host_fkey ON bulavata.events USING btree (host);

CREATE INDEX ix_event_rsvps_event_rsvps_person_fkey ON bulavata.event_rsvps USING btree (person);

CREATE INDEX ix_crew_messages_crew_messages_reply_to_fkey ON bulavata.crew_messages USING btree (reply_to);

CREATE INDEX ix_notifications_notifications_actor_fkey ON bulavata.notifications USING btree (actor);

CREATE INDEX bv_circles_crew_created ON public.bv_circles USING btree (crew_id, created_at DESC);

CREATE INDEX bv_circles_host ON public.bv_circles USING btree (host);

CREATE INDEX bv_circle_people_member ON public.bv_circle_people USING btree (member);

CREATE INDEX bv_circle_comments_circle_created ON public.bv_circle_comments USING btree (circle_id, created_at DESC);

CREATE INDEX bv_circle_comments_author ON public.bv_circle_comments USING btree (author);

CREATE OR REPLACE FUNCTION bulavata.are_friends(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from bulavata.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$function$
;

CREATE OR REPLACE FUNCTION bulavata.visible_to_me(owner uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select owner = (select auth.uid()) or bulavata.are_friends((select auth.uid()), owner);
$function$
;

CREATE OR REPLACE FUNCTION bulavata.luv_left()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select greatest(0, 3 - (select count(*)::int from bulavata.luv
    where giver = (select auth.uid()) and created_at > (now() - interval '24 hours')));
$function$
;

CREATE OR REPLACE FUNCTION bulavata.enforce_luv_cap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
begin
  if (select count(*) from bulavata.luv
      where giver = new.giver and created_at > (now() - interval '24 hours')) >= 3 then
    raise exception 'OUT_OF_LUV';
  end if;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION bulavata.in_crew(c bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from bulavata.crew_members m
    where m.crew_id = c and m.member = (select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_luv_left()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
  select greatest(0, 3 - (select count(*)::int from bulavata.luv
    where giver = auth.uid() and created_at > now() - interval '24 hours'));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_pulse_feed()
 RETURNS TABLE(author uuid, handle text, display_name text, avatar_emoji text, accent text, mood text, text text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p.author, pr.handle, pr.display_name, pr.avatar_emoji, pr.room_accent, p.mood, p.text, p.created_at
  from bulavata.my_circle() c
  cross join lateral (
    select pu.author, pu.mood, pu.text, pu.created_at
    from bulavata.pulses pu
    where pu.author = c.id
    order by pu.created_at desc
    limit 1) p
  join bulavata.profiles pr on pr.id = p.author
  order by p.created_at desc
$function$
;

CREATE OR REPLACE FUNCTION public.bv_moments_feed(lim integer DEFAULT 60)
 RETURNS TABLE(id bigint, author uuid, handle text, display_name text, avatar_emoji text, accent text, body text, media_url text, caption text, created_at timestamp with time zone, luv_count bigint, i_luvd boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as (
    select m.id, m.author, m.body, m.media_url, m.caption, m.created_at, m.luv_count
    from bulavata.moments m
    where m.author in (select c.id from bulavata.my_circle() c)
    order by m.created_at desc
    limit lim),
  mine as (
    select l.target_id from bulavata.luv l
    where l.giver = (select auth.uid()) and l.target_kind = 'moment'
      and l.target_id in (select page.id from page))
  select x.id, x.author, pr.handle, pr.display_name, pr.avatar_emoji, pr.room_accent,
         x.body, x.media_url, x.caption, x.created_at, x.luv_count::bigint,
         exists (select 1 from mine where mine.target_id = x.id)
  from page x join bulavata.profiles pr on pr.id = x.author
  order by x.created_at desc
$function$
;

CREATE OR REPLACE FUNCTION public.bv_my_friends()
 RETURNS TABLE(id uuid, handle text, display_name text, avatar_emoji text, accent text, last_seen timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select pr.id, pr.handle, pr.display_name, pr.avatar_emoji, pr.room_accent, pr.last_seen
  from bulavata.profiles pr
  where pr.id in (
    select f.addressee from bulavata.friendships f where f.requester = (select auth.uid()) and f.status = 'accepted'
    union
    select f.requester from bulavata.friendships f where f.addressee = (select auth.uid()) and f.status = 'accepted')
  order by pr.last_seen desc nulls last
$function$
;

CREATE OR REPLACE FUNCTION public.bv_pending_requests()
 RETURNS TABLE(friendship_id bigint, id uuid, handle text, display_name text, avatar_emoji text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
  select f.id, pr.id, pr.handle, pr.display_name, pr.avatar_emoji
  from bulavata.friendships f join bulavata.profiles pr on pr.id = f.requester
  where f.addressee = auth.uid() and f.status = 'pending';
$function$
;

CREATE OR REPLACE FUNCTION public.bv_room(p_handle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
declare o bulavata.profiles%rowtype; vis boolean; begin
  select * into o from bulavata.profiles where handle = p_handle;
  if not found then return jsonb_build_object('found', false); end if;
  vis := (o.id = auth.uid()) or bulavata.are_friends(auth.uid(), o.id);
  return jsonb_build_object(
    'found', true, 'is_me', o.id = auth.uid(), 'visible', vis,
    'profile', jsonb_build_object('id',o.id,'handle',o.handle,'display_name',o.display_name,
      'pronouns',o.pronouns,'bio',o.bio,'avatar_emoji',o.avatar_emoji,'room_theme',o.room_theme,
      'room_accent',o.room_accent,'room_css',o.room_css,'room_song',o.room_song,
      'human_verified',o.human_verified,'created_at',o.created_at),
    'friend_status', coalesce((select f.status from bulavata.friendships f
       where (f.requester=auth.uid() and f.addressee=o.id) or (f.requester=o.id and f.addressee=auth.uid())
       limit 1), 'none'),
    'is_close', exists (select 1 from bulavata.close_friends c where c.owner = auth.uid() and c.friend = o.id),
    'highlights', case when vis then public.bv_highlights(o.id) else '[]'::jsonb end,
    'top', case when vis then coalesce((select jsonb_agg(jsonb_build_object('slot',t.slot,'handle',p2.handle,
             'display_name',p2.display_name,'avatar_emoji',p2.avatar_emoji) order by t.slot)
           from bulavata.top_friends t join bulavata.profiles p2 on p2.id=t.friend
           where t.owner=o.id), '[]'::jsonb) else '[]'::jsonb end,
    'wall', case when vis then coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'body',w.body,'ink',w.ink,
             'handle',p3.handle,'avatar_emoji',p3.avatar_emoji,'created_at',w.created_at,
             'reactions', bulavata.reaction_summary('wall', w.id),
             'comment_count', (select count(*) from bulavata.comments c where c.target_kind='wall' and c.target_id=w.id and not c.deleted)) order by w.created_at desc)
           from (select * from bulavata.wall_posts where wall_owner=o.id order by created_at desc limit 40) w
           join bulavata.profiles p3 on p3.id=w.author), '[]'::jsonb) else '[]'::jsonb end,
    'moments', case when vis then coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'body',m.body,
             'media_url',m.media_url,'caption',m.caption,'created_at',m.created_at,'audience',m.audience,'edited_at',m.edited_at,
             'reactions', bulavata.reaction_summary('moment', m.id),
             'comment_count', (select count(*) from bulavata.comments c where c.target_kind='moment' and c.target_id=m.id and not c.deleted)) order by m.created_at desc)
           from (select * from bulavata.moments where author=o.id and bulavata.can_see_moment(author, audience) order by created_at desc limit 30) m), '[]'::jsonb) else '[]'::jsonb end
  );
end; $function$
;

CREATE OR REPLACE FUNCTION public.bv_export_my_archive()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from bulavata.profiles p where p.id = auth.uid()),
    'moments', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from bulavata.moments m where m.author=auth.uid()),'[]'::jsonb),
    'pulses',  coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from bulavata.pulses x where x.author=auth.uid()),'[]'::jsonb),
    'wall_posts_i_wrote', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at) from bulavata.wall_posts w where w.author=auth.uid()),'[]'::jsonb),
    'my_wall', coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at) from bulavata.wall_posts w where w.wall_owner=auth.uid()),'[]'::jsonb),
    'spark_answers', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from bulavata.spark_answers s where s.author=auth.uid()),'[]'::jsonb),
    'crew_messages', coalesce((select jsonb_agg(to_jsonb(c) order by c.created_at) from bulavata.crew_messages c where c.author=auth.uid()),'[]'::jsonb)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.bv_join_crew(p_code text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
declare cid bigint; begin
  select id into cid from bulavata.crews where join_code = lower(trim(p_code));
  if not found then raise exception 'NO_SUCH_CREW'; end if;
  insert into bulavata.crew_members (crew_id, member) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end; $function$
;

CREATE OR REPLACE FUNCTION public.bv_my_crews()
 RETURNS TABLE(id bigint, name text, emoji text, accent text, join_code text, members bigint, last_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.id, c.name, c.emoji, c.accent, c.join_code,
    (select count(*) from bulavata.crew_members m2 where m2.crew_id = c.id),
    (select x.created_at from bulavata.crew_messages x where x.crew_id = c.id order by x.created_at desc limit 1)
  from bulavata.crews c
  where c.id in (select m.crew_id from bulavata.crew_members m where m.member = (select auth.uid()))
  order by 7 desc nulls last
$function$
;

CREATE OR REPLACE FUNCTION public.bv_touch()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update bulavata.profiles set last_seen = now()
  where id = (select auth.uid())
    and (last_seen is null or last_seen < now() - interval '5 minutes');
$function$
;

CREATE OR REPLACE FUNCTION bulavata.open_wallet()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
begin
  insert into bulavata.wallets (owner) values (new.id) on conflict (owner) do nothing;
  return new;
end; $function$
;

CREATE OR REPLACE FUNCTION public.bv_handle_free(p_handle text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'bulavata', 'public'
AS $function$
  select not exists (select 1 from bulavata.profiles where handle = lower(trim(p_handle)));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_manage_top(p_slot integer, p_action text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'bulavata', 'public', 'pg_temp'
AS $function$
declare actor uuid:=auth.uid(); other_slot integer; mate uuid; other_mate uuid;
begin
 if actor is null then raise exception 'Sign in to manage your mates'; end if;
 if p_slot not between 1 and 16 or p_slot is null then raise exception 'Invalid mate slot'; end if;
 if p_action not in ('up','down','remove') or p_action is null then raise exception 'Invalid mate action'; end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
 select friend into mate from bulavata.top_friends where owner=actor and slot=p_slot for update;
 if mate is null then raise exception 'That mate slot is empty'; end if;
 if p_action='remove' then delete from bulavata.top_friends where owner=actor and slot=p_slot; return; end if;
 other_slot:=p_slot+case when p_action='up' then -1 else 1 end;
 if other_slot not between 1 and 16 then return; end if;
 select friend into other_mate from bulavata.top_friends where owner=actor and slot=other_slot for update;
 delete from bulavata.top_friends where owner=actor and slot in (p_slot,other_slot);
 insert into bulavata.top_friends(owner,friend,slot) values(actor,mate,other_slot);
 if other_mate is not null then insert into bulavata.top_friends(owner,friend,slot) values(actor,other_mate,p_slot); end if;
end; $function$
;

CREATE OR REPLACE FUNCTION bulavata.my_circle()
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select f.addressee from bulavata.friendships f where f.requester = (select auth.uid()) and f.status = 'accepted'
  union
  select f.requester from bulavata.friendships f where f.addressee = (select auth.uid()) and f.status = 'accepted'
  union
  select (select auth.uid())
$function$
;

CREATE OR REPLACE FUNCTION bulavata.feed(before timestamp with time zone DEFAULT NULL::timestamp with time zone, lim integer DEFAULT 30)
 RETURNS TABLE(kind text, item_id bigint, author uuid, handle text, display_name text, avatar_emoji text, mood text, body text, media_url text, created_at timestamp with time zone, luv_count integer, i_luvd boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with circle as (select id from bulavata.my_circle()),
pick as (
  (select 'pulse'::text kind, p.id item_id, p.author, p.mood, p.text body, null::text media_url, p.created_at, p.luv_count
   from bulavata.pulses p join circle c on c.id = p.author
   where (before is null or p.created_at < before)
   order by p.created_at desc limit lim)
  union all
  (select 'moment'::text, m.id, m.author, null::text, coalesce(m.caption, m.body), m.media_url, m.created_at, m.luv_count
   from bulavata.moments m join circle c on c.id = m.author
   where (before is null or m.created_at < before)
   order by m.created_at desc limit lim)
),
page as (select * from pick order by created_at desc limit lim),
mine as (select l.target_kind, l.target_id from bulavata.luv l
         where l.giver = (select auth.uid())
           and l.target_id in (select item_id from page))
select x.kind, x.item_id, x.author, pr.handle, pr.display_name, pr.avatar_emoji, x.mood, x.body, x.media_url,
       x.created_at, x.luv_count,
       exists (select 1 from mine m where m.target_kind = x.kind and m.target_id = x.item_id) i_luvd
from page x join bulavata.profiles pr on pr.id = x.author
order by x.created_at desc
$function$
;

CREATE OR REPLACE FUNCTION bulavata.sync_luv_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare k text; i bigint; d int;
begin
  if (tg_op = 'INSERT') then k := new.target_kind; i := new.target_id; d := 1;
  else k := old.target_kind; i := old.target_id; d := -1; end if;
  if k = 'pulse' then update bulavata.pulses set luv_count = greatest(0, luv_count + d) where id = i;
  elsif k = 'moment' then update bulavata.moments set luv_count = greatest(0, luv_count + d) where id = i;
  elsif k = 'wall' then update bulavata.wall_posts set luv_count = greatest(0, luv_count + d) where id = i;
  end if;
  return null;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.wallet_send(to_handle text, amount_minor bigint, memo text DEFAULT NULL::text, idem_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid()); src bulavata.wallets; dst bulavata.wallets;
        grp uuid := gen_random_uuid(); ref text; sent_today bigint; existing bulavata.transactions;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if amount_minor is null or amount_minor <= 0 then raise exception 'BAD_AMOUNT'; end if;
  ref := 'p2p:' || coalesce(nullif(idem_key,''), gen_random_uuid()::text);

  select * into existing from bulavata.transactions where reference = ref;
  if found then
    select * into src from bulavata.wallets where owner = me;
    return jsonb_build_object('status','already_done','reference',ref,'balance_minor',src.balance_minor);
  end if;

  select w.* into dst from bulavata.wallets w join bulavata.profiles p on p.id = w.owner where p.handle = lower(to_handle);
  if dst.id is null then raise exception 'NO_SUCH_WALLET'; end if;
  select * into src from bulavata.wallets where owner = me;
  if src.id is null then raise exception 'NO_WALLET'; end if;
  if src.id = dst.id then raise exception 'SELF_SEND'; end if;
  if src.currency <> dst.currency then raise exception 'CURRENCY_MISMATCH'; end if;

  -- lock both rows in a fixed order so two opposite transfers cannot deadlock
  if src.id < dst.id then
    select * into src from bulavata.wallets where id = src.id for update;
    select * into dst from bulavata.wallets where id = dst.id for update;
  else
    select * into dst from bulavata.wallets where id = dst.id for update;
    select * into src from bulavata.wallets where id = src.id for update;
  end if;

  if src.status <> 'active' then raise exception 'WALLET_%', upper(src.status); end if;
  if dst.status not in ('active','dormant') then raise exception 'PAYEE_WALLET_%', upper(dst.status); end if;
  if src.balance_minor < amount_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;

  select coalesce(sum(t.amount_minor),0) into sent_today from bulavata.transactions t
   where t.wallet_id = src.id and t.direction = 'debit' and t.status = 'settled'
     and t.created_at > date_trunc('day', now());
  if sent_today + amount_minor > src.daily_limit_minor then raise exception 'DAILY_LIMIT_EXCEEDED'; end if;

  update bulavata.wallets set balance_minor = balance_minor - amount_minor, updated_at = now() where id = src.id
    returning * into src;
  update bulavata.wallets set balance_minor = balance_minor + amount_minor, updated_at = now(),
    status = case when status = 'dormant' then 'active' else status end where id = dst.id returning * into dst;

  insert into bulavata.transactions(wallet_id, counterparty_wallet, direction, kind, amount_minor, currency,
    status, reference, memo, leg_group, balance_after_minor, settled_at)
  values (src.id, dst.id, 'debit', 'p2p_send', amount_minor, src.currency, 'settled', ref, memo, grp, src.balance_minor, now()),
         (dst.id, src.id, 'credit', 'p2p_receive', amount_minor, dst.currency, 'settled', ref || ':in', memo, grp, dst.balance_minor, now());

  return jsonb_build_object('status','settled','reference',ref,'balance_minor',src.balance_minor,'amount_minor',amount_minor);
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.wallet_topup(wallet_owner uuid, amount_minor bigint, provider_ref text, kind text DEFAULT 'topup'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w bulavata.wallets; ref text; existing bulavata.transactions;
begin
  if amount_minor is null or amount_minor <= 0 then raise exception 'BAD_AMOUNT'; end if;
  if provider_ref is null or provider_ref = '' then raise exception 'PROVIDER_REF_REQUIRED'; end if;
  if kind not in ('topup','refund','adjustment','gift') then raise exception 'BAD_KIND'; end if;
  ref := kind || ':' || provider_ref;
  select * into existing from bulavata.transactions where reference = ref;
  if found then return jsonb_build_object('status','already_done','reference',ref); end if;
  select * into w from bulavata.wallets where owner = wallet_owner for update;
  if w.id is null then raise exception 'NO_WALLET'; end if;
  if w.status in ('frozen','closed') then raise exception 'WALLET_%', upper(w.status); end if;
  update bulavata.wallets set balance_minor = balance_minor + amount_minor, updated_at = now(),
    status = case when status = 'dormant' then 'active' else status end where id = w.id returning * into w;
  insert into bulavata.transactions(wallet_id, direction, kind, amount_minor, currency, status, reference,
    external_ref, balance_after_minor, settled_at)
  values (w.id, 'credit', kind, amount_minor, w.currency, 'settled', ref, provider_ref, w.balance_minor, now());
  return jsonb_build_object('status','settled','reference',ref,'balance_minor',w.balance_minor);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_wallet_credit(p_owner uuid, p_amount_minor bigint, p_provider_ref text, p_currency text DEFAULT 'FJD'::text, p_kind text DEFAULT 'topup'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare w bulavata.wallets;
begin
  select * into w from bulavata.wallets where owner = p_owner;
  if w.id is null then return jsonb_build_object('status','error','reason','NO_WALLET'); end if;
  if upper(trim(p_currency)) <> upper(trim(w.currency)) then
    return jsonb_build_object('status','error','reason','CURRENCY_MISMATCH','wallet_currency',trim(w.currency),'charged',p_currency);
  end if;
  return bulavata.wallet_topup(p_owner, p_amount_minor, p_provider_ref, p_kind);
exception when others then
  return jsonb_build_object('status','error','reason',sqlerrm);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_wallet()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with w as (select * from bulavata.wallets where owner = (select auth.uid())),
  spent as (select coalesce(sum(t.amount_minor),0) s from bulavata.transactions t, w
            where t.wallet_id = w.id and t.direction='debit' and t.status='settled'
              and t.created_at > date_trunc('day', now())),
  tx as (
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'direction', t.direction, 'kind', t.kind, 'amount_minor', t.amount_minor,
      'status', t.status, 'memo', t.memo, 'created_at', t.created_at,
      'balance_after_minor', t.balance_after_minor,
      'other', (select pr.handle from bulavata.wallets w2
                join bulavata.profiles pr on pr.id = w2.owner
                where w2.id = t.counterparty_wallet)
    ) order by t.created_at desc) j
    from (select t.* from bulavata.transactions t, w where t.wallet_id = w.id
          order by t.created_at desc limit 20) t)
  select case when (select count(*) from w) = 0 then jsonb_build_object('has_wallet', false)
  else jsonb_build_object(
    'has_wallet', true,
    'balance_minor', (select balance_minor from w),
    'currency', trim((select currency from w)),
    'status', (select status from w),
    'daily_limit_minor', (select daily_limit_minor from w),
    'spent_today_minor', (select s from spent),
    'transactions', coalesce((select j from tx), '[]'::jsonb)) end;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_wallet_send(p_to_handle text, p_amount_minor bigint, p_memo text DEFAULT NULL::text, p_idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return bulavata.wallet_send(p_to_handle, p_amount_minor, p_memo, p_idem);
exception when others then
  return jsonb_build_object('status','error','reason',sqlerrm);
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.call_require_crew(p_crew bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if auth.uid() is null or not exists(select 1 from bulavata.crew_members m where m.crew_id=p_crew and m.member=auth.uid()) then
    raise exception 'This Koro is unavailable to your account.' using errcode='42501';
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.call_sweep(p_call uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update bulavata.call_people p set state='left',recording=false,device_id=null
  from bulavata.call_rooms r where r.id=p.call_id and (r.id=p_call or (p_call is null and exists(select 1 from bulavata.crew_members scope_member where scope_member.crew_id=r.crew_id and scope_member.member=auth.uid()))) and r.status<>'ended'
    and p.state in ('joined','waiting') and (p.last_seen<clock_timestamp()-interval '60 seconds'
      or not exists(select 1 from bulavata.crew_members m where m.crew_id=r.crew_id and m.member=p.member));
  update bulavata.call_people p set state='missed'
  from bulavata.call_rooms r where r.id=p.call_id and (r.id=p_call or (p_call is null and exists(select 1 from bulavata.crew_members scope_member where scope_member.crew_id=r.crew_id and scope_member.member=auth.uid())))
    and p.state='ringing' and r.ring_expires_at<=clock_timestamp();
  update bulavata.call_rooms r set status='ended',ended_at=clock_timestamp(),end_reason=
    case when r.created_at<clock_timestamp()-interval '4 hours' then 'expired'
      when not exists(select 1 from bulavata.call_people p where p.call_id=r.id and p.member=r.host and p.state='joined') then 'host_disconnected'
      else 'no_answer' end
  where (r.id=p_call or (p_call is null and exists(select 1 from bulavata.crew_members scope_member where scope_member.crew_id=r.crew_id and scope_member.member=auth.uid()))) and r.status<>'ended' and (
    r.created_at<clock_timestamp()-interval '4 hours'
    or not exists(select 1 from bulavata.call_people p where p.call_id=r.id and p.member=r.host and p.state='joined')
    or (r.status='ringing' and r.ring_expires_at<=clock_timestamp()
      and not exists(select 1 from bulavata.call_people p where p.call_id=r.id and p.member<>r.host and p.state in ('joined','waiting'))));
  update bulavata.call_people p set state=case when p.state='ringing' then 'missed' else 'left' end,recording=false,device_id=null
    from bulavata.call_rooms r where r.id=p.call_id and (r.id=p_call or (p_call is null and exists(select 1 from bulavata.crew_members scope_member where scope_member.crew_id=r.crew_id and scope_member.member=auth.uid()))) and r.status='ended' and p.state in ('joined','waiting','ringing');
  delete from bulavata.call_signals where expires_at<=clock_timestamp()
    or exists(select 1 from bulavata.call_rooms r where r.id=call_id and r.status='ended');
  delete from bulavata.call_rooms where id in (select id from bulavata.call_rooms where status='ended' and ended_at<clock_timestamp()-interval '30 days' order by ended_at limit 100);
  delete from bulavata.call_callbacks where id in (select id from bulavata.call_callbacks where created_at<clock_timestamp()-interval '30 days' order by created_at limit 100);
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.call_summary(p_call uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object('id',r.id,'crew_id',r.crew_id,'crew_name',c.name,'host',r.host,'host_name',h.display_name,
    'mode',r.mode,'status',r.status,'lobby',r.lobby,'capacity',r.capacity,'created_at',r.created_at,
    'ring_expires_at',r.ring_expires_at,'ended_at',r.ended_at,'end_reason',r.end_reason,
    'my_state',(select p.state from bulavata.call_people p where p.call_id=r.id and p.member=auth.uid()),
    'joined_count',(select count(*) from bulavata.call_people p where p.call_id=r.id and p.state='joined'),
    'recording_members',coalesce((select jsonb_agg(p.member order by p.member) from bulavata.call_people p where p.call_id=r.id and p.state='joined' and p.recording),'[]'::jsonb))
  from bulavata.call_rooms r join bulavata.crews c on c.id=r.crew_id join bulavata.profiles h on h.id=r.host where r.id=p_call
$function$
;

CREATE OR REPLACE FUNCTION bulavata.call_snapshot(p_call uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object('call',bulavata.call_summary(p_call),'participants',coalesce((
    select jsonb_agg(jsonb_build_object('member',p.member,'display_name',u.display_name,'state',p.state,
      'device_id',p.device_id,'joined_at',p.joined_at,'last_seen',p.last_seen,'recording',p.recording,
      'spatial_x',p.spatial_x,'spatial_y',p.spatial_y) order by p.joined_at nulls last,p.member)
    from bulavata.call_people p join bulavata.profiles u on u.id=p.member where p.call_id=p_call),'[]'::jsonb))
$function$
;

CREATE OR REPLACE FUNCTION bulavata.call_rpc(p_action text, p_args jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid:=auth.uid();
  cid uuid:=nullif(p_args->>'call','')::uuid;
  crew bigint:=nullif(p_args->>'crew','')::bigint;
  device uuid:=nullif(p_args->>'device','')::uuid;
  target uuid:=nullif(p_args->>'target','')::uuid;
  r bulavata.call_rooms;
  person bulavata.call_people;
  req bulavata.call_callbacks;
  n integer;
  signal_id bigint;
  result jsonb;
  kind text:=p_args->>'kind';
  payload jsonb:=p_args->'payload';
  call_action text:=p_args->>'action';
begin
  if actor is null then raise exception 'Sign in to use calls.' using errcode='42501'; end if;
  -- Every state transition for a person is serialized across rooms and devices.
  perform pg_advisory_xact_lock(hashtextextended(actor::text,20261025));
  if p_action='start' then
    perform bulavata.call_require_crew(crew);
    if device is null or p_args->>'mode' not in ('audio','video') or p_args->>'mode' is null
      or (p_args->>'capacity')::integer not between 2 and 6 or p_args->>'capacity' is null then raise exception 'Invalid call settings.'; end if;
    perform pg_advisory_xact_lock(hashtextextended('crew:'||crew::text,20261025));
    perform bulavata.call_sweep();
    if exists(select 1 from bulavata.call_people p join bulavata.call_rooms a on a.id=p.call_id where p.member=actor and p.state in ('joined','waiting') and a.status<>'ended') then raise exception 'Leave your current call first.'; end if;
    if exists(select 1 from bulavata.call_rooms where crew_id=crew and status<>'ended') then raise exception 'This Koro already has an open call.'; end if;
    if (select count(*) from bulavata.call_rooms where host=actor and created_at>clock_timestamp()-interval '5 minutes')>=10 then raise exception 'Too many calls. Try again shortly.'; end if;
    if (select count(*) from bulavata.crew_members where crew_id=crew)>500 then raise exception 'Use a smaller Koro for native calls.'; end if;
    insert into bulavata.call_rooms(crew_id,host,mode,lobby,capacity)
      values(crew,actor,p_args->>'mode',coalesce((p_args->>'lobby')::boolean,false),(p_args->>'capacity')::integer) returning * into r;
    insert into bulavata.call_people(call_id,member,state,device_id,joined_at,last_seen)
      select r.id,m.member,case when m.member=actor then 'joined' else 'ringing' end,
        case when m.member=actor then device end,case when m.member=actor then clock_timestamp() end,
        case when m.member=actor then clock_timestamp() end from bulavata.crew_members m where m.crew_id=crew;
    return bulavata.call_snapshot(r.id);
  elsif p_action='list' then
    if crew is not null then perform bulavata.call_require_crew(crew); end if;
    perform bulavata.call_sweep();
    select coalesce(jsonb_agg(bulavata.call_summary(q.id) order by q.created_at desc),'[]'::jsonb) into result from (
      select a.id,a.created_at from bulavata.call_rooms a where (crew is null or a.crew_id=crew)
      and exists(select 1 from bulavata.crew_members m where m.crew_id=a.crew_id and m.member=actor)
      and a.created_at>=clock_timestamp()-interval '30 days' order by a.created_at desc limit 40) q;
    return result;
  elsif p_action in ('callback_request','callback_list','availability') then
    perform bulavata.call_require_crew(crew);
    if p_action='availability' then
      if p_args->>'available' is not null then
        if not exists(select 1 from bulavata.crews where id=crew and owner=actor) then raise exception 'Only the Koro owner changes availability.' using errcode='42501'; end if;
        insert into bulavata.call_availability(crew_id,available) values(crew,(p_args->>'available')::boolean)
          on conflict(crew_id) do update set available=excluded.available,updated_at=clock_timestamp();
      end if;
      return jsonb_build_object('available',coalesce((select available from bulavata.call_availability where crew_id=crew),false),'is_owner',exists(select 1 from bulavata.crews where id=crew and owner=actor));
    elsif p_action='callback_request' then
      if char_length(coalesce(p_args->>'note',''))>300 then raise exception 'Keep your callback note under 300 characters.'; end if;
      if exists(select 1 from bulavata.call_callbacks where crew_id=crew and requester=actor and state in ('queued','claimed')) then raise exception 'You already have a pending callback.'; end if;
      if (select count(*) from bulavata.call_callbacks where requester=actor and created_at>clock_timestamp()-interval '1 hour')>=5 then raise exception 'Too many callback requests. Try later.'; end if;
      insert into bulavata.call_callbacks(crew_id,requester,note) values(crew,actor,trim(coalesce(p_args->>'note',''))) returning * into req;
      return to_jsonb(req)||jsonb_build_object('requester_name',(select display_name from bulavata.profiles where id=actor));
    else
      perform bulavata.call_sweep();
      select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into result from (
        select cb.*,p.display_name requester_name from bulavata.call_callbacks cb join bulavata.profiles p on p.id=cb.requester
        where cb.crew_id=crew and (cb.requester=actor or exists(select 1 from bulavata.crews where id=crew and owner=actor))
        order by cb.created_at desc limit 100) q;
      return jsonb_build_object('available',coalesce((select available from bulavata.call_availability where crew_id=crew),false),'is_owner',exists(select 1 from bulavata.crews where id=crew and owner=actor),'requests',result);
    end if;
  elsif p_action='callback_act' then
    select * into req from bulavata.call_callbacks where id=(p_args->>'request')::uuid for update;
    if req.id is null then raise exception 'Callback unavailable.'; end if;
    perform bulavata.call_require_crew(req.crew_id);
    if call_action not in ('claim','complete','cancel') or call_action is null then raise exception 'Invalid callback action.'; end if;
    if call_action='cancel' then
      if req.requester<>actor and not exists(select 1 from bulavata.crews where id=req.crew_id and owner=actor) then raise exception 'Callback unavailable.' using errcode='42501'; end if;
    elsif not exists(select 1 from bulavata.crews where id=req.crew_id and owner=actor) then raise exception 'Only the Koro owner manages callbacks.' using errcode='42501'; end if;
    if req.state not in ('queued','claimed') then return to_jsonb(req); end if;
    update bulavata.call_callbacks set state=case call_action when 'claim' then 'claimed' when 'complete' then 'done' else 'cancelled' end,updated_at=clock_timestamp() where id=req.id returning * into req;
    return to_jsonb(req);
  end if;

  select * into r from bulavata.call_rooms where id=cid for update;
  if r.id is null then raise exception 'This call is unavailable.'; end if;
  perform bulavata.call_require_crew(r.crew_id);
  perform bulavata.call_sweep(cid);
  select * into r from bulavata.call_rooms where id=cid;
  if p_action='snapshot' then return bulavata.call_snapshot(cid); end if;
  if r.status='ended' then raise exception 'This call has ended.'; end if;
  select * into person from bulavata.call_people where call_id=cid and member=actor;
  if p_action='act' and call_action in ('accept','join') then
    if device is null then raise exception 'A call device is required.'; end if;
    if person.state in ('kicked','rejected') then raise exception 'The host has closed your admission.' using errcode='42501'; end if;
    if person.state in ('joined','waiting') and person.device_id is distinct from device then raise exception 'This call was answered on another device.'; end if;
    if exists(select 1 from bulavata.call_people p join bulavata.call_rooms a on a.id=p.call_id where p.member=actor and p.state in ('joined','waiting') and a.status<>'ended' and a.id<>cid) then raise exception 'Leave your current call first.'; end if;
    if person.state<>'joined' or person.state is null then
      select count(*) into n from bulavata.call_people where call_id=cid and state='joined';
      if n>=r.capacity then raise exception 'This call is full.'; end if;
    end if;
    -- A rejoin starts a new media negotiation; do not replay an expired device's SDP.
    if person.state is null or person.state not in ('joined','waiting') then
      delete from bulavata.call_signals where call_id=cid and (sender=actor or recipient=actor);
    end if;
    insert into bulavata.call_people(call_id,member,state,device_id,joined_at,last_seen)
      values(cid,actor,case when r.lobby and r.host<>actor then 'waiting' else 'joined' end,device,clock_timestamp(),clock_timestamp())
      on conflict(call_id,member) do update set state=case when call_people.state='joined' then 'joined' else excluded.state end,
        device_id=excluded.device_id,joined_at=coalesce(call_people.joined_at,excluded.joined_at),last_seen=excluded.last_seen;
    if (select count(*) from bulavata.call_people where call_id=cid and state='joined')>1 then update bulavata.call_rooms set status='active' where id=cid; end if;
    return bulavata.call_snapshot(cid);
  elsif p_action='act' and call_action in ('decline','busy') then
    if person.state in ('joined','waiting') then raise exception 'Leave the call on the device that answered it.'; end if;
    if person.state in ('kicked','rejected') then raise exception 'The host has closed your admission.' using errcode='42501'; end if;
    insert into bulavata.call_people(call_id,member,state) values(cid,actor,case when call_action='busy' then 'busy' else 'declined' end)
      on conflict(call_id,member) do update set state=excluded.state;
    return bulavata.call_snapshot(cid);
  elsif p_action='act' and call_action in ('end','kick','admit','reject') then
    if actor<>r.host and not (call_action='end' and exists(select 1 from bulavata.crews where id=r.crew_id and owner=actor)) then raise exception 'Only the host manages this call.' using errcode='42501'; end if;
    if call_action='end' then
      update bulavata.call_rooms set status='ended',ended_at=clock_timestamp(),end_reason='host_ended' where id=cid;
      perform bulavata.call_sweep(cid);
    else
      if target is null or target=r.host then raise exception 'Choose another participant.'; end if;
      if call_action='admit' then
        if not exists(select 1 from bulavata.crew_members where crew_id=r.crew_id and member=target) then raise exception 'This person left the Koro.'; end if;
        if (select count(*) from bulavata.call_people where call_id=cid and state='joined')>=r.capacity then raise exception 'This call is full.'; end if;
        update bulavata.call_people set state='joined',last_seen=clock_timestamp() where call_id=cid and member=target and state='waiting';
        if not found then raise exception 'This person is no longer waiting.'; end if;
        update bulavata.call_rooms set status='active' where id=cid;
      else
        update bulavata.call_people set state=case when call_action='kick' then 'kicked' else 'rejected' end,recording=false,device_id=null where call_id=cid and member=target;
        delete from bulavata.call_signals where call_id=cid and (sender=target or recipient=target);
      end if;
    end if;
    return bulavata.call_snapshot(cid);
  end if;

  if person.state not in ('joined','waiting') or person.state is null or person.device_id is distinct from device or device is null then raise exception 'This device has not joined the call.' using errcode='42501'; end if;
  if p_action='act' and call_action='heartbeat' then
    update bulavata.call_people set last_seen=clock_timestamp() where call_id=cid and member=actor;
  elsif p_action='act' and call_action='leave' then
    update bulavata.call_people set state='left',recording=false,device_id=null where call_id=cid and member=actor;
    if actor=r.host then update bulavata.call_rooms set status='ended',ended_at=clock_timestamp(),end_reason='host_left' where id=cid; perform bulavata.call_sweep(cid); end if;
    delete from bulavata.call_signals where call_id=cid and (sender=actor or recipient=actor);
  elsif p_action='act' and call_action in ('record_start','record_stop') and person.state='joined' then
    update bulavata.call_people set recording=(call_action='record_start'),last_seen=clock_timestamp() where call_id=cid and member=actor;
  elsif p_action='position' and person.state='joined' then
    if (p_args->>'x')::real not between 0 and 1 or (p_args->>'y')::real not between 0 and 1 or p_args->>'x' is null or p_args->>'y' is null then raise exception 'Invalid room position.'; end if;
    update bulavata.call_people set spatial_x=(p_args->>'x')::real,spatial_y=(p_args->>'y')::real,last_seen=clock_timestamp() where call_id=cid and member=actor;
  elsif p_action in ('signal','signals') and person.state='joined' then
    if p_action='signal' then
      if target is null or target=actor or kind not in ('offer','answer','ice') or kind is null then raise exception 'Invalid signal recipient or type.'; end if;
      if not exists(select 1 from bulavata.call_people p join bulavata.crew_members m on m.member=p.member and m.crew_id=r.crew_id where p.call_id=cid and p.member=target and p.state='joined' and p.last_seen>clock_timestamp()-interval '60 seconds') then raise exception 'Recipient is no longer in this call.' using errcode='42501'; end if;
      if kind in ('offer','answer') and (jsonb_typeof(payload)<>'object' or payload->>'type' is distinct from kind or payload->>'sdp' is null or char_length(payload->>'sdp')<1) then raise exception 'Invalid session description.'; end if;
      if kind='ice' and payload is not null and payload<>'null'::jsonb and jsonb_typeof(payload)<>'object' then raise exception 'Invalid ICE candidate.'; end if;
      if octet_length(coalesce(payload::text,'null'))>(case when kind='ice' then 8192 else 98304 end) then raise exception 'Signal exceeds its size limit.'; end if;
      if (select count(*) from bulavata.call_signals where sender=actor and created_at>clock_timestamp()-interval '10 seconds')>=300 then raise exception 'Signaling rate limit reached.'; end if;
      insert into bulavata.call_signals(call_id,sender,sender_device,recipient,kind,payload) values(cid,actor,device,target,kind,payload) returning id into signal_id;
      return to_jsonb(signal_id);
    else
      select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]'::jsonb) into result from (
        select s.id,s.sender,s.recipient,s.kind,s.payload,s.created_at from bulavata.call_signals s
        join bulavata.call_people p on p.call_id=s.call_id and p.member=s.sender
        where s.call_id=cid and s.recipient=actor and s.id>greatest(coalesce((p_args->>'after')::bigint,0),0)
        and s.expires_at>clock_timestamp() and p.state='joined' and p.device_id=s.sender_device
        and p.last_seen>clock_timestamp()-interval '60 seconds'
        and exists(select 1 from bulavata.crew_members m where m.crew_id=r.crew_id and m.member=s.sender)
        order by s.id limit 200) q;
      return result;
    end if;
  else raise exception 'Invalid call action.';
  end if;
  return bulavata.call_snapshot(cid);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_call_start(p_crew bigint, p_mode text, p_lobby boolean, p_capacity integer, p_device uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('start',jsonb_build_object('crew',p_crew,'mode',p_mode,'lobby',p_lobby,'capacity',p_capacity,'device',p_device))$function$
;

CREATE OR REPLACE FUNCTION public.bv_call_list(p_crew bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('list',jsonb_build_object('crew',p_crew))$function$
;

CREATE OR REPLACE FUNCTION public.bv_call_snapshot(p_call uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('snapshot',jsonb_build_object('call',p_call))$function$
;

CREATE OR REPLACE FUNCTION public.bv_call_act(p_call uuid, p_action text, p_device uuid, p_target uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('act',jsonb_build_object('call',p_call,'action',p_action,'device',p_device,'target',p_target))$function$
;

CREATE OR REPLACE FUNCTION public.bv_call_signal(p_call uuid, p_to uuid, p_kind text, p_payload jsonb, p_device uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('signal',jsonb_build_object('call',p_call,'target',p_to,'kind',p_kind,'payload',p_payload,'device',p_device))$function$
;

CREATE OR REPLACE FUNCTION public.bv_call_signals(p_call uuid, p_after bigint, p_device uuid)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('signals',jsonb_build_object('call',p_call,'after',p_after,'device',p_device))$function$
;

CREATE OR REPLACE FUNCTION public.bv_call_position(p_call uuid, p_device uuid, p_x real, p_y real)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('position',jsonb_build_object('call',p_call,'device',p_device,'x',p_x,'y',p_y))$function$
;

CREATE OR REPLACE FUNCTION public.bv_callback_request(p_crew bigint, p_note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('callback_request',jsonb_build_object('crew',p_crew,'note',p_note))$function$
;

CREATE OR REPLACE FUNCTION public.bv_callback_list(p_crew bigint)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('callback_list',jsonb_build_object('crew',p_crew))$function$
;

CREATE OR REPLACE FUNCTION public.bv_callback_act(p_request uuid, p_action text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('callback_act',jsonb_build_object('request',p_request,'action',p_action))$function$
;

CREATE OR REPLACE FUNCTION public.bv_call_availability(p_crew bigint, p_available boolean DEFAULT NULL::boolean)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO ''
AS $function$select bulavata.call_rpc('availability',jsonb_build_object('crew',p_crew,'available',p_available))$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_type(p_type text)
 RETURNS TABLE(circle_type text, skin_id text, emoji text, accent text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  SELECT * FROM (VALUES
    ('kava','grog','🥥','#efc187'),
    ('tale','studio-ocean','🤝','#6de6dd'),
    ('kakase','kula','💬','#b52b50'),
    ('lotu','masi-white','🙏','#756035'),
    ('koro','village','🪸','#246347'),
    ('mataqali','core-masi','🌿','#7a412c'),
    ('school','varsity','🎓','#8f2d40'),
    ('old-boys','occasion-school-reunion','🎓','#875016'),
    ('old-girls','occasion-school-reunion','🎓','#875016'),
    ('family','occasion-family-reunion','🏡','#246347'),
    ('music','sigidrigi','🎶','#c4b7fc'),
    ('other','lagoon','💬','#086779')
  ) AS t(circle_type,skin_id,emoji,accent) WHERE t.circle_type=p_type;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_groups()
 RETURNS TABLE(id bigint, name text, emoji text, accent text, join_code text, members bigint, last_at timestamp with time zone, owner uuid, circle_type text, skin_id text, graph_visibility text, show_on_graph boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  RETURN QUERY
    SELECT c.id,c.name,c.emoji,c.accent,c.join_code,
      (SELECT count(*) FROM bulavata.crew_members m2 WHERE m2.crew_id=c.id),
      (SELECT x.created_at FROM bulavata.crew_messages x WHERE x.crew_id=c.id ORDER BY x.created_at DESC LIMIT 1),
      c.owner,t.circle_type,t.skin_id,coalesce(s.graph_visibility,'private'),coalesce(ms.show_on_graph,false)
    FROM bulavata.crews c
    JOIN bulavata.crew_members m ON m.crew_id=c.id AND m.member=v_uid
    LEFT JOIN bulavata.talanoa_group_settings s ON s.crew_id=c.id
    CROSS JOIN LATERAL bulavata_talanoa_private.talanoa_type(coalesce(s.circle_type,'koro')) t
    LEFT JOIN bulavata.talanoa_member_graph_settings ms ON ms.crew_id=c.id AND ms.member=v_uid
    ORDER BY 7 DESC NULLS LAST,c.id;
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_group_row(p_crew bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT to_jsonb(g) FROM bulavata_talanoa_private.talanoa_groups() g WHERE g.id=p_crew;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_create_group(p_name text, p_type text, p_graph_visibility text, p_show_on_graph boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id bigint; v_type record; v_name text := btrim(p_name);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  IF v_name IS NULL OR char_length(v_name) NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'Use a circle name of 1 to 40 characters' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_type FROM bulavata_talanoa_private.talanoa_type(p_type);
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown circle type' USING ERRCODE='22023'; END IF;
  IF p_graph_visibility IS NULL OR p_graph_visibility NOT IN ('private','public') OR p_show_on_graph IS NULL THEN
    RAISE EXCEPTION 'Invalid graph choice' USING ERRCODE='22023';
  END IF;
  -- Use the physical table's existing kind and join_code defaults.
  INSERT INTO bulavata.crews(name,emoji,accent,owner)
    VALUES (v_name,v_type.emoji,v_type.accent,v_uid) RETURNING id INTO v_id;
  INSERT INTO bulavata.talanoa_group_settings(crew_id,circle_type,graph_visibility)
    VALUES (v_id,p_type,p_graph_visibility);
  INSERT INTO bulavata.crew_members(crew_id,member) VALUES (v_id,v_uid);
  INSERT INTO bulavata.talanoa_member_graph_settings(crew_id,member,show_on_graph)
    VALUES (v_id,v_uid,p_show_on_graph);
  RETURN bulavata_talanoa_private.talanoa_group_row(v_id);
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_update_group(p_crew bigint, p_type text, p_graph_visibility text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_type record;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM bulavata.crews c WHERE c.id=p_crew AND c.owner=v_uid
    AND EXISTS (SELECT 1 FROM bulavata.crew_members m WHERE m.crew_id=c.id AND m.member=v_uid) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle owner required' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_type FROM bulavata_talanoa_private.talanoa_type(p_type);
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown circle type' USING ERRCODE='22023'; END IF;
  IF p_graph_visibility IS NULL OR p_graph_visibility NOT IN ('private','public') THEN
    RAISE EXCEPTION 'Invalid graph choice' USING ERRCODE='22023';
  END IF;
  INSERT INTO bulavata.talanoa_group_settings(crew_id,circle_type,graph_visibility)
    VALUES (p_crew,p_type,p_graph_visibility)
    ON CONFLICT (crew_id) DO UPDATE SET circle_type=EXCLUDED.circle_type,graph_visibility=EXCLUDED.graph_visibility;
  UPDATE bulavata.crews SET emoji=v_type.emoji,accent=v_type.accent WHERE id=p_crew;
  RETURN bulavata_talanoa_private.talanoa_group_row(p_crew);
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_graph_choice(p_crew bigint, p_visible boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM bulavata.crew_members m WHERE m.crew_id=p_crew AND m.member=v_uid) THEN
    RAISE EXCEPTION 'Circle membership required' USING ERRCODE='42501';
  END IF;
  IF p_visible IS NULL THEN RAISE EXCEPTION 'Invalid graph choice' USING ERRCODE='22023'; END IF;
  INSERT INTO bulavata.talanoa_member_graph_settings(crew_id,member,show_on_graph) VALUES (p_crew,v_uid,p_visible)
    ON CONFLICT (crew_id,member) DO UPDATE SET show_on_graph=EXCLUDED.show_on_graph;
  RETURN p_visible;
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_my_graph_visibility()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_visibility text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  SELECT s.graph_visibility INTO v_visibility FROM bulavata.talanoa_personal_graph_settings s WHERE s.member=v_uid;
  RETURN coalesce(v_visibility,'private');
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_set_graph_visibility(p_visibility text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  IF p_visibility IS NULL OR p_visibility NOT IN ('private','public') THEN
    RAISE EXCEPTION 'Invalid graph visibility' USING ERRCODE='22023';
  END IF;
  INSERT INTO bulavata.talanoa_personal_graph_settings(member,graph_visibility) VALUES (v_uid,p_visibility)
    ON CONFLICT (member) DO UPDATE SET graph_visibility=EXCLUDED.graph_visibility;
  RETURN p_visibility;
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_invitation(p_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_result jsonb; v_code text := btrim(p_code);
BEGIN
  IF v_code IS NULL OR v_code !~ '^[a-f0-9]{10}$' THEN
    RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002';
  END IF;
  SELECT jsonb_build_object('id',c.id,'name',c.name,'circle_type',t.circle_type,'skin_id',t.skin_id,
    'graph_visibility',coalesce(s.graph_visibility,'private')) INTO v_result
  FROM bulavata.crews c
  LEFT JOIN bulavata.talanoa_group_settings s ON s.crew_id=c.id
  CROSS JOIN LATERAL bulavata_talanoa_private.talanoa_type(coalesce(s.circle_type,'koro')) t
  WHERE c.join_code=v_code;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_join_circle(p_code text, p_show_on_graph boolean)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id bigint; v_code text := btrim(p_code);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  IF p_show_on_graph IS NULL THEN RAISE EXCEPTION 'Invalid graph choice' USING ERRCODE='22023'; END IF;
  IF v_code IS NULL OR v_code !~ '^[a-f0-9]{10}$' THEN
    RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002';
  END IF;
  SELECT c.id INTO v_id FROM bulavata.crews c WHERE c.join_code=v_code FOR KEY SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invitation unavailable' USING ERRCODE='P0002'; END IF;
  INSERT INTO bulavata.crew_members(crew_id,member) VALUES (v_id,v_uid) ON CONFLICT (crew_id,member) DO NOTHING;
  INSERT INTO bulavata.talanoa_member_graph_settings(crew_id,member,show_on_graph) VALUES (v_id,v_uid,p_show_on_graph)
    ON CONFLICT (crew_id,member) DO UPDATE SET show_on_graph=EXCLUDED.show_on_graph;
  RETURN v_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_circle_graph(p_crew bigint, p_public_only boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_group record; v_member boolean; v_full boolean;
  v_nodes jsonb; v_edges jsonb; v_group_id text := 'group:'||p_crew::text;
BEGIN
  SELECT c.name,c.emoji,coalesce(s.graph_visibility,'private') AS visibility INTO v_group
    FROM bulavata.crews c LEFT JOIN bulavata.talanoa_group_settings s ON s.crew_id=c.id WHERE c.id=p_crew;
  IF NOT FOUND THEN RAISE EXCEPTION 'Circle graph unavailable' USING ERRCODE='42501'; END IF;
  v_member := v_uid IS NOT NULL AND EXISTS (SELECT 1 FROM bulavata.crew_members m WHERE m.crew_id=p_crew AND m.member=v_uid);
  v_full := v_member AND p_public_only IS FALSE;
  IF NOT v_full AND v_group.visibility<>'public' THEN
    RAISE EXCEPTION 'Circle graph unavailable' USING ERRCODE='42501';
  END IF;
  WITH people AS (
    SELECT p.handle,coalesce(nullif(p.display_name,''),p.handle) AS label,coalesce(p.avatar_emoji,'🌺') AS emoji,
      CASE WHEN v_full AND p.id=v_uid THEN 'you' ELSE 'person' END AS node_type
    FROM bulavata.crew_members m JOIN bulavata.profiles p ON p.id=m.member
    LEFT JOIN bulavata.talanoa_member_graph_settings s ON s.crew_id=m.crew_id AND s.member=m.member
    WHERE m.crew_id=p_crew AND (v_full OR coalesce(s.show_on_graph,false))
    ORDER BY p.handle,p.id LIMIT 120
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id','person:'||p.handle,'type',p.node_type,
      'label',p.label,'handle',p.handle,'emoji',p.emoji) ORDER BY p.handle),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('source',v_group_id,'target','person:'||p.handle,'type','member') ORDER BY p.handle),'[]'::jsonb)
    INTO v_nodes,v_edges FROM people p;
  RETURN jsonb_build_object('kind','circle','title',v_group.name,'visibility',CASE WHEN v_full THEN 'private' ELSE 'public' END,
    'nodes',jsonb_build_array(jsonb_build_object('id',v_group_id,'type','group','label',v_group.name,'emoji',coalesce(v_group.emoji,'🪸')))||v_nodes,
    'edges',v_edges);
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_public_personal_graph(p_handle text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_owner record; v_nodes jsonb; v_edges jsonb; v_center text;
BEGIN
  IF p_handle IS NULL OR p_handle !~ '^[a-z0-9_]{3,20}$' THEN
    RAISE EXCEPTION 'Personal graph unavailable' USING ERRCODE='42501';
  END IF;
  SELECT p.id,p.handle,coalesce(nullif(p.display_name,''),p.handle) AS label,coalesce(p.avatar_emoji,'🌺') AS emoji
    INTO v_owner FROM bulavata.profiles p
    JOIN bulavata.talanoa_personal_graph_settings s ON s.member=p.id AND s.graph_visibility='public'
    WHERE p.handle=p_handle;
  IF NOT FOUND THEN RAISE EXCEPTION 'Personal graph unavailable' USING ERRCODE='42501'; END IF;
  v_center := 'person:'||v_owner.handle;
  WITH friend_ids AS (
    SELECT f.addressee AS member FROM bulavata.friendships f WHERE f.requester=v_owner.id AND f.status='accepted'
    UNION
    SELECT f.requester FROM bulavata.friendships f WHERE f.addressee=v_owner.id AND f.status='accepted'
  ), people AS (
    SELECT p.handle,coalesce(nullif(p.display_name,''),p.handle) AS label,coalesce(p.avatar_emoji,'🌺') AS emoji
    FROM friend_ids f JOIN bulavata.profiles p ON p.id=f.member
    JOIN bulavata.talanoa_personal_graph_settings s ON s.member=p.id AND s.graph_visibility='public'
    WHERE p.id<>v_owner.id ORDER BY p.handle,p.id LIMIT 120
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('id','person:'||p.handle,'type','person','label',p.label,
      'handle',p.handle,'emoji',p.emoji) ORDER BY p.handle),'[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('source',v_center,'target','person:'||p.handle,'type','friend') ORDER BY p.handle),'[]'::jsonb)
    INTO v_nodes,v_edges FROM people p;
  RETURN jsonb_build_object('kind','personal','title',v_owner.label||'''s friends','visibility','public',
    'nodes',jsonb_build_array(jsonb_build_object('id',v_center,'type','you','label',v_owner.label,'handle',v_owner.handle,'emoji',v_owner.emoji))||v_nodes,
    'edges',v_edges);
END;
$function$
;

CREATE OR REPLACE FUNCTION bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL OR (p_expected_owner IS NOT NULL AND p_expected_owner<>v_uid) THEN
    RAISE EXCEPTION 'Account changed. Sign in again.' USING ERRCODE='42501';
  END IF;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_circle_groups()
 RETURNS TABLE(id bigint, name text, emoji text, accent text, join_code text, members bigint, last_at timestamp with time zone, owner uuid, circle_type text, skin_id text, graph_visibility text, show_on_graph boolean)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT * FROM bulavata_talanoa_private.talanoa_groups(); $function$
;

CREATE OR REPLACE FUNCTION public.bv_circle_create_group(p_name text, p_type text, p_graph_visibility text DEFAULT 'private'::text, p_show_on_graph boolean DEFAULT false, p_expected_owner uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner);
  RETURN bulavata_talanoa_private.talanoa_create_group(p_name,p_type,p_graph_visibility,p_show_on_graph);
END; $function$
;

CREATE OR REPLACE FUNCTION public.bv_circle_update_group(p_crew bigint, p_type text, p_graph_visibility text, p_expected_owner uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner);
  RETURN bulavata_talanoa_private.talanoa_update_group(p_crew,p_type,p_graph_visibility);
END; $function$
;

CREATE OR REPLACE FUNCTION public.bv_circle_graph_choice(p_crew bigint, p_visible boolean, p_expected_owner uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner);
  RETURN bulavata_talanoa_private.talanoa_graph_choice(p_crew,p_visible);
END; $function$
;

CREATE OR REPLACE FUNCTION public.bv_my_graph_visibility()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT bulavata_talanoa_private.talanoa_my_graph_visibility(); $function$
;

CREATE OR REPLACE FUNCTION public.bv_set_graph_visibility(p_visibility text, p_expected_owner uuid DEFAULT NULL::uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner);
  RETURN bulavata_talanoa_private.talanoa_set_graph_visibility(p_visibility);
END; $function$
;

CREATE OR REPLACE FUNCTION public.bv_circle_invitation(p_code text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT bulavata_talanoa_private.talanoa_invitation(p_code); $function$
;

CREATE OR REPLACE FUNCTION public.bv_join_circle(p_code text, p_show_on_graph boolean DEFAULT false, p_expected_owner uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  PERFORM bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner);
  RETURN bulavata_talanoa_private.talanoa_join_circle(p_code,p_show_on_graph);
END; $function$
;

CREATE OR REPLACE FUNCTION public.bv_circle_graph(p_crew bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT bulavata_talanoa_private.talanoa_circle_graph(p_crew,false); $function$
;

CREATE OR REPLACE FUNCTION public.bv_public_circle_graph(p_crew bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT bulavata_talanoa_private.talanoa_circle_graph(p_crew,true); $function$
;

CREATE OR REPLACE FUNCTION public.bv_public_personal_graph(p_handle text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT bulavata_talanoa_private.talanoa_public_personal_graph(p_handle); $function$
;

CREATE OR REPLACE FUNCTION bulavata.gift_friends(a uuid, b uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from bulavata.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a)));
$function$
;

CREATE OR REPLACE FUNCTION bulavata.gifts_used(who uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::int from bulavata.gifts
  where giver = who and created_at > now() - interval '24 hours';
$function$
;

CREATE OR REPLACE FUNCTION public.bv_gifts_left()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select greatest(0, 3 - bulavata.gifts_used((select auth.uid())));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_gift_send(p_to uuid, p_gift text, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  used int;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_to is null or p_to = me then raise exception 'SELF_GIFT'; end if;
  if not bulavata.gift_friends(me, p_to) then raise exception 'NOT_FRIENDS'; end if;
  perform pg_advisory_xact_lock(hashtext('bv_gift:' || me::text));
  used := bulavata.gifts_used(me);
  if used >= 3 then raise exception 'OUT_OF_GIFTS'; end if;
  insert into bulavata.gifts (giver, receiver, gift, note)
  values (me, p_to, p_gift, nullif(btrim(left(coalesce(p_note, ''), 80)), ''));
  return greatest(0, 2 - used);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_gifts_for(p_owner uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  mine boolean;
  fr boolean;
begin
  if me is null or p_owner is null then return jsonb_build_object('visible', false); end if;
  mine := (me = p_owner);
  fr := bulavata.gift_friends(me, p_owner);
  if not mine and not fr then return jsonb_build_object('visible', false); end if;
  return jsonb_build_object(
    'visible',  true,
    'is_me',    mine,
    'can_send', fr and not mine,
    'left',     greatest(0, 3 - bulavata.gifts_used(me)),
    'counts',   coalesce((select jsonb_object_agg(gift, n) from (
                  select gift, count(*) n from bulavata.gifts
                  where receiver = p_owner and not hidden group by gift) s), '{}'::jsonb),
    'recent',   coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id desc) from (
                  select g.id, g.gift, g.note, g.created_at, p.handle, p.avatar_emoji
                  from bulavata.gifts g join bulavata.profiles p on p.id = g.giver
                  where g.receiver = p_owner and not g.hidden
                  order by g.created_at desc, g.id desc limit 12) r), '[]'::jsonb));
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_gift_hide(p_id bigint)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with u as (
    update bulavata.gifts set hidden = true
    where id = p_id and receiver = (select auth.uid()) returning 1)
  select exists (select 1 from u);
$function$
;

CREATE OR REPLACE FUNCTION bulavata.can_see_moment(p_author uuid, p_audience text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_author = (select auth.uid())
      or (bulavata.are_friends((select auth.uid()), p_author)
          and (p_audience = 'friends'
               or exists (select 1 from bulavata.close_friends c
                          where c.owner = p_author and c.friend = (select auth.uid()))));
$function$
;

CREATE OR REPLACE FUNCTION bulavata.target_author(p_kind text, p_id bigint)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case p_kind
    when 'moment'  then (select m.author from bulavata.moments m where m.id = p_id)
    when 'pulse'   then (select p.author from bulavata.pulses p where p.id = p_id)
    when 'wall'    then (select w.wall_owner from bulavata.wall_posts w where w.id = p_id)
    when 'comment' then (select c.author from bulavata.comments c where c.id = p_id)
    when 'story'   then (select s.author from bulavata.stories s where s.id = p_id)
    when 'message' then (select x.author from bulavata.crew_messages x where x.id = p_id)
  end;
$function$
;

CREATE OR REPLACE FUNCTION bulavata.can_see_target(p_kind text, p_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a uuid; aud text; crew bigint; begin
  if p_kind = 'moment' then
    select author, audience into a, aud from bulavata.moments where id = p_id;
    return found and bulavata.can_see_moment(a, aud);
  elsif p_kind = 'story' then
    select author, audience into a, aud from bulavata.stories where id = p_id;
    return found and bulavata.can_see_moment(a, aud);
  elsif p_kind = 'message' then
    select crew_id into crew from bulavata.crew_messages where id = p_id and not deleted and (expires_at is null or expires_at > now());
    return found and bulavata.in_crew(crew);
  else
    a := bulavata.target_author(p_kind, p_id);
    return a is not null and (a = (select auth.uid()) or bulavata.are_friends((select auth.uid()), a));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.reaction_summary(p_kind text, p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(r.reaction, r.n)
                        from (select reaction, count(*) n from bulavata.reactions
                              where target_kind = p_kind and target_id = p_id group by reaction) r), '{}'::jsonb),
    'mine', (select reaction from bulavata.reactions
             where target_kind = p_kind and target_id = p_id and giver = (select auth.uid())));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_react(p_kind text, p_id bigint, p_reaction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if (select auth.uid()) is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not bulavata.can_see_target(p_kind, p_id) then raise exception 'NOT_VISIBLE'; end if;
  if p_reaction is null or p_reaction = '' then
    delete from bulavata.reactions where giver = (select auth.uid()) and target_kind = p_kind and target_id = p_id;
  else
    insert into bulavata.reactions(giver, target_kind, target_id, reaction)
    values ((select auth.uid()), p_kind, p_id, p_reaction)
    on conflict (giver, target_kind, target_id) do update set reaction = excluded.reaction, created_at = now();
  end if;
  return bulavata.reaction_summary(p_kind, p_id);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_reactors(p_kind text, p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when bulavata.can_see_target(p_kind, p_id) then coalesce((
    select jsonb_agg(jsonb_build_object('handle', p.handle, 'avatar_emoji', p.avatar_emoji, 'reaction', r.reaction) order by r.created_at desc)
    from bulavata.reactions r join bulavata.profiles p on p.id = r.giver
    where r.target_kind = p_kind and r.target_id = p_id), '[]'::jsonb) else '[]'::jsonb end;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_comment(p_kind text, p_id bigint, p_body text, p_parent bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c bulavata.comments; begin
  if (select auth.uid()) is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not bulavata.can_see_target(p_kind, p_id) then raise exception 'NOT_VISIBLE'; end if;
  if p_parent is not null and not exists (select 1 from bulavata.comments
      where id = p_parent and target_kind = p_kind and target_id = p_id) then raise exception 'BAD_PARENT'; end if;
  insert into bulavata.comments(target_kind, target_id, author, parent_id, body)
  values (p_kind, p_id, (select auth.uid()), p_parent, p_body) returning * into c;
  return jsonb_build_object('id', c.id, 'created_at', c.created_at);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_comments(p_kind text, p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when bulavata.can_see_target(p_kind, p_id) then coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'parent_id', c.parent_id, 'author', c.author,
      'handle', p.handle, 'avatar_emoji', p.avatar_emoji, 'accent', p.room_accent,
      'body', case when c.deleted then null else c.body end, 'deleted', c.deleted, 'created_at', c.created_at,
      'reactions', bulavata.reaction_summary('comment', c.id)) order by c.created_at asc)
    from bulavata.comments c join bulavata.profiles p on p.id = c.author
    where c.target_kind = p_kind and c.target_id = p_id), '[]'::jsonb) else '[]'::jsonb end;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_comment_delete(p_id bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update bulavata.comments set deleted = true, body = '' where id = p_id
    and (author = (select auth.uid()) or bulavata.target_author(target_kind, target_id) = (select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_bookmark_toggle(p_kind text, p_id bigint, p_folder text DEFAULT ''::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare existed boolean; begin
  if (select auth.uid()) is null then raise exception 'NOT_SIGNED_IN'; end if;
  delete from bulavata.bookmarks where owner = (select auth.uid()) and target_kind = p_kind and target_id = p_id;
  existed := found;
  if existed then return false; end if;
  if not bulavata.can_see_target(p_kind, p_id) then raise exception 'NOT_VISIBLE'; end if;
  insert into bulavata.bookmarks(owner, target_kind, target_id, folder) values ((select auth.uid()), p_kind, p_id, coalesce(p_folder,''));
  return true;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_bookmarks()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.target_kind, 'target_id', b.target_id,
      'folder', b.folder, 'saved_at', b.created_at,
      'body', case b.target_kind when 'moment' then (select m.body from bulavata.moments m where m.id = b.target_id)
                                 when 'pulse' then (select p.text from bulavata.pulses p where p.id = b.target_id)
                                 else (select w.body from bulavata.wall_posts w where w.id = b.target_id) end,
      'media_url', case b.target_kind when 'moment' then (select m.media_url from bulavata.moments m where m.id = b.target_id) end,
      'handle', (select p.handle from bulavata.profiles p where p.id = bulavata.target_author(b.target_kind, b.target_id)))
      order by b.created_at desc)
    from bulavata.bookmarks b where b.owner = (select auth.uid())), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_moment_edit(p_id bigint, p_body text, p_media_url text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare m bulavata.moments; begin
  select * into m from bulavata.moments where id = p_id and author = (select auth.uid());
  if not found then raise exception 'NOT_YOURS'; end if;
  if m.created_at < now() - interval '1 hour' then raise exception 'EDIT_WINDOW_CLOSED'; end if;
  if m.edit_count >= 5 then raise exception 'EDIT_LIMIT'; end if;
  if coalesce(p_body,'') = '' and coalesce(p_media_url,'') = '' then raise exception 'EMPTY'; end if;
  insert into bulavata.moment_edits(moment_id, old_body, old_media_url) values (m.id, m.body, m.media_url);
  update bulavata.moments set body = p_body, media_url = nullif(p_media_url,''), edited_at = now(), edit_count = edit_count + 1 where id = m.id;
  return jsonb_build_object('edit_count', m.edit_count + 1);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_moment_history(p_id bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when bulavata.can_see_target('moment', p_id) then coalesce((
    select jsonb_agg(jsonb_build_object('body', e.old_body, 'media_url', e.old_media_url, 'edited_at', e.edited_at) order by e.edited_at desc)
    from bulavata.moment_edits e where e.moment_id = p_id), '[]'::jsonb) else '[]'::jsonb end;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_moment_repost(p_id bigint, p_quote text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare new_id bigint; begin
  if (select auth.uid()) is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not bulavata.can_see_target('moment', p_id) then raise exception 'NOT_VISIBLE'; end if;
  if p_quote is null and exists (select 1 from bulavata.moments where author = (select auth.uid()) and repost_of = p_id and body is null)
    then raise exception 'ALREADY_REPOSTED'; end if;
  insert into bulavata.moments(author, body, repost_of) values ((select auth.uid()), nullif(p_quote,''), p_id) returning id into new_id;
  return new_id;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_poll_create(p_moment bigint, p_question text, p_options text[], p_hours integer DEFAULT 24)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pid bigint; begin
  if not exists (select 1 from bulavata.moments where id = p_moment and author = (select auth.uid())) then raise exception 'NOT_YOURS'; end if;
  insert into bulavata.polls(moment_id, question, options, closes_at)
  values (p_moment, p_question, p_options, now() + make_interval(hours => greatest(1, least(p_hours, 168)))) returning id into pid;
  return pid;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.poll_json(p_moment bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select (select jsonb_build_object('id', p.id, 'question', p.question, 'options', to_jsonb(p.options), 'closes_at', p.closes_at,
            'closed', p.closes_at < now(),
            'total', (select count(*) from bulavata.poll_votes v where v.poll_id = p.id),
            'counts', (select coalesce(jsonb_agg(coalesce(n,0) order by i), '[]'::jsonb) from generate_series(0, array_length(p.options,1)-1) i
                       left join (select choice, count(*) n from bulavata.poll_votes where poll_id = p.id group by choice) c on c.choice = i),
            'mine', (select choice from bulavata.poll_votes v where v.poll_id = p.id and v.voter = (select auth.uid())))
          from bulavata.polls p where p.moment_id = p_moment);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_poll_vote(p_poll bigint, p_choice integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare mid bigint; begin
  select moment_id into mid from bulavata.polls where id = p_poll and closes_at > now();
  if not found then raise exception 'POLL_CLOSED'; end if;
  if not bulavata.can_see_target('moment', mid) then raise exception 'NOT_VISIBLE'; end if;
  insert into bulavata.poll_votes(poll_id, voter, choice) values (p_poll, (select auth.uid()), p_choice)
  on conflict (poll_id, voter) do update set choice = excluded.choice, created_at = now();
  return bulavata.poll_json(mid);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_close_friend_set(p_friend uuid, p_on boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if p_on then
    if not bulavata.are_friends((select auth.uid()), p_friend) then raise exception 'NOT_FRIENDS'; end if;
    insert into bulavata.close_friends(owner, friend) values ((select auth.uid()), p_friend) on conflict do nothing;
  else
    delete from bulavata.close_friends where owner = (select auth.uid()) and friend = p_friend;
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_close_friends()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'handle', p.handle, 'display_name', p.display_name, 'avatar_emoji', p.avatar_emoji) order by p.handle)
    from bulavata.close_friends c join bulavata.profiles p on p.id = c.friend where c.owner = (select auth.uid())), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_story_post(p_body text, p_media_url text DEFAULT NULL::text, p_kind text DEFAULT 'story'::text, p_audience text DEFAULT 'friends'::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare sid bigint; begin
  if (select auth.uid()) is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_kind = 'note' then
    delete from bulavata.stories where author = (select auth.uid()) and kind = 'note' and highlight_title is null;
  end if;
  insert into bulavata.stories(author, kind, body, media_url, audience)
  values ((select auth.uid()), p_kind, nullif(p_body,''), nullif(p_media_url,''), p_audience) returning id into sid;
  return sid;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_stories()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with live as (
    select s.* from bulavata.stories s
    where s.expires_at > now()
      and (s.author = (select auth.uid()) or s.author in (select c.id from bulavata.my_circle() c))
      and bulavata.can_see_moment(s.author, s.audience))
  select coalesce((select jsonb_agg(person order by (person->>'latest') desc) from (
    select jsonb_build_object('author', l.author, 'handle', p.handle, 'display_name', p.display_name,
      'avatar_emoji', p.avatar_emoji, 'accent', p.room_accent, 'is_me', l.author = (select auth.uid()),
      'latest', max(l.created_at),
      'all_seen', bool_and(exists (select 1 from bulavata.story_views v where v.story_id = l.id and v.viewer = (select auth.uid()))),
      'note', (select jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at) from live n
               where n.author = l.author and n.kind = 'note' order by n.created_at desc limit 1),
      'items', (select jsonb_agg(jsonb_build_object('id', i.id, 'body', i.body, 'media_url', i.media_url, 'audience', i.audience,
                  'created_at', i.created_at, 'expires_at', i.expires_at,
                  'seen', exists (select 1 from bulavata.story_views v where v.story_id = i.id and v.viewer = (select auth.uid())),
                  'views', case when i.author = (select auth.uid()) then (select count(*) from bulavata.story_views v where v.story_id = i.id) end,
                  'reactions', bulavata.reaction_summary('story', i.id)) order by i.created_at)
                from live i where i.author = l.author and i.kind = 'story')) person
    from live l join bulavata.profiles p on p.id = l.author group by l.author, p.handle, p.display_name, p.avatar_emoji, p.room_accent) x), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_story_seen(p_id bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into bulavata.story_views(story_id, viewer) select p_id, (select auth.uid())
  where bulavata.can_see_target('story', p_id) on conflict do nothing;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_story_delete(p_id bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  delete from bulavata.stories where id = p_id and author = (select auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.bv_story_highlight(p_id bigint, p_title text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update bulavata.stories set highlight_title = nullif(p_title,'') where id = p_id and author = (select auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.bv_highlights(p_owner uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.highlight_title, 'body', s.body, 'media_url', s.media_url, 'created_at', s.created_at) order by s.created_at desc)
    from bulavata.stories s where s.author = p_owner and s.highlight_title is not null and bulavata.can_see_moment(s.author, s.audience)), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_memories()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'body', m.body, 'media_url', m.media_url, 'created_at', m.created_at,
      'years_ago', extract(year from now())::int - extract(year from m.created_at)::int) order by m.created_at desc)
    from bulavata.moments m where m.author = (select auth.uid())
      and m.created_at < now() - interval '300 days'
      and to_char(m.created_at, 'MM-DD') = to_char(now(), 'MM-DD')), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_event_create(p_title text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_place text DEFAULT NULL::text, p_about text DEFAULT NULL::text, p_audience text DEFAULT 'friends'::text, p_crew bigint DEFAULT NULL::bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare eid bigint; begin
  if (select auth.uid()) is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_crew is not null and not exists (select 1 from bulavata.crew_members cm where cm.crew_id = p_crew and cm.member = (select auth.uid()))
    then raise exception 'NOT_IN_CREW'; end if;
  insert into bulavata.events(host, crew_id, title, about, place, starts_at, ends_at, audience)
  values ((select auth.uid()), p_crew, p_title, nullif(p_about,''), nullif(p_place,''), p_starts_at, p_ends_at, case when p_crew is not null then 'crew' else p_audience end)
  returning id into eid;
  insert into bulavata.event_rsvps(event_id, person, status) values (eid, (select auth.uid()), 'going');
  return eid;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.can_see_event(e bulavata.events)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.host = (select auth.uid())
     or (e.audience = 'crew' and exists (select 1 from bulavata.crew_members cm where cm.crew_id = e.crew_id and cm.member = (select auth.uid())))
     or (e.audience <> 'crew' and bulavata.can_see_moment(e.host, e.audience));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_events(p_past boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'about', e.about, 'place', e.place,
      'starts_at', e.starts_at, 'ends_at', e.ends_at, 'audience', e.audience, 'cancelled', e.cancelled, 'crew_id', e.crew_id,
      'is_host', e.host = (select auth.uid()), 'host_handle', p.handle, 'host_emoji', p.avatar_emoji,
      'mine', (select r.status from bulavata.event_rsvps r where r.event_id = e.id and r.person = (select auth.uid())),
      'going', (select count(*) from bulavata.event_rsvps r where r.event_id = e.id and r.status = 'going'),
      'maybe', (select count(*) from bulavata.event_rsvps r where r.event_id = e.id and r.status = 'maybe'),
      'people', (select coalesce(jsonb_agg(jsonb_build_object('handle', pp.handle, 'avatar_emoji', pp.avatar_emoji, 'status', r.status) order by r.updated_at), '[]'::jsonb)
                 from bulavata.event_rsvps r join bulavata.profiles pp on pp.id = r.person where r.event_id = e.id and r.status <> 'no'))
      order by e.starts_at asc)
    from bulavata.events e join bulavata.profiles p on p.id = e.host
    where bulavata.can_see_event(e)
      and ((not p_past and coalesce(e.ends_at, e.starts_at + interval '3 hours') > now() - interval '1 hour')
        or (p_past and coalesce(e.ends_at, e.starts_at + interval '3 hours') <= now() - interval '1 hour'))), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_event_rsvp(p_event bigint, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare e bulavata.events; begin
  select * into e from bulavata.events where id = p_event;
  if not found or not bulavata.can_see_event(e) then raise exception 'NOT_VISIBLE'; end if;
  insert into bulavata.event_rsvps(event_id, person, status) values (p_event, (select auth.uid()), p_status)
  on conflict (event_id, person) do update set status = excluded.status, updated_at = now();
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_event_cancel(p_event bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update bulavata.events set cancelled = true where id = p_event and host = (select auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.bv_moments_feed2(lim integer DEFAULT 60)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with page as (
    select m.* from bulavata.moments m
    where (m.author = (select auth.uid()) or m.author in (select c.id from bulavata.my_circle() c))
      and bulavata.can_see_moment(m.author, m.audience)
    order by m.created_at desc limit lim)
  select coalesce((select jsonb_agg(jsonb_build_object(
      'id', x.id, 'author', x.author, 'handle', pr.handle, 'display_name', pr.display_name, 'avatar_emoji', pr.avatar_emoji,
      'accent', pr.room_accent, 'body', x.body, 'media_url', x.media_url, 'caption', x.caption, 'created_at', x.created_at,
      'audience', x.audience, 'edited_at', x.edited_at, 'edit_count', x.edit_count,
      'luv_count', x.luv_count,
      'i_luvd', exists (select 1 from bulavata.luv l where l.giver = (select auth.uid()) and l.target_kind = 'moment' and l.target_id = x.id),
      'reactions', bulavata.reaction_summary('moment', x.id),
      'comment_count', (select count(*) from bulavata.comments c where c.target_kind = 'moment' and c.target_id = x.id and not c.deleted),
      'bookmarked', exists (select 1 from bulavata.bookmarks b where b.owner = (select auth.uid()) and b.target_kind = 'moment' and b.target_id = x.id),
      'repost_count', (select count(*) from bulavata.moments r where r.repost_of = x.id),
      'poll', bulavata.poll_json(x.id),
      'repost', (select jsonb_build_object('id', o.id, 'body', o.body, 'media_url', o.media_url, 'created_at', o.created_at,
                   'handle', op.handle, 'display_name', op.display_name, 'avatar_emoji', op.avatar_emoji, 'accent', op.room_accent,
                   'visible', bulavata.can_see_moment(o.author, o.audience))
                 from bulavata.moments o join bulavata.profiles op on op.id = o.author where o.id = x.repost_of)
    ) order by x.created_at desc)
    from page x join bulavata.profiles pr on pr.id = x.author), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION bulavata.crew_owner(p_crew bigint)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select c.owner from bulavata.crews c where c.id = p_crew;
$function$
;

CREATE OR REPLACE FUNCTION bulavata.crew_can_post(p_crew bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from bulavata.crews c where c.id = p_crew
                 and (not c.broadcast or c.owner = (select auth.uid())))
     and bulavata.in_crew(p_crew);
$function$
;

CREATE OR REPLACE FUNCTION bulavata.reply_in_crew(p_reply bigint, p_crew bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_reply is null or exists (select 1 from bulavata.crew_messages r where r.id = p_reply and r.crew_id = p_crew);
$function$
;

CREATE OR REPLACE FUNCTION bulavata.crew_message_expiry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v integer; begin
  select vanish_seconds into v from bulavata.crews where id = new.crew_id;
  if v is not null and new.expires_at is null then new.expires_at := now() + make_interval(secs => v); end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_crew_settings(p_crew bigint, p_vanish_seconds integer, p_broadcast boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c bulavata.crews; line text; begin
  select * into c from bulavata.crews where id = p_crew and owner = (select auth.uid());
  if not found then raise exception 'NOT_OWNER'; end if;
  update bulavata.crews set vanish_seconds = p_vanish_seconds, broadcast = coalesce(p_broadcast, false) where id = p_crew;
  if c.vanish_seconds is distinct from p_vanish_seconds then
    line := case when p_vanish_seconds is null then 'Vanish mode off. Messages stay.'
                 else 'Vanish mode on. New messages disappear after ' ||
                      case when p_vanish_seconds < 3600 then (p_vanish_seconds/60)||' minute'||case when p_vanish_seconds/60=1 then '' else 's' end
                           when p_vanish_seconds < 86400 then (p_vanish_seconds/3600)||' hour'||case when p_vanish_seconds/3600=1 then '' else 's' end
                           else (p_vanish_seconds/86400)||' day'||case when p_vanish_seconds/86400=1 then '' else 's' end end || '.' end;
    insert into bulavata.crew_messages(crew_id, author, body, kind, expires_at) values (p_crew, (select auth.uid()), line, 'system', null);
  end if;
  if c.broadcast is distinct from coalesce(p_broadcast, false) then
    insert into bulavata.crew_messages(crew_id, author, body, kind, expires_at) values (p_crew, (select auth.uid()),
      case when p_broadcast then 'This is now a broadcast Koro. Only the owner posts; everyone can react.' else 'Everyone can post again.' end, 'system', null);
  end if;
  return jsonb_build_object('vanish_seconds', p_vanish_seconds, 'broadcast', coalesce(p_broadcast,false));
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_crew_pin(p_crew bigint, p_message bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update bulavata.crews set pinned_message = p_message where id = p_crew and owner = (select auth.uid())
    and (p_message is null or exists (select 1 from bulavata.crew_messages m where m.id = p_message and m.crew_id = p_crew));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_crew_message_delete(p_id bigint)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update bulavata.crew_messages set deleted = true, body = '' where id = p_id
    and (author = (select auth.uid()) or bulavata.crew_owner(crew_id) = (select auth.uid()));
$function$
;

CREATE OR REPLACE FUNCTION public.bv_crew_messages2(p_crew bigint, lim integer DEFAULT 80)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with ok as (select bulavata.in_crew(p_crew) as yes),
  page as (
    select m.* from bulavata.crew_messages m, ok
    where ok.yes and m.crew_id = p_crew and (m.expires_at is null or m.expires_at > now())
    order by m.created_at desc limit lim)
  select jsonb_build_object(
    'settings', (select jsonb_build_object('vanish_seconds', c.vanish_seconds, 'broadcast', c.broadcast, 'is_owner', c.owner = (select auth.uid()),
                   'can_post', bulavata.crew_can_post(p_crew), 'pinned', c.pinned_message)
                 from bulavata.crews c, ok where ok.yes and c.id = p_crew),
    'pinned', (select jsonb_build_object('id', pm.id, 'body', pm.body, 'handle', pp.handle)
               from bulavata.crews c join bulavata.crew_messages pm on pm.id = c.pinned_message join bulavata.profiles pp on pp.id = pm.author, ok
               where ok.yes and c.id = p_crew and not pm.deleted and (pm.expires_at is null or pm.expires_at > now())),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'author', x.author, 'handle', p.handle, 'display_name', p.display_name, 'avatar_emoji', p.avatar_emoji,
        'body', case when x.deleted then null else x.body end, 'deleted', x.deleted, 'kind', x.kind,
        'created_at', x.created_at, 'expires_at', x.expires_at,
        'reactions', bulavata.reaction_summary('message', x.id),
        'reply', (select jsonb_build_object('id', r.id, 'handle', rp.handle, 'body', case when r.deleted then null else left(r.body, 120) end)
                  from bulavata.crew_messages r join bulavata.profiles rp on rp.id = r.author where r.id = x.reply_to and r.crew_id = x.crew_id)
      ) order by x.created_at desc)
      from page x join bulavata.profiles p on p.id = x.author), '[]'::jsonb));
$function$
;

CREATE OR REPLACE FUNCTION bulavata.notify(p_recipient uuid, p_actor uuid, p_kind text, p_target_kind text, p_target_id bigint, p_snippet text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  insert into bulavata.notifications(recipient, actor, kind, target_kind, target_id, snippet)
  select p_recipient, p_actor, p_kind, coalesce(p_target_kind, ''), coalesce(p_target_id, 0), left(coalesce(p_snippet, ''), 140)
  where p_recipient is not null and p_actor is not null and p_recipient <> p_actor
  on conflict (recipient, actor, kind, target_kind, target_id)
    do update set created_at = now(), read_at = null, snippet = excluded.snippet;
$function$
;

CREATE OR REPLACE FUNCTION bulavata.target_snippet(p_kind text, p_id bigint)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select left(coalesce(case p_kind
    when 'moment'  then (select m.body from bulavata.moments m where m.id = p_id)
    when 'pulse'   then (select p.text from bulavata.pulses p where p.id = p_id)
    when 'wall'    then (select w.body from bulavata.wall_posts w where w.id = p_id)
    when 'comment' then (select c.body from bulavata.comments c where c.id = p_id)
    when 'story'   then (select s.body from bulavata.stories s where s.id = p_id)
  end, ''), 140);
$function$
;

CREATE OR REPLACE FUNCTION bulavata.can_see_target_as(p_who uuid, p_kind text, p_id bigint)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a uuid; aud text; begin
  if p_kind in ('moment','story') then
    if p_kind = 'moment' then select author, audience into a, aud from bulavata.moments where id = p_id;
    else select author, audience into a, aud from bulavata.stories where id = p_id; end if;
    if not found then return false; end if;
    if a = p_who then return true; end if;
    if coalesce(aud, 'friends') = 'close' then
      return exists (select 1 from bulavata.close_friends c where c.owner = a and c.friend = p_who);
    end if;
    return bulavata.are_friends(p_who, a);
  else
    a := bulavata.target_author(p_kind, p_id);
    return a is not null and (a = p_who or bulavata.are_friends(p_who, a));
  end if;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.trg_notify_reaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform bulavata.notify(bulavata.target_author(new.target_kind, new.target_id), new.giver, 'reaction',
                          new.target_kind, new.target_id, new.reaction || '|' || bulavata.target_snippet(new.target_kind, new.target_id));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.trg_notify_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare owner_id uuid; parent_author uuid; h text; mentioned uuid;
begin
  owner_id := bulavata.target_author(new.target_kind, new.target_id);
  perform bulavata.notify(owner_id, new.author, 'reply', new.target_kind, new.target_id, new.body);
  if new.parent_id is not null then
    select author into parent_author from bulavata.comments where id = new.parent_id;
    if parent_author is distinct from owner_id then
      perform bulavata.notify(parent_author, new.author, 'reply', 'comment', new.parent_id, new.body);
    end if;
  end if;
  -- @mentions: only friends of the author are told, and only once per comment.
  for h in select distinct lower(m[1]) from regexp_matches(new.body, '@([A-Za-z0-9_]{2,30})', 'g') m loop
    select id into mentioned from bulavata.profiles where lower(handle) = h;
    if mentioned is not null and mentioned not in (new.author, coalesce(owner_id, new.author), coalesce(parent_author, new.author))
       and bulavata.are_friends(new.author, mentioned)
       and bulavata.can_see_target_as(mentioned, new.target_kind, new.target_id) then
      perform bulavata.notify(mentioned, new.author, 'mention', 'comment', new.id, new.body);
    end if;
  end loop;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.trg_notify_friendship()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' and coalesce(new.status, 'pending') = 'pending' then
    perform bulavata.notify(new.addressee, new.requester, 'friend_request', 'friendship', new.id, '');
  elsif tg_op = 'UPDATE' and new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform bulavata.notify(new.requester, new.addressee, 'friend_accepted', 'friendship', new.id, '');
    -- the request itself is now answered
    update bulavata.notifications set read_at = coalesce(read_at, now())
      where recipient = new.addressee and kind = 'friend_request' and target_kind = 'friendship' and target_id = new.id;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.trg_notify_wall()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform bulavata.notify(new.wall_owner, new.author, 'wall', 'wall', new.id, new.body);
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.trg_notify_rsvp()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare h uuid; t text;
begin
  select host, title into h, t from bulavata.events where id = new.event_id;
  perform bulavata.notify(h, new.person, 'rsvp', 'event', new.event_id, new.status || '|' || coalesce(t, ''));
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_activity(lim integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'target_kind', n.target_kind, 'target_id', n.target_id,
      'snippet', n.snippet, 'created_at', n.created_at, 'read', n.read_at is not null,
      'actor', n.actor, 'handle', p.handle, 'display_name', p.display_name, 'avatar_emoji', p.avatar_emoji, 'accent', p.room_accent)
      order by n.created_at desc)
    from (select * from bulavata.notifications
          where recipient = (select auth.uid()) order by created_at desc limit greatest(1, least(coalesce(lim, 40), 200))) n
    join bulavata.profiles p on p.id = n.actor), '[]'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_activity_unread()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select count(*)::integer from bulavata.notifications where recipient = (select auth.uid()) and read_at is null;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_activity_read(p_ids bigint[] DEFAULT NULL::bigint[])
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with done as (
    update bulavata.notifications set read_at = now()
      where recipient = (select auth.uid()) and read_at is null and (p_ids is null or id = any(p_ids))
      returning 1)
  select count(*)::integer from done;
$function$
;

CREATE OR REPLACE FUNCTION bulavata.talanoa_count_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    update bulavata.talanoa_posts set like_count = like_count + 1 where id = new.post_id; return new;
  end if;
  update bulavata.talanoa_posts set like_count = greatest(like_count - 1, 0) where id = old.post_id; return old;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.talanoa_count_repost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' then
    update bulavata.talanoa_posts set repost_count = repost_count + 1 where id = new.post_id; return new;
  end if;
  update bulavata.talanoa_posts set repost_count = greatest(repost_count - 1, 0) where id = old.post_id; return old;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.talanoa_count_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if tg_op = 'INSERT' and new.reply_to is not null then
    update bulavata.talanoa_posts set reply_count = reply_count + 1 where id = new.reply_to;
  elsif tg_op = 'DELETE' and old.reply_to is not null then
    update bulavata.talanoa_posts set reply_count = greatest(reply_count - 1, 0) where id = old.reply_to;
  end if;
  return coalesce(new, old);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_feed(p_mode text DEFAULT 'latest'::text, p_as_of timestamp with time zone DEFAULT now(), p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_cursor_created timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id bigint DEFAULT NULL::bigint, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone, p_post_id bigint DEFAULT NULL::bigint, p_reply_to bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me  uuid := (select auth.uid());
  lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  hot boolean := p_mode = 'hot' and p_post_id is null and p_reply_to is null and p_since is null;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  return coalesce((
    with page as (
      select t.*,
        case when hot then (t.like_count + 2 * t.repost_count + 1.5 * t.reply_count + 1)::float8
                          / power(greatest(extract(epoch from (p_as_of - t.created_at)), 0) / 3600.0 + 2, 1.4)
             else 0::float8 end as hot_score
      from bulavata.talanoa_posts t
      where case when p_post_id  is not null then t.id = p_post_id
                 when p_reply_to is not null then t.reply_to = p_reply_to
                 else t.reply_to is null end
        and (p_post_id is not null or p_since is not null or t.created_at <= p_as_of)
        and (p_since is null or t.created_at > p_since)
        and (not hot or t.created_at > p_as_of - interval '72 hours')
        and (p_cursor_created is null or (t.created_at, t.id) < (p_cursor_created, p_cursor_id))
      order by hot_score desc,
               case when p_reply_to is not null then t.created_at end asc,
               case when p_reply_to is not null then t.id end asc,
               t.created_at desc, t.id desc
      limit lim offset case when hot then greatest(coalesce(p_offset, 0), 0) else 0 end)
    select jsonb_agg(jsonb_build_object(
        'id', x.id, 'author', x.author, 'handle', pr.handle, 'display_name', pr.display_name,
        'avatar_emoji', pr.avatar_emoji, 'accent', pr.room_accent,
        'body', x.body, 'created_at', x.created_at, 'reply_to', x.reply_to, 'quote_of', x.quote_of,
        'like_count', x.like_count, 'repost_count', x.repost_count, 'reply_count', x.reply_count,
        'hot', round(x.hot_score::numeric, 4),
        'mine', x.author = me,
        'i_liked',    exists (select 1 from bulavata.talanoa_likes   l where l.post_id = x.id and l.member = me),
        'i_reposted', exists (select 1 from bulavata.talanoa_reposts r where r.post_id = x.id and r.member = me),
        'quote', (select jsonb_build_object('id', q.id, 'body', q.body, 'created_at', q.created_at,
                                            'handle', qp.handle, 'display_name', qp.display_name, 'avatar_emoji', qp.avatar_emoji)
                  from bulavata.talanoa_posts q join bulavata.profiles qp on qp.id = q.author where q.id = x.quote_of),
        'sere', (select jsonb_build_object('id', s.id, 'video', s.output_video_url, 'poster', s.output_poster_url,
                                           'plays', s.plays, 'tips', s.tips_count, 'scene', s.scene_id,
                                           'seconds', round((s.render_end_ms - s.render_start_ms) / 1000.0),
                                           'remix_of', s.remix_of)
                 from bulavata.sere_media_generations s where s.id = x.sere_id and s.status = 'completed'),
        'voice', case when x.voice_path is not null then jsonb_build_object('path', x.voice_path, 'seconds', x.voice_seconds) end
      ) order by x.hot_score desc, case when p_reply_to is not null then x.created_at end asc, case when p_reply_to is not null then x.id end asc, x.created_at desc, x.id desc)
    from page x join bulavata.profiles pr on pr.id = x.author), '[]'::jsonb);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_post(p_body text, p_quote bigint DEFAULT NULL::bigint, p_reply_to bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  b text := btrim(coalesce(p_body, ''));
  parent bulavata.talanoa_posts%rowtype;
  target bigint := p_reply_to;
  nid bigint;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if b = '' then raise exception 'EMPTY'; end if;
  if char_length(b) > 280 then raise exception 'TOO_LONG'; end if;
  if p_quote is not null and not exists (select 1 from bulavata.talanoa_posts where id = p_quote) then
    raise exception 'GONE';
  end if;
  if target is not null then
    select * into parent from bulavata.talanoa_posts where id = target;
    if not found then raise exception 'GONE'; end if;
    if parent.reply_to is not null then target := parent.reply_to; end if;
  end if;
  insert into bulavata.talanoa_posts (author, body, quote_of, reply_to) values (me, b, p_quote, target) returning id into nid;
  return public.bv_talanoa_feed('latest', now(), 1, 0, null, null, null, nid, null) -> 0;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_like(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid()); liked boolean; n integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from bulavata.talanoa_posts where id = p_id) then raise exception 'GONE'; end if;
  delete from bulavata.talanoa_likes where post_id = p_id and member = me;
  if found then liked := false;
  else insert into bulavata.talanoa_likes (post_id, member) values (p_id, me); liked := true; end if;
  select like_count into n from bulavata.talanoa_posts where id = p_id;
  return jsonb_build_object('liked', liked, 'like_count', n);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_repost(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid()); reposted boolean; n integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from bulavata.talanoa_posts where id = p_id) then raise exception 'GONE'; end if;
  delete from bulavata.talanoa_reposts where post_id = p_id and member = me;
  if found then reposted := false;
  else insert into bulavata.talanoa_reposts (post_id, member) values (p_id, me); reposted := true; end if;
  select repost_count into n from bulavata.talanoa_posts where id = p_id;
  return jsonb_build_object('reposted', reposted, 'repost_count', n);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_delete(p_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  delete from bulavata.talanoa_posts where id = p_id and author = me;
  if not found then raise exception 'NOT_YOURS'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.sere_autopost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare nid bigint;
begin
  if new.status = 'completed' and coalesce(old.status, '') <> 'completed' then
    new.completed_at := coalesce(new.completed_at, now());
    if new.post_id is null then
      insert into bulavata.talanoa_posts (author, body, sere_id)
        values (new.user_id, coalesce(nullif(btrim(new.caption), ''), '🎤 Sere'), new.id)
        returning id into nid;
      new.post_id := nid;
    end if;
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.sere_count_tip()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  update bulavata.sere_media_generations set tips_count = tips_count + 1 where id = new.sere_id;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer DEFAULT 0, p_scene text DEFAULT 'none'::text, p_caption text DEFAULT NULL::text, p_remix_of uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  nid uuid := gen_random_uuid();
  ext text := lower(coalesce(p_image_ext, 'jpg'));
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
    (id, user_id, audio_url, source_image_url, scene_id, caption, audio_duration_ms, render_start_ms, render_end_ms, remix_of)
  values (nid, me, audio_path, me::text || '/' || nid::text || '.' || ext, coalesce(p_scene, 'none'),
          nullif(btrim(left(coalesce(p_caption, ''), 140)), ''),
          coalesce(parent.audio_duration_ms, p_duration_ms), s, e, p_remix_of);
  return jsonb_build_object('id', nid, 'audio_path', audio_path, 'image_path', me::text || '/' || nid::text || '.' || ext,
                            'remix', p_remix_of is not null, 'left', greatest(0, 4 - used));
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_sere_mine()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', g.id, 'status', g.status, 'progress', g.progress, 'error', g.error, 'caption', g.caption,
      'video', g.output_video_url, 'poster', g.output_poster_url, 'post_id', g.post_id, 'created_at', g.created_at)
    order by g.created_at desc), '[]'::jsonb)
  from (select * from bulavata.sere_media_generations where user_id = (select auth.uid())
        order by created_at desc limit 20) g;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_sere_tip(p_sere uuid, p_gift text, p_note text DEFAULT NULL::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  g bulavata.sere_media_generations%rowtype;
  used integer;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into g from bulavata.sere_media_generations where id = p_sere and status = 'completed';
  if not found then raise exception 'GONE'; end if;
  if g.user_id = me then raise exception 'SELF_GIFT'; end if;
  if not bulavata.gift_friends(me, g.user_id) then raise exception 'NOT_FRIENDS'; end if;
  perform pg_advisory_xact_lock(hashtext('bv_gift:' || me::text));
  used := bulavata.gifts_used(me);
  if used >= 3 then raise exception 'OUT_OF_GIFTS'; end if;
  insert into bulavata.gifts (giver, receiver, gift, note, sere_id)
    values (me, g.user_id, p_gift, nullif(btrim(left(coalesce(p_note, ''), 80)), ''), g.id);
  return greatest(0, 2 - used);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_sere_play(p_sere uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  update bulavata.sere_media_generations set plays = plays + 1
   where id = p_sere and status = 'completed' and (select auth.uid()) is not null;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_sere_remove(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  delete from bulavata.sere_media_generations where id = p_id and user_id = me;
  if not found then raise exception 'NOT_YOURS'; end if;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid, p_engine text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ declare r jsonb; eng text := case when p_engine in ('quick','lifelike') then p_engine else 'quick' end; begin r := public.bv_sere_create(p_image_ext, p_duration_ms, p_start_ms, p_scene, p_caption, p_remix_of); update bulavata.sere_media_generations set engine = eng where id = (r->>'id')::uuid; return r || jsonb_build_object('engine', eng); end $function$
;

CREATE OR REPLACE FUNCTION public.bv_account_delete()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION bulavata.hub_row(p_slug text, p_uid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'slug', h.slug, 'name', h.name, 'emoji', h.emoji, 'blurb', h.blurb, 'crew_id', h.crew_id,
    'members', (select count(*) from bulavata.crew_members m where m.crew_id = h.crew_id),
    'joined', exists (select 1 from bulavata.crew_members m where m.crew_id = h.crew_id and m.member = p_uid))
  from bulavata.hubs h where h.slug = p_slug;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_hubs()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  return coalesce((select jsonb_agg(bulavata.hub_row(h.slug, v_uid) order by h.sort, h.slug) from bulavata.hubs h), '[]'::jsonb);
end; $function$
;

CREATE OR REPLACE FUNCTION public.bv_hub_join(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid()); v_hub bulavata.hubs%rowtype; v_owner uuid;
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  if not exists (select 1 from bulavata.profiles p where p.id = v_uid) then raise exception 'NO_ROOM'; end if;
  -- The row lock makes two first joiners queue, so a hub never gets two Koro.
  select * into v_hub from bulavata.hubs h where h.slug = lower(btrim(coalesce(p_slug, ''))) for update;
  if not found then raise exception 'NO_SUCH_HUB'; end if;
  if v_hub.crew_id is null then
    -- A hub Koro is looked after by the longest-standing member (the founder), never by whoever
    -- happened to tap first, so no ordinary member gains owner controls over an open room.
    select p.id into v_owner from bulavata.profiles p order by p.created_at, p.id limit 1;
    insert into bulavata.crews (name, emoji, owner, about)
      values (v_hub.name, v_hub.emoji, v_owner, v_hub.blurb) returning id into v_hub.crew_id;
    update bulavata.hubs set crew_id = v_hub.crew_id where slug = v_hub.slug;
  end if;
  insert into bulavata.crew_members (crew_id, member) values (v_hub.crew_id, v_uid) on conflict do nothing;
  return bulavata.hub_row(v_hub.slug, v_uid);
end; $function$
;

CREATE OR REPLACE FUNCTION public.bv_people_to_meet(p_limit integer DEFAULT 3)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_uid uuid := (select auth.uid()); v_limit int := least(greatest(coalesce(p_limit, 3), 1), 12);
begin
  if v_uid is null then raise exception 'NOT_SIGNED_IN'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', x.id, 'handle', x.handle, 'display_name', x.display_name,
             'avatar_emoji', x.avatar_emoji, 'accent', x.room_accent, 'posts', x.posts, 'hub', x.hub)
             order by (x.hub is not null) desc, x.posts desc, x.last_seen desc nulls last, x.handle)
    from (select y.* from (
      select p.id, p.handle, p.display_name, p.avatar_emoji, p.room_accent, p.last_seen,
        (select count(*) from bulavata.talanoa_posts t
          where t.author = p.id and t.reply_to is null and t.created_at > now() - interval '30 days') as posts,
        (select h.name from bulavata.hubs h
          join bulavata.crew_members theirs on theirs.crew_id = h.crew_id and theirs.member = p.id
          join bulavata.crew_members mine on mine.crew_id = h.crew_id and mine.member = v_uid
          order by h.sort limit 1) as hub
      from bulavata.profiles p
      where p.id <> v_uid
        and not exists (select 1 from bulavata.friendships f
          where (f.requester = v_uid and f.addressee = p.id) or (f.requester = p.id and f.addressee = v_uid))
      ) y
      -- The cut to the limit uses the same order as the list, so the best matches are the ones kept.
      order by (y.hub is not null) desc, y.posts desc, y.last_seen desc nulls last, y.handle
      limit v_limit
    ) x), '[]'::jsonb);
end; $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_share(p_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  t text;
  p record;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select x.id, x.body, pr.handle, pr.display_name into p
    from bulavata.talanoa_posts x join bulavata.profiles pr on pr.id = x.author where x.id = p_id;
  if not found then raise exception 'GONE'; end if;
  select s.token into t from bulavata.talanoa_shares s where s.post_id = p_id and s.sharer = me;
  if t is null then
    t := md5(gen_random_uuid()::text || clock_timestamp()::text || me::text);
    insert into bulavata.talanoa_shares (token, post_id, sharer) values (t, p_id, me)
      on conflict (post_id, sharer) do nothing;
    select s.token into t from bulavata.talanoa_shares s where s.post_id = p_id and s.sharer = me;
  end if;
  return jsonb_build_object('token', t, 'path', '/p/' || p_id::text || '/' || t,
    'id', p.id, 'body', p.body, 'handle', p.handle, 'display_name', p.display_name);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_shared(p_post bigint, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  s bulavata.talanoa_shares%rowtype;
  card jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{32}$' then return null; end if;
  select * into s from bulavata.talanoa_shares where token = p_token and post_id = p_post;
  if not found then return null; end if;
  update bulavata.talanoa_shares set opens = opens + 1 where token = s.token;
  select jsonb_build_object(
      'id', x.id, 'body', x.body, 'created_at', x.created_at,
      'like_count', x.like_count, 'reply_count', x.reply_count,
      'handle', pr.handle, 'display_name', pr.display_name, 'avatar_emoji', pr.avatar_emoji, 'accent', pr.room_accent,
      'sharer', jsonb_build_object('handle', sp.handle, 'display_name', sp.display_name),
      'quote', (select jsonb_build_object('body', q.body, 'handle', qp.handle, 'display_name', qp.display_name)
                from bulavata.talanoa_posts q join bulavata.profiles qp on qp.id = q.author where q.id = x.quote_of))
    into card
    from bulavata.talanoa_posts x
    join bulavata.profiles pr on pr.id = x.author
    join bulavata.profiles sp on sp.id = s.sharer
   where x.id = s.post_id;
  return card;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_referral_claim(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.coins_tipped_today(p_who uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(sum(coins), 0)::integer from bulavata.coin_tips where giver = p_who and created_at > date_trunc('day', now());
$function$
;

CREATE OR REPLACE FUNCTION public.bv_coins()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  a bulavata.coin_accounts%rowtype;
  s bulavata.coin_settings%rowtype;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  insert into bulavata.coin_accounts (owner) values (me) on conflict (owner) do nothing;
  select * into a from bulavata.coin_accounts where owner = me;
  select * into s from bulavata.coin_settings;
  return jsonb_build_object(
    'balance', a.balance, 'earned', a.earned, 'bought', a.bought, 'tipped', a.tipped, 'received', a.received, 'paid_out', a.paid_out,
    'coin_sene', s.coin_sene, 'fee_bps', s.fee_bps, 'tips_on', s.tips_on, 'buy_on', s.buy_on, 'payout_on', s.payout_on,
    'payout_min', s.payout_min_coins, 'max_tip', s.max_tip, 'daily_cap', s.daily_tip_cap,
    'tipped_today', bulavata.coins_tipped_today(me),
    'bundles', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'coins', b.coins, 'bonus', b.bonus, 'price_minor', b.price_minor) order by b.sort), '[]'::jsonb)
                from bulavata.coin_bundles b where b.active),
    'ledger', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', l.id, 'kind', l.kind, 'delta', l.delta, 'memo', l.memo, 'created_at', l.created_at, 'post_id', l.post_id,
                 'other', (select p.handle from bulavata.profiles p where p.id = l.counterparty)) order by l.created_at desc, l.id desc), '[]'::jsonb)
               from (select * from bulavata.coin_ledger where owner = me order by created_at desc, id desc limit 20) l));
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_coin_tips_for(p_post bigint)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when (select auth.uid()) is null then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object('handle', p.handle, 'display_name', p.display_name, 'avatar_emoji', p.avatar_emoji,
                                        'coins', t.coins, 'note', t.note, 'created_at', t.created_at) order by t.created_at desc, t.id desc)
    from (select * from bulavata.coin_tips where post_id = p_post order by created_at desc, id desc limit 30) t
    join bulavata.profiles p on p.id = t.giver), '[]'::jsonb) end;
$function$
;

CREATE OR REPLACE FUNCTION public.bv_coin_tip(p_post bigint, p_coins integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  s bulavata.coin_settings%rowtype;
  p bulavata.talanoa_posts%rowtype;
  giver bulavata.coin_accounts%rowtype;
  fee integer; net integer; today integer; note text;
  grp uuid := gen_random_uuid();
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into s from bulavata.coin_settings;
  if not s.tips_on then raise exception 'TIPS_OFF'; end if;
  if p_coins is null or p_coins < 1 or p_coins > s.max_tip then raise exception 'BAD_AMOUNT'; end if;
  select * into p from bulavata.talanoa_posts where id = p_post;
  if not found then raise exception 'GONE'; end if;
  if p.author = me then raise exception 'SELF_TIP'; end if;
  perform pg_advisory_xact_lock(hashtext('coins:' || me::text));
  today := bulavata.coins_tipped_today(me);
  if today + p_coins > s.daily_tip_cap then raise exception 'DAILY_CAP'; end if;
  insert into bulavata.coin_accounts (owner) values (me), (p.author) on conflict (owner) do nothing;
  perform 1 from bulavata.coin_accounts where owner in (me, p.author) order by owner for update;
  select * into giver from bulavata.coin_accounts where owner = me;
  if giver.balance < p_coins then raise exception 'NOT_ENOUGH_COINS'; end if;
  fee := (p_coins * s.fee_bps) / 10000;
  net := p_coins - fee;
  note := nullif(btrim(left(coalesce(p_note, ''), 60)), '');
  update bulavata.coin_accounts set balance = balance - p_coins, tipped = tipped + p_coins, updated_at = now() where owner = me returning * into giver;
  update bulavata.coin_accounts set earned = earned + net, received = received + net, updated_at = now() where owner = p.author;
  update bulavata.coin_settings set platform_fees = platform_fees + fee, updated_at = now();
  insert into bulavata.coin_tips (post_id, giver, author, coins, net, note) values (p_post, me, p.author, p_coins, net, note);
  update bulavata.talanoa_posts set tip_count = tip_count + 1, tip_coins = tip_coins + p_coins where id = p_post returning * into p;
  insert into bulavata.coin_ledger (owner, kind, delta, group_id, counterparty, post_id, memo) values
    (me, 'tip_out', -p_coins, grp, p.author, p_post, note), (p.author, 'tip_in', net, grp, me, p_post, note);
  if fee > 0 then
    insert into bulavata.coin_ledger (owner, kind, delta, group_id, counterparty, post_id) values (null, 'fee', fee, grp, me, p_post);
  end if;
  perform bulavata.notify(p.author, me, 'tip', 'post', p_post, p_coins::text || '|' || coalesce(note, ''));
  return jsonb_build_object('balance', giver.balance, 'coins', p_coins, 'net', net, 'tip_count', p.tip_count, 'tip_coins', p.tip_coins, 'tipped_today', today + p_coins);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_coins_buy(p_bundle text, p_idem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  s bulavata.coin_settings%rowtype;
  b bulavata.coin_bundles%rowtype;
  w bulavata.wallets%rowtype;
  a bulavata.coin_accounts%rowtype;
  ref text; sent_today bigint; total integer;
  grp uuid := gen_random_uuid();
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into s from bulavata.coin_settings;
  if not s.buy_on then raise exception 'COINS_BUY_OFF'; end if;
  select * into b from bulavata.coin_bundles where id = p_bundle and active;
  if not found then raise exception 'NO_SUCH_BUNDLE'; end if;
  total := b.coins + b.bonus;
  ref := 'coins:buy:' || coalesce(nullif(p_idem, ''), gen_random_uuid()::text);
  if exists (select 1 from bulavata.transactions where reference = ref) then
    select * into a from bulavata.coin_accounts where owner = me;
    return jsonb_build_object('status', 'already_done', 'reference', ref, 'balance', coalesce(a.balance, 0));
  end if;
  perform pg_advisory_xact_lock(hashtext('coins:' || me::text));
  select * into w from bulavata.wallets where owner = me for update;
  if w.id is null then raise exception 'NO_WALLET'; end if;
  if w.status <> 'active' then raise exception 'WALLET_%', upper(w.status); end if;
  if w.balance_minor < b.price_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;
  select coalesce(sum(t.amount_minor), 0) into sent_today from bulavata.transactions t
   where t.wallet_id = w.id and t.direction = 'debit' and t.status = 'settled' and t.created_at > date_trunc('day', now());
  if sent_today + b.price_minor > w.daily_limit_minor then raise exception 'DAILY_LIMIT_EXCEEDED'; end if;
  update bulavata.wallets set balance_minor = balance_minor - b.price_minor, updated_at = now() where id = w.id returning * into w;
  insert into bulavata.transactions (wallet_id, direction, kind, amount_minor, currency, status, reference, memo, balance_after_minor, settled_at)
  values (w.id, 'debit', 'coin_buy', b.price_minor, w.currency, 'settled', ref, total::text || ' coins (' || b.id || ')', w.balance_minor, now());
  insert into bulavata.coin_accounts (owner) values (me) on conflict (owner) do nothing;
  update bulavata.coin_accounts set balance = balance + total, bought = bought + total, updated_at = now() where owner = me returning * into a;
  insert into bulavata.coin_ledger (owner, kind, delta, group_id, reference, memo) values (me, 'buy', total, grp, ref, b.id);
  return jsonb_build_object('status', 'settled', 'reference', ref, 'coins', total, 'balance', a.balance, 'wallet_minor', w.balance_minor);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_coins_payout(p_coins integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  s bulavata.coin_settings%rowtype;
  a bulavata.coin_accounts%rowtype;
  w bulavata.wallets%rowtype;
  minor bigint; lid bigint; ref text;
  grp uuid := gen_random_uuid();
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  select * into s from bulavata.coin_settings;
  if not s.payout_on then raise exception 'PAYOUT_OFF'; end if;
  if p_coins is null or p_coins < s.payout_min_coins then raise exception 'BELOW_MINIMUM'; end if;
  perform pg_advisory_xact_lock(hashtext('coins:' || me::text));
  select * into a from bulavata.coin_accounts where owner = me for update;
  if a.owner is null or a.earned < p_coins then raise exception 'NOT_ENOUGH_EARNED'; end if;
  select * into w from bulavata.wallets where owner = me for update;
  if w.id is null then raise exception 'NO_WALLET'; end if;
  if w.status in ('frozen', 'closed') then raise exception 'WALLET_%', upper(w.status); end if;
  minor := p_coins::bigint * s.coin_sene;
  update bulavata.coin_accounts set earned = earned - p_coins, paid_out = paid_out + p_coins, updated_at = now() where owner = me returning * into a;
  insert into bulavata.coin_ledger (owner, kind, delta, group_id, memo) values (me, 'payout', -p_coins, grp, 'to wallet') returning id into lid;
  ref := 'coins:payout:' || lid::text;
  update bulavata.coin_ledger set reference = ref where id = lid;
  update bulavata.wallets set balance_minor = balance_minor + minor, updated_at = now(),
    status = case when status = 'dormant' then 'active' else status end where id = w.id returning * into w;
  insert into bulavata.transactions (wallet_id, direction, kind, amount_minor, currency, status, reference, memo, balance_after_minor, settled_at)
  values (w.id, 'credit', 'coin_payout', minor, w.currency, 'settled', ref, p_coins::text || ' coins earned on the wall', w.balance_minor, now());
  return jsonb_build_object('status', 'settled', 'coins', p_coins, 'minor', minor, 'earned', a.earned, 'wallet_minor', w.balance_minor);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_share_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_block(p_member uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_member is null or p_member = me then raise exception 'BAD_MEMBER'; end if;
  if not exists (select 1 from bulavata.profiles where id = p_member) then raise exception 'GONE'; end if;
  insert into bulavata.blocks (blocker, blocked) values (me, p_member) on conflict do nothing;
  delete from bulavata.top_friends where (owner = me and friend = p_member) or (owner = p_member and friend = me);
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_unblock(p_member uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  delete from bulavata.blocks where blocker = me and blocked = p_member;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_blocked()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.blocked, 'handle', p.handle, 'display_name', p.display_name) order by b.created_at desc), '[]'::jsonb)
  from bulavata.blocks b join bulavata.profiles p on p.id = b.blocked
  where b.blocker = (select auth.uid());
$function$
;

CREATE OR REPLACE FUNCTION public.bv_report(p_kind text, p_id text, p_reason text, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid()); n text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_kind not in ('post','profile') or p_id is null or char_length(p_id) not between 1 and 64 then raise exception 'BAD_TARGET'; end if;
  if p_reason not in ('spam','bullying','hate','sexual','violence','underage','scam','other') then raise exception 'BAD_REASON'; end if;
  if n is not null and char_length(n) > 500 then raise exception 'TOO_LONG'; end if;
  if (select count(*) from bulavata.reports where reporter = me and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'REPORT_LIMIT';
  end if;
  insert into bulavata.reports (reporter, target_kind, target_id, reason, note) values (me, p_kind, p_id, p_reason, n)
  on conflict (reporter, target_kind, target_id) do update set reason = excluded.reason, note = excluded.note, created_at = now(), status = 'open';
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_talanoa_post_voice(p_path text, p_seconds integer, p_body text DEFAULT NULL::text, p_reply_to bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  me uuid := (select auth.uid());
  b text := btrim(coalesce(p_body, ''));
  parent bulavata.talanoa_posts%rowtype;
  target bigint := p_reply_to;
  nid bigint;
begin
  if me is null then raise exception 'NOT_SIGNED_IN'; end if;
  if p_path is null or p_seconds is null or p_seconds < 1 or p_seconds > 60
     or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|m4a|ogg)$'
     or split_part(p_path, '/', 1) <> me::text then
    raise exception 'VOICE_BAD';
  end if;
  -- the recording must already be uploaded, by this member, and not attached to another post
  if not exists (select 1 from storage.objects o where o.bucket_id = 'talanoa-voice' and o.name = p_path and (o.owner = me or o.owner_id = me::text)) then
    raise exception 'VOICE_BAD';
  end if;
  if exists (select 1 from bulavata.talanoa_posts t where t.voice_path = p_path) then raise exception 'VOICE_BAD'; end if;
  if (select count(*) from bulavata.talanoa_posts t
      where t.author = me and t.voice_path is not null and t.created_at > now() - interval '24 hours') >= 30 then
    raise exception 'VOICE_LIMIT';
  end if;
  if b = '' then b := '🎙️ Voice note'; end if;
  if char_length(b) > 280 then raise exception 'TOO_LONG'; end if;
  if target is not null then
    select * into parent from bulavata.talanoa_posts where id = target;
    if not found then raise exception 'GONE'; end if;
    if parent.reply_to is not null then target := parent.reply_to; end if;
  end if;
  insert into bulavata.talanoa_posts (author, body, reply_to, voice_path, voice_seconds)
    values (me, b, target, p_path, p_seconds::smallint) returning id into nid;
  return public.bv_talanoa_feed('latest', now(), 1, 0, null, null, null, nid, null) -> 0;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.top_mate_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if new.friend is not null and new.friend <> new.owner
     and not exists (select 1 from bulavata.blocks b where (b.blocker = new.friend and b.blocked = new.owner)) then
    perform bulavata.notify(new.friend, new.owner, 'top_mate', 'profile', 0, '#' || new.slot);
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_invite_create(p_label text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_invite_open(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_invites_mine()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_link_app(p_app text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid := (select auth.uid()); tok text;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if p_app is distinct from 'mataka' then raise exception 'Unknown app'; end if;
  if not exists (select 1 from bulavata.profiles where id = me) then raise exception 'Make your Sota Kece room first'; end if;
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into bulavata.app_links(member, app, token_hash)
    values (me, p_app, encode(extensions.digest(tok, 'sha256'), 'hex'))
    on conflict (member, app) do update set token_hash = excluded.token_hash, created_at = now(), last_used_at = null;
  return tok;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_unlink_app(p_app text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with d as (delete from bulavata.app_links where member = (select auth.uid()) and app = p_app returning 1)
  select exists (select 1 from d);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_app_unlink(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with d as (delete from bulavata.app_links
             where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') returning 1)
  select exists (select 1 from d);
$function$
;

CREATE OR REPLACE FUNCTION public.bv_app_feed(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare me uuid; out jsonb;
begin
  if p_token is null or length(p_token) <> 48 then return null; end if;
  update bulavata.app_links set last_used_at = now()
    where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    returning member into me;
  if me is null then return null; end if;

  select jsonb_build_object(
    'name', (select coalesce(nullif(display_name, ''), handle) from bulavata.profiles where id = me),
    'unread', (select count(*) from bulavata.notifications n where n.recipient = me and n.read_at is null
                 and not exists (select 1 from bulavata.blocks b where b.blocker = me and b.blocked = n.actor)),
    'activity', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'kind', n.kind, 'snippet', left(coalesce(n.snippet, ''), 140),
               'at', n.created_at, 'read', n.read_at is not null,
               'who', coalesce(nullif(p.display_name, ''), p.handle), 'emoji', p.avatar_emoji, 'accent', p.room_accent)
             order by n.created_at desc)
      from (select * from bulavata.notifications x
             where x.recipient = me
               and not exists (select 1 from bulavata.blocks b where b.blocker = me and b.blocked = x.actor)
             order by x.created_at desc limit 12) n
      join bulavata.profiles p on p.id = n.actor), '[]'::jsonb),
    'koro', coalesce((
      select jsonb_agg(k order by k->>'at' desc)
      from (
        select jsonb_build_object('crew', c.id, 'koro', c.name, 'kemoji', c.emoji,
                 'who', coalesce(nullif(p.display_name, ''), p.handle), 'emoji', p.avatar_emoji,
                 'body', left(m.body, 140), 'at', m.created_at) k
        from bulavata.crew_members cm
        join bulavata.crews c on c.id = cm.crew_id
        join lateral (
          select * from bulavata.crew_messages x
           where x.crew_id = cm.crew_id and not x.deleted and x.kind is distinct from 'system'
             and x.author <> me and (x.expires_at is null or x.expires_at > now())
             and x.created_at > now() - interval '14 days'
             and not exists (select 1 from bulavata.blocks b where b.blocker = me and b.blocked = x.author)
           order by x.created_at desc limit 1) m on true
        join bulavata.profiles p on p.id = m.author
        where cm.member = me
        order by m.created_at desc limit 8) s), '[]'::jsonb)
  ) into out;
  return out;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.circle_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text,61011));
  if tg_op='INSERT' then new.created_at=now();
  elsif old.status='ended' then raise exception 'This circle has ended.';
  elsif new.status<>old.status and not ((old.status='planned' and new.status in ('open','ended')) or (old.status='open' and new.status='ended')) then
    raise exception 'Invalid circle transition.';
  end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.circle_people_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare c public.bv_circles;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.circle_id::text,61011));
  select * into c from public.bv_circles where id=new.circle_id;
  if c.id is null or c.status='ended' then raise exception 'This circle is unavailable.'; end if;
  if tg_op='INSERT' then
    new.joined_at=now();
    if new.comments_paused or (new.seat is not null and not(new.member=c.host and new.seat=1)) then raise exception 'Only the host assigns speaker seats.'; end if;
  elsif auth.uid()<>c.host and (new.seat is distinct from old.seat or new.comments_paused<>old.comments_paused) then
    raise exception 'Only the host can moderate.';
  end if;
  if new.member=c.host and (new.seat is distinct from 1 or new.comments_paused) then raise exception 'The host keeps seat one.'; end if;
  if new.member<>c.host and new.seat=1 then raise exception 'Seat one belongs to the host.'; end if;
  if new.seat>c.capacity then raise exception 'All speaker seats are filled.'; end if;
  if new.comments_paused and new.requested then new.requested=false; end if;
  if new.seat is not null then new.requested=false; end if;
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION bulavata.circle_comment_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.circle_id::text,61011));
  if not exists(select 1 from public.bv_circles where id=new.circle_id and status='open') then raise exception 'Comments open when the host opens the circle.'; end if;
  if exists(select 1 from public.bv_circle_comments where author=auth.uid() and circle_id=new.circle_id and created_at>clock_timestamp()-interval '2 seconds') then
    raise exception 'Give the conversation a moment before posting again.';
  end if;
  new.created_at=clock_timestamp();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION public.bv_circle_create(p_crew bigint, p_title text, p_topic text, p_capacity integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to host a circle.'; end if;
  insert into public.bv_circles(crew_id,host,title,topic,capacity) values(p_crew,auth.uid(),trim(p_title),trim(p_topic),p_capacity) returning id into cid;
  insert into public.bv_circle_people(circle_id,member,seat) values(cid,auth.uid(),1);
  return cid;
end $function$
;

create or replace view public.bv_profiles with (security_invoker=true) as
 SELECT id,
    handle,
    display_name,
    pronouns,
    bio,
    avatar_emoji,
    room_theme,
    room_accent,
    room_css,
    room_song,
    human_verified,
        CASE
            WHEN id = (( SELECT auth.uid() AS uid)) THEN verify_method
            ELSE NULL::text
        END AS verify_method,
        CASE
            WHEN id = (( SELECT auth.uid() AS uid)) THEN birth_year
            ELSE NULL::integer
        END AS birth_year,
        CASE
            WHEN id = (( SELECT auth.uid() AS uid)) THEN age_band
            ELSE NULL::text
        END AS age_band,
    created_at,
    last_seen
   FROM bulavata.profiles;

create or replace view public.bv_friendships with (security_invoker=true) as
 SELECT id,
    requester,
    addressee,
    status,
    created_at
   FROM bulavata.friendships;

create or replace view public.bv_top_friends with (security_invoker=true) as
 SELECT owner,
    friend,
    slot
   FROM bulavata.top_friends;

create or replace view public.bv_pulses with (security_invoker=true) as
 SELECT id,
    author,
    mood,
    text,
    created_at
   FROM bulavata.pulses;

create or replace view public.bv_moments with (security_invoker=true) as
 SELECT id,
    author,
    body,
    media_url,
    caption,
    created_at,
    audience,
    repost_of
   FROM bulavata.moments;

create or replace view public.bv_wall_posts with (security_invoker=true) as
 SELECT id,
    wall_owner,
    author,
    body,
    ink,
    created_at
   FROM bulavata.wall_posts;

create or replace view public.bv_luv with (security_invoker=true) as
 SELECT id,
    giver,
    target_kind,
    target_id,
    target_profile,
    created_at
   FROM bulavata.luv;

create or replace view public.bv_crews with (security_invoker=true) as
 SELECT id,
    name,
    emoji,
    accent,
    owner,
    join_code,
    created_at
   FROM bulavata.crews;

create or replace view public.bv_crew_members with (security_invoker=true) as
 SELECT crew_id,
    member,
    joined_at
   FROM bulavata.crew_members;

create or replace view public.bv_crew_messages with (security_invoker=true) as
 SELECT id,
    crew_id,
    author,
    body,
    created_at,
    reply_to
   FROM bulavata.crew_messages
  WHERE NOT deleted AND kind = 'text'::text;

create or replace view public.bv_sparks with (security_invoker=true) as
 SELECT id,
    for_date,
    question
   FROM bulavata.sparks;

create or replace view public.bv_spark_answers with (security_invoker=true) as
 SELECT id,
    spark_id,
    author,
    body,
    created_at
   FROM bulavata.spark_answers;

create or replace view bulavata.wallet_reconciliation as
 SELECT w.id AS wallet_id,
    w.owner,
    w.balance_minor,
    COALESCE(sum(
        CASE
            WHEN t.direction = 'credit'::text THEN t.amount_minor
            WHEN t.direction = 'debit'::text THEN - t.amount_minor
            ELSE NULL::bigint
        END), 0::numeric) AS ledger_minor,
    w.balance_minor::numeric - COALESCE(sum(
        CASE
            WHEN t.direction = 'credit'::text THEN t.amount_minor
            WHEN t.direction = 'debit'::text THEN - t.amount_minor
            ELSE NULL::bigint
        END), 0::numeric) AS drift_minor
   FROM bulavata.wallets w
     LEFT JOIN bulavata.transactions t ON t.wallet_id = w.id AND t.status = 'settled'::text
  GROUP BY w.id, w.owner, w.balance_minor;

create or replace view bulavata.gift_daily_stats as
 SELECT date_trunc('day'::text, created_at)::date AS day,
    count(*) AS gifts_sent,
    count(DISTINCT giver) AS people_giving,
    count(DISTINCT receiver) AS people_receiving,
    mode() WITHIN GROUP (ORDER BY gift) AS most_popular
   FROM bulavata.gifts
  GROUP BY (date_trunc('day'::text, created_at)::date)
  ORDER BY (date_trunc('day'::text, created_at)::date) DESC;

create or replace view public.bv_sere_media_generations with (security_invoker=true) as
 SELECT id,
    user_id,
    audio_url,
    source_image_url,
    output_video_url,
    output_poster_url,
    status,
    scene_id,
    caption,
    audio_duration_ms,
    render_start_ms,
    render_end_ms,
    provider,
    provider_job_id,
    progress,
    error,
    attempts,
    remix_of,
    post_id,
    plays,
    tips_count,
    created_at,
    completed_at,
    engine
   FROM bulavata.sere_media_generations;

create or replace view public.bv_sere_scenes with (security_invoker=true) as
 SELECT id,
    label,
    params,
    sort
   FROM bulavata.sere_scenes
  ORDER BY sort;

CREATE TRIGGER luv_cap BEFORE INSERT ON bulavata.luv FOR EACH ROW EXECUTE FUNCTION bulavata.enforce_luv_cap();

CREATE TRIGGER t_open_wallet AFTER INSERT ON bulavata.profiles FOR EACH ROW EXECUTE FUNCTION bulavata.open_wallet();

CREATE TRIGGER luv_count_sync AFTER INSERT OR DELETE ON bulavata.luv FOR EACH ROW EXECUTE FUNCTION bulavata.sync_luv_count();

CREATE TRIGGER crew_message_expiry BEFORE INSERT ON bulavata.crew_messages FOR EACH ROW EXECUTE FUNCTION bulavata.crew_message_expiry();

CREATE TRIGGER notify_reaction AFTER INSERT OR UPDATE OF reaction ON bulavata.reactions FOR EACH ROW EXECUTE FUNCTION bulavata.trg_notify_reaction();

CREATE TRIGGER notify_comment AFTER INSERT ON bulavata.comments FOR EACH ROW EXECUTE FUNCTION bulavata.trg_notify_comment();

CREATE TRIGGER notify_friendship AFTER INSERT OR UPDATE OF status ON bulavata.friendships FOR EACH ROW EXECUTE FUNCTION bulavata.trg_notify_friendship();

CREATE TRIGGER notify_wall AFTER INSERT ON bulavata.wall_posts FOR EACH ROW EXECUTE FUNCTION bulavata.trg_notify_wall();

CREATE TRIGGER notify_rsvp AFTER INSERT OR UPDATE OF status ON bulavata.event_rsvps FOR EACH ROW EXECUTE FUNCTION bulavata.trg_notify_rsvp();

CREATE TRIGGER talanoa_likes_count AFTER INSERT OR DELETE ON bulavata.talanoa_likes FOR EACH ROW EXECUTE FUNCTION bulavata.talanoa_count_like();

CREATE TRIGGER talanoa_reposts_count AFTER INSERT OR DELETE ON bulavata.talanoa_reposts FOR EACH ROW EXECUTE FUNCTION bulavata.talanoa_count_repost();

CREATE TRIGGER talanoa_replies_count AFTER INSERT OR DELETE ON bulavata.talanoa_posts FOR EACH ROW EXECUTE FUNCTION bulavata.talanoa_count_reply();

CREATE TRIGGER sere_autopost BEFORE UPDATE ON bulavata.sere_media_generations FOR EACH ROW EXECUTE FUNCTION bulavata.sere_autopost();

CREATE TRIGGER sere_tip_count AFTER INSERT ON bulavata.gifts FOR EACH ROW WHEN ((new.sere_id IS NOT NULL)) EXECUTE FUNCTION bulavata.sere_count_tip();

CREATE TRIGGER top_mate_added AFTER INSERT ON bulavata.top_friends FOR EACH ROW EXECUTE FUNCTION bulavata.top_mate_added();

CREATE TRIGGER circle_guard BEFORE INSERT OR UPDATE ON public.bv_circles FOR EACH ROW EXECUTE FUNCTION bulavata.circle_guard();

CREATE TRIGGER circle_people_guard BEFORE INSERT OR UPDATE ON public.bv_circle_people FOR EACH ROW EXECUTE FUNCTION bulavata.circle_people_guard();

CREATE TRIGGER circle_comment_guard BEFORE INSERT ON public.bv_circle_comments FOR EACH ROW EXECUTE FUNCTION bulavata.circle_comment_guard();

alter table bulavata.profiles enable row level security;

alter table bulavata.friendships enable row level security;

alter table bulavata.top_friends enable row level security;

alter table bulavata.pulses enable row level security;

alter table bulavata.moments enable row level security;

alter table bulavata.wall_posts enable row level security;

alter table bulavata.luv enable row level security;

alter table bulavata.crews enable row level security;

alter table bulavata.crew_members enable row level security;

alter table bulavata.crew_messages enable row level security;

alter table bulavata.sparks enable row level security;

alter table bulavata.spark_answers enable row level security;

alter table bulavata.wallets enable row level security;

alter table bulavata.transactions enable row level security;

alter table bulavata.pinned_items enable row level security;

alter table bulavata.call_rooms enable row level security;

alter table bulavata.call_people enable row level security;

alter table bulavata.call_signals enable row level security;

alter table bulavata.call_callbacks enable row level security;

alter table bulavata.call_availability enable row level security;

alter table bulavata.talanoa_group_settings enable row level security;

alter table bulavata.talanoa_member_graph_settings enable row level security;

alter table bulavata.talanoa_personal_graph_settings enable row level security;

alter table bulavata.gifts enable row level security;

alter table bulavata.moment_edits enable row level security;

alter table bulavata.close_friends enable row level security;

alter table bulavata.reactions enable row level security;

alter table bulavata.comments enable row level security;

alter table bulavata.bookmarks enable row level security;

alter table bulavata.polls enable row level security;

alter table bulavata.poll_votes enable row level security;

alter table bulavata.stories enable row level security;

alter table bulavata.story_views enable row level security;

alter table bulavata.events enable row level security;

alter table bulavata.event_rsvps enable row level security;

alter table bulavata.notifications enable row level security;

alter table bulavata.talanoa_posts enable row level security;

alter table bulavata.talanoa_likes enable row level security;

alter table bulavata.talanoa_reposts enable row level security;

alter table bulavata.sere_scenes enable row level security;

alter table bulavata.sere_media_generations enable row level security;

alter table bulavata.hubs enable row level security;

alter table bulavata.talanoa_shares enable row level security;

alter table bulavata.referrals enable row level security;

alter table bulavata.coin_settings enable row level security;

alter table bulavata.coin_bundles enable row level security;

alter table bulavata.coin_accounts enable row level security;

alter table bulavata.coin_ledger enable row level security;

alter table bulavata.coin_tips enable row level security;

alter table bulavata.blocks enable row level security;

alter table bulavata.reports enable row level security;

alter table bulavata.invites enable row level security;

alter table bulavata.app_links enable row level security;

alter table public.bv_circles enable row level security;

alter table public.bv_circle_people enable row level security;

alter table public.bv_circle_comments enable row level security;

create policy p_read on bulavata.profiles as permissive for select to authenticated using (true);

create policy p_ins on bulavata.profiles as permissive for insert to authenticated with check ((id = ( SELECT auth.uid() AS uid)));

create policy p_upd on bulavata.profiles as permissive for update to authenticated using ((id = ( SELECT auth.uid() AS uid))) with check ((id = ( SELECT auth.uid() AS uid)));

create policy f_read on bulavata.friendships as permissive for select to authenticated using (((requester = ( SELECT auth.uid() AS uid)) OR (addressee = ( SELECT auth.uid() AS uid))));

create policy f_ins on bulavata.friendships as permissive for insert to authenticated with check ((requester = ( SELECT auth.uid() AS uid)));

create policy f_upd on bulavata.friendships as permissive for update to authenticated using (((addressee = ( SELECT auth.uid() AS uid)) OR (requester = ( SELECT auth.uid() AS uid))));

create policy f_del on bulavata.friendships as permissive for delete to authenticated using (((addressee = ( SELECT auth.uid() AS uid)) OR (requester = ( SELECT auth.uid() AS uid))));

create policy pu_read on bulavata.pulses as permissive for select to authenticated using (bulavata.visible_to_me(author));

create policy pu_ins on bulavata.pulses as permissive for insert to authenticated with check ((author = ( SELECT auth.uid() AS uid)));

create policy pu_del on bulavata.pulses as permissive for delete to authenticated using ((author = ( SELECT auth.uid() AS uid)));

create policy m_ins on bulavata.moments as permissive for insert to authenticated with check ((author = ( SELECT auth.uid() AS uid)));

create policy m_del on bulavata.moments as permissive for delete to authenticated using ((author = ( SELECT auth.uid() AS uid)));

create policy w_read on bulavata.wall_posts as permissive for select to authenticated using (bulavata.visible_to_me(wall_owner));

create policy w_ins on bulavata.wall_posts as permissive for insert to authenticated with check (((author = ( SELECT auth.uid() AS uid)) AND bulavata.visible_to_me(wall_owner)));

create policy w_del on bulavata.wall_posts as permissive for delete to authenticated using (((author = ( SELECT auth.uid() AS uid)) OR (wall_owner = ( SELECT auth.uid() AS uid))));

create policy l_read on bulavata.luv as permissive for select to authenticated using (true);

create policy l_ins on bulavata.luv as permissive for insert to authenticated with check ((giver = ( SELECT auth.uid() AS uid)));

create policy c_read on bulavata.crews as permissive for select to authenticated using (((owner = ( SELECT auth.uid() AS uid)) OR bulavata.in_crew(id)));

create policy c_ins on bulavata.crews as permissive for insert to authenticated with check ((owner = ( SELECT auth.uid() AS uid)));

create policy c_upd on bulavata.crews as permissive for update to authenticated using ((owner = ( SELECT auth.uid() AS uid)));

create policy cm_read on bulavata.crew_members as permissive for select to authenticated using (bulavata.in_crew(crew_id));

create policy cm_ins on bulavata.crew_members as permissive for insert to authenticated with check ((member = ( SELECT auth.uid() AS uid)));

create policy cm_del on bulavata.crew_members as permissive for delete to authenticated using ((member = ( SELECT auth.uid() AS uid)));

create policy cx_del on bulavata.crew_messages as permissive for delete to authenticated using ((author = ( SELECT auth.uid() AS uid)));

create policy s_read on bulavata.sparks as permissive for select to authenticated using (true);

create policy sa_read on bulavata.spark_answers as permissive for select to authenticated using (((author = ( SELECT auth.uid() AS uid)) OR (bulavata.are_friends(( SELECT auth.uid() AS uid), author) AND (EXISTS ( SELECT 1
   FROM bulavata.spark_answers mine
  WHERE ((mine.spark_id = spark_answers.spark_id) AND (mine.author = ( SELECT auth.uid() AS uid))))))));

create policy sa_ins on bulavata.spark_answers as permissive for insert to authenticated with check ((author = ( SELECT auth.uid() AS uid)));

create policy wa_read on bulavata.wallets as permissive for select to authenticated using ((owner = ( SELECT auth.uid() AS uid)));

create policy tx_read on bulavata.transactions as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM bulavata.wallets w
  WHERE ((w.id = transactions.wallet_id) AND (w.owner = ( SELECT auth.uid() AS uid))))));

create policy pin_read on bulavata.pinned_items as permissive for select to authenticated using ((bulavata.visible_to_me(owner) OR (owner = ( SELECT auth.uid() AS uid))));

create policy pin_insert on bulavata.pinned_items as permissive for insert to authenticated with check ((owner = ( SELECT auth.uid() AS uid)));

create policy pin_update on bulavata.pinned_items as permissive for update to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy pin_delete on bulavata.pinned_items as permissive for delete to authenticated using ((owner = ( SELECT auth.uid() AS uid)));

create policy tf_read on bulavata.top_friends as permissive for select to authenticated using ((bulavata.visible_to_me(owner) OR (owner = ( SELECT auth.uid() AS uid))));

create policy tf_insert on bulavata.top_friends as permissive for insert to authenticated with check ((owner = ( SELECT auth.uid() AS uid)));

create policy tf_update on bulavata.top_friends as permissive for update to authenticated using ((owner = ( SELECT auth.uid() AS uid))) with check ((owner = ( SELECT auth.uid() AS uid)));

create policy tf_delete on bulavata.top_friends as permissive for delete to authenticated using ((owner = ( SELECT auth.uid() AS uid)));

create policy m_read on bulavata.moments as permissive for select to public using (bulavata.can_see_moment(author, audience));

create policy cx_ins on bulavata.crew_messages as permissive for insert to public with check (((author = ( SELECT auth.uid() AS uid)) AND (kind = 'text'::text) AND bulavata.crew_can_post(crew_id) AND bulavata.reply_in_crew(reply_to, crew_id)));

create policy cx_read on bulavata.crew_messages as permissive for select to public using ((bulavata.in_crew(crew_id) AND ((expires_at IS NULL) OR (expires_at > now()))));

create policy n_read on bulavata.notifications as permissive for select to public using ((recipient = ( SELECT auth.uid() AS uid)));

create policy tw_posts_read on bulavata.talanoa_posts as permissive for select to authenticated using (true);

create policy tw_likes_read on bulavata.talanoa_likes as permissive for select to authenticated using (true);

create policy tw_reposts_read on bulavata.talanoa_reposts as permissive for select to authenticated using (true);

create policy sere_scenes_read on bulavata.sere_scenes as permissive for select to authenticated using (true);

create policy sere_gen_read on bulavata.sere_media_generations as permissive for select to authenticated using (((user_id = ( SELECT auth.uid() AS uid)) OR (status = 'completed'::text)));

create policy shares_own on bulavata.talanoa_shares as permissive for select to authenticated using ((sharer = ( SELECT auth.uid() AS uid)));

create policy referrals_own on bulavata.referrals as permissive for select to authenticated using ((sharer = ( SELECT auth.uid() AS uid)));

create policy coin_settings_read on bulavata.coin_settings as permissive for select to authenticated using (true);

create policy coin_bundles_read on bulavata.coin_bundles as permissive for select to authenticated using (active);

create policy coin_accounts_own on bulavata.coin_accounts as permissive for select to authenticated using ((owner = ( SELECT auth.uid() AS uid)));

create policy coin_ledger_own on bulavata.coin_ledger as permissive for select to authenticated using ((owner = ( SELECT auth.uid() AS uid)));

create policy coin_tips_mine on bulavata.coin_tips as permissive for select to authenticated using (((giver = ( SELECT auth.uid() AS uid)) OR (author = ( SELECT auth.uid() AS uid))));

create policy blocks_own on bulavata.blocks as permissive for select to authenticated using ((blocker = ( SELECT auth.uid() AS uid)));

create policy invites_own on bulavata.invites as permissive for select to authenticated using ((sharer = ( SELECT auth.uid() AS uid)));

create policy circles_read on public.bv_circles as permissive for select to authenticated using (bulavata.in_crew(crew_id));

create policy circles_create on public.bv_circles as permissive for insert to authenticated with check (((host = ( SELECT auth.uid() AS uid)) AND bulavata.in_crew(crew_id) AND (status = 'planned'::text)));

create policy circles_host_update on public.bv_circles as permissive for update to authenticated using (((host = ( SELECT auth.uid() AS uid)) AND bulavata.in_crew(crew_id))) with check (((host = ( SELECT auth.uid() AS uid)) AND bulavata.in_crew(crew_id)));

create policy people_read on public.bv_circle_people as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM bv_circles c
  WHERE (c.id = bv_circle_people.circle_id))));

create policy people_join on public.bv_circle_people as permissive for insert to authenticated with check (((member = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM bv_circles c
  WHERE ((c.id = bv_circle_people.circle_id) AND (c.status <> 'ended'::text))))));

create policy people_update on public.bv_circle_people as permissive for update to authenticated using ((EXISTS ( SELECT 1
   FROM bv_circles c
  WHERE ((c.id = bv_circle_people.circle_id) AND ((bv_circle_people.member = ( SELECT auth.uid() AS uid)) OR (c.host = ( SELECT auth.uid() AS uid))))))) with check ((EXISTS ( SELECT 1
   FROM bv_circles c
  WHERE ((c.id = bv_circle_people.circle_id) AND ((bv_circle_people.member = ( SELECT auth.uid() AS uid)) OR (c.host = ( SELECT auth.uid() AS uid)))))));

create policy comments_read on public.bv_circle_comments as permissive for select to authenticated using ((EXISTS ( SELECT 1
   FROM bv_circles c
  WHERE (c.id = bv_circle_comments.circle_id))));

create policy comments_write on public.bv_circle_comments as permissive for insert to authenticated with check (((author = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM bv_circles c
  WHERE ((c.id = bv_circle_comments.circle_id) AND (c.status = 'open'::text)))) AND (EXISTS ( SELECT 1
   FROM bv_circle_people p
  WHERE ((p.circle_id = bv_circle_comments.circle_id) AND (p.member = ( SELECT auth.uid() AS uid)) AND (NOT p.comments_paused))))));

create policy comments_moderate on public.bv_circle_comments as permissive for delete to authenticated using ((EXISTS ( SELECT 1
   FROM bv_circles c
  WHERE ((c.id = bv_circle_comments.circle_id) AND ((bv_circle_comments.author = ( SELECT auth.uid() AS uid)) OR (c.host = ( SELECT auth.uid() AS uid)))))));

grant usage on schema bulavata to anon;
grant usage on schema bulavata to authenticated;
grant usage on schema bulavata to service_role;
grant usage on schema bulavata_talanoa_private to anon;
grant usage on schema bulavata_talanoa_private to authenticated;

revoke all on table bulavata.profiles from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.profiles to authenticated;

revoke all on sequence bulavata.friendships_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.friendships_id_seq to authenticated;

revoke all on table bulavata.friendships from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.friendships to authenticated;

revoke all on table bulavata.top_friends from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.top_friends to authenticated;

revoke all on sequence bulavata.pulses_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.pulses_id_seq to authenticated;

revoke all on table bulavata.pulses from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.pulses to authenticated;

revoke all on sequence bulavata.moments_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.moments_id_seq to authenticated;

revoke all on table bulavata.moments from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.moments to authenticated;

revoke all on sequence bulavata.wall_posts_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.wall_posts_id_seq to authenticated;

revoke all on table bulavata.wall_posts from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.wall_posts to authenticated;

revoke all on sequence bulavata.luv_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.luv_id_seq to authenticated;

revoke all on table bulavata.luv from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.luv to authenticated;

revoke all on sequence bulavata.crews_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.crews_id_seq to authenticated;

revoke all on table bulavata.crews from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.crews to authenticated;

revoke all on table bulavata.crew_members from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.crew_members to authenticated;

revoke all on sequence bulavata.crew_messages_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.crew_messages_id_seq to authenticated;

revoke all on table bulavata.crew_messages from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.crew_messages to authenticated;

revoke all on sequence bulavata.sparks_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.sparks_id_seq to authenticated;

revoke all on table bulavata.sparks from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.sparks to authenticated;

revoke all on sequence bulavata.spark_answers_id_seq from public, anon, authenticated, service_role;
grant select, usage on sequence bulavata.spark_answers_id_seq to authenticated;

revoke all on table bulavata.spark_answers from public, anon, authenticated, service_role;
grant delete, insert, select, update on table bulavata.spark_answers to authenticated;

revoke all on table public.bv_profiles from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_profiles to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_profiles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_profiles to service_role;

revoke all on table public.bv_friendships from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_friendships to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_friendships to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_friendships to service_role;

revoke all on table public.bv_top_friends from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_top_friends to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_top_friends to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_top_friends to service_role;

revoke all on table public.bv_pulses from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_pulses to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_pulses to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_pulses to service_role;

revoke all on table public.bv_moments from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_moments to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_moments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_moments to service_role;

revoke all on table public.bv_wall_posts from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_wall_posts to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_wall_posts to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_wall_posts to service_role;

revoke all on table public.bv_luv from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_luv to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_luv to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_luv to service_role;

revoke all on table public.bv_crews from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crews to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crews to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crews to service_role;

revoke all on table public.bv_crew_members from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crew_members to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crew_members to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crew_members to service_role;

revoke all on table public.bv_crew_messages from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crew_messages to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crew_messages to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_crew_messages to service_role;

revoke all on table public.bv_sparks from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sparks to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sparks to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sparks to service_role;

revoke all on table public.bv_spark_answers from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_spark_answers to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_spark_answers to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_spark_answers to service_role;

revoke all on table bulavata.wallets from public, anon, authenticated, service_role;
grant select on table bulavata.wallets to authenticated;

revoke all on table bulavata.transactions from public, anon, authenticated, service_role;
grant select on table bulavata.transactions to authenticated;

revoke all on sequence bulavata.pinned_items_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.pinned_items from public, anon, authenticated, service_role;

revoke all on table bulavata.wallet_reconciliation from public, anon, authenticated, service_role;

revoke all on table bulavata.call_rooms from public, anon, authenticated, service_role;

revoke all on table bulavata.call_people from public, anon, authenticated, service_role;

revoke all on sequence bulavata.call_signals_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.call_signals from public, anon, authenticated, service_role;

revoke all on table bulavata.call_callbacks from public, anon, authenticated, service_role;

revoke all on table bulavata.call_availability from public, anon, authenticated, service_role;

revoke all on table bulavata.talanoa_group_settings from public, anon, authenticated, service_role;

revoke all on table bulavata.talanoa_member_graph_settings from public, anon, authenticated, service_role;

revoke all on table bulavata.talanoa_personal_graph_settings from public, anon, authenticated, service_role;

revoke all on sequence bulavata.gifts_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.gifts from public, anon, authenticated, service_role;

revoke all on table bulavata.gift_daily_stats from public, anon, authenticated, service_role;

revoke all on sequence bulavata.moment_edits_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.moment_edits from public, anon, authenticated, service_role;

revoke all on table bulavata.close_friends from public, anon, authenticated, service_role;

revoke all on sequence bulavata.reactions_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.reactions from public, anon, authenticated, service_role;

revoke all on sequence bulavata.comments_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.comments from public, anon, authenticated, service_role;

revoke all on sequence bulavata.bookmarks_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.bookmarks from public, anon, authenticated, service_role;

revoke all on sequence bulavata.polls_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.polls from public, anon, authenticated, service_role;

revoke all on table bulavata.poll_votes from public, anon, authenticated, service_role;

revoke all on sequence bulavata.stories_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.stories from public, anon, authenticated, service_role;

revoke all on table bulavata.story_views from public, anon, authenticated, service_role;

revoke all on sequence bulavata.events_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.events from public, anon, authenticated, service_role;

revoke all on table bulavata.event_rsvps from public, anon, authenticated, service_role;

revoke all on sequence bulavata.notifications_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.notifications from public, anon, authenticated, service_role;
grant select on table bulavata.notifications to authenticated;

revoke all on sequence bulavata.talanoa_posts_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.talanoa_posts from public, anon, authenticated, service_role;
grant select on table bulavata.talanoa_posts to authenticated;

revoke all on table bulavata.talanoa_likes from public, anon, authenticated, service_role;
grant select on table bulavata.talanoa_likes to authenticated;

revoke all on table bulavata.talanoa_reposts from public, anon, authenticated, service_role;
grant select on table bulavata.talanoa_reposts to authenticated;

revoke all on table bulavata.sere_scenes from public, anon, authenticated, service_role;
grant select on table bulavata.sere_scenes to authenticated;
grant select on table bulavata.sere_scenes to service_role;

revoke all on table bulavata.sere_media_generations from public, anon, authenticated, service_role;
grant select on table bulavata.sere_media_generations to authenticated;
grant select, update on table bulavata.sere_media_generations to service_role;

revoke all on table public.bv_sere_media_generations from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sere_media_generations to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sere_media_generations to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sere_media_generations to service_role;

revoke all on table public.bv_sere_scenes from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sere_scenes to anon;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sere_scenes to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_sere_scenes to service_role;

revoke all on table bulavata.hubs from public, anon, authenticated, service_role;

revoke all on table bulavata.talanoa_shares from public, anon, authenticated, service_role;
grant select on table bulavata.talanoa_shares to authenticated;

revoke all on sequence bulavata.referrals_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.referrals from public, anon, authenticated, service_role;
grant select on table bulavata.referrals to authenticated;

revoke all on table bulavata.coin_settings from public, anon, authenticated, service_role;
grant select on table bulavata.coin_settings to authenticated;

revoke all on table bulavata.coin_bundles from public, anon, authenticated, service_role;
grant select on table bulavata.coin_bundles to authenticated;

revoke all on table bulavata.coin_accounts from public, anon, authenticated, service_role;
grant select on table bulavata.coin_accounts to authenticated;

revoke all on sequence bulavata.coin_ledger_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.coin_ledger from public, anon, authenticated, service_role;
grant select on table bulavata.coin_ledger to authenticated;

revoke all on sequence bulavata.coin_tips_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.coin_tips from public, anon, authenticated, service_role;
grant select on table bulavata.coin_tips to authenticated;

revoke all on table bulavata.blocks from public, anon, authenticated, service_role;
grant select on table bulavata.blocks to authenticated;

revoke all on sequence bulavata.reports_id_seq from public, anon, authenticated, service_role;

revoke all on table bulavata.reports from public, anon, authenticated, service_role;

revoke all on table bulavata.invites from public, anon, authenticated, service_role;
grant select on table bulavata.invites to authenticated;

revoke all on table bulavata.app_links from public, anon, authenticated, service_role;

revoke all on table public.bv_circles from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_circles to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_circles to service_role;

revoke all on table public.bv_circle_people from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_circle_people to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_circle_people to service_role;

revoke all on table public.bv_circle_comments from public, anon, authenticated, service_role;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_circle_comments to authenticated;
grant delete, insert, maintain, references, select, trigger, truncate, update on table public.bv_circle_comments to service_role;

revoke all on function bulavata.are_friends(a uuid, b uuid) from public, anon, authenticated, service_role;
grant execute on function bulavata.are_friends(a uuid, b uuid) to authenticated;
grant execute on function bulavata.are_friends(a uuid, b uuid) to public;

revoke all on function bulavata.visible_to_me(owner uuid) from public, anon, authenticated, service_role;
grant execute on function bulavata.visible_to_me(owner uuid) to authenticated;
grant execute on function bulavata.visible_to_me(owner uuid) to public;

revoke all on function bulavata.luv_left() from public, anon, authenticated, service_role;
grant execute on function bulavata.luv_left() to authenticated;
grant execute on function bulavata.luv_left() to public;

revoke all on function bulavata.enforce_luv_cap() from public, anon, authenticated, service_role;
grant execute on function bulavata.enforce_luv_cap() to authenticated;
grant execute on function bulavata.enforce_luv_cap() to public;

revoke all on function bulavata.in_crew(c bigint) from public, anon, authenticated, service_role;
grant execute on function bulavata.in_crew(c bigint) to authenticated;
grant execute on function bulavata.in_crew(c bigint) to public;

revoke all on function public.bv_luv_left() from public, anon, authenticated, service_role;
grant execute on function public.bv_luv_left() to anon;
grant execute on function public.bv_luv_left() to authenticated;
grant execute on function public.bv_luv_left() to public;
grant execute on function public.bv_luv_left() to service_role;

revoke all on function public.bv_pulse_feed() from public, anon, authenticated, service_role;
grant execute on function public.bv_pulse_feed() to anon;
grant execute on function public.bv_pulse_feed() to authenticated;
grant execute on function public.bv_pulse_feed() to public;
grant execute on function public.bv_pulse_feed() to service_role;

revoke all on function public.bv_moments_feed(lim integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_moments_feed(lim integer) to anon;
grant execute on function public.bv_moments_feed(lim integer) to authenticated;
grant execute on function public.bv_moments_feed(lim integer) to public;
grant execute on function public.bv_moments_feed(lim integer) to service_role;

revoke all on function public.bv_my_friends() from public, anon, authenticated, service_role;
grant execute on function public.bv_my_friends() to authenticated;
grant execute on function public.bv_my_friends() to service_role;

revoke all on function public.bv_pending_requests() from public, anon, authenticated, service_role;
grant execute on function public.bv_pending_requests() to authenticated;
grant execute on function public.bv_pending_requests() to service_role;

revoke all on function public.bv_room(p_handle text) from public, anon, authenticated, service_role;
grant execute on function public.bv_room(p_handle text) to anon;
grant execute on function public.bv_room(p_handle text) to authenticated;
grant execute on function public.bv_room(p_handle text) to public;
grant execute on function public.bv_room(p_handle text) to service_role;

revoke all on function public.bv_export_my_archive() from public, anon, authenticated, service_role;
grant execute on function public.bv_export_my_archive() to authenticated;
grant execute on function public.bv_export_my_archive() to service_role;

revoke all on function public.bv_join_crew(p_code text) from public, anon, authenticated, service_role;
grant execute on function public.bv_join_crew(p_code text) to anon;
grant execute on function public.bv_join_crew(p_code text) to authenticated;
grant execute on function public.bv_join_crew(p_code text) to public;
grant execute on function public.bv_join_crew(p_code text) to service_role;

revoke all on function public.bv_my_crews() from public, anon, authenticated, service_role;
grant execute on function public.bv_my_crews() to authenticated;
grant execute on function public.bv_my_crews() to service_role;

revoke all on function public.bv_touch() from public, anon, authenticated, service_role;
grant execute on function public.bv_touch() to anon;
grant execute on function public.bv_touch() to authenticated;
grant execute on function public.bv_touch() to public;
grant execute on function public.bv_touch() to service_role;

revoke all on function bulavata.open_wallet() from public, anon, authenticated, service_role;
grant execute on function bulavata.open_wallet() to public;

revoke all on function public.bv_handle_free(p_handle text) from public, anon, authenticated, service_role;
grant execute on function public.bv_handle_free(p_handle text) to anon;
grant execute on function public.bv_handle_free(p_handle text) to authenticated;
grant execute on function public.bv_handle_free(p_handle text) to public;
grant execute on function public.bv_handle_free(p_handle text) to service_role;

revoke all on function public.bv_manage_top(p_slot integer, p_action text) from public, anon, authenticated, service_role;
grant execute on function public.bv_manage_top(p_slot integer, p_action text) to authenticated;
grant execute on function public.bv_manage_top(p_slot integer, p_action text) to service_role;

revoke all on function bulavata.my_circle() from public, anon, authenticated, service_role;
grant execute on function bulavata.my_circle() to authenticated;
grant execute on function bulavata.my_circle() to public;

revoke all on function bulavata.feed(before timestamp with time zone, lim integer) from public, anon, authenticated, service_role;
grant execute on function bulavata.feed(before timestamp with time zone, lim integer) to authenticated;
grant execute on function bulavata.feed(before timestamp with time zone, lim integer) to public;

revoke all on function bulavata.sync_luv_count() from public, anon, authenticated, service_role;
grant execute on function bulavata.sync_luv_count() to public;

revoke all on function bulavata.wallet_send(to_handle text, amount_minor bigint, memo text, idem_key text) from public, anon, authenticated, service_role;
grant execute on function bulavata.wallet_send(to_handle text, amount_minor bigint, memo text, idem_key text) to authenticated;

revoke all on function bulavata.wallet_topup(wallet_owner uuid, amount_minor bigint, provider_ref text, kind text) from public, anon, authenticated, service_role;
grant execute on function bulavata.wallet_topup(wallet_owner uuid, amount_minor bigint, provider_ref text, kind text) to service_role;

revoke all on function public.bv_wallet_credit(p_owner uuid, p_amount_minor bigint, p_provider_ref text, p_currency text, p_kind text) from public, anon, authenticated, service_role;
grant execute on function public.bv_wallet_credit(p_owner uuid, p_amount_minor bigint, p_provider_ref text, p_currency text, p_kind text) to service_role;

revoke all on function public.bv_wallet() from public, anon, authenticated, service_role;
grant execute on function public.bv_wallet() to authenticated;
grant execute on function public.bv_wallet() to service_role;

revoke all on function public.bv_wallet_send(p_to_handle text, p_amount_minor bigint, p_memo text, p_idem text) from public, anon, authenticated, service_role;
grant execute on function public.bv_wallet_send(p_to_handle text, p_amount_minor bigint, p_memo text, p_idem text) to authenticated;
grant execute on function public.bv_wallet_send(p_to_handle text, p_amount_minor bigint, p_memo text, p_idem text) to service_role;

revoke all on function bulavata.call_require_crew(p_crew bigint) from public, anon, authenticated, service_role;

revoke all on function bulavata.call_sweep(p_call uuid) from public, anon, authenticated, service_role;

revoke all on function bulavata.call_summary(p_call uuid) from public, anon, authenticated, service_role;

revoke all on function bulavata.call_snapshot(p_call uuid) from public, anon, authenticated, service_role;

revoke all on function bulavata.call_rpc(p_action text, p_args jsonb) from public, anon, authenticated, service_role;
grant execute on function bulavata.call_rpc(p_action text, p_args jsonb) to authenticated;

revoke all on function public.bv_call_start(p_crew bigint, p_mode text, p_lobby boolean, p_capacity integer, p_device uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_start(p_crew bigint, p_mode text, p_lobby boolean, p_capacity integer, p_device uuid) to authenticated;
grant execute on function public.bv_call_start(p_crew bigint, p_mode text, p_lobby boolean, p_capacity integer, p_device uuid) to service_role;

revoke all on function public.bv_call_list(p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_list(p_crew bigint) to authenticated;
grant execute on function public.bv_call_list(p_crew bigint) to service_role;

revoke all on function public.bv_call_snapshot(p_call uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_snapshot(p_call uuid) to authenticated;
grant execute on function public.bv_call_snapshot(p_call uuid) to service_role;

revoke all on function public.bv_call_act(p_call uuid, p_action text, p_device uuid, p_target uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_act(p_call uuid, p_action text, p_device uuid, p_target uuid) to authenticated;
grant execute on function public.bv_call_act(p_call uuid, p_action text, p_device uuid, p_target uuid) to service_role;

revoke all on function public.bv_call_signal(p_call uuid, p_to uuid, p_kind text, p_payload jsonb, p_device uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_signal(p_call uuid, p_to uuid, p_kind text, p_payload jsonb, p_device uuid) to authenticated;
grant execute on function public.bv_call_signal(p_call uuid, p_to uuid, p_kind text, p_payload jsonb, p_device uuid) to service_role;

revoke all on function public.bv_call_signals(p_call uuid, p_after bigint, p_device uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_signals(p_call uuid, p_after bigint, p_device uuid) to authenticated;
grant execute on function public.bv_call_signals(p_call uuid, p_after bigint, p_device uuid) to service_role;

revoke all on function public.bv_call_position(p_call uuid, p_device uuid, p_x real, p_y real) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_position(p_call uuid, p_device uuid, p_x real, p_y real) to authenticated;
grant execute on function public.bv_call_position(p_call uuid, p_device uuid, p_x real, p_y real) to service_role;

revoke all on function public.bv_callback_request(p_crew bigint, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.bv_callback_request(p_crew bigint, p_note text) to authenticated;
grant execute on function public.bv_callback_request(p_crew bigint, p_note text) to service_role;

revoke all on function public.bv_callback_list(p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_callback_list(p_crew bigint) to authenticated;
grant execute on function public.bv_callback_list(p_crew bigint) to service_role;

revoke all on function public.bv_callback_act(p_request uuid, p_action text) from public, anon, authenticated, service_role;
grant execute on function public.bv_callback_act(p_request uuid, p_action text) to authenticated;
grant execute on function public.bv_callback_act(p_request uuid, p_action text) to service_role;

revoke all on function public.bv_call_availability(p_crew bigint, p_available boolean) from public, anon, authenticated, service_role;
grant execute on function public.bv_call_availability(p_crew bigint, p_available boolean) to authenticated;
grant execute on function public.bv_call_availability(p_crew bigint, p_available boolean) to service_role;

revoke all on function bulavata_talanoa_private.talanoa_type(p_type text) from public, anon, authenticated, service_role;

revoke all on function bulavata_talanoa_private.talanoa_groups() from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_groups() to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_group_row(p_crew bigint) from public, anon, authenticated, service_role;

revoke all on function bulavata_talanoa_private.talanoa_create_group(p_name text, p_type text, p_graph_visibility text, p_show_on_graph boolean) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_create_group(p_name text, p_type text, p_graph_visibility text, p_show_on_graph boolean) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_update_group(p_crew bigint, p_type text, p_graph_visibility text) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_update_group(p_crew bigint, p_type text, p_graph_visibility text) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_graph_choice(p_crew bigint, p_visible boolean) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_graph_choice(p_crew bigint, p_visible boolean) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_my_graph_visibility() from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_my_graph_visibility() to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_set_graph_visibility(p_visibility text) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_set_graph_visibility(p_visibility text) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_invitation(p_code text) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_invitation(p_code text) to anon;
grant execute on function bulavata_talanoa_private.talanoa_invitation(p_code text) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_join_circle(p_code text, p_show_on_graph boolean) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_join_circle(p_code text, p_show_on_graph boolean) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_circle_graph(p_crew bigint, p_public_only boolean) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_circle_graph(p_crew bigint, p_public_only boolean) to anon;
grant execute on function bulavata_talanoa_private.talanoa_circle_graph(p_crew bigint, p_public_only boolean) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_public_personal_graph(p_handle text) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_public_personal_graph(p_handle text) to anon;
grant execute on function bulavata_talanoa_private.talanoa_public_personal_graph(p_handle text) to authenticated;

revoke all on function bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner uuid) from public, anon, authenticated, service_role;
grant execute on function bulavata_talanoa_private.talanoa_assert_owner(p_expected_owner uuid) to authenticated;

revoke all on function public.bv_circle_groups() from public, anon, authenticated, service_role;
grant execute on function public.bv_circle_groups() to authenticated;
grant execute on function public.bv_circle_groups() to service_role;

revoke all on function public.bv_circle_create_group(p_name text, p_type text, p_graph_visibility text, p_show_on_graph boolean, p_expected_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_circle_create_group(p_name text, p_type text, p_graph_visibility text, p_show_on_graph boolean, p_expected_owner uuid) to authenticated;
grant execute on function public.bv_circle_create_group(p_name text, p_type text, p_graph_visibility text, p_show_on_graph boolean, p_expected_owner uuid) to service_role;

revoke all on function public.bv_circle_update_group(p_crew bigint, p_type text, p_graph_visibility text, p_expected_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_circle_update_group(p_crew bigint, p_type text, p_graph_visibility text, p_expected_owner uuid) to authenticated;
grant execute on function public.bv_circle_update_group(p_crew bigint, p_type text, p_graph_visibility text, p_expected_owner uuid) to service_role;

revoke all on function public.bv_circle_graph_choice(p_crew bigint, p_visible boolean, p_expected_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_circle_graph_choice(p_crew bigint, p_visible boolean, p_expected_owner uuid) to authenticated;
grant execute on function public.bv_circle_graph_choice(p_crew bigint, p_visible boolean, p_expected_owner uuid) to service_role;

revoke all on function public.bv_my_graph_visibility() from public, anon, authenticated, service_role;
grant execute on function public.bv_my_graph_visibility() to authenticated;
grant execute on function public.bv_my_graph_visibility() to service_role;

revoke all on function public.bv_set_graph_visibility(p_visibility text, p_expected_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_set_graph_visibility(p_visibility text, p_expected_owner uuid) to authenticated;
grant execute on function public.bv_set_graph_visibility(p_visibility text, p_expected_owner uuid) to service_role;

revoke all on function public.bv_circle_invitation(p_code text) from public, anon, authenticated, service_role;
grant execute on function public.bv_circle_invitation(p_code text) to anon;
grant execute on function public.bv_circle_invitation(p_code text) to authenticated;
grant execute on function public.bv_circle_invitation(p_code text) to service_role;

revoke all on function public.bv_join_circle(p_code text, p_show_on_graph boolean, p_expected_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_join_circle(p_code text, p_show_on_graph boolean, p_expected_owner uuid) to authenticated;
grant execute on function public.bv_join_circle(p_code text, p_show_on_graph boolean, p_expected_owner uuid) to service_role;

revoke all on function public.bv_circle_graph(p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_circle_graph(p_crew bigint) to anon;
grant execute on function public.bv_circle_graph(p_crew bigint) to authenticated;
grant execute on function public.bv_circle_graph(p_crew bigint) to service_role;

revoke all on function public.bv_public_circle_graph(p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_public_circle_graph(p_crew bigint) to anon;
grant execute on function public.bv_public_circle_graph(p_crew bigint) to authenticated;
grant execute on function public.bv_public_circle_graph(p_crew bigint) to service_role;

revoke all on function public.bv_public_personal_graph(p_handle text) from public, anon, authenticated, service_role;
grant execute on function public.bv_public_personal_graph(p_handle text) to anon;
grant execute on function public.bv_public_personal_graph(p_handle text) to authenticated;
grant execute on function public.bv_public_personal_graph(p_handle text) to service_role;

revoke all on function bulavata.gift_friends(a uuid, b uuid) from public, anon, authenticated, service_role;

revoke all on function bulavata.gifts_used(who uuid) from public, anon, authenticated, service_role;

revoke all on function public.bv_gifts_left() from public, anon, authenticated, service_role;
grant execute on function public.bv_gifts_left() to authenticated;
grant execute on function public.bv_gifts_left() to service_role;

revoke all on function public.bv_gift_send(p_to uuid, p_gift text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.bv_gift_send(p_to uuid, p_gift text, p_note text) to authenticated;
grant execute on function public.bv_gift_send(p_to uuid, p_gift text, p_note text) to service_role;

revoke all on function public.bv_gifts_for(p_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_gifts_for(p_owner uuid) to authenticated;
grant execute on function public.bv_gifts_for(p_owner uuid) to service_role;

revoke all on function public.bv_gift_hide(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_gift_hide(p_id bigint) to authenticated;
grant execute on function public.bv_gift_hide(p_id bigint) to service_role;

revoke all on function bulavata.can_see_moment(p_author uuid, p_audience text) from public, anon, authenticated, service_role;

revoke all on function bulavata.target_author(p_kind text, p_id bigint) from public, anon, authenticated, service_role;

revoke all on function bulavata.can_see_target(p_kind text, p_id bigint) from public, anon, authenticated, service_role;

revoke all on function bulavata.reaction_summary(p_kind text, p_id bigint) from public, anon, authenticated, service_role;

revoke all on function public.bv_react(p_kind text, p_id bigint, p_reaction text) from public, anon, authenticated, service_role;
grant execute on function public.bv_react(p_kind text, p_id bigint, p_reaction text) to authenticated;
grant execute on function public.bv_react(p_kind text, p_id bigint, p_reaction text) to service_role;

revoke all on function public.bv_reactors(p_kind text, p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_reactors(p_kind text, p_id bigint) to authenticated;
grant execute on function public.bv_reactors(p_kind text, p_id bigint) to service_role;

revoke all on function public.bv_comment(p_kind text, p_id bigint, p_body text, p_parent bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_comment(p_kind text, p_id bigint, p_body text, p_parent bigint) to authenticated;
grant execute on function public.bv_comment(p_kind text, p_id bigint, p_body text, p_parent bigint) to service_role;

revoke all on function public.bv_comments(p_kind text, p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_comments(p_kind text, p_id bigint) to authenticated;
grant execute on function public.bv_comments(p_kind text, p_id bigint) to service_role;

revoke all on function public.bv_comment_delete(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_comment_delete(p_id bigint) to authenticated;
grant execute on function public.bv_comment_delete(p_id bigint) to service_role;

revoke all on function public.bv_bookmark_toggle(p_kind text, p_id bigint, p_folder text) from public, anon, authenticated, service_role;
grant execute on function public.bv_bookmark_toggle(p_kind text, p_id bigint, p_folder text) to authenticated;
grant execute on function public.bv_bookmark_toggle(p_kind text, p_id bigint, p_folder text) to service_role;

revoke all on function public.bv_bookmarks() from public, anon, authenticated, service_role;
grant execute on function public.bv_bookmarks() to authenticated;
grant execute on function public.bv_bookmarks() to service_role;

revoke all on function public.bv_moment_edit(p_id bigint, p_body text, p_media_url text) from public, anon, authenticated, service_role;
grant execute on function public.bv_moment_edit(p_id bigint, p_body text, p_media_url text) to authenticated;
grant execute on function public.bv_moment_edit(p_id bigint, p_body text, p_media_url text) to service_role;

revoke all on function public.bv_moment_history(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_moment_history(p_id bigint) to authenticated;
grant execute on function public.bv_moment_history(p_id bigint) to service_role;

revoke all on function public.bv_moment_repost(p_id bigint, p_quote text) from public, anon, authenticated, service_role;
grant execute on function public.bv_moment_repost(p_id bigint, p_quote text) to authenticated;
grant execute on function public.bv_moment_repost(p_id bigint, p_quote text) to service_role;

revoke all on function public.bv_poll_create(p_moment bigint, p_question text, p_options text[], p_hours integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_poll_create(p_moment bigint, p_question text, p_options text[], p_hours integer) to authenticated;
grant execute on function public.bv_poll_create(p_moment bigint, p_question text, p_options text[], p_hours integer) to service_role;

revoke all on function bulavata.poll_json(p_moment bigint) from public, anon, authenticated, service_role;

revoke all on function public.bv_poll_vote(p_poll bigint, p_choice integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_poll_vote(p_poll bigint, p_choice integer) to authenticated;
grant execute on function public.bv_poll_vote(p_poll bigint, p_choice integer) to service_role;

revoke all on function public.bv_close_friend_set(p_friend uuid, p_on boolean) from public, anon, authenticated, service_role;
grant execute on function public.bv_close_friend_set(p_friend uuid, p_on boolean) to authenticated;
grant execute on function public.bv_close_friend_set(p_friend uuid, p_on boolean) to service_role;

revoke all on function public.bv_close_friends() from public, anon, authenticated, service_role;
grant execute on function public.bv_close_friends() to authenticated;
grant execute on function public.bv_close_friends() to service_role;

revoke all on function public.bv_story_post(p_body text, p_media_url text, p_kind text, p_audience text) from public, anon, authenticated, service_role;
grant execute on function public.bv_story_post(p_body text, p_media_url text, p_kind text, p_audience text) to authenticated;
grant execute on function public.bv_story_post(p_body text, p_media_url text, p_kind text, p_audience text) to service_role;

revoke all on function public.bv_stories() from public, anon, authenticated, service_role;
grant execute on function public.bv_stories() to authenticated;
grant execute on function public.bv_stories() to service_role;

revoke all on function public.bv_story_seen(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_story_seen(p_id bigint) to authenticated;
grant execute on function public.bv_story_seen(p_id bigint) to service_role;

revoke all on function public.bv_story_delete(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_story_delete(p_id bigint) to authenticated;
grant execute on function public.bv_story_delete(p_id bigint) to service_role;

revoke all on function public.bv_story_highlight(p_id bigint, p_title text) from public, anon, authenticated, service_role;
grant execute on function public.bv_story_highlight(p_id bigint, p_title text) to authenticated;
grant execute on function public.bv_story_highlight(p_id bigint, p_title text) to service_role;

revoke all on function public.bv_highlights(p_owner uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_highlights(p_owner uuid) to authenticated;
grant execute on function public.bv_highlights(p_owner uuid) to service_role;

revoke all on function public.bv_memories() from public, anon, authenticated, service_role;
grant execute on function public.bv_memories() to authenticated;
grant execute on function public.bv_memories() to service_role;

revoke all on function public.bv_event_create(p_title text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_place text, p_about text, p_audience text, p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_event_create(p_title text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_place text, p_about text, p_audience text, p_crew bigint) to authenticated;
grant execute on function public.bv_event_create(p_title text, p_starts_at timestamp with time zone, p_ends_at timestamp with time zone, p_place text, p_about text, p_audience text, p_crew bigint) to service_role;

revoke all on function bulavata.can_see_event(e bulavata.events) from public, anon, authenticated, service_role;

revoke all on function public.bv_events(p_past boolean) from public, anon, authenticated, service_role;
grant execute on function public.bv_events(p_past boolean) to authenticated;
grant execute on function public.bv_events(p_past boolean) to service_role;

revoke all on function public.bv_event_rsvp(p_event bigint, p_status text) from public, anon, authenticated, service_role;
grant execute on function public.bv_event_rsvp(p_event bigint, p_status text) to authenticated;
grant execute on function public.bv_event_rsvp(p_event bigint, p_status text) to service_role;

revoke all on function public.bv_event_cancel(p_event bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_event_cancel(p_event bigint) to authenticated;
grant execute on function public.bv_event_cancel(p_event bigint) to service_role;

revoke all on function public.bv_moments_feed2(lim integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_moments_feed2(lim integer) to authenticated;
grant execute on function public.bv_moments_feed2(lim integer) to service_role;

revoke all on function bulavata.crew_owner(p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function bulavata.crew_owner(p_crew bigint) to authenticated;

revoke all on function bulavata.crew_can_post(p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function bulavata.crew_can_post(p_crew bigint) to authenticated;

revoke all on function bulavata.reply_in_crew(p_reply bigint, p_crew bigint) from public, anon, authenticated, service_role;
grant execute on function bulavata.reply_in_crew(p_reply bigint, p_crew bigint) to authenticated;

revoke all on function bulavata.crew_message_expiry() from public, anon, authenticated, service_role;

revoke all on function public.bv_crew_settings(p_crew bigint, p_vanish_seconds integer, p_broadcast boolean) from public, anon, authenticated, service_role;
grant execute on function public.bv_crew_settings(p_crew bigint, p_vanish_seconds integer, p_broadcast boolean) to authenticated;
grant execute on function public.bv_crew_settings(p_crew bigint, p_vanish_seconds integer, p_broadcast boolean) to service_role;

revoke all on function public.bv_crew_pin(p_crew bigint, p_message bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_crew_pin(p_crew bigint, p_message bigint) to authenticated;
grant execute on function public.bv_crew_pin(p_crew bigint, p_message bigint) to service_role;

revoke all on function public.bv_crew_message_delete(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_crew_message_delete(p_id bigint) to authenticated;
grant execute on function public.bv_crew_message_delete(p_id bigint) to service_role;

revoke all on function public.bv_crew_messages2(p_crew bigint, lim integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_crew_messages2(p_crew bigint, lim integer) to authenticated;
grant execute on function public.bv_crew_messages2(p_crew bigint, lim integer) to service_role;

revoke all on function bulavata.notify(p_recipient uuid, p_actor uuid, p_kind text, p_target_kind text, p_target_id bigint, p_snippet text) from public, anon, authenticated, service_role;

revoke all on function bulavata.target_snippet(p_kind text, p_id bigint) from public, anon, authenticated, service_role;

revoke all on function bulavata.can_see_target_as(p_who uuid, p_kind text, p_id bigint) from public, anon, authenticated, service_role;

revoke all on function bulavata.trg_notify_reaction() from public, anon, authenticated, service_role;
grant execute on function bulavata.trg_notify_reaction() to public;

revoke all on function bulavata.trg_notify_comment() from public, anon, authenticated, service_role;
grant execute on function bulavata.trg_notify_comment() to public;

revoke all on function bulavata.trg_notify_friendship() from public, anon, authenticated, service_role;
grant execute on function bulavata.trg_notify_friendship() to public;

revoke all on function bulavata.trg_notify_wall() from public, anon, authenticated, service_role;
grant execute on function bulavata.trg_notify_wall() to public;

revoke all on function bulavata.trg_notify_rsvp() from public, anon, authenticated, service_role;
grant execute on function bulavata.trg_notify_rsvp() to public;

revoke all on function public.bv_activity(lim integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_activity(lim integer) to authenticated;
grant execute on function public.bv_activity(lim integer) to service_role;

revoke all on function public.bv_activity_unread() from public, anon, authenticated, service_role;
grant execute on function public.bv_activity_unread() to authenticated;
grant execute on function public.bv_activity_unread() to service_role;

revoke all on function public.bv_activity_read(p_ids bigint[]) from public, anon, authenticated, service_role;
grant execute on function public.bv_activity_read(p_ids bigint[]) to authenticated;
grant execute on function public.bv_activity_read(p_ids bigint[]) to service_role;

revoke all on function bulavata.talanoa_count_like() from public, anon, authenticated, service_role;

revoke all on function bulavata.talanoa_count_repost() from public, anon, authenticated, service_role;

revoke all on function bulavata.talanoa_count_reply() from public, anon, authenticated, service_role;

revoke all on function public.bv_talanoa_feed(p_mode text, p_as_of timestamp with time zone, p_limit integer, p_offset integer, p_cursor_created timestamp with time zone, p_cursor_id bigint, p_since timestamp with time zone, p_post_id bigint, p_reply_to bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_feed(p_mode text, p_as_of timestamp with time zone, p_limit integer, p_offset integer, p_cursor_created timestamp with time zone, p_cursor_id bigint, p_since timestamp with time zone, p_post_id bigint, p_reply_to bigint) to authenticated;
grant execute on function public.bv_talanoa_feed(p_mode text, p_as_of timestamp with time zone, p_limit integer, p_offset integer, p_cursor_created timestamp with time zone, p_cursor_id bigint, p_since timestamp with time zone, p_post_id bigint, p_reply_to bigint) to service_role;

revoke all on function public.bv_talanoa_post(p_body text, p_quote bigint, p_reply_to bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_post(p_body text, p_quote bigint, p_reply_to bigint) to authenticated;
grant execute on function public.bv_talanoa_post(p_body text, p_quote bigint, p_reply_to bigint) to service_role;

revoke all on function public.bv_talanoa_like(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_like(p_id bigint) to authenticated;
grant execute on function public.bv_talanoa_like(p_id bigint) to service_role;

revoke all on function public.bv_talanoa_repost(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_repost(p_id bigint) to authenticated;
grant execute on function public.bv_talanoa_repost(p_id bigint) to service_role;

revoke all on function public.bv_talanoa_delete(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_delete(p_id bigint) to authenticated;
grant execute on function public.bv_talanoa_delete(p_id bigint) to service_role;

revoke all on function bulavata.sere_autopost() from public, anon, authenticated, service_role;

revoke all on function bulavata.sere_count_tip() from public, anon, authenticated, service_role;

revoke all on function public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid) to authenticated;
grant execute on function public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid) to service_role;

revoke all on function public.bv_sere_mine() from public, anon, authenticated, service_role;
grant execute on function public.bv_sere_mine() to authenticated;
grant execute on function public.bv_sere_mine() to service_role;

revoke all on function public.bv_sere_tip(p_sere uuid, p_gift text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.bv_sere_tip(p_sere uuid, p_gift text, p_note text) to authenticated;
grant execute on function public.bv_sere_tip(p_sere uuid, p_gift text, p_note text) to service_role;

revoke all on function public.bv_sere_play(p_sere uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_sere_play(p_sere uuid) to authenticated;
grant execute on function public.bv_sere_play(p_sere uuid) to service_role;

revoke all on function public.bv_sere_remove(p_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_sere_remove(p_id uuid) to authenticated;
grant execute on function public.bv_sere_remove(p_id uuid) to service_role;

revoke all on function public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid, p_engine text) from public, anon, authenticated, service_role;
grant execute on function public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid, p_engine text) to authenticated;
grant execute on function public.bv_sere_create(p_image_ext text, p_duration_ms integer, p_start_ms integer, p_scene text, p_caption text, p_remix_of uuid, p_engine text) to service_role;

revoke all on function public.bv_account_delete() from public, anon, authenticated, service_role;
grant execute on function public.bv_account_delete() to authenticated;
grant execute on function public.bv_account_delete() to service_role;

revoke all on function bulavata.hub_row(p_slug text, p_uid uuid) from public, anon, authenticated, service_role;

revoke all on function public.bv_hubs() from public, anon, authenticated, service_role;
grant execute on function public.bv_hubs() to authenticated;
grant execute on function public.bv_hubs() to service_role;

revoke all on function public.bv_hub_join(p_slug text) from public, anon, authenticated, service_role;
grant execute on function public.bv_hub_join(p_slug text) to authenticated;
grant execute on function public.bv_hub_join(p_slug text) to service_role;

revoke all on function public.bv_people_to_meet(p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_people_to_meet(p_limit integer) to authenticated;
grant execute on function public.bv_people_to_meet(p_limit integer) to service_role;

revoke all on function public.bv_talanoa_share(p_id bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_share(p_id bigint) to authenticated;
grant execute on function public.bv_talanoa_share(p_id bigint) to service_role;

revoke all on function public.bv_talanoa_shared(p_post bigint, p_token text) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_shared(p_post bigint, p_token text) to anon;
grant execute on function public.bv_talanoa_shared(p_post bigint, p_token text) to authenticated;
grant execute on function public.bv_talanoa_shared(p_post bigint, p_token text) to service_role;

revoke all on function public.bv_referral_claim(p_token text) from public, anon, authenticated, service_role;
grant execute on function public.bv_referral_claim(p_token text) to authenticated;
grant execute on function public.bv_referral_claim(p_token text) to service_role;

revoke all on function bulavata.coins_tipped_today(p_who uuid) from public, anon, authenticated, service_role;

revoke all on function public.bv_coins() from public, anon, authenticated, service_role;
grant execute on function public.bv_coins() to authenticated;
grant execute on function public.bv_coins() to service_role;

revoke all on function public.bv_coin_tips_for(p_post bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_coin_tips_for(p_post bigint) to authenticated;
grant execute on function public.bv_coin_tips_for(p_post bigint) to service_role;

revoke all on function public.bv_coin_tip(p_post bigint, p_coins integer, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.bv_coin_tip(p_post bigint, p_coins integer, p_note text) to authenticated;
grant execute on function public.bv_coin_tip(p_post bigint, p_coins integer, p_note text) to service_role;

revoke all on function public.bv_coins_buy(p_bundle text, p_idem text) from public, anon, authenticated, service_role;
grant execute on function public.bv_coins_buy(p_bundle text, p_idem text) to authenticated;
grant execute on function public.bv_coins_buy(p_bundle text, p_idem text) to service_role;

revoke all on function public.bv_coins_payout(p_coins integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_coins_payout(p_coins integer) to authenticated;
grant execute on function public.bv_coins_payout(p_coins integer) to service_role;

revoke all on function public.bv_share_stats() from public, anon, authenticated, service_role;
grant execute on function public.bv_share_stats() to authenticated;
grant execute on function public.bv_share_stats() to service_role;

revoke all on function public.bv_block(p_member uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_block(p_member uuid) to authenticated;
grant execute on function public.bv_block(p_member uuid) to service_role;

revoke all on function public.bv_unblock(p_member uuid) from public, anon, authenticated, service_role;
grant execute on function public.bv_unblock(p_member uuid) to authenticated;
grant execute on function public.bv_unblock(p_member uuid) to service_role;

revoke all on function public.bv_blocked() from public, anon, authenticated, service_role;
grant execute on function public.bv_blocked() to authenticated;
grant execute on function public.bv_blocked() to service_role;

revoke all on function public.bv_report(p_kind text, p_id text, p_reason text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.bv_report(p_kind text, p_id text, p_reason text, p_note text) to authenticated;
grant execute on function public.bv_report(p_kind text, p_id text, p_reason text, p_note text) to service_role;

revoke all on function public.bv_talanoa_post_voice(p_path text, p_seconds integer, p_body text, p_reply_to bigint) from public, anon, authenticated, service_role;
grant execute on function public.bv_talanoa_post_voice(p_path text, p_seconds integer, p_body text, p_reply_to bigint) to authenticated;
grant execute on function public.bv_talanoa_post_voice(p_path text, p_seconds integer, p_body text, p_reply_to bigint) to service_role;

revoke all on function bulavata.top_mate_added() from public, anon, authenticated, service_role;
grant execute on function bulavata.top_mate_added() to public;

revoke all on function public.bv_invite_create(p_label text) from public, anon, authenticated, service_role;
grant execute on function public.bv_invite_create(p_label text) to authenticated;
grant execute on function public.bv_invite_create(p_label text) to service_role;

revoke all on function public.bv_invite_open(p_token text) from public, anon, authenticated, service_role;
grant execute on function public.bv_invite_open(p_token text) to anon;
grant execute on function public.bv_invite_open(p_token text) to authenticated;
grant execute on function public.bv_invite_open(p_token text) to service_role;

revoke all on function public.bv_invites_mine() from public, anon, authenticated, service_role;
grant execute on function public.bv_invites_mine() to authenticated;
grant execute on function public.bv_invites_mine() to service_role;

revoke all on function public.bv_link_app(p_app text) from public, anon, authenticated, service_role;
grant execute on function public.bv_link_app(p_app text) to authenticated;
grant execute on function public.bv_link_app(p_app text) to service_role;

revoke all on function public.bv_unlink_app(p_app text) from public, anon, authenticated, service_role;
grant execute on function public.bv_unlink_app(p_app text) to authenticated;
grant execute on function public.bv_unlink_app(p_app text) to service_role;

revoke all on function public.bv_app_unlink(p_token text) from public, anon, authenticated, service_role;
grant execute on function public.bv_app_unlink(p_token text) to anon;
grant execute on function public.bv_app_unlink(p_token text) to authenticated;
grant execute on function public.bv_app_unlink(p_token text) to service_role;

revoke all on function public.bv_app_feed(p_token text) from public, anon, authenticated, service_role;
grant execute on function public.bv_app_feed(p_token text) to anon;
grant execute on function public.bv_app_feed(p_token text) to authenticated;
grant execute on function public.bv_app_feed(p_token text) to service_role;

revoke all on function bulavata.circle_guard() from public, anon, authenticated, service_role;

revoke all on function bulavata.circle_people_guard() from public, anon, authenticated, service_role;

revoke all on function bulavata.circle_comment_guard() from public, anon, authenticated, service_role;

revoke all on function public.bv_circle_create(p_crew bigint, p_title text, p_topic text, p_capacity integer) from public, anon, authenticated, service_role;
grant execute on function public.bv_circle_create(p_crew bigint, p_title text, p_topic text, p_capacity integer) to authenticated;
grant execute on function public.bv_circle_create(p_crew bigint, p_title text, p_topic text, p_capacity integer) to service_role;
