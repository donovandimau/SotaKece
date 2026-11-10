# The share engine — public post links with referral credit (10 November 2026)

Every post on the Talanoa Wall can now leave the app as a link that works for anyone, and every
link remembers who sent it. This is the blueprint's "share engine with deep links": WhatsApp-first
sharing, a preview card in the chat, one tap into the post, and credit to the sharer when a new
member joins through the link.

## How it flows

1. A member taps **Share** on a post. The wall calls `bv_talanoa_share(post)`, which mints a
   32-hex token for *this member and this post* (the same link every time they share it) and
   returns the words for the message.
2. The app's own share sheet opens (`sota-share.js`: native share on phones, WhatsApp first
   elsewhere) with `https://sotakece.com/p/<post>/<token>` and a message like
   `“First line of the post…” — Lusi Vakatawa on Sota Kece`.
3. Whoever opens the link gets a small public page (`api/share.js`, routed by `vercel.json`) with
   the post, the author, the counts, and the preview tags messaging apps read, so WhatsApp and
   Messenger show a card before anyone taps. The open is counted on the link.
4. The page has one button: **Open in Sota Kece** → `/?ref=<token>#talanoa=<post>`. A member lands
   on the post. A new person lands on sign-up; the token is kept on the device (30 days) and the
   address is cleaned, while the hash that opens the post survives sign-in.
5. The moment a room exists (either sign-up path), the page calls `bv_referral_claim(token)` once.
   The sharer gets a join counted on the link and an Activity line, "@newbie joined Sota Kece
   through your link"; the new member sees "@sharer brought you here. Say bula."

## What ships

| Piece | File |
|---|---|
| Data layer | `supabase/migrations/20261110160000_sota_share_engine.sql` |
| Public page | `api/share.js` (shares the page frame of `api/listen.js`), route in `vercel.json` |
| Wall | `sota-pulse.js`: `share()` mints the link and uses the app sheet; `shareText()` |
| Page | `index.html`: `rememberReferral()` at boot, `claimReferral()` after both room-creation paths |
| Activity | `sota-plus.js`: the `joined` kind |
| Checks | `tests/share-engine-db.sql` via `tests/run-share-engine-db.cjs` (PGlite, in the Talanoa privacy workflow); `tests/share-engine.test.cjs` |

## Data layer (schema `bulavata`)

- `talanoa_shares(token pk, post_id → talanoa_posts cascade, sharer → profiles cascade, opens, joins, created_at, unique (post_id, sharer))`.
- `referrals(id, member unique → profiles, sharer → profiles, token → talanoa_shares set null, created_at, check member ≠ sharer)`.
- RLS: a member reads only their own links and the referrals they earned. `anon` reads nothing.
- `notifications.kind` gains `joined`.
- `bv_talanoa_share(post)` (members): mint or return the member's token; errors `NOT_SIGNED_IN`, `GONE`.
- `bv_talanoa_shared(post, token)` (anyone): the card for exactly that post and token, or null; counts the open. The token is the capability, so a post is readable outside the app only once a member chose to send it, and ids cannot be probed.
- `bv_referral_claim(token)` (members): credits once per member, never to oneself, and only while the account is under a day old, so an old account following a link is a visit, not a sign-up.

## Public page

- `GET /p/<post>/<token>` → `api/share.js` with the publishable key only; no service role, no secret.
- `og:title` is the author's name on Sota Kece, `og:description` the first 200 characters, `og:url` the link itself, image the site card. `noindex`.
- Cache `public, max-age=60, s-maxage=300` on a hit; `no-store` on a miss (404) or database error (503). A removed post takes its page with it within minutes.
- `/p/` is not touched by the service worker (it only serves `/` offline).

## Verified

- `node tests/run-share-engine-db.cjs`: 38 SQL checks + preservation snapshot (anon denied everywhere except the token read; mint idempotent per member; wrong post, wrong token, malformed and null tokens all return null; opens counted per link; referral credited once, not to self, not for accounts over a day old; the sharer is told in Activity; a member sees only their own rows; deleting the post deletes its links and the public page, the referral keeps its credit).
- `tests/share-engine.test.cjs` (7): page tags and escaping, long-post cut, the exact database call with the publishable key and no bearer, 404/405/503 behaviour, the wall minting and handing the link to the sheet, the fallback to the in-app link, and page/worker/route wiring.
- Full suite: 411 pass with jsdom, 383 pass as CI runs it. Two tests that pinned the previous release id now read it from the page.
- The public page rendered at 390px in light and dark schemes.

## Not verified here

- A WhatsApp or Messenger preview fetch against the live page (needs the merged route on sotakece.com).
- A real sign-up through a link on production.

## Decisions for Donovan

- Referral reward is recognition only: a line in Activity and the counts on the link. The wallet stays off until the Reserve Bank of Fiji approves it, so no coins or credit.
- A member's own links are readable through the table policies (`talanoa_shares`, `referrals`), ready for a "your links: opens, joins" line in the room later.
