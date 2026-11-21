# Cutover: Sota Kece onto the shared Dimau account (dimau-core-ireland)

Prepared 21 Nov 2026 (Ops task 1255). Not done yet. Every step that changes a live database, a live
setting or the live site needs Donovan's yes in chat first.

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
