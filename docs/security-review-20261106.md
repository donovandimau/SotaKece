# Security review — 6 November 2026

CodeQL's initial scan identified a DOM text-to-HTML path in `refreshBar`: the comment button's text was passed back into the HTML builder. `bar` now renders only nonnegative safe integer counts; invalid values use the existing Reply label. This closes the identified HTML interpretation path without changing social permissions or presentation.

The normal check workflow now explicitly requests only `contents: read`. The repository already used read-only workflow defaults; the workflow declaration preserves that boundary if the repository default changes later.

The page script version and service-worker release identifier advance together so existing installations receive the hardened renderer through their normal safe update flow.

## Validation

- Two focused behavior tests cover malicious markup, valid integer counts and malformed count values.
- JavaScript syntax checks pass for the renderer and service worker.
- Full repository checks, hosted CodeQL and deployment results are recorded in the pull request. Local optional DOM test installation was interrupted by the workstation's storage/resource issue; no local full-suite pass is claimed.

## Other initial scan results

- The two SHA-1 findings are in the coturn TURN REST credential implementation and its matching test. HMAC-SHA1 is the existing relay protocol. This review does not change the protocol or claim an upgrade of relay cryptography.
- Seven warnings are in test assertions inspecting source strings, inline script syntax, and expected public links. These assertions do not decide production URL trust or sanitize user content. They were not changed simply to silence the scanner.
- No alerts were dismissed. Scan results remain available for future review.

This focused change does not certify all authenticated social flows, third-party integrations, database policies or account security. It sends no user messages and makes no real calls.
