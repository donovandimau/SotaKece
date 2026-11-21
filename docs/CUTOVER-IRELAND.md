# Cutover: Sota Kece onto the shared Dimau account (dimau-core-ireland)

Prepared 21 Nov 2026 (Ops task 1255). **Run 21 Nov 2026 (Ops task 1257, Donovan: "Done, run the cutover").**

## What was done on 21 Nov

| Step | Result |
| --- | --- |
| 1 Redirect URLs | Added by Donovan in the Ireland dashboard |
| 5 Baseline | Applied to dimau-core-ireland, recorded as migration `20261121195543 sota_kece_baseline_from_sydney`. Ireland downloaded both files from GitHub (commit 87774ef) and checked them against the live export's md5 before running. Inventory equals Sydney exactly (56 tables, 171 functions, 162 indexes, 279 constraints, 64 policies, 470/285 grants, 5 buckets, 8 storage policies, 2 realtime tables, 1 cron job). |
| 6 sota-server | Deployed to Ireland, verify_jwt off, same code and secret hash; refuses requests without the secret (401). |
| 7 Rows | No id swap was needed: the one member has the same auth id in both projects. 26 rows copied (profile, wallet, app link, Talanoa post, Sere item, 7 sparks, 6 Sere scenes, 3 hubs, coin settings, 4 coin bundles) with triggers off, sequences moved on. Per-table md5 of every row equals Sydney (Sere item after the address change). The export method escaped `&` in two hub names; fixed and re-checked. |
| 8 Files | 9 objects (3.1 MB) copied to the same bucket and path through two one-off helper functions (`sota-move-export` on Sydney, `sota-move-import` on Ireland) and a one-time secret. Names and sizes identical on both sides. Both helpers then redeployed as do-nothing stubs (410, JWT required); delete them from the dashboard when convenient. |
| 9 Switch | `switch-backend.cjs --switch` (22 files), `EXPECTED = []`, release bumped to `sota-kece-shell-20261121-v207-ireland` so installed copies fetch the new page, CSS rebuilt. 780/780 tests and the database runners pass (LF copy). |

The rest of this page is the plan as written beforehand.

## Why it is one switch

Sota Kece's sign-in and its data go through the same Supabase connection. If the site signed people in
to Ireland while its data stayed in Sydney, Sydney would refuse every Ireland sign-in, and the reverse
also fails. So the data move and the sign-in switch happen together, on one day.

`scripts/switch-backend.cjs` moves every file that names Sydney (22 today: the page, `/api/*`, share
links, call room, Sere, the deletion page, the migration check and the tests) in one go. It leaves the
files that already use Ireland on purpose untouched (analytics, payments, shared music, hub map,
Viti Pulse). Rehearsed on 21 Nov in a throwaway copy with the repo's own line endings: 779/779 tests
pass before; after the switch, the CSS rebuild and setting `EXPECTED = []` in
`tests/backend-switch.test.cjs`, 779/779 pass again.

Members sign in once more after the cutover (a sign-in belongs to one project). Same email, same Google
account; no new account.

## Before the day

| # | Who | What | Check |
|---|---|---|---|
| 1 | Donovan, Supabase dashboard (dimau-core-ireland → Authentication → URL Configuration → Redirect URLs) | Add `https://sotakece.com/**`, `https://www.sotakece.com/**`, `https://sere.sotakece.com/**`. Leave the Site URL as `https://account.dimau-fintech.com`. | Google sign-in on a preview returns to Sota Kece, not the account page |
| 2 | Claude | Merge the Ireland baseline work first if it touches the same names (separate session, "Ireland can't be rebuilt from its migrations"). | No clash |
| 3 | Claude | Decide the exposure review: 11 security-definer functions callable signed out, 86 by any member (see `supabase/baseline/TRIAL-2026-11-21.md`). Fix in Sydney first or as part of the move, not after. | Advisor findings understood |

## On the day (in this order)

| # | What | Check |
|---|---|---|
| 4 | Announce a short pause; stop writes on Sydney (revoke `authenticated` execute on the `bv_*` write functions, or put the site in read-only). | New posts refused |
| 5 | Apply `supabase/baseline/sota_kece_schema.sql`, then `sota_kece_platform.sql`, to dimau-core-ireland as a migration. | Inventory equals the trial (56 tables, 171 functions, 64 policies…) |
| 6 | Deploy `supabase/functions/sota-server` to Ireland (same code; the bridge secret's hash is in the code, so the Worker's `SOTA_SERVER_SECRET` stays). | `POST` without the header → 401 |
| 7 | Copy rows from Sydney to Ireland with the member id swapped in the same statement (56 foreign keys point at `bulavata.profiles(id)` with no `ON UPDATE CASCADE`). Today that is 1 member: 1 profile, 1 Talanoa post, 1 Sere item, 1 wallet row. Match by verified email only. | Row counts match; no Sydney id left in Ireland |
| 8 | Copy the Sere files (9 objects, ~3 MB) to the member's new folder (`<ireland id>/…`) and update any stored path. | Files open signed in |
| 9 | `node scripts/switch-backend.cjs --switch`, set `EXPECTED = []` in `tests/backend-switch.test.cjs`, flip the "still on Sydney" note, `node scripts/build-css.cjs`, full tests. Open the PR. | 779/779 |
| 10 | Merge. Cloudflare Workers Builds deploys the `sotakece` Worker. | Live page's `SB_URL` is Ireland |
| 11 | Real round trips on a phone: email sign-up (confirmation returns to sotakece.com), Google sign-in, post, voice note, call, gift, Delete my data on a throwaway account. | All pass |

## After

- Keep Sydney's Sota Kece data read-only for 30 days, then ask Donovan before removing it.
- Update `migrations-check.json` is done by the switch (it then checks Ireland).
- Record in TRACKER.md, Ops, and `super-app/SPEC.md` §3 (Sota Kece's auth question answered: it moved).

## Rollback

Before step 10: nothing visible changed; drop the copied schema from Ireland if wanted.
After step 10: revert the cutover commit (the site goes back to Sydney, which still holds the data as of
step 4). Anything members wrote in Ireland after the switch would need copying back.
