'use strict';
// Isolated synthetic Postgres fixture for the share engine; never connects to Supabase or a live DB.
// POSIX: NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/run-share-engine-db.cjs
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
 avatar_emoji text DEFAULT '🌺', room_accent text NOT NULL DEFAULT '#4FA8D8', created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bulavata.profiles ENABLE ROW LEVEL SECURITY;
-- The production notifications table and writer (20261031210000_sota_activity.sql), as the share engine finds them.
CREATE TABLE bulavata.notifications (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 recipient uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE,
 actor uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('reaction','reply','mention','friend_request','friend_accepted','wall','rsvp')),
 target_kind text NOT NULL DEFAULT '', target_id bigint NOT NULL DEFAULT 0,
 snippet text NOT NULL DEFAULT '' CHECK (length(snippet) <= 140),
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz,
 UNIQUE (recipient, actor, kind, target_kind, target_id)
);
ALTER TABLE bulavata.notifications ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION bulavata.notify(p_recipient uuid, p_actor uuid, p_kind text, p_target_kind text, p_target_id bigint, p_snippet text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 INSERT INTO bulavata.notifications(recipient, actor, kind, target_kind, target_id, snippet)
 SELECT p_recipient, p_actor, p_kind, coalesce(p_target_kind, ''), coalesce(p_target_id, 0), left(coalesce(p_snippet, ''), 140)
 WHERE p_recipient IS NOT NULL AND p_actor IS NOT NULL AND p_recipient <> p_actor
 ON CONFLICT (recipient, actor, kind, target_kind, target_id) DO UPDATE SET created_at = now(), read_at = NULL, snippet = excluded.snippet;
$$;
REVOKE ALL ON FUNCTION bulavata.notify(uuid, uuid, text, text, bigint, text) FROM public, anon, authenticated;
INSERT INTO bulavata.profiles(id,handle,display_name,avatar_emoji,room_accent) VALUES
 ('11111111-1111-1111-1111-111111111111','ana','Ana','🌺','#4FA8D8'),
 ('22222222-2222-2222-2222-222222222222','bo','Bo','🥥','#2A9D8F'),
 ('33333333-3333-3333-3333-333333333333','cy','Cy','🐚','#E76F51');
`;
const snapshot=String.raw`
SELECT 'table' AS kind,c.relname AS name,jsonb_build_object('acl',c.relacl::text,'rls',c.relrowsecurity) AS definition
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bulavata' AND c.relname IN ('profiles','notifications','talanoa_posts')
UNION ALL SELECT 'schema',n.nspname,to_jsonb(n.nspacl::text) FROM pg_namespace n WHERE n.nspname IN ('public','bulavata','auth')
ORDER BY kind,name;
`;
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(fixture);
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261109000000_sota_talanoa_wall.sql'),'utf8'));
  const before=(await db.query(snapshot)).rows;
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261110160000_sota_share_engine.sql'),'utf8'));
  assert.deepEqual((await db.query(snapshot)).rows,before,'Existing tables, RLS and schema grants must remain unchanged');
  const results=await db.exec(fs.readFileSync(path.join(root,'tests/share-engine-db.sql'),'utf8'));
  const checks=results.flatMap(result=>result.rows||[]).flatMap(row=>Object.values(row)).filter(value=>typeof value==='string'&&value.startsWith('PASS '));
  for(const check of checks)process.stdout.write(check+'\n');
  assert.ok(checks.length>=24&&checks.includes('PASS suite completed'),'Expected the full share engine SQL suite to execute');
  process.stdout.write(`Share engine isolated Postgres: ${checks.length} SQL checks + preservation snapshot passed.\n`);
 } finally {await db.close();}
})().catch(error=>{process.stderr.write((error.stack||String(error))+'\n');process.exitCode=1;});
