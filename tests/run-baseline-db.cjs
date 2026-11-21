'use strict';
// Rebuild check for the exported live schema (supabase/baseline/sota_kece_schema.sql).
// Loads it into an isolated PGlite database with small stand-ins for Supabase's auth, storage and
// extensions schemas, then compares what was built with the inventory counted on live
// dimau-core-sydney when the file was exported. Never connects to Supabase or any live database.
// POSIX: NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/run-baseline-db.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pgliteModule = process.env.PGLITE_MODULE || '@electric-sql/pglite';
const {PGlite} = require(pgliteModule);
const {pgcrypto} = require(require.resolve(pgliteModule).replace(/index\.c?js$/, 'contrib/pgcrypto.cjs'));
const root = path.resolve(__dirname, '..');
const schema = fs.readFileSync(path.join(root, 'supabase/baseline/sota_kece_schema.sql'), 'utf8');
const platform = fs.readFileSync(path.join(root, 'supabase/baseline/sota_kece_platform.sql'), 'utf8');

// Counted on live dimau-core-sydney on 21 Nov 2026, 18:3x UTC, with the same queries as below.
// Re-export the schema and update these together; supabase/baseline/README.md has the query.
const LIVE = {
  tables: 56, views: 16, sequences: 25, functions: 171, securityDefinerFunctions: 142,
  indexes: 162, constraints: 279, triggers: 18, policies: 64, rlsTables: 56,
  tableGrants: 470, functionGrants: 285, anonCallable: 33,
};

// Just enough of Supabase for the file to load: the three API roles, auth.uid()/auth.users,
// pgcrypto under extensions, and storage.objects with storage.foldername().
const stand_ins = String.raw`
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
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

const INVENTORY = String.raw`
with rels as (select c.oid, c.relkind, c.relrowsecurity, c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where (n.nspname='bulavata' or (n.nspname='public' and c.relname like 'bv\_%')) and c.relkind in ('r','v','S')),
fns as (select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where (n.nspname in ('bulavata','bulavata_talanoa_private') or (n.nspname='public' and (p.proname like 'bv\_%' or p.proname like 'sota\_%'))) and p.prokind in ('f','p'))
select json_build_object(
 'tables',(select count(*) from rels where relkind='r'),
 'views',(select count(*) from rels where relkind='v'),
 'sequences',(select count(*) from rels where relkind='S'),
 'functions',(select count(*) from fns),
 'securityDefinerFunctions',(select count(*) from fns join pg_proc p using (oid) where p.prosecdef),
 'indexes',(select count(*) from pg_index i join rels r on r.oid=i.indrelid),
 'constraints',(select count(*) from pg_constraint c join rels r on r.oid=c.conrelid where c.contype in ('p','u','x','c','f')),
 'triggers',(select count(*) from pg_trigger t join rels r on r.oid=t.tgrelid where not t.tgisinternal),
 'policies',(select count(*) from pg_policy p join rels r on r.oid=p.polrelid),
 'rlsTables',(select count(*) from rels where relkind='r' and relrowsecurity),
 'tableGrants',(select count(*) from rels r, aclexplode(r.relacl) g where g.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)),
 'functionGrants',(select count(*) from fns f join pg_proc p using (oid), aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) g where g.grantee in (0,'anon'::regrole::oid,'authenticated'::regrole::oid,'service_role'::regrole::oid)),
 'anonCallable',(select count(*) from fns f join pg_proc p using (oid) where has_function_privilege('anon', p.oid, 'execute'))
) as inventory`;

(async () => {
  const db = new PGlite({extensions: {pgcrypto}});
  await db.exec(stand_ins);
  await db.exec(schema);

  // 1. Everything on live was rebuilt, with the same security settings and grants.
  const built = (await db.query(INVENTORY)).rows[0].inventory;
  for (const key of Object.keys(LIVE)) built[key] = Number(built[key]);
  assert.deepEqual(built, LIVE, 'rebuilt database does not match the live inventory');

  // 2. Every function body compiles against the rebuilt schema. The file loads with
  //    check_function_bodies off (as pg_dump does), so recreate each one with checking on.
  const fns = (await db.query(String.raw`select p.oid::int as oid, pg_get_functiondef(p.oid) as def
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname in ('bulavata','bulavata_talanoa_private') or (n.nspname='public' and (p.proname like 'bv\_%' or p.proname like 'sota\_%'))) and p.prokind in ('f','p')`)).rows;
  await db.exec('set check_function_bodies = on');
  const broken = [];
  for (const f of fns) {
    try { await db.exec(f.def); } catch (e) { broken.push(f.def.split('\n')[0] + ' -> ' + e.message); }
  }
  assert.deepEqual(broken, [], 'functions that do not compile:\n' + broken.join('\n'));

  // 3. Row level security holds with no API grants: a signed-in member sees no other member's profile.
  const me = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  await db.exec(`insert into auth.users(id) values ('${me}'), ('${other}');
    insert into bulavata.profiles(id, handle) values ('${me}', 'me_test'), ('${other}', 'other_test');`);
  await db.exec(`set role anon`);
  await assert.rejects(db.query('select count(*) from bulavata.friendships'), /permission denied/,
    'anon must not read friendships directly');
  await db.exec('reset role');

  // 4. The platform file (storage, realtime, cron) is plain SQL with no hand edits: bucket rows load.
  const buckets = platform.split('\n').filter((l) => l.startsWith('insert into storage.buckets')).join('\n');
  await db.exec(buckets);
  const ids = (await db.query('select id from storage.buckets order by id')).rows.map((r) => r.id);
  assert.deepEqual(ids, ['bv-room-media', 'sere-audio', 'sere-images', 'sere-video', 'talanoa-voice']);
  assert.match(platform, /alter publication supabase_realtime add table bulavata\.talanoa_posts;/);
  assert.match(platform, /select cron\.schedule\('sota-koro-vanish-sweep'/);

  await db.close();
  console.log('baseline schema: rebuilt and matches live inventory', JSON.stringify(built));
})().catch((e) => { console.error(e); process.exit(1); });
