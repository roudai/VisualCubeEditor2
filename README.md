# VisualCube Editor 2.0

This is a tool for making Rubik's Cube images with GUI.  
[VisualCube TS](https://github.com/tdecker91/visualcube) is used to display the images.

URL : https://visualcube.roudai.net/

Vue.js - 3.5.45  
Lodash - 4.17.21  
VisualCube TS - 1.0.13  
Bootstrap - 5.3.9

## Pages

| URL (file) | What it does |
|---|---|
| `/` (`index.html`) | Editor. Pick a PLL / OLL case (`/?pll=Aa`, `/?oll=27`) or type an algorithm (`/?alg=`, `/?case=`), save your own algorithm for a case, download the image |
| `/pll` / `/oll` (`pll.html` / `oll.html`) | All 21 PLL / 57 OLL cases with images, learning status, filters and a ZIP download |
| `/practice` (`practice.html`) | Timer practice for PLL / OLL cases (auto-marks cases as learned) and full solves (WCA-style random-state scrambles, inspection, +2 / DNF, ao5 / ao12) |
| `/stats` (`stats.html`) | Practice records: totals, daily chart, per-case table, CSV export |
| `/privacy` / `/terms` (`privacy.html` / `terms.html`) | Privacy policy and terms of use |

Page URLs have no `.html` (GitHub Pages serves `pll.html` for `/pll`). Old links such as `/index.html?alg=…`
still work, and the address bar is rewritten to `/?alg=…` (`js/navbar.js`). Do not put a folder named like a page
(`pll/`, `oll/`, …) at the root: GitHub Pages would serve the folder for `/pll`. Source data lives in `data/`.

The UI is available in English and Japanese. Settings and records are kept in the browser (localStorage);
signing in (Google / Facebook / GitHub, via Firebase) also saves them to your account.

The PLL / OLL lists, practice and stats were ported from [Megaminx Image Editor](https://github.com/roudai/MegaminxImageEditor).

## Development

Static site: no build step and no dependencies to install. Serve the directory with the bundled server, which
resolves `/pll` to `pll.html` like GitHub Pages does (a plain static server such as `python3 -m http.server`
does not, so links between pages return 404 there):

```sh
node tools/serve.js 8000   # http://localhost:8000/
```

Tests (Node.js built-in test runner; checked with Node.js 24):

```sh
node --test
```

Generated data — edit the json, then regenerate (the tests fail if the generated files are stale):

```sh
node tools/build-pll-data.js     # data/pll/algs_info.json -> js/pll-data.js
node tools/build-oll-data.js     # data/oll/algs_info.json -> js/oll-data.js
node tools/gen-scrambles.js      # case scrambles -> data/pll/scrambles.json, data/oll/scrambles.json
node tools/build-scrambles.js    # -> js/pll-scrambles.js, js/oll-scrambles.js
```

Specs (Japanese) are in `reference/`: `PLL_SPEC.md`, `OLL_SPEC.md`, `PRACTICE_SPEC.md`, `I18N_SPEC.md`, `CLOUD_SYNC_SPEC.md`.
