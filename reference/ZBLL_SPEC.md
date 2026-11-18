# ZBLL の仕様（3x3x3）

上面の十字ができている（エッジが4枚とも向いている。OCLL の 7 種類）ときに、最後の層をまるごと一度に揃える ZBLL（472 ケース）を、
一覧・練習・記録で使う。エディタにケースを選ぶ行は作らない。コードと食い違うときはコードを正とする。

- データと確認：`data/zbll/algs_info.json`、`tools/build-zbll-data.js`（共通部分は `tools/build-case-data.js`）、`js/zbll-data.js`（生成物）、
  `js/case-check.js`、`test/zbll-data.test.js`
- スクランブル：`data/zbll/scrambles.json` → `js/zbll-scrambles.js`（`tools/build-scrambles.js`）
- 画面：一覧 `zbll.html`（`js/cases.js`）、練習・記録（`reference/PRACTICE_SPEC.md`）

## 元データ：`data/zbll/algs_info.json`

```json
"1": {
  "name": "T-2GLL1",
  "group": "2GLL",
  "algset": "T-ZBLL",
  "s": "(U) F U2 F' R' U2 R U' F U F' U2 R' U R",
  "a": [
    "R U R' U R U2 R' U2 R' U' R U' R' U2 R",
    "(U') R U R' U' R' F D' R U R' D R2 U' R' F'",
    "(U2) L' U' L U' L' U2 L R U R' U R U2 R'"
  ]
}
```

- キーは 1〜472 の通し番号（並び順）
- `name`：「OCLL-名前」（`T-2GLL1`、`Sune-SS1` など）。URL・保存・ZIP のファイル名（`zbll-T-2GLL1.png`）で使う
- `group`：小グループ（`2GLL`・`Diag`・`Same/Opposite` …）。`algset`：OCLL（`T-ZBLL`・`U-ZBLL`・`L-ZBLL`・`H-ZBLL`・`Pi-ZBLL`・`Sune-ZBLL`・`Antisune-ZBLL`）
- `a`：解く手順の配列。1本目が主な手順（一覧・練習のヒント・記録で使う）。2本目以降は別解（生成物の `alts`。今は画面には出さない）
- `s`：揃った状態から回すとそのケースになる手順（面回しと括弧付きの AUF だけ）

### 置かれたデータからの整形（2026-11-18）
置かれた json（1行。`a` は配列、`scrambles.json` のキーは通し番号）を、次のように整形した（元のデータの手順・スクランブルの中身は変えていない）。

- **名前**：元の名前は OCLL をまたいで重なる（`2GLL1` が 7 つなど）ので、OCLL を前に付けた（`T-2GLL1`）。
  同じ OCLL の中でも番号が無かった U の `SS`・`OO`、L の `SA`（各 12 件）は、データの順に `SS1`〜`SS12` などと番号を付けた
- **`s` の向き**：1本目の手順の逆とちょうど同じ状態になるよう、前後の AUF を付け直した（430 ケース。`CaseCheck.fitSetup`）。
  画像は1本目を回し始める向き（PLL・OLL・COLL と同じ決まり）
- **揃わない別解を消した**（3本）：U-SS6 の2本目 `(U') r' F R' F' R F' r U r' U2 L' U2 r R`、L-SO8 の2本目 `(U') R2' D' R U2 R' D R U2 R' D' r U2 r' D' R U2 R`、
  Antisune-JN2 の3本目 `F U' R' U' R U F U2 R' U R U' R' U2 R`
- **`scrambles.json`**：キーを通し番号からケース名にした
- **一覧の向き**：同じ OCLL のケースは、一覧の向き（上面の U の色の位置）がすべて同じになるようにした。そろっていなかった Antisune-JN4 は、1本目の頭の AUF を `(U)` から `(U')` にした（手順の本体は同じ。`test/zbll-data.test.js` で確かめる）
- どちらもインデント 2 の JSON にした

### OCLL と小グループ（7 種類・40 組）

