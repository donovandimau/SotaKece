# Sota Kece baseline schema

`supabase/migrations/` cannot rebuild Sota Kece on its own. About 15 of its first tables (profiles,
friendships, moments, wallets, transactions and others) were made on the live database and never saved as
migration files. This folder fills that gap: a full copy of what is live, taken from the database itself.

| File | What it is |
| --- | --- |
| `sota_kece_schema.sql` | Schemas `bulavata` and `bulavata_talanoa_private`, plus the `public.bv_*` / `public.sota_*` functions, views and tables: tables, sequences, constraints, indexes, functions, views, triggers, row level security, policies and grants. |
| `sota_kece_platform.sql` | Supabase-only pieces outside those schemas: 5 storage buckets (no files), 8 storage policies, 2 realtime tables, the `sota-koro-vanish-sweep` cron job. |
| `export/schema-export.sql`, `export/platform-export.sql` | The read-only queries that produced the two files. |

Exported from **dimau-core-sydney** (`aqfzpaczyodhugsgqvxi`) on **21 Nov 2026**. It holds structure only:
no rows, no member data, no secrets.

## Not a migration

These files are not in `supabase/migrations/` and nothing applies them automatically. They are the starting
point for moving Sota Kece onto the shared Dimau account (dimau-core-ireland, `super-app/SPEC.md` §3.2 step 5
in `dimau-platform-standard`). That move is a separate, reviewed step that needs Donovan's yes before
anything touches a live database.

Things to know before running them anywhere:

- They need `auth.uid()`, `auth.users`, `storage.objects` and pgcrypto in `extensions`, as every Supabase
  project has. `bulavata.profiles.id` references `auth.users(id)`, so member ids must exist there first.
- 142 of the 171 functions are `SECURITY DEFINER` and 33 can be called by signed-out visitors (`anon`), exactly
  as on live. Moving them copies that exposure; review it during the move, not here.
- The platform file uses `insert … on conflict do nothing` for buckets but plain `create policy` and
  `cron.schedule` for the rest, so run it once.

## Test

`tests/run-baseline-db.cjs` loads `sota_kece_schema.sql` into an isolated PGlite database (with small stand-ins
for Supabase's auth, storage and extensions), then checks:

1. the rebuilt object counts equal the live inventory taken at export time (tables, views, sequences,
   functions, security-definer functions, indexes, constraints, triggers, policies, RLS tables, table and
   function grants, functions callable by `anon`);
2. every function body compiles against the rebuilt schema (the file loads with `check_function_bodies = off`,
   as `pg_dump` output does, so the test recreates each function with checking on);
3. `anon` cannot read a table directly;
4. the bucket rows in the platform file load.

```bash
cd tests/talanoa-tools && npm ci --ignore-scripts && cd ../..
NODE_PATH="$PWD/tests/talanoa-tools/node_modules" node tests/run-baseline-db.cjs
```

## Refreshing it

Run `export/schema-export.sql` on the live project (read-only) and save the `content` column as
`sota_kece_schema.sql`; do the same with `export/platform-export.sql` for `sota_kece_platform.sql`. Then run the
inventory query in `tests/run-baseline-db.cjs` on live and update `LIVE` in that file. A large result is easiest
to move as `encode(convert_to(content,'UTF8'),'base64')` with `md5(content)` beside it, checked after decoding.
