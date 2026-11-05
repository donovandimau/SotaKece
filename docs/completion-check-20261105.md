# Sota Kece delivery and interaction check — 5 November 2026

This change starts from the owner's rebuilt main, `6c71f355ca67218ede5d020ec143da39021fc3ed`. It preserves the two distinct feature photos, full-width band panel, compact Home visualiser, Bula welcome pill, all portraits, 94 skins and the existing music/design experiences.

## Repairs

- The custom Sota service worker had no active update notification owner: the shared installer does not register this worker. The app now compares the page release with its controlling worker and offers an explicit update. It never reloads automatically. Unsent text and open editors block the reload; Later dismisses that release. Only a release identifier is exchanged, with no member data or drafts sent to the worker.
- Closing sharing opened from the collapsed Menu now restores focus to the visible Menu button instead of leaving focus on the page body.
- Public footer/text navigation links and the connections selection label now provide a 44px touch target.

## Verification scope

- Fresh production and source inspection confirmed the owner's rebuild is deployed, rather than treating an older open browser tab as deployment evidence.
- Seven public destinations were inspected at desktop and phone widths; all images loaded and no horizontal overflow was found. Music visuals expose four modes and five palettes; changing the mode was exercised on production. Music sharing opens the contextual sheet; the library remains behind Browse music. Room Studio was opened on production: Discover starts without school covers, All exposes 94 skins and the optional School pride filter exposes eight.
- Fictional local member layouts were inspected for feed, Moments, friends, Koro, room, music and connections; phone checks covered feed, Moments and friends. A valid fictional account also confirmed Circles renders the rebuilt navigation after its scripts finish loading. An earlier incomplete render was investigated and was not counted as a source defect. No real account, conversation, invitation or call was created.
- 26 focused update, offline and sharing tests pass with jsdom, zero skips. They cover release identity, source validation, explicit reload, draft/editor protection, dismissal, focus return and the existing public-only cache constraints.
- Normal CI command: 575 tests, 320 pass, 255 optional-environment skips, zero failures.
- Expanded suite with canonical LF fixtures: 575 tests, 567 pass, four existing Companion/Connect failures, four skips. Windows CRLF-sensitive visualiser fixture extraction was investigated separately; unrelated source files were not changed. The four expanded-suite failures match the existing baseline and are not reported as passes.

Exact release-head CI and deployment evidence belong in the PR. A source commit or ready preview alone is not a claim that the canonical production alias has updated. Authenticated Ops command writes were unavailable; repository handover is retained, with no Ops receipt claimed. Wallet and launch instructions remain unchanged.
