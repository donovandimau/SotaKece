# Interaction ideas from the 11 November prototype

On 11 November 2026 Claude built a standalone prototype from two owner mockups: an interface kit with a bubble cluster, a 3D map, a liquid ring calculator and a card stack, and a "Sota Kece" village app concept. Donovan then added zoom navigation, infographics, a guided tour and engagement stats. The prototype was a single HTML file published privately on claude.ai, outside this repository, which breaks the no-copies rule. It was reported in the Ops Room (#1493). Donovan decided on 11 November to fold its ideas into this repository instead.

**None of this is built here yet.** Each idea below is a separate revision. Each needs Donovan's design approval before work starts, in line with the one-revision-at-a-time rule.

## What not to carry over

- **The prototype's look.** It was dark, mint and gold. Sota Kece keeps its own direction in DESIGN.md: the warm editorial surface, the light-blue pattern, photographic artwork and the owner image direction in TRACKER.md.
- **Its example content.** A village called "Nakorovou", invented people, notices, a church roof fund and usage figures. None of it is real and none of it belongs here.
- **Its data store.** It used the claude.ai artifact database. Real data stays in Sota Kece's own tables, which are moving to dimau-core-ireland (Ops Room #1500).

## The ideas, mapped to what Sota Kece already has

| # | Prototype idea | Where it fits in Sota Kece | Real data it would use |
|---|---|---|---|
| 1 | **Guided tour.** A "Show me around" story told in stops: the camera moves, a card explains each stop, scroll or arrow keys advance it, and any stop can be left | First-run onboarding for new members. This fits the cold-start work: Talanoa Wall, then Koro hubs, then Music, then Sere, then My room | Static copy, plus live counts from `bv_hubs()` and the wall feed |
| 2 | **Bubble cluster.** Physics bubbles that push each other apart; tapping one enlarges it and opens a detail panel; they can be dragged | People to meet and the starter Koro: hubs as large bubbles and members as small ones, with tap to join or greet | `bv_hubs()`, `bv_people_to_meet()`, `bv_hub_join()` |
| 3 | **Zoom navigation.** Places on a map; zooming in fills a progress ring and the screen grows out of the place; pinch or Esc to come back | Hubs on a world map: UK & overseas, then Fiji, then Suva and the West. This suits the launch order, overseas Fijians first | `bulavata.hubs` (suva, west, diaspora) and member counts |
| 4 | **Charts that add detail as you zoom.** A headline figure at a distance and a breakdown up close | Inside idea 3: each hub shows its members and recent posts, then a short breakdown | `bv_hubs()`, wall post counts |
| 5 | **Card stack.** Tilted 3D cards that move to the front on scroll or swipe, with a list beside them | Highlights or Activity: a stack of the member's recent notifications or best posts | `bv_activity()`, `bv_highlights()` |
| 6 | **Liquid ring and dials.** A goal ring with a liquid fill, dials and an arc slider | Coins and wallet. **Hold:** both are hidden until the Reserve Bank of Fiji approves the wallet. A non-money use could be the daily Sere and gift allowance (5 Sere, 3 gifts a day) | `bv_sere_mine()`, `bv_gifts_left()` |
| 7 | **One core message.** A single headline, with the evidence underneath | The guest Home for cold start, for example "38 Fijians in the UK hub talked today" | Wall and hub counts, true numbers only |
| 8 | **Explorable charts.** Tap a bar for the exact figure, switch week, filter | A member's share stats: opens and sign-ups per shared post | `bulavata.talanoa_shares`, `bulavata.referrals` |
| 9 | **Engagement panel.** Whole-community and personal usage | Owner and admin view only | The Dimau event spine (`public.events`, `track()`); see the 11 Nov funnel-events handover |

## Suggested order

1. Guided tour (1), because it helps the cold start most and needs no new backend.
2. Hub zoom map with charts (3 and 4). Do this once the Ireland move (#1500) has finished, so it is built against the final database.
3. People bubbles (2).
4. Share stats (8).
5. Card stack (5).
6. The liquid ring (6) waits for the Reserve Bank decision, unless the Sere and gift allowance version is approved first.

## Build rules that apply to every one of these

- Plain HTML, CSS and JS, with no framework (DESIGN.md).
- New stylesheets go in the css-bundle lists. Run `node scripts/build-css.cjs`.
- New scripts go inside the js-later blocks, never as a bare script tag (AGENTS.md).
- `tests/css-bundle.test.cjs` and `tests/first-paint.test.cjs` must pass.
- Add new public files to the service worker allowlist.
- Respect reduced motion, keyboard use and focus states, and design phone and desktop separately.
- Show true figures only. If a count is unknown, hide it rather than inventing one.
