# Sota Kece: discovery and inner-page layout

4 November 2026 · continuation of the existing social product, not a replacement.

## What was already built

The audit found 94 native room skins, six curated discovery collections, a custom Room Studio, a per-page designer, 82 library tracks and one audio owner. The native music visualiser has four visual modes and five colour palettes. These were retained. The visualiser had been put inside a collapsed disclosure, while the editors and secondary destinations were hard to discover.

## Research and applied decisions

- [Material 3 adaptive breakpoints](https://m3.material.io/foundations/layout/breakpoints): navigation and panes should adapt to available width. Applied a persistent primary rail on wide screens and the existing primary phone navigation, with an explicit secondary destination strip. A music room uses two columns on desktop and one on phone.
- [Material 3 canonical layouts](https://m3.material.io/foundations/layout/canonical-examples): feed, list-detail and supporting-pane templates give different tasks different structures. Applied a main-content/supporting-pane music layout, kept group list plus workspace, and retained the native feed, room and connection-map structures.
- [shadcn sidebar documentation](https://ui.shadcn.com/docs/components/base/sidebar) and [sidebar blocks](https://ui.shadcn.com/blocks/sidebar): reviewed grouped primary and secondary navigation patterns. Applied a distinct “Make it yours” rail section and visible labelled local tools, without introducing a framework dependency.
- [Material 3 Expressive research](https://design.google/library/expressive-material-design-google-research), already recorded in the previous colour study, informs the expressive interface. No source proves a particular palette increases engagement among young Fijians. Colour and layout choices here remain design judgements to validate with those users.

The Material canonical page was read in full; breakpoints and shadcn official pages were retrieved through research search. A requested shadcn Music example URL returned 404 and was not used as evidence. This is an adaptation of navigation/layout patterns, not a pixel-for-pixel copy of a template.

## Implemented experience

Seven public destinations and eight member destinations now expose a clear location, real tools and related choices. Public inner pages have distinct hibiscus, coral, sunshine, violet and lime surfaces using the existing natural photographs. The member feed, moments and friends pages get compact visual introductions; native Koro, circle and map headers remain. Own rooms retain their personalised cover and skin.

“Explore Sota Kece” opens a keyboard-accessible directory. “Design this page” opens the native designer for the current destination. Room Studio and all skins are direct tools in the wide rail and Explore directory. Eight signed-in destinations are visible in a secondary navigation strip. Native browser Back restores a member destination, with bounded deep links that leave invitation, wallet and public graph routes to their original controllers.

Music now shows the actual visualiser and its native choices beside the player, with an explicit Music visuals tab for a larger stage. Moving between the player and stage preserves the same component, selected mode, colour, audio element, filters and playback. Library search, queues, playlist creation and device imports remain native. The rotating Fiji flag remains in the shared header. Reduced-motion preferences remain supported.

Communications gets explicit cross-app wayfinding and labelled Chat, Discussions, Board and Audio & video tabs. Selected circle skins remain authoritative, with readable call-panel surfaces. Direct calls now begin at a clear voice/video choice and Join screen. Simply visiting or switching the mode starts no devices, call configuration or signalling. Joining retains the existing native call engine and six-person limit. Late media returned after leaving is stopped.

No photo saturation or colour filter was added. No private media, account, graph-consent, wallet or launch policy was changed. New presentation assets remain optional on-demand offline resources; the essential install stays below the existing 1 MB budget.

## Verification scope

- All seven public pages and all eight member templates were inspected at 1440 × 900 and 390 × 844, with no horizontal document overflow. Windows scrollbars reduce the content widths to 1425/375 px.
- Member templates used an isolated, fictional account and local data stubs. The four conversation tabs used a fictional local Koro. These checks verify actual product templates and controllers, not real production account data or remote messaging delivery.
- Real muted library playback continued across music views with the same audio owner, Halo/Violet choices and filter intact. Playback was paused after checking.
- Native Studio displayed all 94 skins; page design previews applied to the new surfaces. Both editors fit the phone. Preview changes were cancelled.
- Explore phone directory and member browser Back were exercised. Direct call lobby was checked at both widths without granting camera/microphone access or joining a real call.
- Regression tests cover navigation, media-owner preservation, editor delegation, bounded routes, late account focus and call entry/device cleanup. Full suite result is recorded in TRACKER.md and the PR.

Private production write flows, real multi-person calling, real-device touch ergonomics and a young-Fijian usability study remain outside this visual/controller audit. No measured engagement uplift is claimed.
