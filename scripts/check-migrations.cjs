#!/usr/bin/env node
// Migration check: is everything our migration files create actually on the live database?
//
// Why: several times a pull request was merged with a "run this migration" note and nobody ran it, so a
// feature went live with no tables or functions behind it. This reads the .sql files listed in
// migrations-check.json, collects every table, function and added column they create (minus anything a
// later file drops), and asks the database which of those names do not exist.
//
// It only asks "does this name exist" through public.ops_objects_missing, with the public (anon) key that
// the site itself already ships. It reads no rows and needs no secret.
//
// On a pull request a gap is a warning (the migration is normally applied when the PR merges).
// On main a gap fails the run: something is merged and live without its database change.
// If the database cannot be asked at all (three tries), that is also a warning on a PR and a failure on main.
// migrations-check.json: "dirs" (folders of .sql files), "databases" (name, url, public key),
// "ignoreFiles" (files deliberately not applied yet) and "ignore" (single names; a trailing * matches a prefix).
// Give the reason for every ignore in TRACKER.md.
// Copy of the shared script; change it in one repo and copy it to the others.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'migrations-check.json'), 'utf8'));

function sqlFiles(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(name => name.toLowerCase().endsWith('.sql')).sort().map(name => path.posix.join(dir, name))
    .filter(file => !(config.ignoreFiles || []).includes(file));
}
const clean = name => name.toLowerCase().replace(/"/g, '');
const qualify = name => name.includes('.') ? name : 'public.' + name;

function collect(files) {
  // Statements are applied in the order they appear, file by file, so "drop then create again" leaves the
  // table wanted and "create then drop" leaves it out.
  const wanted = new Map();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(root, file), 'utf8').replace(/--[^\n]*/g, m => ' '.repeat(m.length)).replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
    const steps = [];
    const add = (at, drop, kind, name) => { if (!/^pg_temp\./.test(name)) steps.push({ at, drop, key: kind + ':' + name }); };
    for (const m of sql.matchAll(/\bdrop\s+table\s+(?:if\s+exists\s+)?([a-z_0-9."]+)/gi)) add(m.index, true, 't', qualify(clean(m[1])));
    for (const m of sql.matchAll(/\bdrop\s+function\s+(?:if\s+exists\s+)?([a-z_0-9."]+)/gi)) add(m.index, true, 'f', qualify(clean(m[1])));
    for (const m of sql.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([a-z_0-9."]+)/gi)) add(m.index, false, 't', qualify(clean(m[1])));
    for (const m of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+([a-z_0-9."]+)/gi)) add(m.index, false, 'f', qualify(clean(m[1])));
    for (const m of sql.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([a-z_0-9."]+)([^;]*)/gi)) {
      const table = qualify(clean(m[1])), from = m.index + m[0].length - m[2].length;
      for (const c of m[2].matchAll(/\bdrop\s+column\s+(?:if\s+exists\s+)?([a-z_0-9"]+)/gi)) add(from + c.index, true, 'c', table + '.' + clean(c[1]));
      for (const c of m[2].matchAll(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_0-9"]+)/gi)) add(from + c.index, false, 'c', table + '.' + clean(c[1]));
    }
    steps.sort((a, b) => a.at - b.at);
    for (const step of steps) {
      if (!step.drop) { wanted.set(step.key, file); continue; }
      wanted.delete(step.key);
      // Dropping a table takes its added columns with it.
      if (step.key.startsWith('t:')) for (const key of [...wanted.keys()]) if (key.startsWith('c:' + step.key.slice(2) + '.')) wanted.delete(key);
    }
  }
  return wanted;
}
const ignored = key => (config.ignore || []).some(rule => rule.endsWith('*') ? key.startsWith(rule.slice(0, -1)) : key === rule);

async function missingIn(database, names) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await askOnce(database, names); }
    catch (error) { lastError = error; if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 4000)); }
  }
  throw lastError;
}
async function askOnce(database, names) {
  const response = await fetch(database.url.replace(/\/$/, '') + '/rest/v1/rpc/ops_objects_missing', {
    method: 'POST', headers: { apikey: database.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_names: names }), signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(database.name + ' answered HTTP ' + response.status);
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error(database.name + ' gave an unexpected answer');
  return result;
}

async function main() {
  const files = (config.dirs || []).flatMap(sqlFiles);
  const wanted = collect(files);
  const names = [...wanted.keys()].filter(key => !ignored(key)).sort();
  const strict = process.env.MIGRATIONS_CHECK_STRICT === '1';
  console.log('Migration check: ' + files.length + ' SQL files, ' + names.length + ' tables, functions and columns to look for.');
  if (!names.length) return 0;
  let missing = names;
  try {
    // A name counts as present if any listed database has it (an app may be moving between two).
    for (const database of config.databases) { if (!missing.length) break; missing = await missingIn(database, missing); }
  } catch (error) {
    // On main, "could not check" is a failure too: a changed key or a removed helper function would
    // otherwise pass quietly for ever. On a pull request it stays a warning.
    console.log('::' + (strict ? 'error' : 'warning') + '::Migration check could not ask the database (' + error.message + '). Nothing was checked.');
    return strict ? 1 : 0;
  }
  if (!missing.length) { console.log('Everything the migration files create exists on ' + config.databases.map(d => d.name).join(' or ') + '.'); return 0; }
  const level = strict ? 'error' : 'warning';
  for (const key of missing) {
    const kind = { t: 'table', f: 'function', c: 'column' }[key[0]] || 'name';
    console.log('::' + level + ' file=' + (wanted.get(key) || '') + '::Not on the live database: ' + kind + ' ' + key.slice(2));
  }
  console.log(missing.length + ' missing. ' + (strict
    ? 'This is merged to main, so a feature may be live without its database change. Apply the migration, or list the name under "ignore" in migrations-check.json with the reason in TRACKER.md.'
    : 'Apply the migration when this pull request merges; the same check fails on main if it is still missing.'));
  return strict ? 1 : 0;
}
if (require.main === module) main().then(code => process.exit(code), error => { console.error(error); process.exit(1); });
module.exports = { collect, ignored };
