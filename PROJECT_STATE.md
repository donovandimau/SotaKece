## 10 November 2026 — Guest welcome before the feature scripts (Ops task 1041)

Release `sota-kece-shell-20261110-v164-first-paint`. After task 1037 the phone largest paint was still about 4.7s in the lab, because the veranda photo was only drawn once about 45 scripts had downloaded and run.

- **Static first paint.** `index.html` carries `<template id="sx-first-paint">`: the header, bottom navigation and Home welcome exactly as `sota-experience.js` renders them (the example room body is left empty; it is below the first screen). A tiny inline script after `#app` clones it in only when the screen is 760px or narrower, the hash is empty or `#home`, there is no `code`/`sid`/`error` in the query, and there is no Supabase session in localStorage (`sb-aqfzpaczyodhugsgqvxi-auth-token`). The app's first render replaces it; the photo, text and positions are the same, so nothing moves. `tests/first-paint.test.cjs` fails if the welcome copy in `sota-experience.js` changes without the template.
- **Head scripts moved.** `vendor/supabase`, `room-media.js`, `skin-identities.js`, `pacific-themes.js`, `skin-visuals.js` and `skins.js` were parser-blocking in `<head>`; they now sit just before `communications-core.js`, same order, still before the app script.
- **Bula pill.** `bula-top-20261030.js` now takes the floating position off the pill when it moves it into the top bar, so it no longer ends up bottom-left on some loads (the race noted in task 1037).
- **Live check.** `tests/tools/lcp-phone.mjs` measures slow-phone largest paint; `deploy-verify.yml` runs it against sotakece.com after each production deploy (report only).

Lab, local static server, 5-run medians: phone 390px (4x CPU, 1.6 Mbps, 150 ms) largest paint 4.86s → 3.39s, first paint 2.4s → 1.7s, layout shift 0.003 → 0.005 (a small font swap on the early text); desktop 1440px 0.65s → 0.64s. The phone runs split into two groups, 2.0–2.2s and 3.3–3.4s: on the lab's HTTP/1.1 server the photo either gets one of the six connections at once or waits behind 36 render-blocking stylesheets. Production serves HTTP/2, where that queue does not exist. Screenshots 390@3x, 1440@1x, 1440@2x match pixel for pixel with the pill in the top bar.

Live (GitHub runner, same throttling, 5-run medians, deployment URLs measured back to back): before (v163-hover) 5.99s, layout shift 0.022; after (v164) 5.21s, layout shift 0.0065; after with the static copy skipped (`#x`) 4.91s. On HTTP/2 everything downloads at once, so the copy's early header logo (46 KB) and music badge (22 KB) slowed the photo; the follow-up leaves those two images out of the copy (their boxes keep their size and the app draws them, as it already did in the filmstrip).

Still possible: fewer, combined stylesheets (36 render-blocking files) would remove the connection queue on HTTP/1.1 and shave first paint everywhere.

## 10 November 2026 — Largest paint, second pass (Ops task 1037)

Release `sota-kece-shell-20261110-v162-lcp`. Real visitors on 10 November: largest paint p75 3.77s over 32 samples (target 2.5s), layout shift fine. Task 1020 already preloads the veranda guitar photo; what was still slow:

- **Too many bytes ahead of the first paint.** Phones and 2x screens downloaded the 1536px photo (218 KB) for a 304–412px slot. A new `friends-guitar-clean-1024.webp` (127 KB) sits in the `srcset` and the preload, so those screens now take the 1024px file; it is still sharper than the screen can show. `music-playlist.css` carried the woven mat as a 57 KB base64 picture inside a render-blocking stylesheet; it is now `/assets/music-weave-20261110.webp`, loaded only when the player opens (and saved for offline use once used).
- **A hidden 3D graph did its WebGL set-up and a full-page layout read while the welcome was being drawn.** `life-graph3d.js` now starts WebGL only when the graph comes near the screen (IntersectionObserver); without IntersectionObserver it starts at once as before. `revised/live/life-graph3d.js` kept identical.
- **2.3 MB of pictures nobody sees on Home were downloaded during the first seconds** (fetched while the old welcome is drawn and swapped). The 1.16 MB tiled blue pattern (shown at 420px) is now a 1260px WebP (375 KB) and the 695 KB mobile reference picture is a WebP (446 KB), same size and look. Old files are kept for cached copies.

Lab, 3-run medians, local static server: phone 390px (4x CPU, 1.6 Mbps, 150 ms) largest paint 5.6–5.7s → 4.7s, first paint 2.5s → 2.4s, layout shift 0.003 unchanged; desktop 1440px 0.77s → 0.69s. Full-page screenshots before/after at 390@3x, 1440@1x and 1440@2x match except a few dozen pixels of photo resampling (random bubbles and the Bula pill masked). All node tests pass (364 pass, 271 skipped, 0 fail).

Found, not changed: the Bula pill sometimes lands in the header and sometimes floats bottom-left on the same build (seen on main before this change). Still slow: the page is drawn by JavaScript after about 50 scripts and 40 stylesheets load, so on slow phones the photo waits for them; the real fix is to draw the guest welcome before the feature scripts.

## 10 November 2026 — Navigation tidy: one primary nav per viewport

Release `sota-kece-shell-20261110-v160-legal`. The owner's review of the live desktop (1440×900) and phone (390×844) views found three navigation systems showing at once, fixed widgets sitting over content on phones, and the composer pushed under the fold. What changed, and where:

- **Dock only on phones.** `sota-premium-shell.css` now scopes the bottom dock to 760px and under. Wider screens get the left rail from `sota-experience.css` back as the single primary navigation (brand, five destinations, the "Make it yours" links); no floating dock, and nothing reserves space for one.
- **Secondary pills follow the active dock tab.** `sota-worlds.js` renders `.sx-world-member-tabs` from `tabGroups`: Home and Talanoa (both land on the wall) share Your feed · Moments · Your Koro · Talanoa circles; People shows Friends · Your connections; Music and My space show no strip. On phones the strip scrolls sideways with an edge fade (`sota-worlds.css`) instead of hiding five of eight pills; the current pill is scrolled into view. The dock now highlights Talanoa on the Koro and circles pages (`sota-experience.js` nav map).
- **Search in the header.** `sota-experience.js` adds a `[data-dps-search-open]` button beside the menu; the shell's floating search button is hidden on every `.sx-enabled` page and kept only for sign-in/welcome screens (bottom-right).
- **Dimau Group badge never floats.** `dimau-consistency.js` (shared, external) still injects it; `sota-premium-shell.css` forces it to render as a static page footer under everything, clear of the dock, and the header menu carries a "Dimau Group ↗" link.
- **Composer in the first screen.** On Your feed the Music visuals block now follows the wall (`.tw-wrap`), so the composer sits straight under the hero; the phone breadcrumb is folded (the dock already says where you are) and a returning member's greeting is compact (`[data-world-visit=returning]`).
- **Make a photo sing** is a bordered, softly glowing second button beside the primary action at every width (`.sx-world-secondary.sx-world-sere`).

Tests: `tests/sota-worlds.test.cjs` now expects the group sizes above and that every secondary world is reachable from some strip.

## 9 November 2026 — Rolling upgrade Phase 1: the Dimau Premium Shell

Owner's fleet strategy: one universal premium shell, applied one app at a time, Sota Kece first. The shell lives in `dimau-platform-standard/premium-shell` (PR #27) and is copied here byte-for-byte (`dimau-premium-shell.css`, `dimau-premium-shell.js`; `tests/premium-shell-sha256.json` holds the hashes and `tests/premium-shell.test.cjs` checks them). Light sky-blue stays, as the owner confirmed on 9 Nov; no dark theme is shipped.

