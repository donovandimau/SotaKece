'use strict';
// Isolated synthetic Postgres fixture for report, block and Top Mates Activity; never touches a live DB.
// POSIX: NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/run-safety-db.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const A='11111111-1111-1111-1111-111111111111',B='22222222-2222-2222-2222-222222222222',C='33333333-3333-3333-3333-333333333333';
const fixture=String.raw`
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth; CREATE SCHEMA bulavata;
GRANT USAGE ON SCHEMA auth, bulavata, public TO anon,authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid; $$;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated;
CREATE TABLE bulavata.profiles (id uuid PRIMARY KEY, handle text UNIQUE NOT NULL, display_name text NOT NULL DEFAULT '');
ALTER TABLE bulavata.profiles ENABLE ROW LEVEL SECURITY;
CREATE TABLE bulavata.top_friends (owner uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE,
 friend uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE, slot integer NOT NULL CHECK (slot BETWEEN 1 AND 16),
 PRIMARY KEY (owner, slot), UNIQUE (owner, friend));
ALTER TABLE bulavata.top_friends ENABLE ROW LEVEL SECURITY;
CREATE TABLE bulavata.notifications (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 recipient uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE, actor uuid NOT NULL REFERENCES bulavata.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('reaction','reply','mention','friend_request','friend_accepted','wall','rsvp','joined','tip')),
 target_kind text NOT NULL DEFAULT '', target_id bigint NOT NULL DEFAULT 0, snippet text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(), read_at timestamptz, UNIQUE (recipient, actor, kind, target_kind, target_id));
CREATE FUNCTION bulavata.notify(p_recipient uuid, p_actor uuid, p_kind text, p_target_kind text, p_target_id bigint, p_snippet text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
 INSERT INTO bulavata.notifications(recipient, actor, kind, target_kind, target_id, snippet)
 SELECT p_recipient, p_actor, p_kind, coalesce(p_target_kind, ''), coalesce(p_target_id, 0), left(coalesce(p_snippet, ''), 140)
 WHERE p_recipient IS NOT NULL AND p_actor IS NOT NULL AND p_recipient <> p_actor
 ON CONFLICT (recipient, actor, kind, target_kind, target_id) DO UPDATE SET created_at = now(), read_at = NULL, snippet = excluded.snippet;
$$;
INSERT INTO bulavata.profiles VALUES ('${A}','ana','Ana'),('${B}','bo','Bo'),('${C}','cy','Cy');
`;
const as=who=>`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${who}',false);`;
async function fails(db,sql,code){
 try{await db.exec(sql);}catch(e){assert.match(String(e.message),new RegExp(code));return;}
 assert.fail('expected '+code+': '+sql);
}
async function q(db,sql){const res=await db.exec(sql);return res[res.length-1].rows;}
(async()=>{
 const db=new PGlite(); let n=0; const ok=(v,label)=>{assert.ok(v,label);n++;process.stdout.write('PASS '+label+'\n');};
 try{
  await db.exec(fixture);
  const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261112130000_sota_safety_and_mates.sql'),'utf8');
  await db.exec(sql); await db.exec(sql); ok(true,'migration runs twice');
  // Top Mates: Bo puts Ana in slot 3 -> Ana hears about it
  await db.exec(`INSERT INTO bulavata.top_friends VALUES ('${B}','${A}',3)`);
  let r=(await q(db,`SELECT kind,snippet FROM bulavata.notifications WHERE recipient='${A}' AND actor='${B}'`));
  ok(r.length===1&&r[0].kind==='top_mate'&&r[0].snippet==='#3','top_mate notification with slot');
  // Block: Ana blocks Bo -> both Top Mates links gone
  await db.exec(`INSERT INTO bulavata.top_friends VALUES ('${A}','${B}',1)`);
  await db.exec(as(A)+` SELECT public.bv_block('${B}');`);
  r=(await q(db,`RESET ROLE; SELECT count(*)::int c FROM bulavata.top_friends WHERE (owner='${A}' AND friend='${B}') OR (owner='${B}' AND friend='${A}')`));
  ok(r[0].c===0,'block removes Top Mates both ways');
  r=(await q(db,as(A)+` SELECT public.bv_blocked() j`)); const list=r[r.length-1]?r[r.length-1].j:null;
  ok(Array.isArray(list)&&list.length===1&&list[0].handle==='bo','blocker sees block list');
  r=(await q(db,as(B)+` SELECT count(*)::int c FROM bulavata.blocks`));
  ok(r[r.length-1].c===0,'blocked member cannot see who blocked them');
  // a blocked person adding the blocker gives no notification
  await db.exec(`RESET ROLE; DELETE FROM bulavata.notifications; INSERT INTO bulavata.top_friends VALUES ('${B}','${A}',2)`);
  r=(await q(db,`SELECT count(*)::int c FROM bulavata.notifications`)); ok(r[0].c===0,'no Top Mates note from a blocked member');
  await fails(db,as(A)+` SELECT public.bv_block('${A}');`,'BAD_MEMBER'); ok(true,'cannot block self');
  await db.exec(as(A)+` SELECT public.bv_unblock('${B}');`);
  r=(await q(db,`RESET ROLE; SELECT count(*)::int c FROM bulavata.blocks`)); ok(r[0].c===0,'unblock');
  // Report
  await db.exec(as(C)+` SELECT public.bv_report('post','42','spam','selling followers');`);
  await db.exec(as(C)+` SELECT public.bv_report('post','42','scam',null);`);
  r=(await q(db,`RESET ROLE; SELECT reason,count(*) over ()::int c FROM bulavata.reports`));
  ok(r.length===1&&r[0].reason==='scam','re-reporting updates, no duplicates');
  await fails(db,as(C)+` SELECT public.bv_report('post','43','nonsense',null);`,'BAD_REASON'); ok(true,'bad reason refused');
  await fails(db,as(C)+` SELECT count(*) FROM bulavata.reports;`,'permission denied'); ok(true,'members cannot read reports');
  await fails(db,`RESET ROLE; SET ROLE anon; SELECT public.bv_report('post','1','spam',null);`,'permission denied'); ok(true,'guests cannot report');
  for(let i=100;i<119;i++)await db.exec(as(C)+` SELECT public.bv_report('post','${i}','spam',null);`);
  await fails(db,as(C)+` SELECT public.bv_report('post','999','spam',null);`,'REPORT_LIMIT'); ok(true,'20 a day limit');
  process.stdout.write(`Safety isolated Postgres: ${n} checks passed.\n`);
 } finally {await db.close();}
})().catch(e=>{process.stderr.write((e.stack||String(e))+'\n');process.exitCode=1;});
