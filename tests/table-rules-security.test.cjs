'use strict';
// Table rules for Koros, friendships and profiles (migration 20261122200000_sota_table_rule_holes.sql).
// Builds the exported live schema in PGlite (as run-baseline-db.cjs does), applies the migration, then
// acts as ordinary signed-in members through the same public bv_* views and functions the app uses.
// Never connects to Supabase. POSIX: NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/table-rules-security.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pgliteModule = process.env.PGLITE_MODULE || '@electric-sql/pglite';
const {PGlite} = require(pgliteModule);
const {pgcrypto} = require(require.resolve(pgliteModule).replace(/index\.c?js$/, 'contrib/pgcrypto.cjs'));
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const schema = read('supabase/baseline/sota_kece_schema.sql');
const migration = read('supabase/migrations/20261122200000_sota_table_rule_holes.sql');

const standIns = String.raw`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text,
  owner uuid, owner_id text, metadata jsonb, created_at timestamptz DEFAULT now());
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT USAGE ON SCHEMA auth, storage, extensions, public TO anon, authenticated, service_role;
`;

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';

(async () => {
  const db = new PGlite({extensions: {pgcrypto}});
  await db.exec(standIns);
  await db.exec(schema);

  // Before the fix: the holes the review found are really there in the exported schema.
  const as = async (who) => { await db.exec('reset role'); await db.exec(`set request.jwt.claim.sub = '${who}'; set role authenticated`); };
  const admin = () => db.exec('reset role');
  await db.exec(`insert into auth.users(id) values ('${A}'), ('${B}'), ('${C}');
    insert into bulavata.profiles(id, handle) values ('${A}', 'member_a'), ('${B}', 'member_b');`);
  await as(B);
  await db.exec(`insert into public.bv_friendships(requester, addressee, status) values ('${B}', '${A}', 'accepted')`);
  await admin();
  assert.equal((await db.query(`select bulavata.are_friends('${A}', '${B}') f`)).rows[0].f, true, 'hole 2 reproduces before the fix');
  await db.exec('delete from bulavata.friendships');
  await as(C);
  await assert.rejects(db.query(`insert into public.bv_profiles(id, handle, age_band) values ('${C}', 'member_c', 'adult')`),
    /cannot insert into column "age_band"/, 'sign-up bug reproduces before the fix');
  await admin();

  await db.exec(migration);
  await db.exec(migration); // running it twice changes nothing

  // A makes a private Koro the way the app does, and posts in it.
  await as(A);
  const crew = Number((await db.query(`select public.bv_circle_create_group('Private', 'other', 'private', false, '${A}') g`)).rows[0].g.id);
  await db.exec(`insert into public.bv_crew_messages(crew_id, author, body) values (${crew}, '${A}', 'secret')`);
  await admin();
  const code = (await db.query(`select join_code from bulavata.crews where id = ${crew}`)).rows[0].join_code;
  const seen = async (who) => { await as(who); const r = (await db.query(`select public.bv_crew_messages2(${crew}, 10) m`)).rows[0].m; return (r.messages || []).length; };

  // 1. No joining a Koro without its code; the code still works, and leaving still works.
  await as(B);
  await assert.rejects(db.query(`insert into public.bv_crew_members(crew_id, member) values (${crew}, '${B}')`), /permission denied/);
  assert.equal(await seen(B), 0);
  await db.query(`select public.bv_join_circle('${code}', false, '${B}')`);
  assert.equal(await seen(B), 1, 'joining with the code lets B read the Koro');
  await db.exec(`delete from public.bv_crew_members where crew_id = ${crew} and member = '${B}'`);
  assert.equal(await seen(B), 0, 'B left');
  await admin();
  await db.exec('set role anon');
  await assert.rejects(db.query(`select public.bv_join_crew('${code}')`), /permission denied/, 'bv_join_crew needs sign-in');

  // 2. Friend requests start pending; the sender cannot accept or rewrite them; the person asked can.
  await as(B);
  await assert.rejects(db.query(`insert into public.bv_friendships(requester, addressee, status) values ('${B}', '${A}', 'accepted')`), /row-level security/);
  await assert.rejects(db.query(`insert into public.bv_friendships(requester, addressee) values ('${A}', '${B}')`), /row-level security/, 'no request in someone else\'s name');
  const req = (await db.query(`insert into public.bv_friendships(requester, addressee) values ('${B}', '${A}') returning id, status`)).rows[0];
  assert.equal(req.status, 'pending');
  await db.exec(`update public.bv_friendships set status = 'accepted' where id = ${req.id}`);
  await assert.rejects(db.query(`update public.bv_friendships set addressee = '${B}', requester = '${A}' where id = ${req.id}`), /permission denied/);
  await admin();
  assert.equal((await db.query(`select bulavata.are_friends('${A}', '${B}') f`)).rows[0].f, false, 'sender cannot accept their own request');
  await as(A);
  await db.exec(`update public.bv_friendships set status = 'accepted' where id = ${req.id}`);
  await admin();
  assert.equal((await db.query(`select bulavata.are_friends('${A}', '${B}') f`)).rows[0].f, true, 'the person asked accepts');

  // 3. No ticking your own verified badge; the rest of the profile is still yours to edit.
  await as(B);
  await assert.rejects(db.query(`update public.bv_profiles set human_verified = true where id = '${B}'`), /permission denied/);
  await db.exec(`update public.bv_profiles set display_name = 'Bee', bio = 'hi', room_css = 'x' where id = '${B}'`);

  // 4. Sign-up works again, keeps table defaults, and ignores a self-set badge; only your own row.
  await as(C);
  const made = (await db.query(`insert into public.bv_profiles(id, handle, display_name, age_band, room_accent, human_verified)
    values ('${C}', 'member_c', 'Cee', 'adult', '#ff0000', true) returning handle, age_band`)).rows[0];
  assert.deepEqual(made, {handle: 'member_c', age_band: 'adult'});
  await assert.rejects(db.query(`insert into public.bv_profiles(id, handle) values ('${A}', 'not_mine')`));
  await admin();
  const row = (await db.query(`select display_name, age_band, human_verified, room_accent, avatar_emoji, room_bg from bulavata.profiles where id = '${C}'`)).rows[0];
  assert.deepEqual(row, {display_name: 'Cee', age_band: 'adult', human_verified: false, room_accent: '#ff0000', avatar_emoji: '🌺', room_bg: '#87CEEB'});
  const b = (await db.query(`select display_name, human_verified from bulavata.profiles where id = '${B}'`)).rows[0];
  assert.deepEqual(b, {display_name: 'Bee', human_verified: false});

  await db.close();
  console.log('table rules: Koro joins, friend requests, verified badge and sign-up all behave');
})().catch((e) => { console.error(e); process.exit(1); });
