# VisualCube Editor 2.0

This is a tool for making Rubik's Cube images with GUI.  
[VisualCube TS](https://github.com/tdecker91/visualcube) is used to display the images.

URL : https://visualcube.roudai.net/

Vue.js - 3.5.45  
Lodash - 4.17.21  
VisualCube TS - 1.0.13  
Bootstrap - 5.3.9

## Pages

| Page | What it does |
|---|---|
| `index.html` | Editor. Pick a PLL / OLL case (`?pll=Aa`, `?oll=27`) or type an algorithm (`?alg=`, `?case=`), save your own algorithm for a case, download the image |
| `pll.html` / `oll.html` | All 21 PLL / 57 OLL cases with images, learning status, filters and a ZIP download |
| `practice.html` | Timer practice for PLL / OLL cases (auto-marks cases as learned) and full solves (WCA-style random-state scrambles, inspection, +2 / DNF, ao5 / ao12) |
| `stats.html` | Practice records: totals, daily chart, per-case table, CSV export |
| `privacy.html` / `terms.html` | Privacy policy and terms of use |

The UI is available in English and Japanese. Settings and records are kept in the browser (localStorage);
signing in (Google / Facebook / GitHub, via Firebase) also saves them to your account.

The PLL / OLL lists, practice and stats were ported from [Megaminx Image Editor](https://github.com/roudai/MegaminxImageEditor).

## Development

Static site: no build step and no dependencies to install. Serve the directory with any static file server, e.g.

```sh
python3 -m http.server 8000
```

Tests (Node.js built-in test runner; checked with Node.js 24):

```sh
node --test
```

Generated data — edit the json, then regenerate (the tests fail if the generated files are stale):

```sh
node tools/build-pll-data.js     # pll/algs_info.json -> js/pll-data.js
node tools/build-oll-data.js     # oll/algs_info.json -> js/oll-data.js
node tools/gen-scrambles.js      # case scrambles -> pll/scrambles.json, oll/scrambles.json
node tools/build-scrambles.js    # -> js/pll-scrambles.js, js/oll-scrambles.js
```

Specs (Japanese) are in `reference/`: `PLL_SPEC.md`, `OLL_SPEC.md`, `PRACTICE_SPEC.md`, `I18N_SPEC.md`, `CLOUD_SYNC_SPEC.md`.
