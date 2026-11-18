# VisualCube Editor 3.0

**English** | [日本語](README.ja.md)

A web app for making Rubik's Cube images with a GUI, and for learning and practicing the last-layer algorithms
(PLL, OLL, COLL and ZBLL) with a timer.
Images are drawn with [VisualCube TS](https://github.com/tdecker91/visualcube).

URL: https://visualcube.roudai.net/

## Features

### Image editor (`/`)
- Draw any cube from 1x1x1 to 17x17x17, from an algorithm or by setting the sticker colors directly
  - **Algorithm to apply**: the state after the algorithm
  - **Algorithm to solve case**: the state that the algorithm solves (on 3x3x3, rotations, wide moves and slice moves are cancelled out)
  - **Defines the cube state**: paint each sticker
- Normal (3D) or Plan (top) view, stage masks (F2L, OLL, COLL, …), arrows, rotation, colors, opacity and projection distance
- Color presets (Standard / OLL / Custom), transparent or opaque background, image size, and PNG download with your own file name
- Pick a PLL / OLL / COLL case from a list. The algorithm, the view and the colors are set for you,
  and the file name becomes `pll-Aa.png`, `oll-27.png` or `coll-21-1.png`
- Save **your own algorithm** for a case. It is checked to really solve that case, and it is used everywhere
  (lists, practice, stats). You can go back to the default and undo
- 3x3x3 algorithms are checked as you type: unknown moves are reported, and repeats such as `(R U)2` work

### Case lists (`/pll`, `/oll`, `/coll`, `/zbll`)
- All 21 PLL, 57 OLL, 40 COLL and 472 ZBLL cases with images and algorithms. Click a case to open it in the editor
  (ZBLL has no row in the editor; its name and algorithm are opened with `/?zbll=<name>&case=<alg>` in plan view)
- Mark each case as **To learn / Learning / Learned**, see your progress, and filter by status
- Order by group or by **learning order** (13 stages each for PLL and OLL). OLL can also be shown in number order (1–57)
- Show only the groups or stages you pick, practice exactly those cases, and reset all progress (with undo)
- Download all images as a ZIP, with the colors and image settings you saved in the editor
- ZBLL is grouped into 40 subsets (T / 2GLL, …) or 7 OCLL sets (T, U, L, H, Pi, Sune, Antisune)
- The COLL and ZBLL lists are linked from the OLL list

### Practice (`/practice`)
- **PLL / OLL / COLL / ZBLL**: a scramble for a random case is shown. Solve it with your cube and stop the timer.
  A case solved within the target time (2 / 3 / 5 / 8 s or any value, set separately for PLL, OLL, COLL and ZBLL)
  is marked as learned automatically. Hints (the first moves), "couldn't solve", skip and undo are available
- **Full solve**: WCA-style random-state scrambles generated in the browser, 15-second inspection with automatic +2 / DNF,
  ao5 / ao12, penalties and deletion
- Press Space to start and stop on a computer; tap on a phone

### Stats (`/stats`)
- Totals and a chart of every solve (ao5 / ao12 for full solves, the target line for cases)
- A table per case, sorted by **weakest first** (average of the last 10 solves), by group or by learning order.
  Click a case to practice it
- A list of every solve, 50 per page, with deletion (one or many) and undo

### Account and languages
- English and Japanese, switchable on every page
- Everything is saved in your browser. Signing in with Google, Facebook or GitHub (Firebase) also saves your settings,
  progress, own algorithms and practice records to your account, so you can use them on any device.
  The account is shared with [Megaminx Image Editor](https://github.com/roudai/MegaminxImageEditor)
- You can delete your account data yourself from the privacy policy page
- A how-to page in English and Japanese (`/guide`), linked from the account menu

## URL parameters

| Example | Meaning |
|---|---|
| `/?alg=R U R' U'` | Draw the state after the algorithm |
| `/?case=R U R' U'` | Draw the state that the algorithm solves |
| `/?pll=Aa`, `/?oll=27`, `/?coll=21-1` | Open the editor with that case selected (priority: `pll` → `oll` → `coll` → `case` → `alg`) |
| `/practice?set=oll&filter=new` | Open practice with the set (`pll` / `oll` / `coll` / `zbll` / `full`) and the target (`new` / `learning` / `learned` / `all`) |
| `/stats?set=coll` | Open the stats of that set |

Page URLs have no `.html`. Old links such as `/index.html?alg=…` still work, and the address bar is rewritten to `/?alg=…`.

## Sources

- PLL / OLL / COLL algorithms, case names and image orientation: [roudai.net](https://roudai.net/)
  ([PLL](https://roudai.net/pll/pll/), [OLL](https://roudai.net/oll/oll/), [COLL](https://roudai.net/oll/coll/)).
  PLL names follow that page: Ua/Ub, Aa/Ab, Ra/Rb, Ga/Gd and Gb/Gc are swapped compared with the common international naming
- ZBLL algorithms and scrambles: provided data (`data/zbll/`), normalized as described in `reference/ZBLL_SPEC.md`
- Learning order: [Cube Voyage](https://cubevoyage.net/)
  ([PLL](https://cubevoyage.net/how-to-solve/advanced/pllsequence/), [OLL](https://cubevoyage.net/how-to-solve/advanced/ollsequence/))
- The case lists, practice and stats were ported from [Megaminx Image Editor](https://github.com/roudai/MegaminxImageEditor)

## Development

A static site: no build step and nothing to install. Serve the directory with the bundled server, which resolves
`/pll` to `pll.html` like GitHub Pages does. A plain static server such as `python3 -m http.server` does not,
so links between pages return 404 there.

```sh
node tools/serve.js 8000      # http://localhost:8000/
node tools/serve.js --demo    # http://localhost:8001/stats  (sample records, sign-in disabled)
```

`--demo` uses its own port so that its browser storage stays separate from yours. It fills in practice records,
recent times and progress (`tools/demo-data.js`) and shows a badge with a reset link (`/__demo/reset`).
When `VERSION` in `tools/demo-data.js` changes, a browser with older sample data is filled in again.

Tests (Node.js built-in test runner; checked with Node.js 24):

```sh
node --test
```

Generated data: edit the JSON, then regenerate. The tests fail if a generated file is stale.

```sh
node tools/build-pll-data.js     # data/pll/algs_info.json (+ learn_order.json) -> js/pll-data.js
node tools/build-oll-data.js     # data/oll/algs_info.json (+ learn_order.json) -> js/oll-data.js
node tools/build-coll-data.js    # data/coll/algs_info.json -> js/coll-data.js
node tools/build-zbll-data.js    # data/zbll/algs_info.json -> js/zbll-data.js
node tools/gen-scrambles.js      # case scrambles -> data/{pll,oll,coll}/scrambles.json (ZBLL scrambles are provided, not generated)
node tools/build-scrambles.js    # -> js/{pll,oll,coll,zbll}-scrambles.js (every scramble is verified)
```

Each case has `a` (an algorithm that solves it) and `s` (an algorithm that makes it). The build checks that they
match and suggests a fix when they do not. Case scrambles are made by the bundled two-phase solver (`js/cube-solver.js`),
and every scramble is verified.

### Project layout

| Path | Contents |
|---|---|
| `index.html`, `pll.html`, `oll.html`, `coll.html`, `zbll.html`, `practice.html`, `stats.html`, `guide.html`, `privacy.html`, `terms.html` | Pages |
| `js/` | Scripts (plain scripts, no modules or bundler): `cube-state.js` (3x3x3 state), `case-check.js` (algorithm checks), `cube-solver.js` (solver), `store.js` / `cloud-sync.js` (saving), `i18n.js` (translations), and one script per page |
| `css/` | Styles |
| `data/` | Source data (algorithms, learning order, scrambles). Do not put a folder named like a page (`pll/`, `oll/`, …) at the root: GitHub Pages would serve the folder for `/pll` |
| `tools/` | Data builders, scramble generator, local server |
| `test/` | Tests |
| `reference/` | Specifications (Japanese): `PLL_SPEC.md`, `OLL_SPEC.md`, `COLL_SPEC.md`, `ZBLL_SPEC.md`, `PRACTICE_SPEC.md`, `I18N_SPEC.md`, `CLOUD_SYNC_SPEC.md` |
| `library/` | VisualCube TS (`srVisualizer.min.js`) |
| `firestore.rules` | Firestore security rules (shared with Megaminx Image Editor) |

### Libraries

- Vue.js 3.5.45
- Lodash 4.17.21
- VisualCube TS 1.0.13
- Bootstrap 5.3.9
- Firebase 10.12.2 (Authentication, Firestore)

## Contact

Please use [GitHub Issues](https://github.com/roudai/VisualCubeEditor2/issues).
See also the [privacy policy](https://visualcube.roudai.net/privacy) and the [terms of use](https://visualcube.roudai.net/terms).
