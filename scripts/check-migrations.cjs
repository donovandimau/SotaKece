#!/usr/bin/env node
// Migration check: is everything our migration files create actually on the live database?
//
// Why: several times a pull request was merged with a "run this migration" note and nobody ran it, so a
// feature went live with no tables or functions behind it. This reads the .sql files listed in
// migrations-check.json, collects every table, function and added column they create (minus anything a
// later file drops), and asks the database which of those do not exist.
//
// Functions are checked with their argument list, so a new version of an existing function (same name,
// different arguments) is not mistaken for the old one. Names written without a schema are looked for in
// the schema the file selects with "set search_path" (or "defaultSchema", or public).
//
// It only asks "does this exist" through public.ops_objects_missing, with the public (anon) key that
// the site itself already ships. It reads no rows and needs no secret.
//
// On a pull request a gap is a warning (the migration is normally applied when the PR merges).
// On main a gap fails the run: something is merged and live without its database change.
// If the database cannot be asked at all (three tries), that is also a warning on a PR and a failure on main.
// migrations-check.json: "dirs" (folders of .sql files), "databases" (name, url, public key),
// "defaultSchema" (optional; where unqualified names live when the file does not say),
// "ignoreFiles" (files deliberately not applied yet) and "ignore" (single names; a trailing * matches a prefix).
// Give the reason for every ignore in TRACKER.md.
// Copy of the shared script; the master copy and its tests live in Dimau-Ops-Room. Change it there and copy it out.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'migrations-check.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