What changed on the page: the existing navigation (`.sx-nav`, built by `sota-experience.js`, same five destinations, same handlers) is now the shell's bottom dock at **every** width — full-width glass bar with safe-area padding on phones, a centred 560 px floating dock on wider screens — and the desktop left rail is retired (`sota-premium-shell.css` maps the geometry; the rail's brand, caption and world links are hidden, and `#app` loses its 224 px left padding). A floating search button (bottom-left, clear of Connect and the Plus pill) opens the shell's search overlay; `sota-premium-shell.js` is the provider and searches only what the app already has: destinations, members by handle (signed in, through the existing `bv_profiles` read), the skin collection (`BulaSkins.presets`) and the music library (`music-playlist.json`). Nothing is stored and no new host is contacted. Keyboard: `/` or Ctrl/Cmd+K opens, arrows move, Escape closes and returns focus. The overlay markup is static in `index.html` after `#app`, so first paint already has the final layout.

Offline: the four files travel with the essential shell. To keep the essential install under 1 MB (`tests/offline-delivery.test.cjs`), the chat and call files (`communications-chat.*`, `native-call-stage.*`, `circle-communications.css`) moved from the precache list to on-demand caching: they serve `communications.html` and `call.html`, neither of which is precached, so offline behaviour is unchanged. Release `sota-kece-shell-20261109-v153-premium-shell`.

Verified locally (static server, real Chromium, `tests/tools/check-shell.mjs`): phone 390 — dock 375×64 at the viewport bottom, five 71×56 targets, no horizontal overflow, overlay opens/traps/closes with focus return, CLS 0.007; desktop 1440 — dock 560×64, five 108×50 targets, CLS 0.004. `node --test tests/*.test.cjs`: 598 tests, 581 pass, 13 skipped, 4 fail (the same four pre-existing Companion/Connect jsdom failures as on main). Not verified here: the hosted preview (the sandbox cannot reach sotakece.com or the Sydney project); `deploy-verify.yml` now runs the same shell check against sotakece.com on every production deployment and fails if the live release is not the one the commit shipped.

Still on the live guest page and deliberately kept: the labelled example room ("EXAMPLE ROOM", "Example notes", "Example Top Mates"). It is the product demo the owner approved in November and every element says it is an example; removing it is a design decision for Donovan, not a cleanup.

## 9 November 2026 — Faster first paint, no layout jump, older phones

Real visitors over 7 days: largest paint p75 3.22s (target 2.5s). The largest thing on the opening screen is the veranda guitar photo in the welcome (`friends-guitar-clean-*.webp`). It is drawn by JavaScript, so the browser only found it after every script had run, and while it downloaded it shared the connection with an old brand picture still preloaded at top priority (373 KB on phones) and a hidden 1.1 MB logo SVG. Changes, with no change to the look: the photo is preloaded first in `<head>` with the same srcset/sizes and high priority; the two old `front-reference-brand` preloads are removed; the hidden rail logo and the old brand picture in the replaced welcome markup are `loading="lazy"`; `bula-top-20261030.js` moves the Bula pill into the top bar in a microtask instead of the next animation frame, so the page no longer shows it on its own line for one frame (that was the whole 0.12–0.16 layout jump); `Object.hasOwn` is replaced with `Object.prototype.hasOwnProperty.call` (Safari before 15.4). Asset query versions bumped; release v152.

Lab, 3-run medians: phone 390px (4x CPU, 1.6 Mbps, 150 ms) largest paint 13.2s → 6.5s, layout shift 0.124 → 0.003; desktop 1440px 2.9s → 2.1s, 0.159 → 0.004. Full-page screenshots before/after are identical at 390 and 1440. `node --test tests/*.test.cjs` 324 pass, 268 skipped (unchanged). The four files one GB visitor could not load all return 200 live. Still open: the page renders after ~40 synchronous scripts, and the old welcome drawn then replaced still fetches a 1.16 MB background pattern.

## 9 November 2026 — The Talanoa Wall: a live feed for every member

Owner asked for the first core feature of the Sota Kece blueprint: the real-time Pulse feed. The Pulse tab is now one wall for every signed-in member — not friends only — with 280-character posts, quote, reply, like, repost and share. New posts arrive through Supabase Realtime and wait behind a "N new posts" pill so the list never jumps under a thumb; pages load ahead of the scroll; the wall ends when the posts do. Latest is the default order (the 2 November decision stands); Hot, a velocity ranking frozen at the moment the wall opened, is one tap away. Today's Spark stays on the tab as a card and loads beside the feed instead of ahead of it.

Migration `supabase/migrations/20261109000000_sota_talanoa_wall.sql` adds `bulavata.talanoa_posts`, `talanoa_likes`, `talanoa_reposts` with counters kept by definer triggers, member-only read policies (also what Realtime checks) and no direct write grants; `bv_talanoa_feed` (latest/hot/since/post/thread in one function), `bv_talanoa_post`, `bv_talanoa_like`, `bv_talanoa_repost`, `bv_talanoa_delete`. `sota-pulse.js` + `.css` render the wall through the page's `shell()`; `index.html` hands the tab over, keeps the Spark in `sparkCard()`, and stops the wall's channel on tab change; `sw.js` caches the two files on demand; release `v151`.

Verified locally: `tests/run-talanoa-wall-db.cjs` (isolated PGlite, 49 SQL checks + preservation snapshot, now in the Talanoa privacy workflow) and `tests/talanoa-wall.test.cjs` (11 DOM tests); the full `node --test tests/*.test.cjs` suite passes with three existing tests updated from the old composer ids and `postPulse` marker. Not verified: hosted render and Realtime delivery on the preview. The migration was applied to dimau-core-sydney on 9 November through the Supabase connector with the owner's approval; `bv_talanoa_*` exist and `talanoa_posts` is in the Realtime publication, so merging the branch puts the wall live. The old `bulavata.pulses` table is untouched and empty. Full notes: `docs/talanoa-wall-20261109.md`.

## 4 November 2026 — Visible visualiser; controls collapsed; photographic headings

Home retains the existing animated visualiser in compact mode. Only choosing Music reveals playback, settings, sharing and the library. The same visual/audio elements are preserved across routes and shell remount. Feature cards and the music teaser carry photorealistic images with overlaid hover/focus-lit headings. Existing Bula and sunset social-image corrections remain. 72 focused tests pass. Fresh browser visual inspection is unavailable; provider/CI evidence is recorded in PR369. Whole-page audio-reactive lighting is researched as a further option, not included in this change.

## 4 November 2026 — Bula retained; Volau removed; everyday sunset social imagery

Owner corrected the previous draft: keep the Bula welcome pill and remove only Volau. The two Bula scripts remain unchanged; only the companion loader tags are removed from the three existing entry pages. The revised layout is retained. New local responsive artwork depicts four fictional adults socialising face to face, with an acoustic guitar and soft Pacific sunset light. No phones or work scene. Existing member portraits, skins, music and current main's sharing changes are preserved. See docs/social-sunset-20261104.md and existing PR369 for checks and deployment status.

## 2 November 2026 — Connection over scrolling

Owner asked for every app's engagement to reward good behaviour rather than copy social-media tricks. Sota Kece already had no algorithmic feed, so this adds three small things that favour real connection and give the feed an end. New `sota-wellbeing.js` + `.css` (remembered on the device only, `sk.well.v1`; the last-seen marker only moves forward; nothing sent anywhere; no streaks, no activity badges, no time counters):
- **You're all caught up** at the end of Moments, with how many are new since the last visit ("That is everything from your friends. Nothing else is waiting for you").
- **Say bula** in the Moments side column: up to two friends whose room you have not visited in 21 days (never-visited first, then oldest), with Visit and Not now (hides that friend for 14 days). `openRoom` records the visit.
- After 25 minutes in one sitting, one gentle note a day suggesting a break or a call.

