# AI instructions — bulavata

<!-- tracker-pointer -->
## READ FIRST: TRACKER.md
Before any work in this repo, read `TRACKER.md` (what is done, in progress and not to be touched in this project) and `ALL-PROJECTS.md` in `donovandimau/dimau-ops` (rules and shared work for every project). Claim your task in TRACKER.md before you start. Update it in the same commit as your work. Never redo work that is already listed there.


## Stylesheets are combined
`index.html` loads `sota-styles-head.css` and `sota-styles.css`, built from the separate `.css` files listed in the `<!-- css-bundle ... -->` comments beside them (same order as the old `<link>` tags). Edit the source file (and its `?v=` in the list), then run `node scripts/build-css.cjs`; `tests/css-bundle.test.cjs` fails if a bundle is out of date. To add a stylesheet to the page, add its `<link>` line inside the right list and rebuild.
