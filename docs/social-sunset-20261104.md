# Sota Kece — social sunset photograph and Bula correction

Owner requests, 4 November 2026: retain the revised layout and Bula welcome pill; remove only Volau; use photorealistic young adults socialising, with no work or phones. Final cast: one Fijian man and Fijian, Chinese and Indian women, one woman playing acoustic guitar. Soft sunset, everyday clothes and an ordinary lived-in Pacific veranda replace the rejected polished/luxury treatment. Two models use the owner-supplied adult couple as visual references.

## Implementation

- Existing PR369 and its branch are reused; current main 27666e7 is reconciled as a merge parent. Current music, sharing, authenticity corrections and saved work are preserved.
- Keep both Bula scripts unchanged. Remove only dimau-companion.js loader tags from index.html, communications.html and tests/chat-preview.html. Shared companion files stay in history/source for later work.
- Preserve the revised split welcome and actual example room, navigation, portraits, 94 skins, design controls and music owners. The final photograph fits inside the existing welcome copy column and appears in contextual People/Talanoa headers; unrelated navigation keeps its current symbols.
- Two same-origin WebP sizes (768 and 1536 wide) use responsive selection. Whole-frame sizing keeps all four faces and the guitar visible. No rejected work/phone/luxury image is referenced by the application.
- Public artwork is cached only after use. Shell cache/versioned runtime references advance for reliable phone updates. Private-media cache rules are unchanged.

## Verification

- Existing discovery, routing, audio/room ownership and offline suites: 41 passed, zero failures, zero skipped, with jsdom 26.1.0.
- Changed JavaScript parses. Static checks verify both Bula scripts remain and all three Volau loader entry points are absent.
- Final image inspected: four adults, woman playing guitar, relaxed ordinary setting, sunset lighting and no phones/laptops/work scene.
- Hosted desktop/phone verification and the exact preview URL are recorded in PR369 after deployment; this document does not substitute for that result. Authenticated member writes and multi-person calls are outside this image/loader change.

## Continuity

Ops agent credential unavailable in this environment. The current owner access-fallback standing instruction was read in the signed-in Ops dashboard; implementation continues through authorised GitHub/Vercel tools. TRACKER.md claim was committed first on the existing branch. No Ops agent lease, memory, checkpoint or publication receipt is invented. Existing launch/wallet holds remain.
