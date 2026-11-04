# Music, sharing and placement review — 4 November 2026

Owner direction: premium quality comes first. Each surface should serve its purpose and reflect Sota Kece's identity; visual sameness is not an acceptance criterion.

## Result
- The 82-track music library is a native disclosure, closed initially. Opening and closing it keeps the same audio owner, filter, queue and visualiser. The Music visuals and Player & library views remain; four visuals and five palettes are retained.
- Playback has a clear previous / play / next row, separate playback preferences and a labelled Share music action. The floating player appears on other pages when a track is selected and stays out of the full Music page. Bottom content remains reachable.
- Removed the staged Talanoa food/coastal scene from Home, social worlds and call entry. The replacements use typography and conversation/call symbols instead of assuming a cast, diet or lifestyle. No ethnicity is inferred from an image.
- App sharing is labelled Share Sota Kece in the header menu. Music sharing identifies the selected track and shares its existing canonical song link. The public room invitation delegates to the same app sheet without exposing private owner/profile data.
- The share sheet has a contextual preview, primary Copy link action, honest clipboard feedback, real vector symbols, close/Escape/backdrop dismissal and focus restoration. Desktop uses a centred dialog; phone fallback uses a bottom sheet. Native phone sharing retains installed-app destinations and cancellation. The fallback includes WhatsApp, Facebook, X, Telegram and Email; it avoids unverified app-only deep links.
- Member Home, note, meme-link and map-zoom controls have comfortable targets. Communications' create/join, callback and external-invitation disclosures do too. Call-page design controls are placed in its footer, instead of being clipped beside the viewport.
- Added a 1200 × 630 branded public JPEG, matching Open Graph and Twitter metadata and descriptive alt text. The design uses Sota Kece's actual logo and bundled font. Provenance: share-preview-20261104.json. No fabricated product screen. App and music links resolve to the canonical domain.

## Checks
- All seven public routes and eight fictional member layouts inspected at 1440 × 900 and 390 × 844; four conversation tabs, both existing design editors and call prejoin also reviewed. Final changed surfaces fit without horizontal overflow or clipped controls. Fictional member data is a local layout fixture, not authenticated product coverage.
- Real muted playlist audio loaded and advanced. Revealing/hiding the library retained playback and its filter; the test track was paused afterwards. The four visual modes/five palettes and both room-design paths remain.
- Share app and selected-song sheets, canonical URLs, focus restoration, keyboard controls and destination URL encoding inspected at both widths. No social posts or real messages were sent. Native phone cancellation and clipboard failure are covered by focused DOM tests.
- Full Node suite with jsdom: 564 tests; 556 passed, four unchanged pre-existing Companion/Connect failures, four skipped. The ordinary CI suite runs without jsdom and skips those browser-dependent legacy cases. Native and Revised page-design source copies remain identical. JavaScript syntax and git diff checks pass.
- Offline cache advanced to v133-player-polish, keeps the public-asset allowlist and excludes the removed Talanoa image. Changed assets have versioned references. Production verification is recorded in the PR after the existing release workflow runs.

## Platform limits and research
- Destination URL construction and local UX were checked. Sending through logged-in third-party accounts was not exercised. Preview renderers and caches belong to the receiving apps; a new image URL avoids reusing the previous image asset, but existing messages may retain cached cards.
- WhatsApp's official click-to-chat guide: https://faq.whatsapp.com/5913398998672934
- Telegram's official share widget: https://core.telegram.org/widgets/share
- Facebook's reference URL returned HTTP 429 during this review. The existing public share endpoint is retained; no SDK/app-ID dependency added. The old X web-intent documentation redirected to its new overview. Those limitations are not represented as verified external sends.

## Coordination
Canonical repository: donovandimau/bulavata; live: https://sotakece.com/; branch: agent/player-share-polish-20261104. Separate active portfolio audit branch: donovandimau/dimau-ops, agent/share-portfolio-audit-20261104. Its work is not overwritten and portfolio-wide publication is not claimed here. Wallet hold and overseas-first launch order remain.

Authenticated Ops command writes were unavailable: the supported secure client reported no installed encrypted Codex credential. This handover and the PR record the evidence; no accepted Ops receipt is claimed. Continue through the existing release workflow and reconcile the portfolio audit's per-app evidence.
