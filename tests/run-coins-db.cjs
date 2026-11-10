'use strict';
// Isolated synthetic Postgres fixture for coins, tipping and payouts; never connects to Supabase or a live DB.
// POSIX: NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/run-coins-db.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
// Profiles, the activity writer and the FJD wallet exactly as the share-engine and coins migrations find them in production.
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
CREATE TABLE bulavata.wallets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner uuid NOT NULL UNIQUE REFERENCES bulavata.profiles(id) ON DELETE CASCADE,
 currency char(3) NOT NULL DEFAULT 'FJD',
 balance_minor bigint NOT NULL DEFAULT 0 CHECK (balance_minor >= 0),
 pending_minor bigint NOT NULL DEFAULT 0 CHECK (pending_minor >= 0),
 status text NOT NULL DEFAULT 'dormant' CHECK (status IN ('dormant','active','frozen','closed')),
 kyc_tier integer NOT NULL DEFAULT 0, kyc_ref text, daily_limit_minor bigint NOT NULL DEFAULT 50000,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bulavata.transactions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 wallet_id uuid NOT NULL REFERENCES bulavata.wallets(id) ON DELETE RESTRICT,
 counterparty_wallet uuid REFERENCES bulavata.wallets(id) ON DELETE SET NULL,
 direction text NOT NULL CHECK (direction IN ('credit','debit')),
 kind text NOT NULL CONSTRAINT transactions_kind_check CHECK (kind IN ('topup','withdrawal','p2p_send','p2p_receive','gift','subscription','refund','fee','adjustment')),
 amount_minor bigint NOT NULL CHECK (amount_minor > 0), currency char(3) NOT NULL, balance_after_minor bigint,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','failed','reversed')),
 reference text UNIQUE, external_ref text, memo text, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz, leg_group uuid
);
ALTER TABLE bulavata.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bulavata.transactions ENABLE ROW LEVEL SECURITY;
INSERT INTO bulavata.profiles(id,handle,display_name,avatar_emoji,room_accent) VALUES
 ('11111111-1111-1111-1111-111111111111','ana','Ana','🌺','#4FA8D8'),
 ('22222222-2222-2222-2222-222222222222','bo','Bo','🥥','#2A9D8F'),
 ('33333333-3333-3333-3333-333333333333','cy','Cy','🐚','#E76F51');
INSERT INTO bulavata.wallets(owner,balance_minor,status) VALUES
 ('11111111-1111-1111-1111-111111111111',2000,'active'),
 ('22222222-2222-2222-2222-222222222222',0,'dormant'),
 ('33333333-3333-3333-3333-333333333333',500,'active');
`;
const snapshot=String.raw`
SELECT 'table' AS kind,c.relname AS name,jsonb_build_object('acl',c.relacl::text,'rls',c.relrowsecurity) AS definition
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='bulavata' AND c.relname IN ('profiles','notifications','wallets','transactions','talanoa_posts')
UNION ALL SELECT 'schema',n.nspname,to_jsonb(n.nspacl::text) FROM pg_namespace n WHERE n.nspname IN ('public','bulavata','auth')
ORDER BY kind,name;
`;
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(fixture);
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261109000000_sota_talanoa_wall.sql'),'utf8'));
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261110160000_sota_share_engine.sql'),'utf8'));
  const before=(await db.query(snapshot)).rows;
  await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/20261110200000_sota_coins.sql'),'utf8'));
  assert.deepEqual((await db.query(snapshot)).rows,before,'Existing tables, RLS and schema grants must remain unchanged');
  const results=await db.exec(fs.readFileSync(path.join(root,'tests/coins-db.sql'),'utf8'));
  const checks=results.flatMap(result=>result.rows||[]).flatMap(row=>Object.values(row)).filter(value=>typeof value==='string'&&value.startsWith('PASS '));
  for(const check of checks)process.stdout.write(check+'\n');
  assert.ok(checks.length>=40&&checks.includes('PASS suite completed'),'Expected the full coins SQL suite to execute');
  process.stdout.write(`Coins isolated Postgres: ${checks.length} SQL checks + preservation snapshot passed.\n`);
 } finally {await db.close();}
})().catch(error=>{process.stderr.write((error.stack||String(error))+'\n');process.exitCode=1;});
