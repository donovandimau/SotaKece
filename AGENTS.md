# AI instructions — bulavata

<!-- tracker-pointer -->
## READ FIRST: TRACKER.md
Before any work in this repo, read `TRACKER.md` (what is done, in progress and not to be touched in this project) and `ALL-PROJECTS.md` in `donovandimau/dimau-ops` (rules and shared work for every project). Claim your task in TRACKER.md before you start. Update it in the same commit as your work. Never redo work that is already listed there.


## Stylesheets are combined
`index.html` loads `sota-styles-head.css` and `sota-styles.css`, built from the separate `.css` files listed in the `<!-- css-bundle ... -->` comments beside them (same order as the old `<link>` tags). Edit the source file (and its `?v=` in the list), then run `node scripts/build-css.cjs`; `tests/css-bundle.test.cjs` fails if a bundle is out of date. To add a stylesheet to the page, add its `<link>` line inside the right list and rebuild.

## Scripts and the phone guest first paint
Phone guests on Home are painted from critical CSS (generated beside each bundle) before any stylesheet or script loads; see PROJECT_STATE.md, task 1048. Every script after the `window.SK` decision in `<head>` lives in a `<!-- js-later ... --><script>SK.js()</script>` block (inline ones as `type="text/x-sk-later"` + `SK.run()`). Add or move a script inside those blocks, never as a bare `<script>`, then run `node scripts/build-css.cjs` (it also refreshes the critical CSS and preload list); `tests/first-paint.test.cjs` and `tests/css-bundle.test.cjs` enforce this.

Signed-in members on phones get a kept copy of their Home top (`SK.keep`/`SK.paint` in the SK script). It may only contain the words in `var mw="..."` there, and the build adds those words to the critical CSS. If you change the member header, tabs or greeting markup, add any new class or attribute to `mw` and rebuild. Until you do, those members just take the old path.
