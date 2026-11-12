'use strict';
// Isolated synthetic Postgres fixture for invite links; never connects to Supabase or a live DB.
// POSIX: NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/run-invites-db.cjs
// Runs the share engine's own SQL suite again on top of the invites migration (which replaces
// bv_referral_claim), then the invite suite.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
// The share engine runner's fixture (roles, auth.uid, profiles, notifications, three members), plus Di.
const engine=read('tests/run-share-engine-db.cjs');
const fixture=engine.slice(engine.indexOf('String.raw`')+11,engine.indexOf('`;',engine.indexOf('String.raw`')))+
 "\nINSERT INTO bulavata.profiles(id,handle,display_name,avatar_emoji,room_accent) VALUES ('44444444-4444-4444-4444-444444444444','di','Di','🌴','#F4A261');\n";
const checks=results=>results.flatMap(r=>r.rows||[]).flatMap(row=>Object.values(row)).filter(v=>typeof v==='string'&&v.startsWith('PASS '));
(async()=>{
 const db=new PGlite();
 try {
  await db.exec(fixture);
  for(const m of ['20261109000000_sota_talanoa_wall','20261110160000_sota_share_engine','20261112120000_sota_share_stats','20261112180000_sota_invites'])
   await db.exec(read(`supabase/migrations/${m}.sql`));
  const share=checks(await db.exec(read('tests/share-engine-db.sql')));
  assert.ok(share.length>=24&&share.includes('PASS suite completed'),'The share engine SQL suite must still pass with invites');
  process.stdout.write(`Share engine suite on top of invites: ${share.length} checks passed.\n`);
  const inv=checks(await db.exec(read('tests/invites-db.sql')));
  for(const c of inv)process.stdout.write(c+'\n');
  assert.ok(inv.length>=30&&inv.includes('PASS suite completed'),'Expected the full invites SQL suite to execute');
  process.stdout.write(`Invites isolated Postgres: ${inv.length} SQL checks passed.\n`);
 } finally {await db.close();}
})().catch(error=>{process.stderr.write((error.stack||String(error))+'\n');process.exitCode=1;});
