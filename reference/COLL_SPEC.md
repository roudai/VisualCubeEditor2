# COLL の仕様（3x3x3）

上面の十字ができている（エッジが4枚とも向いている。OLL 21〜27）ときに、コーナーの向きと位置を一度に揃える COLL（40 ケース）を、
PLL・OLL と同じく一覧・練習・記録・エディタで使う。コードと食い違うときはコードを正とする。

- データと確認：`data/coll/algs_info.json`、`tools/build-coll-data.js`（共通部分は `tools/build-case-data.js`）、
  `js/coll-data.js`（生成物）、`js/coll-groups.js`、`js/case-check.js`、`test/coll-data.test.js`
- 画面：一覧 `coll.html`（`js/cases.js`）、エディタ（`js/editor-cases.js`）、練習・記録（`reference/PRACTICE_SPEC.md`）

## 出典
roudai.net の COLL（https://roudai.net/oll/coll/ ）に準拠する。

- 各ケースの手順はページの手順そのまま（各ケース1本）。記号もページの書き方のまま（`R'2`・`U2'` など）。前の `(U)` などの AUF もそのまま
- 図の向きは、ページの図と同じにする。ページの図は、手順をそのまま `case` に渡して描いている（sr-visualizer の `{ view: 'plan', mask: 'coll' }`）
  - 作るときに、sr-visualizer の `case: a` と `algorithm: s`（`mask: 'coll'`）の描画を 40 ケースとも比べ、一致を確かめた。一覧の画像（`CubeDraw`）とも一致する
- **番号の直し**：ページの見出しは「OLL n26 Sune」「OLL n27 Anti-Sune」だが、OLL のページ（と一般の番号）では Sune が OLL 27、Anti-Sune が OLL 26。
  ここでは OLL の番号に合わせ、Anti-Sune の6ケースを 26-1〜26-6、Sune の6ケースを 27-1〜27-6 にした（ユーザーの回答。中の並びはページのまま）

## データ：`data/coll/algs_info.json`

```json
"35": {
  "name": "27-1",
  "group": "Sune",
  "algset": "COLL",
  "s": "R U2 R' U' R U' R'",
  "a": "R U R' U R U2' R'"
}
```

- キーは 1〜40 の通し番号（並び順）。`algset` は `"COLL"`（生成物には入れない）
- `name`：「OLL の番号-ページの中の通し番号」（ページの `n21-1` から `n` を外したもの。26・27 は上の「番号の直し」のとおり）
- `group` と並び（グループの説明は `js/coll-groups.js` の `CASE_GROUP_NOTES.coll`。画面では「H (OLL 21)」のように添える）

| グループ | 説明 | ケース |
|---|---|---|
| H | OLL 21 | 21-1〜21-4 |
| Pi | OLL 22 | 22-1〜22-6 |
| U | OLL 23 | 23-1〜23-6 |
| T | OLL 24 | 24-1〜24-6 |
| L | OLL 25 | 25-1〜25-6 |
| Anti-Sune | OLL 26 | 26-1〜26-6 |
| Sune | OLL 27 | 27-1〜27-6 |

- `a`：解く手順（Algorithm to solve case）。`[前AUF] 手順`。最後に括弧付きの AUF・向きを戻さない持ち替えは付けない
- `s`：そのケースになる手順（Algorithm to apply）。`a` の逆手順を、センターを動かさない面回しだけに直したもの（2層回しは面回し＋持ち替えとみなし、
  持ち替えのぶん後ろの面を読み替える）。`a` の逆とちょうど同じ状態になる。`a` に前の AUF があるケースは、最後に括弧付きの AUF が付く（例：21-1 の `… F' (U')`）
- 覚える順は無い（出典に無い）。名前が番号ではないので、一覧・練習・記録の並びはグループ順だけ（並びの切り替えは出ない）

## 確認（`js/case-check.js` の `check('coll', a, s)`。生成時と、エディタの「自分の手順」で使う）
- 図に見える部分（`collPattern`）：上面 9 枚と、側面のコーナーのステッカー。側面のエッジのステッカー（側面上段の真ん中）は比べない（COLL はエッジの位置を揃えないため）
- エラーにするもの
  - `a` の最後に括弧付きの AUF（`trailing-auf`）、向きを戻さない持ち替え（`trailing-y`）
  - `s` が最後の層以外を崩す、または上面のエッジが向いていない（`setup-f2l`）
  - `a` を回すと、F2L が崩れる、または上面の向きとコーナーの位置が最後の AUF を除いて揃わない（`not-solved`。エッジの位置は問わない）
  - `a` の逆と `s` で、図に見える部分が違う（`mismatch`）