function sqlFiles(dir) {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full).filter(name => name.toLowerCase().endsWith('.sql')).sort().map(name => path.posix.join(dir, name))
    .filter(file => !(config.ignoreFiles || []).includes(file));
}
const clean = name => name.toLowerCase().replace(/"/g, '');
const blank = text => text.replace(/[^\n]/g, ' ');

// Same length as the input, with comments blanked out.
const withoutComments = sql => sql.replace(/--[^\n]*/g, blank).replace(/\/\*[\s\S]*?\*\//g, blank);
// Same length again, with function bodies ($$ ... $$) and quoted strings blanked out too. Used to find
// statements and argument lists without being fooled by text inside a body or a default value.
const withoutBodies = sql => sql.replace(/\$([a-z_0-9]*)\$[\s\S]*?\$\1\$/gi, blank).replace(/'(?:[^']|'')*'/g, blank);

// Where each "set search_path" statement in the file starts, and the first schema it names.
function schemaChanges(bare, fallback) {
  const changes = [];
  for (const m of bare.matchAll(/(^|;)\s*set\s+(?:session\s+|local\s+)?search_path\s*(?:=|\bto\b)\s*([^;]+)/gi)) {
    const first = m[2].split(',').map(part => clean(part.trim())).find(part => part && part !== '$user');
    changes.push({ at: m.index, schema: !first || first === 'default' ? fallback : first });
  }
  return changes;
}

// The arguments of "create function name(...)" starting at the opening bracket: one entry per input
// argument, as written (name and type), without its default. OUT arguments are not part of a function's identity.
function argumentList(bare, open) {
  let depth = 0, end = -1;
  for (let i = open; i < bare.length; i++) {
    if (bare[i] === '(') depth++;
    else if (bare[i] === ')' && --depth === 0) { end = i; break; }
  }
  if (end < 0) return null;
  const parts = []; let from = open + 1; depth = 0;
  for (let i = open + 1; i <= end; i++) {
    if (bare[i] === '(' || bare[i] === '[') depth++;
    else if ((bare[i] === ')' && i < end) || bare[i] === ']') depth--;
    if ((bare[i] === ',' && depth === 0) || i === end) { parts.push(bare.slice(from, i)); from = i + 1; }
  }
  return parts.map(part => clean(part).replace(/\s+/g, ' ').trim())
    .filter(part => part && !/^out\s/.test(part))
    .map(part => part.replace(/^(?:in|inout|variadic)\s+/, '').replace(/\s+default(?:\s.*)?$/, '').replace(/\s*:?=.*$/, '').trim());
}
const nameOf = key => key.replace(/\(.*$/, '');
const argCount = key => { const inner = key.slice(key.indexOf('(') + 1, -1); return inner ? inner.split('|').length : 0; };

function collect(files, options = {}) {
  const base = options.root || root;
  const fallback = clean(options.defaultSchema || config.defaultSchema || 'public');
  // Statements are applied in the order they appear, file by file, so "drop then create again" leaves the
  // table wanted and "create then drop" leaves it out.
  const wanted = new Map();
  for (const file of files) {
    const sql = withoutComments(fs.readFileSync(path.join(base, file), 'utf8'));
    const bare = withoutBodies(sql);
    const changes = schemaChanges(bare, fallback);
    // Each migration file runs in its own session, so the schema choice starts again in every file.
    const schemaAt = at => { let schema = fallback; for (const c of changes) if (c.at <= at) schema = c.schema; return schema; };
    const qualify = (name, at) => name.includes('.') ? name : schemaAt(at) + '.' + name;
    const steps = [];
    const add = (at, drop, kind, name, extra) => { if (!/^pg_temp\./.test(name)) steps.push({ at, drop, kind, name, ...extra }); };
    for (const m of sql.matchAll(/\bdrop\s+table\s+(?:if\s+exists\s+)?([a-z_0-9."]+)/gi)) add(m.index, true, 't', qualify(clean(m[1]), m.index));
    for (const m of sql.matchAll(/\bcreate\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([a-z_0-9."]+)/gi)) add(m.index, false, 't', qualify(clean(m[1]), m.index));
    for (const m of sql.matchAll(/\bdrop\s+function\s+(?:if\s+exists\s+)?([a-z_0-9."]+)\s*(\()?/gi)) {
      const args = m[2] ? argumentList(bare, m.index + m[0].length - 1) : null;
      add(m.index, true, 'f', qualify(clean(m[1]), m.index), { count: args ? args.length : null });
    }
    for (const m of sql.matchAll(/\bcreate\s+(?:or\s+replace\s+)?function\s+([a-z_0-9."]+)\s*(\()?/gi)) {
      const args = m[2] ? argumentList(bare, m.index + m[0].length - 1) : null;
      add(m.index, false, 'f', qualify(clean(m[1]), m.index) + (args ? '(' + args.join('|') + ')' : ''));
    }
    for (const m of sql.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([a-z_0-9."]+)([^;]*)/gi)) {
      const table = qualify(clean(m[1]), m.index), from = m.index + m[0].length - m[2].length;
      for (const c of m[2].matchAll(/\bdrop\s+column\s+(?:if\s+exists\s+)?([a-z_0-9"]+)/gi)) add(from + c.index, true, 'c', table + '.' + clean(c[1]));
      for (const c of m[2].matchAll(/\badd\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_0-9"]+)/gi)) add(from + c.index, false, 'c', table + '.' + clean(c[1]));
    }
    steps.sort((a, b) => a.at - b.at);
    for (const step of steps) {
      const key = step.kind + ':' + step.name;
      if (!step.drop) { wanted.set(key, file); continue; }
      if (step.kind === 'f') {
        // "drop function f" removes every version; "drop function f(a, b)" removes the versions with that many arguments.
        for (const k of [...wanted.keys()]) if (k[0] === 'f' && nameOf(k) === key && (step.count === null || !k.includes('(') || argCount(k) === step.count)) wanted.delete(k);
        continue;
      }
      wanted.delete(key);
      // Dropping a table takes its added columns with it.
      if (step.kind === 't') for (const k of [...wanted.keys()]) if (k.startsWith('c:' + step.name + '.')) wanted.delete(k);
    }
  }
  return wanted;
}
// An ignore rule matches the full name; for a function it may also be written without the argument list.
const ignored = (key, rules = config.ignore || []) => rules.some(rule => [key, nameOf(key)].some(name => rule.endsWith('*') ? name.startsWith(rule.slice(0, -1)) : name === rule));

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
    console.log('::' + level + ' file=' + (wanted.get(key) || '') + '::Not on the live database: ' + kind + ' ' + key.slice(2).replace(/\|/g, ', '));
  }
  console.log(missing.length + ' missing. ' + (strict
    ? 'This is merged to main, so a feature may be live without its database change. Apply the migration, or list the name under "ignore" in migrations-check.json with the reason in TRACKER.md.'
    : 'Apply the migration when this pull request merges; the same check fails on main if it is still missing.'));
  return strict ? 1 : 0;
}
if (require.main === module) main().then(code => process.exit(code), error => { console.error(error); process.exit(1); });
module.exports = { collect, ignored, argumentList, withoutBodies, withoutComments };