Checks: `node --test tests/*.test.cjs` 316 pass (313 before + 3 new in `tests/wellbeing.test.cjs`). Cards rendered with the app's own styles at 1200px and 390px. Service worker cache `sota-kece-shell-20261102-v123-wellbeing`. No database change.

## 1 November 2026 — Wallet receipts button removed; Sota Kece Plus pill stays

This corrects the 31 October Plus checkout entry below. The "+ Wallet receipts" button and the dimau-receipts.js script were taken out of index.html (commit 75f9b83) because the wallet stays off until the Reserve Bank of Fiji approves it. No page loads the receipts widget now. The Sota Kece Plus pill (FJ$9.90 / 30 days, product sotakece-plus-30d) was briefly removed in the same commit, then put back (commit a7c31ea) after the owner approved it on 31 October. The pill is loaded on index.html only.

## 31 October 2026 — Activity: who reacted, replied, mentioned, asked, scrawled, answered

Sota Kece had every social action but no way to find out it happened to you. Migration `supabase/migrations/20261031210000_sota_activity.sql` adds `bulavata.notifications`, filled only by database triggers (reactions, comments incl. parent-reply and @mentions of friends, friend requests and acceptances, wall scrawls, event RSVPs). The writer skips self-actions, coalesces repeats (a changed reaction updates one row and re-surfaces it), and never writes to someone who could not already see the thing. Pattern from the socialens / Meadows feeds; written fresh.

- `bv_activity(lim)` newest first with the actor's handle and avatar; `bv_activity_unread()`; `bv_activity_read(ids|null)`. Row-level security: you read only your own; anon gets nothing.
- Accepting a friend request marks the request notification read for the person who had it.
- `sota-plus.js`: 🔔 Activity in the More panel with an unread badge (polled once a minute and when the tab becomes visible; silent if the function is not deployed yet), an Activity page that marks rows read on open, "mark all read", and a Room button per row. `sota-plus.css` styles; asset queries bumped to `20261031-activity-1`; shell cache v122.

Review hardening (same PR): `bulavata.notify`, `target_snippet` and the new `can_see_target_as` are revoked from public/anon/authenticated so only the triggers can write; a mention is delivered only when the mentioned friend could see the target themselves (close-friends moments stay closed); the three API functions are revoked from public as well as anon; the client marks read only the rows it loaded, never the whole inbox.

Verified locally on Postgres 16: `tests/social-plus-fixture.sql` → social-plus migration → this migration → `tests/activity-db.sql` (no forge/snippet privilege for app roles, mention on a close-only moment does not leak, partial read marks only the given ids, self-reaction not notified, re-reaction coalesced, stranger @mention ignored, parent author told once, read/unread counts, friend request → accepted, RSVP snippet, anon denied). `tests/activity.test.cjs` (4) and all 62 existing node tests pass. Not verified: hosted render while signed in. The migration is NOT applied to the live project — the owner applies it in the Supabase SQL editor.

## 31 October 2026 — Sota Kece Plus checkout (Stripe, live) + wallet receipts

Owner asked to connect Stripe. One line before `</body>` loads the shared Dimau buy widget (dimau-pay.js from the money engine) for product `sotakece-plus-30d` — FJ$9.90 for 30 days, already active in the engine. It shows a small pill bottom-right that opens the offer card; nothing else on the page changes. Wording is honest about what exists today: it is a supporter tier ("Plus perks land first for members") — no Plus-only feature is gated yet. Next: read the engine's entitlement (`pay?entitled=<session>`) after checkout and show a Plus badge; that needs the engine's entitlements migration run first.

The shared receipts widget (dimau-receipts.js — photo of an M-PAiSA / MyCash receipt, read on the device, parsed by the parse-receipt function, nothing stored server-side) rides along as a "+ Wallet receipts" button bottom-LEFT, so it does not sit on top of the Plus pill bottom-right.

## 31 October 2026 (later) — Koro messaging: vanish mode, broadcast Koro, replies, reactions, pin

Second batch from the feature spreadsheets, built after reading how SimpleX and XMTP do disappearing messages (expiry stamped per message from a per-conversation setting, a system line in the chat when it changes, a sweep that really deletes). Migration `supabase/migrations/20261031160000_sota_koro_messaging.sql` (needs the social-plus migration first) plus the Koro section of `sota-plus.js`:

- Vanish mode — the Koro owner sets off / 1 hour / 24 hours / 7 days; new messages get an expiry at send time, are hidden the moment they expire (read policy and the room function both check), and a pg_cron sweep deletes them for real every ten minutes.
- Broadcast Koro — only the owner posts (enforced in the insert policy); members react and reply. Switching either setting writes a system line into the chat.
- Replies (quote the message above), reactions on messages, a pinned message at the top, delete-for-everyone by author or owner.
- The room now reads one function (`bv_crew_messages2`) instead of two table reads; newest still at the top.

Verified locally: `tests/koro-messaging-db.sql` (owner/member/stranger). Existing node tests pass; the essential shell stays under 1 MB (the old per-message markup came out of index.html to keep it there). Phone-width render checked.

## 31 October 2026 — The social layer: reactions, replies, saved, stories, polls, events

Owner supplied two spreadsheets of standard social-platform features (X, Instagram, YouTube, TikTok, Facebook) and asked for them to be built into the apps that need them. Sota Kece is that app. Built in one migration (`supabase/migrations/20261031140000_sota_social_plus.sql`) plus `sota-plus.js` / `sota-plus.css`, wired into Moments and rooms:

- Reactions (six: Bula, Vinaka, Haha, Wow, Sad, Fire — unlimited, separate from the three-a-day Uro) on moments, wall scrawls, stories and replies, with "who reacted".
- Replies and threaded replies on moments and wall scrawls; author or post owner can remove one.
- Saved (private bookmarks) with a Saved page.
- Edit a moment for one hour after posting, five edits, earlier versions kept and viewable ("edited").
- Repost and Quote; the quoted moment shows inside, and disappears if its audience changes.
- Polls on moments (2–4 options, 1 day to 1 week).
- Close friends list; moments, stories and events can be "close friends only" — enforced in the moments read policy and every function, not just the screen.
- Stories (24 hours, image link or text) with a strip at the top of Moments, a viewer, seen state, view counts for the author, and "keep on my room" highlights shown on the room. Notes: one short 24-hour status under your name on the strip.
- Events with going / maybe / can't, hosted for friends, close friends or a Koro.
- Memories: "On this day" from the owner's own moments in earlier years.
- @mentions open the room; drafts save on the device; an 8-second Undo window before a moment posts.
- Still no algorithm: every list is newest first, friends only.

Verified locally on Postgres 16 with a three-person fixture (friend, close friend, stranger, anonymous): `tests/social-plus-fixture.sql` then the migration then `tests/social-plus-db.sql`. All existing node tests pass. The migration is NOT yet applied to dimau-core-sydney — the owner applies it (Supabase SQL editor or `supabase db push`) before merging; until then the Moments tab on the preview will show the retry message because `bv_moments_feed2` does not exist yet.

## 27 October 2026 — Apply the supplied chrome glass button design throughout Sota Kece

The owner rejected the faint outline discs and remaining word buttons. The supplied reference is a domed glass control with reflective chrome edges, curved highlights, vivid action colours and bold dark symbols. Apply this material to all action controls in the main app, communications, calls, install prompt and companion; keep song, person, graph and skin content names readable within their existing controls. Connection-category links gain distinct subject symbols. Artwork detail links keep their whole-image hit areas and gain glass symbol markers. A one-colour design still colours the controls consistently, while Mix & match uses distinct action hues. Legacy layered header paint must not override the new material. The stationary music centre and rotating outer ring retain their existing geometry.

