# TRACKER — Sota Kece

> **Every AI: read this whole file before you start any work on this project, and update it before you finish — in the same commit as your work.**
> Newest entries go at the TOP of each section. If something is listed under *In progress* or *Done*, do not redo it: carry it on, or check with Donovan.
> Work that applies to **every** project (shared rules, rollouts, new-project checklist) lives on the main board: `donovandimau/dimau-ops` → `ALL-PROJECTS.md`. Check it too, and tick this project off there when you apply a rollout here.

## Project
- Ops Room card: `platform-bulavata`
- Code: https://github.com/donovandimau/bulavata
- Live: https://sotakece.com

## Current state
- Status: Ready to Test — Live preview (70% complete)
- Next action: LAUNCH ORDER (Donovan, 31 Oct): open Sota Kece to overseas Fijians first - full social features, wallet hidden (done: #306 merged and live). Once the Reserve Bank of Fiji approves the wallet, open to Fijians in Fiji and connect the two.
- Blocker: none recorded

## In progress — claim a task here BEFORE you start it
| Started | AI | Task | Branch / PR |
|---|---|---|---|
| — | — | nothing claimed | — |

## Do not change
- nothing recorded yet

## Last handover
- 2026-11-03 — Codex: four photographic welcome scenes for young adult early adopters prepared on agent/photorealistic-scenes-20261103 for the existing Ops revision review. No backend or private-media change.
- 2026-11-02 — GitHub: Merged PR #342: Connection over scrolling: caught-up marker, say bula, break note
- Testing: not tested

## Done — newest first
- 2026-11-03 — Codex — Added four original photorealistic Fiji welcome scenes for young adult early adopters (all depicted people aged 18–25) (friends, music, personal space, Talanoa); local lazy-loaded WebP delivery (282 KiB phone / 399 KiB desktop for the four selected images), responsive Talanoa source, truthful generated-scene alt text, explicit offline allowlist and cache update. All five public destinations checked at 1440px and 390px without overflow. Targeted navigation/offline suites: 32/32 pass. Full suite: 527 pass, 14 fail, 4 skipped, identical failure names/counts to unchanged main. Prompts, hashes and source names in docs/welcome-photography*.json. Branch agent/photorealistic-scenes-20261103; publication through the existing Ops review route.
- 2026-11-03 — claude — `dimau-install.js` is again a byte copy of the Dimau master (dimau-platform-standard `install/`). The Sota glass round buttons from #238 now come from the master's `data-buttons="glass"` option, set on the script tag in `index.html` (`?v=20261103-glass-option-1`). Buttons render the same as before. The install note text now uses the shared `--dimau-app-font` default like every other app (29 Oct change). `tests/sota.test.cjs` and `tests/shadow-glass-controls.test.cjs` expect the attribute. With jsdom: the same 462 pass and the same 4 companion/Connect tests fail as on main.
- 2026-11-01 — claude — Automatically merged revision #332 after technical checks
- 2026-11-01 — claude — Restore Sota Kece Plus pill (approved 31 Oct, local pricing); receipts button stays removed (1 replacement(s) in index.html on main)
- 2026-11-01 — claude — Remove paid Plus pill and wallet receipts button (no charging users yet; wallet hidden until RBF approval) (1 replacement(s) in index.html on main)
- 2026-11-01 — claude — Load the page guard only inside a real service worker, so the Node tests that run sw.js still pass  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com> Claude-Session: https://claude.ai/code/sessi
- 2026-11-01 — claude — Opened pull request #332: Offline: show the saved page after 4 seconds on a weak 3G signal
- 2026-11-01 — claude — Offline: show the saved page after 4s on a weak 3G signal instead of hanging — 2 file(s) on claude/offline-3g-timeout: dimau-page-timeout.js, sw.js
- 2026-11-01 — claude — Load the shared Dimau consistency standard (44px header controls, title cap, Dimau Group footer)  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com> Claude-Session: https://claude.ai/code/session
- 2026-10-31 — claude — Load Dimau PWA kit (1 replacement(s) in index.html on feature/pwa-kit)
- 2026-10-31 — claude — Add Dimau PWA kit (install prompt, update bar, bottom sheet, date picker)  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com> Claude-Session: https://claude.ai/code/session_014dUrto2KoCAsc4GVA1W
- 2026-10-31 — claude — feat: add shared wallet-receipts widget (rides with Sota Plus candidate) (1 replacement(s) in index.html on claude/sota-plus-checkout)
- 2026-10-31 — claude — feat: add shared wallet-receipts capture widget (1 replacement(s) in index.html on feat/wallet-receipts)
- 2026-10-30 — claude — Dimau Pay: load the widget from a host every app security policy already allows  The Supabase function address was blocked by script-src on the live sites.  Co-Authored-By: Claude Fable 5.1 <noreply@a

_Seeded 2026-11-02 from the Ops Room. From here on, this file is the record for this project._
