# The Talanoa Wall — real-time Pulse feed (9 November 2026)

The Pulse tab is now one feed for every member of Sota Kece: short posts (280 characters), quote,
reply, like, repost and share, arriving live. It replaces the one-line-per-friend "where you're at"
list that the tab showed before. Today's Spark stays on the tab as a card.

## What ships

| Piece | File |
|---|---|
| Data layer | `supabase/migrations/20261109000000_sota_talanoa_wall.sql` |
| Feed module | `sota-pulse.js`, `sota-pulse.css` (loaded by `index.html`, cached on demand by `sw.js`) |
| Page wiring | `index.html`: `viewPulse()` hands the tab to the module; `sparkCard()` keeps the daily Spark; `go()` stops the wall's live channel on tab change |
| Database checks | `tests/talanoa-wall-db.sql` run by `tests/run-talanoa-wall-db.cjs` (isolated PGlite, in the Talanoa privacy workflow) |
| Module checks | `tests/talanoa-wall.test.cjs` |

## Data layer (schema `bulavata`)

- `talanoa_posts` — `author → profiles`, `body` (1–280 after trim), `quote_of` (set null on delete), `reply_to` (cascade), `like_count`, `repost_count`, `reply_count`, `created_at`. Partial index on `(created_at desc, id desc) where reply_to is null` serves the wall; author, reply and quote indexes serve rooms, threads and tidy-up.
- `talanoa_likes`, `talanoa_reposts` — `(post_id, member)` primary keys.
- Counters move only through `security definer` triggers; the row is the source of truth, so one page is one read.
- Row-level security: members (`authenticated`) read all three tables, which is also what Realtime checks before it delivers an insert. No insert/update/delete grants: every write goes through a function. `anon` has nothing.

## Functions (schema `public`, `security definer`, `search_path ''`, `authenticated` only)

- `bv_talanoa_feed(mode, as_of, limit, offset, cursor_created, cursor_id, since, post_id, reply_to)` → jsonb array of cards (author handle, name, emoji, accent, counts, `i_liked`, `i_reposted`, `mine`, embedded `quote`). One function, five shapes:
  - `latest`: keyset pages on `(created_at, id)`, newest first.
  - `hot`: `(likes + 2·reposts + 1.5·replies + 1) / (age_hours + 2)^1.4` over the last 72 hours, frozen at `as_of` so offset pages stay stable while new posts arrive.
  - `since`: posts newer than a timestamp (the "N new posts" pill).
  - `post_id`: one card. `reply_to`: a thread, oldest first.
- `bv_talanoa_post(body, quote, reply_to)` → the new card. A reply to a reply joins the root thread (one level).
- `bv_talanoa_like(id)` / `bv_talanoa_repost(id)` → toggle, returning the new state and count in one round trip.
- `bv_talanoa_delete(id)` → author only; replies cascade, quotes keep their text and drop the link.
- Errors are codes the page translates: `NOT_SIGNED_IN`, `EMPTY`, `TOO_LONG`, `GONE`, `NOT_YOURS`.
- `talanoa_posts` is added to the `supabase_realtime` publication (guarded, so the local fixture runs too).

## The page

- Skeleton paints at once; the first page and the Spark load side by side, not in a queue.
- Latest / Hot segmented control. Default is **Latest** (`DEFAULT_MODE` in `sota-pulse.js`), in line with the 2 November decision that Sota Kece has no algorithmic feed. Hot is one tap away; flipping the default is one constant.
- Live inserts from other members only raise a sticky "N new posts" pill — the list never moves under a thumb. Tapping it fetches everything newer than the newest card and prepends without duplicates. Own posts are prepended immediately from the function's return. A reply arriving live bumps the parent's count in place, or refreshes the thread if it is open.
- Pages prefetch 900px ahead of the scroll through an `IntersectionObserver`; the wall ends with "That is everything on the wall right now."
- Like and repost are optimistic and reconcile with the server's count; a failure rolls back and tells the member.
- Quote fills the composer with the original; reply opens the thread with its own composer; share uses the native sheet or copies `/#talanoa=<id>`, which deep-links straight into the post.
- Cards use `content-visibility:auto`; styling uses the app's own tokens so every skin paints the wall.
- One delegated listener on `#app`; the module stops its channel and observer when the tab changes.

## Verified

- `NODE_PATH=tests/talanoa-tools/node_modules node tests/run-talanoa-wall-db.cjs`: 49 SQL checks + preservation snapshot (anon denied, member without a sub refused, trim/length rules, like/repost/reply counters, quote vs repost, one-level threading, keyset pages 4,3 | 2,1 with no gaps, since, hot ranking and 72-hour window, stable offset pages, delete cascade and quote detachment, direct table writes denied, member read kept for Realtime).
- `node --test tests/*.test.cjs`: every suite passes locally with jsdom at `/tmp/jsd`, including the 11 new wall tests (skeleton-then-page, live pill with no duplicates, optimistic like with rollback, post/quote/reply flows, Hot paging with a frozen `as_of`, deep link, page and worker wiring).
- Three existing tests that asserted the old composer ids or the `postPulse` marker were updated to the new wiring; the page release meta and worker cache advanced together to `v151-talanoa-wall`.

## Not verified here

- The migration WAS applied to `dimau-core-sydney` on 9 November 2026 through the Supabase connector, with the owner's approval; `bv_talanoa_*` exist and `talanoa_posts` is in the `supabase_realtime` publication. Merging the branch is all that remains to put the wall live.
- Hosted render and Realtime delivery on the preview with two signed-in accounts.

## Decisions for Donovan

- The wall is visible to every member, not friends only; the "no strangers" line was removed from the tab for that reason.
- The old `bulavata.pulses` table and `bv_pulse_feed()` are untouched (empty in production) and can be dropped in a later migration.
- Activity notifications for likes and replies on the wall are a follow-up (`bulavata.notify` is ready for it).