| OCLL | ケース | 小グループ |
|---|---|---|
| T | 72 | 2GLL, Diag, Same/Opposite, Opposite/Same, Adjacent/Same, Adjacent/Opposite |
| U | 72 | 2GLL, Diag, Same/Same, Opposite/Opposite, Adjacent/Same, Adjacent/Opposite |
| L | 72 | 2GLL, Diag, Opposite/Same, Opposite/Adjacent, Same/Opposite, Same/Adjacent |
| H | 40 | 2GLL, Diag, Corner line, Corner column |
| Pi | 72 | 2GLL, Diag, Lines, Diagonals, BL=FR diagonal, BL=BR diagonal |
| Sune | 72 | 2GLL, Diag, Niklas, Diag Niklas, Anti diag Niklas, shitsune |
| Antisune | 72 | 2GLL, Diag, Jean-Niklas, Diag Niklas, Anti diag Niklas, Jean-Pétard |

## 生成：`js/zbll-data.js`（`node tools/build-zbll-data.js`）
- 項目：`{ name, group: "T / 2GLL", stage, order, alg, alts, setup }`
  - `group` は「OCLL / 小グループ」（一覧の見出し、グループのボタン）
  - `stage` は OCLL（T=1 … Antisune=7。データに出てくる順）、`order` はデータの順。`learn_order.json` は使わない
- 確認（PLL と同じく状態をまるごと比べる。`js/case-check.js` の `'zbll'`）
  - 1本目：`s` のケースを最後の AUF を除いて揃え、1本目の逆と `s` の状態がちょうど同じ（合わなければ直し方の候補を出して止まる）
  - 別解：同じケースを、前後の AUF を除いて揃える（`fitSetup`）
  - 名前が重ならない

## スクランブル
- 用意されたもの（ケースごとに 4〜20 本、合わせて 9162 本。7〜16 手）を使う。`tools/gen-scrambles.js` では作り直さない
- `tools/build-scrambles.js zbll` が、全件がそのケース（前後の AUF を除いて）になることを確かめてから `js/zbll-scrambles.js` を作る

## 画面
- 一覧（`zbll.html`、URL は `/zbll`）：PLL・OLL・COLL の一覧と同じ（習得状況、絞り込み、練習する、ZIP `visualcube-zbll.zip`、すべて未習得に戻す）
  - 並びは「小グループ順 / OCLL ごと」（`list-filter` の `zbllOrder`。値は `'group'` / `'learn'`）。見出しは小グループ順では「T / 2GLL」、OCLL ごとでは「T-ZBLL」
    （`stage.zbll.<OCLL>`。番号は付けない）。文言は `CaseSections.orderKeys`
  - 配色は PLL と同じ（エディタで保存した配色）
  - 画像を押すと、1本目の手順を「この手順で揃う状態」でエディタに開く（`/?case=…`）
  - ナビバーには置かず、OLL 一覧の説明の下から「ZBLL一覧 ›」でリンクする
- 練習：種類のボタンに ZBLL（PLL / OLL / COLL / ZBLL / 通し）。小グループか OCLL で絞る。習得の目安・出題の重み・ヒントは PLL などと同じ
- 記録：種類に ZBLL。並びは苦手順 / 小グループ順（OCLL ごとは小グループ順と同じ並びなので出さない）
- 図：1本目の手順の逆（持ち替えは打ち消す）。4 ケース（U-2GLL2・H-Diag2・H-Diag3・H-Diag4）は手順の最後で持ち替えたままになるので、
  sr-visualizer に `case:` で手順をそのまま渡した描画（持ち替えたままの向き）とは違うが、ほかの種類と同じく打ち消した向きで描く

## テスト（`test/zbll-data.test.js` ほか）
- 472 件・名前が重ならない・OCLL の 7 種類と件数・段階の順、小グループが 40 組でひとかたまり、生成物が最新
- 全手順（別解も）が確認を通り、`setup` は面回しと括弧付きの AUF だけ
- 手順とは別の系統の確認：各ケースが最後の層だけを崩し、その OCLL の OLL（H→21、Pi→22、U→23、T→24、L→25、Antisune→26、Sune→27）になる。472 ケースの状態が前後の AUF を除いてすべて違う
- `test/scrambles.test.js`：ZBLL のスクランブル全件（本数 1〜20）