- AUF の付け直しの候補（`fitSetup`）・ケースの見分け（`caseKey`・`findCase`）は PLL と同じく前後の AUF 4×4 通りを試し、図に見える部分で比べる

## 練習用のスクランブル
- `data/coll/scrambles.json` → `js/coll-scrambles.js`（`window.COLL_SCRAMBLES`）。各 20 本（`node tools/gen-scrambles.js coll` → `node tools/build-scrambles.js coll`）
- 作り方（`collScramble`）：`setup` の状態から、上面の向きとコーナーの位置はそのまま、最後の層のエッジの位置だけを一様ランダムにし（偶奇はコーナーに合わせる）、
  ランダムな AUF を付けた状態をソルバで解き、その逆をスクランブルにする。各スクランブルがそのケースになることを確かめる（`verifyScramble`）

## 画面
- 一覧（`coll.html`、URL は `/coll`）：PLL・OLL の一覧と同じ（習得状況、絞り込み、グループのボタン、練習する、ZIP、すべて未習得に戻す）
  - 画像は PLL と同じ配色（エディタで保存した配色。OLL 配色のときは OLL を選ぶ前の配色）で、側面のエッジのステッカーをグレー（`#404040`）にする（`Progress.caseColors(c, scheme, 'coll')`）
  - ZIP は `visualcube-coll.zip`（中は `coll-21-1.png` など）
  - ナビバーにはリンクを置かない（ユーザーの回答）。OLL 一覧の説明の下に「COLL（十字完成のケースのコーナーを一度に揃える）›」のリンクを置く（以前は「COLL一覧（…）›」）
- エディタ：COLL の行は無く、OLL の行で選ぶ（`OLL [COLL H (OLL 21) ▼] [21-2 ▼] [‹ Prev][Next ›]`。1つ目で COLL のグループを選ぶとその最初のケース、2つ目でそのグループのケース）。Prev / Next は COLL 全体をデータの順に送る（21-4 の次は 22-1。1つ目も切り替わる）。URL は `?coll=21-1`（優先順位は `?pll` → `?oll` → `?coll` → `?case` → `?alg`）。ファイル名は `coll-21-1.png`
  - COLL を選ぶと、配色は PLL を選んだときと同じ扱い（OLL 配色なら OLL を選ぶ前の配色に戻す）にし、Stage Mask を COLL にする
  - COLL 以外を選ぶ・選択を外す・Clear で、COLL で付けた Stage Mask を外す。COLL を選んでいる間に手で Stage Mask を変えたら、それ以降は触らない
  - 自分の手順は PLL・OLL と同じく保存できる（`custom-algs` の `coll`）
- 練習・記録：種類のボタンに COLL を足す（PLL / OLL / COLL / ソルブ）。記録の表の並びは苦手順 / グループ順
- 保存：習得状況は `progress.coll`、最近のタイムは `practice.times.coll`、練習の記録は `practice.log`（`set: 'coll'`。PLL・OLL・COLL を合わせて最新 2000 件）

## テスト（`test/coll-data.test.js` ほか）
- 40 件・名前・グループ・並び、グループの説明、生成物が最新
- 各ケースが確認を通り、`setup` が面回しと括弧付きの AUF だけで、solve case の状態と `setup` の状態がちょうど同じ
- 手順とは別の系統の確認
  - 各ケースの手順で、そのグループの OLL（H → 21 … Sune → 27）が揃う（`findCase('oll', a, OLL)`）
  - 上面のコーナーの状態（向きと位置）を状態から直接読み、40 ケースが AUF の違いを除いてすべて違う
- 全ケースが互いに違うケースで、自分の手順でしか揃わない
- `test/case-check.test.js`：COLL の確認のコード、エッジの位置だけが違う状態は同じケース、`findCase`
- `test/scrambles.test.js`：代表的なケースで生成と確認、置いてあるスクランブル全件の確認（CaseCheck を使わず、最後の層のエッジを除いた状態で比べる）
- `test/progress.test.js`：`caseColors` の COLL のグレー
