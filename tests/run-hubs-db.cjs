'use strict';
// Isolated synthetic Postgres fixture for starter Koro (hubs); never connects to Supabase or a live DB.
// POSIX: NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/run-hubs-db.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const fixture=String.raw`
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA bulavata;
GRANT USAGE ON SCHEMA auth, bulavata, public TO anon,authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
CREATE TABLE bulavata.profiles (
 id uuid PRIMARY KEY, handle text UNIQUE NOT NULL, display_name text NOT NULL DEFAULT '',
 avatar_emoji text DEFAULT '🌺', room_accent text NOT NULL DEFAULT '#4FA8D8',
 created_at timestamptz DEFAULT now(), last_seen timestamptz
);
CREATE TABLE bulavata.crews (
 id bigserial PRIMARY KEY, name text NOT NULL, emoji text DEFAULT '🪸', accent text DEFAULT '#4FA8D8',
 owner uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE,
 join_code text NOT NULL UNIQUE DEFAULT md5(random()::text), created_at timestamptz NOT NULL DEFAULT now(),
 kind text NOT NULL DEFAULT 'koro', about text NOT NULL DEFAULT ''
);
CREATE TABLE bulavata.crew_members (
 crew_id bigint NOT NULL REFERENCES bulavata.crews(id) ON DELETE CASCADE,
 member uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE,
 joined_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (crew_id,member)
);
CREATE TABLE bulavata.friendships (
 id bigserial PRIMARY KEY, requester uuid NOT NULL, addressee uuid NOT NULL, status text NOT NULL DEFAULT 'pending'
);
CREATE TABLE bulavata.talanoa_posts (
 id bigserial PRIMARY KEY, author uuid NOT NULL, body text NOT NULL, reply_to bigint, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bulavata.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulavata.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulavata.crew_members ENABLE ROW LEVEL SECURITY;
INSERT INTO bulavata.profiles(id,handle,display_name,created_at,last_seen) VALUES
 ('11111111-1111-1111-1111-111111111111','ana','Ana',now()-interval '40 days',now()-interval '1 hour'),
 ('22222222-2222-2222-2222-222222222222','bo','Bo',now()-interval '20 days',now()-interval '2 hours'),
 ('33333333-3333-3333-3333-333333333333','cy','Cy',now()-interval '10 days',now()-interval '3 hours'),
 ('44444444-4444-4444-4444-444444444444','di','Di',now()-interval '5 days',now()-interval '4 hours');
INSERT INTO bulavata.crews(name,owner) VALUES ('Private family','22222222-2222-2222-2222-222222222222');
INSERT INTO bulavata.crew_members(crew_id,member) VALUES (1,'22222222-2222-2222-2222-222222222222');
`;
const snapshot=String.raw`
SELECT c.relname AS name,jsonb_build_object('acl',c.relacl::text,'rls',c.relrowsecurity) AS definition
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='bulavata' AND c.relname IN ('profiles','crews','crew_members','friendships','talanoa_posts') ORDER BY 1;
`;
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(fixture);
  const before=(await db.query(snapshot)).rows;
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261110120000_sota_hubs.sql'),'utf8'));
  assert.deepEqual((await db.query(snapshot)).rows,before,'Existing tables keep their grants and row-level security');
  const results=await db.exec(fs.readFileSync(path.join(root,'tests/hubs-db.sql'),'utf8'));
  const checks=results.flatMap(result=>result.rows||[]).flatMap(row=>Object.values(row)).filter(value=>typeof value==='string'&&value.startsWith('PASS '));
  for(const check of checks)process.stdout.write(check+'\n');
  assert.ok(checks.length>=18&&checks.includes('PASS suite completed'),'Expected the full hubs SQL suite to execute');
  process.stdout.write(`Hubs isolated Postgres: ${checks.length} SQL checks + preservation snapshot passed.\n`);
 } finally {await db.close();}
})().catch(error=>{process.stderr.write((error.stack||String(error))+'\n');process.exitCode=1;});