Preview, responsive browser evidence, exact checks and production receipt belong to the scoped release PR. No private-account write, actual call, microphone/camera permission or Ops checkpoint is pre-claimed.

## 26 October 2026 — Music visuals active by default and reachable close controls

Owner asks every music visualiser to show motion before a track starts and for top-right close controls that stay reachable on long panels. The large landing/music stage, artwork waveform and shared native player now animate a labelled ambient preview by default, without playing music or opening an idle audio context. Real analysed audio takes priority during playback. Explicit Pause, reduced motion, hidden pages, offscreen panels and modal visibility retain their controls; recording still requires actual playing audio.

Detail routes and main panels have top-right X links; the route exit remains visible while scrolling and returns Home at the document top. Existing portal headers stay sticky with their real X controls. The inline playlist X returns to Visualiser without recreating or pausing audio; local music, circle and Talanoa exits use their existing close/back handlers. The shared visualiser has a fullscreen exit cross. No account, database or storage-policy changes. The owner then supplied button references and asked for small see-through symbols instead of words: opted-in action controls use original SVG symbols, translucent circular rims, hover/focus descriptions and retained accessible names. Existing artwork/music badge layers, song titles, graph names and skin content are preserved. Back destinations remain explicit and existing DOM state/history are retained, following the supplied Back Button UX article (https://smart-interface-design-patterns.com/articles/back-button-ux/).

Source tests and exact hosted checks are recorded in the scoped release PR. No private account write or real call is pre-claimed. Next: confirm the exact production visuals and close controls at desktop and phone widths.

## 26 October 2026 — Visual front, separate details and personal page designs

Owner asks for a mostly visual front screen where each visual opens a detailed page, a colourful site including sign-in/photo editing, and simple controls for personal expression on every page. The supplied galaxy now sits behind the actual WebGL connection map. Music photography follows the landing artwork; the live visualiser and colourful inline playlist are alternate layouts in the same music page and retain the single audio owner. The centre music note stays still; only its outer Fiji ring rotates at 2.4 seconds.

Home is a visual gallery with native detail routes for music, 3D connections, Connect, Talanoa, skins and profile. Account/share/search words move to Connect. DOM owners for music, graph, forms and photos are preserved on route changes. All pages gain a compact Design your space control in navigation. One colour applies a consistent colour style across the site with one tap and Undo; Mix & match provides page-specific colour moods and a preview, with custom colours, uploaded background and layout controls under More options. Account and photo dialogs have their own design shortcut. Saved page preferences and images are owner-scoped on this device, with an All pages default. These preferences are not claimed as cross-device profile publishing. Existing account-saved room skins and photo editing retain their established backend. No database, private-storage policy or schema changes.

Source tests and exact candidate/production browser evidence belong to the current scoped GitHub release. Authenticated Ops checkpoint operations remain unavailable; no checkpoint or remote two-account write is claimed. Next: verify the exact production revision and use Design your space to customise a page.

## 26 October 2026 — Live shared public music catalogue

The existing Sota native playlist now reads the validated central public catalogue on opening. A valid central or saved catalogue is authoritative; the known82 local JSON remains a cold-failure fallback. Refresh preserves the selected stable ID, existing audio element and current playback position. Explicit song selection uses the current validated public mapping, with no duplicate default soundtrack or automatic playback. Existing playback coordination, local uploads, hero visualiser, badge, personal rooms and private data behavior are preserved.

The byte-identical shared catalogue core is a local on-demand shell asset. Seven actual-source DOM/core regression cases and the existing playlist/playback suites pass locally. The release pipeline verifies the full app and hosted media behavior. No Supabase database, bucket, access policy or audio object changes.

## 26 October 2026 — Stop the home page jumping while it loads

Owner asked to fix Sota Kece's layout jumping (“Do it”). Fiji Analytics showed a layout shift of 0.42–0.92 on many loads (p75 about 0.5), mostly on repeat visits. Cause: the shared Dimau Companion element is appended to the page before its own stylesheet loads, so for a moment it sits in the normal page flow (full width, about 130px tall) and then jumps to its fixed corner. It is visible, and counted, whenever the room has not drawn yet (signed-in members, slow phones). Fix: a host-page rule keeps `dimau-companion` fixed, zero-sized and clipped until the companion's own `:host` rules (which are `!important`) take over, so the final render is unchanged. The shared companion files stay byte-identical. Applied to `index.html` and `communications.html`; public shell cache advanced to v83.

Validation: local Chromium with a mocked signed-in session shows CLS 0.18–0.20 before and 0–0.014 after at 390/768/1366/1920; signed-out stays about 0. Full-page screenshots at 390 and 1366 match main (signed-in differences equal run-to-run animation noise). `node --test tests/*.test.cjs`: 219 pass, 0 fail, the same as main. Ops task #806.

## 25 October 2026 — App companion installation

Owner resumed the portfolio companion rollout with “do it”. Added byte-identical original Dimau Companion v1.0.1 assets and app-specific entry points from the shared platform standard. Local task guides, movable characters, appearance settings and read-aloud are available without a model provider. No account, payment, private-record or provider access is added. Open-ended AI remains disconnected unless a host explicitly supplies its existing service; held assistant pilots remain unchanged.

Validation: shared package's 12 tests pass; entry changes preserve original source outside the loader insertion. Host build/deployment and rendered results are tracked on this change's GitHub revision, not claimed by this source entry. Direct GitHub/Vercel execution is authorised by the current owner request; authenticated Ops memory, continuity, task and checkpoint operations remain unavailable, so no such receipts are claimed. Existing unrelated revision branches and holds are preserved. Next: verify the exact hosted companion and record the actual result.

## 2026-10-25 — Shared Koro communications workspace

Owner requests calling, chat, groups and boards across the apps. Add `/communications.html` as the shared Sota Kece workspace, reusing its existing account session and invite-only Koro backend without schema or permission changes. Persistent chat, discussions/replies and collaborative task cards use strict versioned events in existing crew messages. Video/audio invitations open the external Jitsi service only after a user chooses the explicit link; the Calls panel discloses that anyone with its link may join and recommends a host lobby. No native private-call service is claimed. Existing Koro controls and plain messages remain, with escaped summaries for structured events. Public shell cache gains only the parser asset and a version refresh; private data stays out of browser/offline storage.

Seven core regressions, JavaScript syntax checks, CSS parsing and SDK-mocked DOM checks pass. Independent review reproduced/fixed stale auth/group operations, transient-profile render recovery, pending-save failure recovery, card cancel and launcher views. No live two-account database write, RLS execution, real call media, hosted preview or production result is pre-claimed. Exact candidate/deployment checks belong to the scoped PR. Source, behavior and limits: `docs/COMMUNICATIONS_2026-10-25.md`. Existing unrelated saved revisions and publication holds remain. Next: verify the exact hosted candidate and use the existing checked release route within owner authorization.

## 2026-10-25 — Verify identity skins and repair phone title clipping

Owner asks to complete the rebuilt collections. Check the current canonical live release, preserving the photographic design, six collection entries, 94 skin IDs, 73 listening references and the shared music visualiser. Browser checks confirmed the RKS school recording plays at its published YouTube source; the native 81-track player streams its first track with advancing time and no media error; the chosen RKS skin and soundtrack survive a signed-out browser reload; all six music-community cards show their attributed song reference. Signed-in profile persistence remains untested because no account session is available.

At 390px the inherited two-and-a-half-line thumbnail title limit clips long school names. Remove that old height limit for the photographic title, keeping the existing artwork, card dimensions, wrapping, controls, account/storage and song behavior. Version the stylesheet URL and public shell cache. Exact candidate/release and visual checks are recorded in the scoped PR; do not claim release before verification.

## 2026-10-25 — Shared audio-reactive music visuals (review revision)

Owner asks to research the first ten music visualiser search pages and build selected features into Sota Kece, the shared player, Sere and Dimau Studios. Add an original shared Canvas/Web Audio engine: spectrum with peak caps, waveform, halo, layered ocean waves; four palettes; intensity; fullscreen; gesture-only activation; low-data, visibility and reduced-motion controls. Studios/Sere include bounded audio-backed WebM capture, and Sere reuses the same source for lyric-video export. Current artwork, songs/catalogue, source credits, accounts/storage and unrelated saved revisions are preserved. Public Maps exposes this as an optional disclosure within music, keeping its ordinary interface simple.

Source/implementation, 100-result screening, actual checks and limitations: `docs/MUSIC_VISUALISERS_2026-10-25.md`. Focused media-graph checks and real local Chromium playback/export/390px checks pass. Exact remote CI and preview receipts belong to the current scoped PR; no production publication or authenticated Ops receipt is pre-claimed. Existing review holds remain. Next: finish exact-head hosted checks and review the working candidate.

## 2026-10-25 — Owner rejects bare/cartoon collection treatment

Owner asks for a more accomplished design after the collection browser was published. Resume canonical 9b4c96460a747770dfd18458524f4dec0549b06d. Replace flat vector cover presentation with original photographic mood artwork and a restrained editorial interface: sixteen generated scenes, six full-image collection entries, stronger community titles, less rounded typography, no miniature placeholder profile skeletons, and a cleaner studio. The old 30-tile emoji collage is replaced by eight real photographic room previews. All eight school skins have distinct photographic still lifes. Ra's rooster, Nadroga's horse and the childhood dalo-garden identity have dedicated photographic motifs. Existing Ocean, Coral Sunset and Brokenhearted photographic covers remain in use.

All 94 IDs, custom words, colours, song associations and saved settings are preserved. The old original vectors stay in the repository. New cover resolution is a separate local module, used by profile/chat tokens and thumbnails without rewriting identity metadata. The owner's supplied public hero, logos and blue pattern remain unchanged. The new photography is original illustrative mood art, not documentary imagery of a school, an artist portrait or official institutional branding. Generation briefs and source PNG names are in docs/editorial-artwork.md; original generation outputs are preserved.

New WebP files are fetched only when used. They are excluded from install-time shell caching and added to the narrowly scoped public-image allowlist. No new UI runtime, external image host, audio source, database or access-control change. Real visual preview and production receipts belong to the current PR.

## 2026-10-25 — Apply the design research to community discovery

Owner accepted the design-search recommendation to apply it to Sota Kece first. Resume verified published main 519d02201a6d0f843d12fc3ecb6659b8ae0ac1d3 in donovandimau/bulavata, Vercel project sotakece. The separate sota-kece React demo is not the production source.

Add six image-led community collections below the existing room entry: School pride (8), Vanua & islands (22), The music crowd (6), Masi & culture (13), Life & memories (18), and Fresh looks (4). Counts come from actual available presets. All 94 skins remain accessible, with 12 varied discovery picks and direct collection entry from the homepage and studio. Search now includes existing identity labels, attributed artists and song titles as well as skin names. Collection entry previews an appropriate identity while preserving saved personal words, media, interests and layout until the user chooses to save.

Use existing original artwork and local fonts. School previews put the friend community first; music previews put soundtracks before the conversation; heritage rooms use a centred profile and editorial stack; place covers have more space. Published profiles derive their matching presentation from the existing skin ID. Saved v1 settings, all 73 song references, the central 81-song playlist, authentication, data permissions, supplied homepage artwork and previous revisions remain unchanged. No third-party logo, brand font, recording or UI runtime was copied. New JS/CSS are included in the public-only shell; artwork remains lazy-loaded.

Verification and exact release receipts belong in the current PR. Browser control reported that the originating browser context is unavailable in this turn, so do not claim visual desktop/mobile or signed-in browser verification. Continue source, DOM-fixture and GitHub/Vercel verification through available tools. No Ops memory, lease or continuity receipt is fabricated.

## 2026-10-25 — Owner correction: redo the identity collections

Owner rejected the colour-dot studio and screenshot defects, then asked to redo all school/group collections and associated music. Resume canonical published 3bce793c6c73c796551f68aff090b7af67385318. Preserve the 88 existing skin IDs, profile/account behavior, native music catalogue, supplied public homepage and original assets.

Replace palette-only cards with visual room thumbnails, search and a collection selector. Collapse optional custom controls. Use one themed cover instead of a wrapping scene title followed by the same group photograph. The revised studio has bounded scrolling and a footer outside the preview. Rebuild artwork across the available collection: 89 new original vector covers plus the new photographic/retro covers; all 94 available skins receive identity metadata, including eight school skins and six additional named music communities. FNU/USP palettes use institution references; other school designs are community supporter treatments rather than certified official branding or copied crests. Primary school/alumni references and limits are in docs/skin-identities-20261025.json.

Keep 73 attributed song associations visible and allow a chosen reference to save in the existing versioned profile settings. Listening stays on the published source; native owned/direct-audio tracks continue to work. No recording downloads, autoplay or invented institutional anthem. Unknown song IDs are rejected. The 222-concept historical research catalogue is preserved; this revision does not claim every school in Fiji is available.

The screenshot's Brokenhearted mid-word title, duplicate cover, palette-only cards, repeated generic cover and encoded waveform are addressed in the new rendering. Existing private schemas/policies, social reads/sends, account logic and 81-song central playlist are unchanged. New art is lazy-loaded; the public-only worker allowlist includes the new static files.

Verification and exact preview/production receipts are recorded in the current PR after hosted checks. Ops browser access is verified; authenticated memory/lease tools remain unavailable in this executor as previously recorded. Continue via connected GitHub/Vercel tools under the 24 October owner standing order; no fabricated memory/lease receipts.

## 2026-10-25 — Shared profile and chat skins

Owner requested the proposed Ocean, Masi, Coral Sunset and Bebo Retro skins. The canonical live app is donovandimau/bulavata at ec95a9eac7c5cc3a6c8339d461028f1693561370 (sotakece.com), confirmed by Ops Projects and Vercel project sotakece. The separate donovandimau/sota-kece React demo is not the production source and was not changed.

Append four original palette presets without reordering the existing 84 saved IDs. New picks opens first in the existing studio; all prior categories remain available. Add Profile and Chat previews, with clearly fictional messages and a disabled sample composer. Each member's saved room skin now styles their existing Koro message bubbles, background, font, corners and controls. Incoming/outgoing text colours meet 4.5:1 contrast across all 88 presets and tested custom palettes. Route changes remove the previous chat palette. Existing profile save, social reads/sends, music, supplied artwork, privacy rules and backend remain unchanged. Version the three changed shell assets and public worker cache.

Verification: node --test tests/*.test.cjs passes all 26 reported test entries, including existing social, upload, playback, offline and save-recovery suites, plus new profile/chat round-trip, contrast, escaping and palette lifecycle checks. Browser preview validation and deployment receipts belong to the current PR.

Ops browser access and current card were verified. Authenticated memory.start failed because DIMAU_OPS_KEY is not configured for this executor; no task lease, memory or continuity receipt is claimed. Continue through connected GitHub/Vercel tools under Donovan's 24 October standing order that missing Ops access must not stop implementation. No raw merge or direct production push; use the existing checked publishing flow after review.

## 2026-10-21 — Supplied blue-and-white page background

Replace only the public page and masthead background pattern with Donovan's attached blue-and-white PNG, preserved byte-for-byte. Keep existing 420px repeat size, original sunset artwork, glass panels, typography, controls, personal room skins and newly published island playlist unchanged. Advance both changed stylesheet URLs and the public shell cache; cache the new public image. Resumed canonical d6a180fce44d2334d6ff6e6f2bca28765c91cb7c. Publication HOLD: show the verified preview for explicit owner review.

## 2026-10-21 — Island music player visual refresh

Owner asked to make the phone music playlist more visually entertaining. Refresh only the native playlist dialog: island-night gradients, subtle reuse of the supplied blue masi, a CSS vinyl record, playback-linked decorative motion, mint primary Play/Pause control, clearer track cards and coloured queue numbers. Motion stops on pause and respects reduced motion; forced colours, focus outlines, native seeking/volume and 44px targets remain available. Preserve the exact 81-song catalogue, audio origin/order, search, previous/next, auto-advance, close/reopen playback and surrounding page design. Playlist asset URLs and public shell cache advanced. Canonical main 1bacd89cec764ce4793aad9a193c67cfc66a3521 is the parent. Publication HOLD pending explicit owner review; this request does not authorize publishing.

## 2026-10-21 — Dimau logo Home links

Donovan confirmed every Dimau logo should return to its own app Home page. Existing logo placements now use accessible local Home links; external owner-site destinations and new-tab behavior are removed where applicable. Existing native Home actions are retained. This scoped revision preserves saved designs, original image markup/assets, inline styles, content, authentication and data behavior. All changed inline scripts and JSX parse; image tags and inline style blocks compare unchanged. Canonical hosted checks and actual link navigation verification are recorded in Ops. Publication HOLD pending explicit owner approval.

# Sota Kece — 20 October 2026

Current requested step: consistent native header logo/title row on phone and desktop.

Canonical base: abe59ef8024fa7c35d21c2c05296dfc51723c6e5. The 64px row,36px contained Dimau mark,48px music target,44px flag/16px note and supplied artwork were already shared. The title changed Fredoka/Nunito and mark corners changed8px/4px at responsive breakpoints. Use Nunito800 at18px/24px for the native brand at every width, retain8px corners, and give the decorated48px logo tile an8px clear gap before its title. Other type/room/artwork rules stay intact. Version the changed stylesheet and public shell cache.

No markup/JS actions, music/social/auth handlers, image/SVG bytes or artwork cropping changed. The secondary Sota brand/navigation inside the supplied picture remains part of that original image. Ops desktop/phone previews use different display scales; physical screenshot pixels are not CSS dimensions.

Publication HOLD: show the verified revision and wait for Donovan's explicit approval. Prior approval of earlier revisions does not approve this one.

## Current owner follow-up — cover the dead headings

The owner supplied desktop/phone crops and asked to bring the Dimau heading row over the dead headings in the main panel. The live64px row now overlaps the picture with an opaque background. Responsive image offsets align source y144 (desktop1360wide) and y220 (phone1008wide) with the live row bottom, hiding the baked Dimau and Sota/navigation headings while keeping the real title/music row and main headline. Supplied image bytes remain original; only their display offset changes. Native functions, handlers and prior verified row/logo/font proportions remain unchanged. CSS and shell cache versions advanced. Continue the saved d4957ba9 candidate on the new leased branch; the earlier sizing revision remains recoverable history. Publication HOLD continues pending explicit approval.

## Current owner follow-up — entrance buttons light up

Only the three real Get started buttons below the supplied artwork gain a shared soft cyan resting glow and stronger hover/focus-visible/active lighting. Keyboard focus has an explicit outline;reduced motion removes transitions;forced colors retains a visible system border/focus. Existing layouts,labels,actions,header-cover offsets and image bytes stay unchanged. Front-page stylesheet/shell cache versions advanced. Continue saved a4b2f5d3 as parent on the current leased branch. Publication HOLD remains pending explicit owner approval.

## Current owner follow-up — supplied pattern inside Sota Kece lettering

Owner clarified that the supplied blue pattern belongs inside the fonts, specifically the top Sota Kece heading. A large pattern-filled Sota Kece wordmark now replaces the first heading position; the existing compact logo/title/music row moves directly below it, keeping all native links and controls. The pattern PNG is copied unchanged from the supplied attachment. The pattern is clipped to text, with a plain-color fallback and system-color fallback. Existing artwork crop/header cover, button lighting, personal rooms and action handlers remain intact. Styles/script/public shell cache versions advanced. Saved c2ad9786 remains the parent. Preview HOLD continues for owner approval before publication.

## Current owner follow-up — new supplied Sota Kece logo

Use the supplied purple logo with blue/yellow/red figures in original colours. Only the separate Sota Kece masthead letters retain the blue masi pattern. Existing compact heading/music row and every other heading remain below in unchanged styles. The supplied PNG is preserved byte-for-byte as sota-kece-logo-20261020.png; a square SVG viewport embeds that original PNG unchanged and excludes only its broad empty side margins when displayed. Use that square wrapper for Sota product marks, browser icon and manifest; Apple touch references the original PNG. Existing prior logo assets and the shared Dimau Group logo remain preserved. Original PNG letters and figures are not patterned or redrawn. Script and public shell cache versions advanced;public new logo cached. No CSS,main artwork or handlers changed. Parent dd196842 retained. Publication HOLD for owner approval continues.

## Owner correction during current step — retain Dimau and remove duplicate title

Donovan explicitly corrected the top compact row: leave the Dimau logo and remove the duplicate heading beside it. Restored the original Dimau mark in that row and removed only its small Sota Kece text span. The home link keeps its accessible Sota Kece home label;music control and row remain. The single large patterned Sota Kece masthead stays above. The new supplied Sota logo is used for the product mark below and the browser/manifest/Apple icons, not as a replacement for Dimau. No other headings gain a pattern or style change. Script and worker cache versions advanced. Prior note proposing to replace the top Dimau mark is superseded by this explicit correction. HOLD continues.

## Final owner clarification — pattern on background, Dimau moved up, no duplicate heading

Latest explicit instruction supersedes the patterned-font request: take the pattern out of the fonts and use it as the background. The blue supplied pattern now fills the top header background. Sota Kece is solid white text with a readable shadow. The original Dimau logo is moved into that same top row;the duplicate small Sota Kece heading beside it is removed. The existing music control shares the row. The empty second brand row is eliminated. Responsive display cropping keeps the old baked artwork branding hidden as before;main supplied artwork bytes and every other heading style stay intact below. The new purple Sota product/app logo remains original colours below and in browser/manifest icons. No pattern is applied to either logo or any font. Style/script/worker cache versions advanced. Exact supplied pattern/logo bytes and action handlers retained. HOLD continues for owner preview approval.

## Current owner follow-up — music up into top-right

Only the existing header music button now aligns to the start of its grid cell. This puts its48px target at the header8px top inset and keeps its12px right inset,without resizing,replacing or duplicating it. Header pattern,solid title,Dimau position,logo assets,other headings,artwork cropping and all actions stay unchanged. CSS and public shell cache versions advanced. Parent032c9b9c retained;publication HOLD for owner preview approval continues.

## Current owner step — replace green Kava symbol, remove duplicate entrance strip

Owner clarified target with a screenshot:the new Sota Kece logo replaces the green symbol in the Kava Circle section farther down,not the large white title or the logo above people search. The supplied logo now occupies that existing Kava symbol frame;the redundant separate product-logo image above search is removed. Roots tagline remains in a compact line. The duplicate below-hero Create your space button strip is removed. Its original sign-up action now sits as an accessible44px-minimum transparent button over the existing pictured CTA,so the picture shows one working entrance button. Existing Room studio and Sign in buttons/IDs are relocated compactly alongside the people-search area (one row below search on phones);existing handlers and account/studio dialogs retained. Shared Dimau,patterned header,solid title,top-right music,main image bytes and display crop remain unchanged. Front stylesheet,script and public worker cache versions advanced. Parent6a73ee78 retained. Publication HOLD for owner preview approval continues.


## Current owner follow-up — header music connects to Supabase playlist

Connect only the existing top-right music button to a native accessible playlist dialog. Reuse the current Fiji 3D Maps catalogue:81 tracks in its existing order/titles,streamed directly from the existing public fiji-audio bucket in Supabase project xnxmumbvgtmlpenutlii. The historical82-track count is superseded by the actual current81-entry source. No audio bytes copied,no new storage or database/access changes,no private Music Hub drafts exposed. Header button now opens the playlist rather than playing the generated sample. Search,track selection,native audio controls,Play/Pause and Previous/Next are available;ending advances the queue. Closing the dialog keeps music playing and restores focus;reopening retains selection. Nothing plays or downloads audio until the listener chooses Play or a song. Playlist pauses when another local/sample/audio player starts. Current header48px button position/artwork and all layout/logo/entrance changes remain exact;other sample/upload/profile functions retained. Module validates catalogue paths against a fixed public audio origin;error messages/retry support network failure. Shell/script caches advanced. Parent ebb2bdc8 retained;publication HOLD for owner preview approval continues.


## Current owner follow-up — blue pattern across public background

Extend the already supplied blue header pattern to the full public landing-page backdrop,including outer gutters,the area below the sunset artwork,the search/control area,gaps between content and the footer. Reuse the original pattern asset at the same420px repeat size;add a navy tint for readable supporting text. The neon wrapper and artwork wrapper are transparent so they no longer show a separate dark/purple/teal background. Remove the separate brown masi decorations above the classic content and below its footer by suppressing those two pseudo-elements,including their occupied height/margins. Original brown masi artwork asset and all imagery remain preserved. No changes to the supplied sunset/picture border,header/logo/music positions,solid title,compact entrance,personal room designs,account/studio/playlist logic or playlist assets. Front stylesheet and public worker cache versions advanced. Parent910c1bc3 retained;publication HOLD for owner preview approval continues.

Supporting search/tagline,collage and footer captions use white text with a small navy shadow so the new patterned background retains at least6.2:1 theoretical white-text contrast even over a pure-white source pixel after the68%navy tint. Font sizes,layout and interactive handlers remain intact.


### Latest owner correction — original light blue pattern and brighter panels

The explicit follow-up supersedes the dark tint/white-caption contrast note above. Keep the pattern in its original light blue colours,matching the top header:remove the68%navy overlay entirely. The public social/Kava panel,room-entry panel and navigation backgrounds are now transparent so the same continuous blue pattern fills their formerly dark empty areas as well as outer gutters,search and footer. Remove the lower social star/grid pseudo backgrounds too. Use stronger navy-edged cyan text glow and brighter cyan/white panel outlines/shadows to highlight words and panel edges over the original pattern. Preserve heading colours,fonts,all layouts,original artwork/assets,logo/music positions,account/studio behavior and81-song Supabase playlist. No image colour edits,global dark tint or new artwork. Brown top/footer strips remain removed. Current task619 lease9/PR122 continues;intermediate c27ff78d retained as superseded history. HOLD for owner preview approval continues.


### Latest owner direction — Fiji History glass panels for readable words

Adopt the supplied Fiji History panel reference so words are readable over the original light-blue pattern. This supersedes the transparent-panel/glow-only lettering approach above. Reuse History's current blue-glass design tokens:rgba(238,248,255,.9) dense pale glass,#0b2540 ink,#075b94 links,12px blur/saturation,1.5px#1e90ff borders,6px/26px alternating rounded corners and blue edge/inset glow. Apply to Sota's search/control header,navigation,community/Kava panel,room entry,collage captions and footer,with sensible insets and no blurred body text. The original blue pattern remains unchanged and undimmed in surrounding spaces. Headings use a subtle highlight;regular copy is crisp dark navy. Search input and existing Room/Sign in buttons get matching readable foregrounds. Sunset/music photos,collage tiles,supplied logos,top header and81-song Supabase playlist remain untouched. CSS only plus stylesheet/worker cache versions and this source record. References read from current canonical History src/app/dimau-blue-glass.css(blob028b491c) and src/ui/visitor-experience.module.css(blob85ec9e70);no History project changes. Reduced-transparency/forced-colour fallbacks included. Task619 lease9/PR122 continues;5a11d540 retained as superseded history. HOLD for owner preview approval.


## Current owner correction — transparency shows the beautiful pattern through panels

Owner explicitly rejected the plain-looking90%opaque pale panels and asks for the Fiji History reference transparency,with more visible fonts. Set the public glass fill to History's rgba(240,248,255,.42),so58%of the original blue pattern remains visible through every panel. Reduce backdrop blur from12px to1px to preserve pattern detail rather than a plain colour wash. Original pattern asset,colour and420px repeat remain unchanged. Strengthen body copy to16px/700 and captions to13px/700,with800-weight navigation/headings/links and a crisp1px pale edge around navy words. This makes the lettering stand apart without putting opaque slabs over the background. Existing card shapes,blue borders/glow,spacing,photos,logos,top header/music geometry,account/studio/playlist handlers and Supabase catalogue remain unchanged. Input/utility-control surfaces stay readable. Reduced-transparency preference still has a solid fallback. Prior11.52:1panel contrast calculation belongs to the superseded90%fill and must not be reused for this transparent revision;visual readability is verified on the actual patterned background. CSS,stylesheet/worker cache versions and this record only. Parentc7dcd469 retained;publication HOLD for owner preview approval continues.


## Current owner steering — orange light-ups

Owner asked to replace blue light-ups with orange. Panel outlines/rest/hover glows,media-panel borders,real entrance-control glows and header icon lighting now use warm orange #ff8a24 with peach highlights. Retain42%glass/1pxblur,original blue pattern420pxrepeat,navy readable words,pale word edge,layout,all original image colours and playlist handlers. No orange/red font experiment or extra bullets added. Header lighting CSS is local to Sota;Fiji History source remains untouched. CSS/cache versions and record only. Explicit publication HOLD continues.


## Current owner step — bigger desktop type and colourful readable action pills

Desktop native copy grows to20/21px,buttons20px,labels18px,captions17px,main heading46px,section headings40px,masthead96–108px. Supporting dialogs/studio controls grow too. Real action labels remain opaque navy and wrap on small widths;Open the skin studio is on its own row below the description. Small translucent action pills use peach,pink,gold,aqua,violet and lime tints with matching coloured dot markers.42%glass/1pxblur panels and blue pattern unchanged. White lettering halos and hot-white hover rings are replaced by warm orange. Original supplied raster design remains exact;all JS/playlist behaviour retained. Phone font sizes retained. CSS/cache/record only. HOLD for review.


## Current owner step — shared link preview uses the new logo

OG/Twitter metadata still referenced14Octoberoldlogo/masi artwork. Reuse the approved supplied20OctoberPNG unchanged as the social share image,with its actual1792x1008dimensions and newlogo alt. Secure-image and Twitter-image URLs agree;canonical/title/description unchanged. No new images or pageUI/handler/style changes. Bump public shell cache so installed app refreshesHTML. Prior14Octoberassets preserved. Canonicalbase64d70458;HOLD for ownerreview before publication.


## Current owner step — aligned responsive header controls

Native Dimau mark and music control now share the vertical centre of the patterned masthead. Remove prior music align-self:start,centre both in equal grid tracks and remove brand padding offset. Desktop controls60pxwith48pxcontained mark;mobile controls48pxwith36pxmark. Original12pxedge spacing,white title,blue pattern,orange light-up/artwork,playlist/accountfunctions and pending new-logo share-previewmetadata retained. OnlyheaderCSS,stylesheet/worker cacheversions and recordchange. Base d6a9d214preserved;HOLD forownerreview.


## Current owner step — blue patterned share-image bands

New square social image fills the thumbnail top and bottom with supplied blue masi pattern, around the new Sota logo on its cream centre strip. Imagegen built-in compositing output; original logo/pattern assets preserved. OG/Twitter image references, actual dimensions and alt agree; public shell cache advanced. Saved responsive header alignment retained. No site layout, style, script, app icon or playlist changes. Base5015233a;HOLD for owner review.

The social image uses its immutable public Vercel asset URL so the held revision and later published page both resolve the actual PNG before/after promotion. Canonical page URL stays sotakece.com. No production write.


## 21 October 2026 — People and Koro connections

Connections view reachable from Friends and Koro. Caller-scoped accepted friends / own Koro RPCs, plus memberships constrained to those friend and Koro IDs. No strangers, friends-of-friends, public discovery, messages, join codes or database policy changes. Read-only graph with search, filters, selection details, neighbour focus, pan/zoom/reset and equivalent keyboard list. Current refresh snapshot, partial/error/empty states; no social data saved in browser storage or shell cache. Fictional signed-out example clearly labelled. Prior header, artwork, playlist and patterned share thumbnail preserved from7668280f. Working preview HOLD for owner review.


##21October2026 —Publish connection map as an example

Owner explicitly requested publication as an example. Public home label Connections example;Friends/Koro graph entry points also show the same fictional map. Real graph loader is preserved but unrouted pending account verification. Example links work before auth,Back returns to normal boot,and notice/footer make clear no real members are loaded. Existing artwork/header/music/share revision retained. Publication authorised for this example;no live social records or policies changed.

## Current owner step — tidy header proportions (21 October 2026)

Resumed exact published source d259e4ac76961583b63521871e0564dd053ea341. Tidy only the masthead shown in the owner's screenshot: cap the solid-white title at64px on desktop with a104px row,24px side gutters and16px gaps. Phone title is28–40px with an80px row,16px side gutters and8px gaps. Keep the saved shared centre line,60px desktop/48px phone controls and48px desktop/36px phone Dimau image. Original blue pattern,orange lighting,all supplied artwork,cropping,Connections example,playlist,account and other page styling/handlers stay intact. Stylesheet/public shell cache versions advanced so older cached header styling refreshes. Task652 lease1;assigned branch agent/codex/tidy-sota-kece-header-proportions-and-spacing/1. Publication HOLD for owner review and explicit approval.

Existing Connections integration check now accepts the versioned public-shell cache name rather than hard-coding v47; it still requires Connections in the cached app shell. The cache refresh for this header therefore no longer fails an unrelated exact-version assertion. All five existing regression suites pass locally.

##23October2026 —Dimau Visuals connections at the bottom (review candidate)

Resume registered2bf0e77d49f4fb6afc99195d29d197d23c6dd662. Owner asks to add
Dimau Visuals for people/group connections,and explicitly says place it at the
bottom of Sota Kece. Add one home/Pulse section below existing content,move the
home-nav example entry there,and offer personal-map/example actions. Keep the
current header/background/artwork/84skins/music/account functions. Reuse existing
Sota graph with a local Dimau Visuals mark and static external tool link;no member
graph transfer. Personal map uses validated current account,existing accepted
friend/Koro RPCs,exact-handle UUID compatibility and scoped membership reads.
Logout/account change/route ownership clear pending/private graphs. Existing
public fictional example remains independent. No DB/policy/data changes. Public
shell cachev51 refreshes only static assets. Task709lease1;working preview HOLD
for owner review;actual member-session validation requires signing in.


24October2026 — Dimau Visuals chart component integration
Portable Dimau Visuals core/SDK/CSS,served locally with no data network requests. Sota visible connection counts track existing map filters and lifecycle;no new member-data reads.




## 2026-10-26 — Complete shared Supabase music playlist

The actual Maps and Navigate built-in queues contain82 public tracks: their81 imported songs plus the separately prepended default soundtrack. Sota Kece previously included only the81 imported songs. Added the existing Laffy Taffy - Raxz Tunez Mokubasi Remix 2k23 default with stable ID fiji-default-soundtrack-v1 and unchanged fiji-default-soundtrack.mp3 object, bringing the selectable Sota list into the same order as both apps. Existing81 IDs, titles, order and paths retained after it.

Validation permits exactly this additional filename while retaining the fixed public fiji-audio origin and rejection of query strings, fragments, arbitrary hosts, paths and duplicate IDs. Playlist fetch/module/public-shell cache versions advanced. Existing playback controls, real visualiser, user-gesture playback, local uploads and private Music Hub drafts are unchanged. No audio bytes copied and no Supabase database, bucket or permission changes. All82 known public objects verified reachable; no claim that an authenticated storage-wide inventory was available. Connector only exposes SEMA, CLI lacks a token and the dashboard needs sign-in; public listing returned no visible rows. All known shared public music in current canonical Maps/Navigate sources is covered.

## 26 October 2026 — Life connections and colourful welcome

Owner requested a colourful live graph of the people, pets and all living connections in a person's life, alongside a brighter welcome/share/search section. Original hero artwork, logo, wallpaper, account/share/search hooks and existing accepted-friend authentication stay intact. Native life map includes Friends, Family, Teachers, Workmates, School mates, Dog, Cat, Other pets, Nature and Other connections, with custom roles, search and add/edit/remove. Category hubs are relationship options, not invented personal records. Device additions are explicitly saved in this browser, partitioned between guest and account; accepted friends are refreshed through the existing identity-validated feed every15seconds and are never inferred to be family or colleagues. Logout/auth expiry clears the current map. This does not introduce cross-device synchronisation.

Owner's final icon direction is authoritative: the central note remains stationary while only the Fiji flag circle rotates faster (2.4seconds). The separate icon correction shipped in PR229. Subsequent front-page visualiser request adds an original prominent rainbow audio-reactive stage using the existing analyser and player, with no copying of the supplied stock reference.

## 26 October 2026 — Owner correction: real 3D and fewer account prompts

Owner rejected the illustrated flat life map. Replace it with a native WebGL 3D network: lit sphere meshes, perspective depth, orbit dragging, zoom/reset and projected labels. You and connection categories remain the initial schematic network; personal nodes/edges are added only from actual entered connections and accepted friendships. No fabricated friends or inferred family/work relationships. Preserve the existing device/account storage partition and editing tools. Accessible connection list and category selector remain available when WebGL cannot run. Remove cartoon icons and duplicate map intro. Keep just the main public Sign up/Sign in pair; guest Talanoa/Top Mates use concise descriptions, and the graph no longer repeats a sign-in button. Expired-session recovery stays available. The published rainbow music stage and stationary centre note/faster outer ring stay intact.

## 26 October 2026 — Live profile and cover photo editing

Make the supplied artwork's Edit profile control a real button aligned to its desktop/phone position. Separate circular profile and rectangular banner photo pickers provide decoded image previews, explicit Save/Cancel and JPG/PNG/WebP signature/size checks. Guest photos are device-local IndexedDB blobs. Member photo uploads use the existing private bv-room-media covers namespace; avatarPath and coverPath are stored inside existing versioned room settings. Save merges the latest server settings with a guarded comparison and preserves unrelated skin/custom CSS. Existing owner/friend policies are retained; no new database columns, public bucket or privileged credentials. Own rooms expose the same editor and render permitted signed photo URLs. Authentication changes cancel the editor and clear old media. The existing split music badge already keeps its centre upright and static while its flag circle rotates; the old open tab was refreshed to show that deployed correction.

