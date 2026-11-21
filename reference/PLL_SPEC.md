# PLL 21ケース：データと確認の仕様

3x3x3 の PLL（全21ケース）の名前・解く手順・そのケースになる手順を持ち、エディタ・一覧・練習で使う。
MegaminxImageEditor の `reference/PLL_SPEC.md` を 3x3 用に書き直したもの。コードと食い違うときはコードを正とする。

- データと確認：`data/pll/algs_info.json`、`tools/build-pll-data.js`（共通部分は `tools/build-case-data.js`）、
  `js/pll-data.js`（生成物）、`js/pll-groups.js`、`js/case-check.js`、`js/custom-algs.js`、`test/pll-data.test.js`
- 画面（エディタのケース選択、一覧 `pll.html`、一括ダウンロード）：`js/editor-cases.js`、`js/cases.js`、`js/cube-draw.js`（「画面」の節）。練習と記録は `reference/PRACTICE_SPEC.md`

## 元データ：`data/pll/algs_info.json`

```json
"8": {
  "name": "T",
  "group": "Adjacent swap",
  "algset": "PLL",
  "s": "F R U' R' U R U R2 F' R U R U' R'",
  "a": "R U R' U' R' F R2 U' R' U' R U R' F'"
}
```

- キーは 1〜21 の通し番号（並び順）。`name`：ケース名。`group`：グループ名。`algset`：`"PLL"`（生成物には入れない）
- `a`：そのケースを解く手順（1本の文字列）。Algorithm to solve case で入力欄に入る
- `s`：揃った状態から回すとそのケースになる手順。Algorithm to apply で入力欄に入る
- 手順・名前・図の向きは roudai.net の PLL 手順（https://roudai.net/pll/pll/）に準拠する（一覧は下の表。下の「出典」）

### グループと並び（5グループ・21ケース）

| グループ | 説明（`js/pll-groups.js`） | ケース |
|---|---|---|
| Edges only | EPLL | Ua Ub H Z |
| Corners only | CPLL | Aa Ab E |
| Adjacent swap | Adjacent corner swap | T F Ja Jb Ra Rb |
| Diagonal swap | Diagonal corner swap | Y V Na Nb |
| G | Double cycle | Ga Gb Gc Gd |

`js/pll-groups.js` は `window.CASE_GROUP_NOTES.pll`（グループ名 → 説明の文字列。移植元の `js/case-groups.js` の `pll` と同じ持ち方で、
英語の文字列だけ）。OLL は `js/oll-groups.js` が `CASE_GROUP_NOTES.oll` を足す（読み込む順は問わない）。node では `require` で PLL の分が返る。
画面では「Edges only (EPLL)」のように括弧付きで添える。

### 出典（roudai.net）

- `a` は、そのページで各ケースの**最初に載っている手順**（両手）。記号もページの書き方のまま写す（`M'2`・`U'2` など。`js/cube-state.js` が `X'2`・`X2'`・`′` を読める）。
  ただし H の `M2` はすべて `M2'`、Gb の2手目は `R2'`、Gc の最後から2手目は `R2'` と書く（ユーザーの指定。状態は `M2`・`R2` と同じ）。
  ページの2本目以降の手順は `test/pll-data.test.js` の `SITE_ALGS` に置き、同じケースになることを確かめる
  （ページの Jb の片手 `R U'2 R' U' R U'2` は途中で切れていて揃わず、Na の片手・最少 `L U' R U'2 L' U L R' U' R U2 L U R'` も揃わないので入れていない）
- **図の向き**：そのページの図は、最初の手順をそのまま `case` に渡して描いている（sr-visualizer の Plan 表示）。
  ここでも同じ状態になるように `s` を作る（下の「AUF」）。手順の最初・最後の `U`（Jb の最後の `U'`、Gb の最初の `U'` など）も、そのページのとおり手順に含める
- **名前**：ページの名前（`U.a` → `Ua`）を使う。国際的に多い呼び方とは、**Ua⇔Ub・Aa⇔Ab・Ra⇔Rb・Ga⇔Gd・Gb⇔Gc が入れ替わっている**
  （例：ここでの Ua は `R2 U R U R' U' R' U' R' U R'` で、3エッジが時計回り）。J・N・ほかは同じ
- 並びとグループは前と同じ（ページの並び `Ua Ub Aa Ab Z H E T V F Ra Rb Jb Ja Y Ga Gb Gd Gc Nb Na` ではなく、下のグループ順）

### 記法

`js/cube-state.js` の先頭コメントのとおり。Megaminx と違う点：

- 大文字・小文字を区別する（`R` と `r` は別。`r` = `Rw` = 2層回し）
- 中層 `M E S`、持ち替え `x y z` が使える。`a` に書いてよい（`s` には書かない）
- 読み替え（`Br` → `BR` など）は無い（`CaseCheck.convert` はそのまま返す）

## AUF

```
a = [前AUF] 手順
s = [AUF] setup [AUF]
```

- AUF は `(U)` `(U2)` `(U')` のいずれか（括弧で囲む）、または無し。**4通り**（Megaminx は5通り）
- **`a` の最後に括弧付きの AUF（`(U)` など）は付けない**（確認でエラー）。出典の手順の最後に括弧の無い `U` があれば（Jb の `… R' U'` など）、
  それは手順の一部としてそのまま書き、そのぶん図の向き（`s`）もそれを含めて揃う状態にする
- **`a` の最後の持ち替え**は、`x … x'` のように手順全体でセンターが元の位置に戻るものだけ書いてよい（Aa・Ab・E）。
  向きを戻さない持ち替え（回し終わってから `y` するだけ、など）は付けない
- 手順の途中の持ち替え・2層回し・中層回しで完成後の向きが変わっても、揃ったとみなす（V の `y`、Ua・Ub・H・Z の `M`）。
  Algorithm to solve case の表示と確認では、センターが動いたぶんを自動で打ち消す（`CubeState.applyAlg` の `cancelRotation`）
- **`s` はセンターを動かさない**。素の面回し（`U R F D L B`）と括弧付きの AUF だけで書く。`a` の逆手順と**ちょうど同じ状態**（＝出典の図と同じ）になるようにする
  - `a` が面回しだけなら、`s` は `a` の逆手順そのもの
  - 持ち替え・2層回しがあれば、逆手順を面回しに直す（`r` は `L` ＋持ち替え、`Fw` は `B` ＋持ち替え、`x y z` は持ち替えだけとみなし、持ち替えのぶん後ろの面を読み替える）。例：Aa の `s` は `R2 F2 R' B' R F2 R' B R'`
  - 中層回し（`M`）がある H・Z は、面回しに直すと長くなるので、出典の2本目以降の中層回しの無い手順の逆から作る（H は `R2 U2 R U2 R2 U2 R2 U2 R U2 R2`、Z は `R' U' R U' R U R U' R' U R U R2 U' R'` 系）。同じ状態になるよう前後の AUF を付けて合わせる
  - 出典の図と同じになることは、作るときにブラウザで sr-visualizer の `case: a` と `algorithm: s` の描画（Plan 表示）を全ケースで比べて確かめた（21 ケースとも一致）
- 満たすべき条件（生成スクリプトが確認する。`js/case-check.js` の `check('pll', a, s)`）
  - `s` の状態に `a` を回すと、最後の AUF を除いて揃う
  - `a` を Algorithm to solve case で表示した状態（`a` の逆手順）と、`s` を Algorithm to apply で表示した状態が一致する
- `a` の前AUFを変えると solve case の画像が（ケースを U で回した形に）変わるので、`s` の前後の AUF で合わせる。
  合っていなければ生成スクリプトが直し方の候補を出す

### 標準の向きと前AUF

標準の向きは、出典（roudai.net）の図の向き（＝そのケースの最初の手順で揃う状態）とし、下の表のピースの動きで決める。
今の21ケースは、どれも括弧付きの前AUFを使っていない（Gb・Gd の最初の `U'`・`U` は出典の手順のとおりで、括弧は付けない）。

表の「ピースの動き」は、解くとピースがどう動くか。`UR>UL>UF` は「UR のピースが UL へ、UL のが UF へ、UF のが UR へ」。
位置は上から見た名前（コーナー UBL UBR UFR UFL、エッジ UB UR UF UL）。`test/pll-data.test.js` の `EXPECTED` と同じ内容。

| 名前 | ピースの動き（標準の向き） | `a`（解く手順。出典の最初の手順） |
|---|---|---|
| Ua | UR>UF>UL | `R2 U R U R' U' R' U' R' U R'` |
| Ub | UR>UL>UF | `R U' R U R U R U' R' U' R2` |
| H | UB>UF UR>UL | `M2' U M2' U2 M2' U M2'` |
| Z | UB>UR UF>UL | `M' U M'2 U M'2 U M' U2 M'2 U'` |
| Aa | UBR>UFL>UFR | `x' R U' R D2 R' U R D2 R2 x` |
| Ab | UBR>UFR>UFL | `x' R2 D2 R' U' R D2 R' U R' x` |
| E | UBL>UFL UBR>UFR | `x' R U' R' D R U R' D' R U R' D R U' R' D' x` |
| T | UBR>UFR UR>UL | `R U R' U' R' F R2 U' R' U' R U R' F'` |
| F | UBR>UFR UB>UF | `R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R` |
| Ja | UBL>UBR UB>UL | `R' U L' U2 R U' R' U2 L R U'` |
| Jb | UBR>UFR UR>UF | `R U R' F' R U R' U' R' F R2 U' R' U'` |
| Ra | UBL>UBR UR>UF | `R' U2 R U'2 R' F R U R' U' R' F' R2 U'` |
| Rb | UBR>UFR UB>UL | `R U' R' U' R U R D R' U' R D' R' U'2 R' U'` |
| Y | UBL>UFR UB>UL | `F R U' R' U' R U R' F' R U R' U' R' F R F'` |
| V | UBL>UFR UB>UR | `R' U R U' R' Fw' U' R U2 R' U' R U' R' Fw R` |
| Na | UBR>UFL UR>UL | `R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'` |
| Nb | UBL>UFR UR>UL | `R' U R U' R' F' U' F R U R' F R' F' R U' R` |
| Ga | UBL>UBR>UFL UB>UL>UF | `D' R U R' U' D R2 U' R U' R' U R' U R2 U` |
| Gb | UBL>UFL>UBR UB>UF>UL | `U' R2' U' R U' R U R' U R2 D' U R U' R' D` |
| Gc | UBL>UFL>UFR UB>UF>UL | `D R' U' R U D' R2 U R' U R U' R U' R2' U'` |
| Gd | UBL>UFR>UFL UB>UL>UF | `U R2 U R' U R' U' R U' R2 D U' R' U R D'` |

`s`（そのケースになる手順）は `data/pll/algs_info.json` を参照。どのケースの `s` にも括弧付きの AUF は付いていない。

## データファイル（生成）

- `node tools/build-pll-data.js`：`data/pll/algs_info.json` を読み、上の条件を確認して `js/pll-data.js` を書き出す。
  処理は `tools/build-case-data.js` の `createBuilder('pll')`（OLL と共通）。`tools/build-pll-data.js` はそれを呼ぶだけで、
  `require` すると `{ SRC, OUT, check, suggest, cases, build, main }` が返る
- 次の場合はエラーで止め、ケース名と理由を表示する（`js/pll-data.js` は書き出さない）
  - `name`・`group` が無い、名前が重複している
  - `a`・`s` が文字列でない、手順が解釈できない
  - `a` の最後に AUF、または向きを戻さない持ち替えが付いている
  - `a` で `s` のケースが揃わない
  - solve case と apply の画像が一致しない
- AUF の付け直しで直るときは、直し方の候補も表示する（`CaseCheck.fitSetup`）
  - 書かれた `a` の前AUFは活かし、`s` の前後の AUF を 4×4 通り試す。`a` の最後の AUF・持ち替えは外し、`a` を変えたときだけ「候補 a」も出す
  - 候補が複数あるときは `s` に付ける AUF が少ない → `s` の前に AUF を付けない を優先する
  ```
  data/pll/algs_info.json に問題があります:
    T: a で s のケースが揃いません（最後の AUF を除いても揃わない）
      候補 s: F R U' R' U R U R2 F' R U R U' R' (U')
  ```
- `js/pll-data.js` は手で編集しない。ブラウザでは `window.PLL_DATA`、node では `module.exports`
- 形式（元データの順番を保つ。`alg` = `a`、`setup` = `s`）
  ```js
  [
    { name: 'Ua', group: 'Edges only', stage: 1, order: 1, alg: "R2 U R U R' U' R' U' R' U R'", setup: "R U' R U R U R U' R' U' R2", inverse: 'Ub' },
    ...
  ]
  ```
- `inverse`：逆手順のケース名。そのケースの `alg` を揃った状態に回してできる状態（前後の AUF の違いは無視。`CaseCheck.caseKey`）が `setup` の状態と一致するケース。ちょうど 1 つでなければ生成でエラー（`tools/build-case-data.js`。PLL だけ）
  - Ua ↔ Ub、Aa ↔ Ab、Ga ↔ Gb、Gc ↔ Gd。ほかの 13 ケース（H、Z、E、T、F、Ja、Jb、Ra、Rb、Y、V、Na、Nb）は自分自身
  - 練習で、直前のケースの逆手順を続けて出さないのに使う（reference/PRACTICE_SPEC.md）
- 練習用のスクランブル（`data/pll/scrambles.json` → `js/pll-scrambles.js`）は別のツール（`tools/gen-scrambles.js`・`tools/build-scrambles.js`）で作る。
  このスクリプトは作らない（Megaminx では `build-pll-data.js` が両方作っていた）

## 覚える順番

Cube Voyage「PLLを覚える順番」（https://cubevoyage.net/how-to-solve/advanced/pllsequence/）に準拠する。

- `data/pll/learn_order.json` は段階ごとのケース名の配列（13 段階・21 件。全ケースをちょうど1回ずつ。生成時と `test/pll-data.test.js` で確認）
  ```
  U(Ua Ub) → T → Y → H → Z → J(Ja Jb) → A(Aa Ab) → F → V → R(Ra Rb) → E → G(Ga Gb Gc Gd) → N(Na Nb)
  ```
  - 出典は種類（U-perm など）ごとに並べている。段階の中の a・b は、出典と名前の付け方が違う（このデータは roudai.net の名前）ので、データの順にした
- 生成（`tools/build-case-data.js`）で、各ケースに `stage`（段階 1〜13）と `order`（覚える順の通し番号 1〜21）を付ける
- 段階の記号は種類の文字（`U`・`J`・`G` など。`CaseSections.stageLabel`）。一覧と練習の段階のボタンは記号だけ
- 段階の名前（`js/i18n.js` の `stage.pll.<記号>`）は「U-perm」の形。見分けやすい5つだけ説明を付ける：
  U-perm（エッジ3つ / 3 edges）、H-perm（向かいのエッジ / opposite edges）、Z-perm（隣のエッジ / adjacent edges）、A-perm（コーナー3つ / 3 corners）、E-perm（コーナー2組の交換 / 2 corner swaps）。ほかは T-perm・Y-perm・J-perm・F-perm・V-perm・R-perm・G-perm・N-perm
- 一覧の見出しは「1. U-perm（エッジ3つ）」のように番号と名前（記号は順番を表さないので番号を付ける。OLL は記号 A〜M が順番なので番号なし）。段階のボタンにマウスを乗せると見出しと同じ文、練習のボタンはそれにケース数（「1. U-perm（エッジ3つ） · 2」）
- 一覧・練習・記録の並びは「グループ順 / 覚える順」。選んだ並びは `visualcube-editor:list-filter` の `pllOrder`（`'group'` / `'learn'`。一覧と練習で共通）。既定はグループ順

## 自分の手順（PLL・OLL 共通）

確かめる内容は `js/custom-algs.js` の `validate`（確認処理は生成スクリプトと共通の `js/case-check.js`）。

1. 表記を整える（全角の記号を半角に、`Rw` → `r`。大文字・小文字は別の回し方なので変えない）。読めなければ `Invalid move: …`
2. 最後の AUF と、向きを戻さない持ち替え（`x y z`）は外す（外したことを知らせる）。`x … x'` のように向きが戻るものは残す。
   先頭の括弧の無い AUF は `(U2)` のように括弧で書き直す
3. 既定の setup の前後に AUF を付け直し（PLL は 4×4 通り）、生成スクリプトと同じ確認を通る setup を探す。見つかればそれを apply 用の setup として保存する
4. 見つからなければ「この手順では揃わない」。ほかのケースなら解ける場合はその名前を添える（`CaseCheck.findCase`）
- 既定の手順と同じ回し方（空白・括弧・`R2'` と `R2` のような書き方の違いは同じとみなす）なら、自分の手順としては保存しない
- 保存：localStorage の `visualcube-editor:custom-algs`（`{ pll: { "Jb": { alg, setup } }, oll: { ... } }`）。読み込むときに確認し、合わない値は無視して既定を使う

## 画面

### エディタ（`index.html`、`js/editor-cases.js`＝`js/main.js` の Vue アプリの mixin）
- `PLL  [Group ▼] [Case ▼] [‹ Prev][Next ›]` の行で選ぶ（OLL の行はその下。同時に選べるのは PLL・OLL のどちらか1つ）。
  Prev / Next はデータの並び順で、端では反対の端に回る
- 選ぶとパズルの種類を 3x3、表示を Plan（上面図）に切り替える（保存しない）。未選択から選んだときは種類を「Algorithm to solve case」にし、
  種類に応じて手順の欄に `alg`（Algorithm to solve case）または `setup`（Algorithm to apply）を入れる。どちらでも同じケースの画像になる
- 画像サイズ：数値の入力欄 `#imageSize`（Megaminx Image Editor と同じ。↑↓で 1 ずつ）。確定（Enter・欄を離れる）で反映し、整数に丸めて 100（Megaminx Image Editor と同じ最小）〜`imageMax`（画面の幅の 80% を 100 単位に丸めたもの、最大 1000）に収める。空・数でないときは前の値に戻す。横の「リセット」で 128（上限が 128 より小さい画面では上限）に戻す
- 画像（`#editorPreview`）は下にスクロールしても画面の上に残す（`sticky-top`）。表示は画面の高さの 35% まで（描く大きさ・ダウンロードする PNG は画像サイズのまま）。「ダウンロード」のボタンは画像のすぐ下（Megaminx Image Editor と同じ。ファイル名の欄は設定の中）。入力欄までのスクロールで画像の下に隠れないよう、画像の高さを `scroll-padding-top` にする（`js/main.js` の mounted）
- 手順の種類（Algorithm to apply / to solve case / Defines the cube state）の選び方：広い画面はラジオボタン、スマホ（幅 576px 未満）はプルダウン `#algorithmTypeSelect`
  （3 つ目だけ 2 行目に落ちて崩れるため）。どちらも Vue の `algtype` を v-model で共有する。キューブが 7 以上で「Defines the cube state」を選べないのも同じ
- ファイル名は `pll-<名前>.png`（Download ボタンで、表示中の画像を PNG で保存する）
- URL は `?pll=<名前>`（`?pll=` → `?oll=` → `?case=` → `?alg=` の優先順）
- パズルの種類を 3x3 以外に変えると選択を外す。Clear は手順と選択の両方を消す
- **自分の手順**：ケースを選んでいる間は、手順の欄を書き換えても選択を外さず「編集中」と出す。「Algorithm to solve case」のときに Save（Enter でも）で保存する
  （確かめる内容は上の「自分の手順」）。保存したケースは「custom」のバッジになり、「Reset to default」で既定に戻す。保存・既定に戻すのあとは「元に戻す」を出す
- **手順の確認（3x3 のときだけ）**：`js/cube-state.js` で読めない記号・括弧の対応をその場で調べ、欄の下にエラーを出す（前の画像は残す）。
  描画ライブラリ（srVisualizer）には、括弧と繰り返しを展開した手順（`CubeState.flatten`）を渡す。
  「Algorithm to solve case」は、手順中の持ち替え・2層回し・中層回しで完成後の向きが変わっても揃ったとみなす（センターを元の位置に戻す持ち替えを足す）。
  3x3 以外は今までどおり、入力をそのままライブラリに渡す
- **Color Preset**（Standard / OLL (U color only) / Custom）：面の色を手で変える・x y z で持ち替えると Custom になり、その配色を覚える。
  OLL を選ぶと OLL 配色にし、OLL 配色のまま PLL を選ぶと OLL を選ぶ前の配色に戻す（覚えていなければ Standard）
- **Background**（Transparent / Opaque）：Opaque のとき Background Color で塗る。Background Color を選ぶと Opaque になる
- 設定の保存（`visualcube-editor:settings`）：配色・Color Preset・画像サイズ・Cube Color・Background Color・Background。
  手順・種類・選択・ファイル名・パズルの種類・表示・マスク・回転・矢印は保存しない

### 一覧（`pll.html`、`js/cases.js`、`css/cases.css`）
- 21ケースの画像・名前・手順をグループごとに並べる。画像は solve case の状態（`alg` の逆手順を回し、センターが動いたぶんを打ち消す）の上面図
  （`js/cube-draw.js`。srVisualizer の Plan 表示なので、エディタと同じ見た目）
- カードのケース名はカードの左右の真ん中に置き、右に逆手順のケース（`inverse`）を薄い字で「⇄ Ub」（自分自身が逆手順のケースは出さない。Ua・Ub・Aa・Ab・Ga〜Gd の 8 ケースだけ）。自分の手順のケースの「カスタム」の札は名前の左。マウスを乗せると・読み上げは「逆手順：Ub」。自分の手順にしたケースも同じ（逆手順はケースの性質で、手順を変えても組は変わらない）。幅 340px 未満では逆手順を名前の下の行に出す。OLL・COLL・ZBLL の一覧には出さない
- カードの並び：スマホ（幅 576px 未満）も 1 行 3 枚、768px 以上は 4 枚、992px 以上は 6 枚（`js/cases.js` の `buildSections`。OLL・COLL・ZBLL の一覧も同じ）。画像はカードの幅に合わせて縮む（最大 120px。`.case-image` の中の svg を CSS で縮める）。スマホではカードの中の余白・ケース名・手順の文字と、右上の習得状況の丸（見た目 18px・押せる範囲 28px）を小さくする
- 配色はエディタで保存した設定：保存した配色（OLL 配色のときは OLL を選ぶ前の配色、それも無ければ Standard）。Cube Color も保存した設定
- ケースを押すと、そのケースを選んだ状態でエディタ（`/?pll=…`）を開く。自分の手順があるケースはその手順と画像で出し、「custom」を付ける
- 習得状況（未習得 / 練習中 / 習得済み）：カード右上の丸を押すたびに切り替える（`visualcube-editor:progress`）。
  上部に進み具合のバーと絞り込み、グループの見出しに「習得済みの数 / 全体」。バーの下に件数の行は出さない（件数は絞り込みのボタンに出ているので、同じ数を 2 回並べない）。
  絞り込みのボタンはバーの色と同じ順（すべて・習得済み・練習中・未習得。それぞれ件数付き）で、習得済み・練習中・未習得には状態の色の点を付けてバーの色の凡例を兼ねる。スマホ（幅 576px 未満）はボタンの余白・文字・点を少し小さくし、4 つを 1 行に収める
  - 絞り込みチップの右に「すべて未習得に戻す」（目立たない小さなリンク。習得状況が1つも無いときは出さない）。グループの選択・絞り込みに関係なく、その種類（PLL / OLL）のケースすべてが対象
    - 押すとすぐには戻さず、「PLL のすべてのケースを未習得に戻しますか？（習得済み n・練習中 m が消えます）」と「未習得に戻す」「キャンセル」を出す（ブラウザの確認ダイアログは使わない。最初のフォーカスはキャンセル）
    - 戻すときは、その種類の習得状況を1回の保存で消す（ログイン中にケースの数だけクラウドへ送らないように）
    - 戻したあとは「n ケースを未習得に戻しました。 元に戻す」。元に戻すと、そのあとに付けた習得状況は残したまま、消したものを戻す。カードの丸を1つ押すと「元に戻す」は消える
    - 消すのは習得状況だけ（練習の記録・最近のタイムは消さない）
- グループのボタン：押したグループだけを表示する（複数選べる。「選択を解除」で戻す）。1〜2 文字の名前（段階の U・T…、COLL・ZBLL の H・Pi など）のボタンは同じ幅にそろえ（`min-width`。スマホは少し狭く、2 文字の名前がある並びは `.two-char` で 2 文字が入る幅）、長い名前は中身の幅のまま。練習ページのグループのボタンも同じ。絞り込みと合わせて `visualcube-editor:list-filter` に保存
- 「練習する」：今の絞り込み・選んだグループのまま練習ページを開く（`reference/PRACTICE_SPEC.md`）
- 並び：進み具合の上で「グループ順 / 覚える順」を切り替える（上の「覚える順番」）。覚える順ではグループのボタンが段階（U・T・…・N）のボタンになる（選んだ段階は `list-filter` の `pllStages`）

### 一括ダウンロード
- 「Download ZIP」（スマホの幅では出さない）：全21ケースを一覧と同じ配色で PNG にし、`visualcube-pll.zip`（中は `pll-<名前>.png`）にまとめる（`js/zip-store.js`、無圧縮）
- 押してすぐにはダウンロードしない。ボタンの下に確認の行（「PLL の 21 ケースの画像（200px・背景は透明）を 1 つの ZIP にまとめてダウンロードしますか？」、**ダウンロード**・**キャンセル**、その下に「画像の大きさや色はエディタで変えられます」）を出し、ダウンロードで始める。ボタンをもう一度押すかキャンセルで閉じる。言語を変えると文を直す。OLL・COLL・ZBLL の一覧も同じ（`#zipConfirm`・`renderZipConfirm`）
- 画像サイズ・Cube Color・背景はエディタで保存した設定（サイズは 100〜1000 px に収める。保存が無ければ 200 px、透明）。SVG を Image → canvas で PNG にする

## テスト（`test/pll-data.test.js`、`node --test test/pll-data.test.js`）

- 21ケースを元データの順に含み、名前が重複しない。グループは5つで、件数（4・3・6・4・4）と並びが決めたとおり
- `js/pll-groups.js` に全グループの説明がある
- `js/pll-data.js` が最新（生成し直しても変わらない）
- 各ケース
  - `check('pll', alg, setup)` が null。`setup` の状態に `alg` を回すと最後の AUF を除いて揃い、`alg` の case 表示が `setup` の状態と一致する
  - `alg` の最後に括弧付きの AUF・向きを戻さない持ち替えが無い（出典の手順の最後の括弧の無い `U` はよい）
  - `setup` の状態で崩れているのは側面上段の12枚だけ（上面は U 色、F2L とセンターは揃ったまま）
  - `setup` は素の面回しと括弧付きの AUF だけ
- **名前とケースの対応**（`a` と `s` が互いに合っていても、名前が違うケースを指していたら上の確認では分からないため、手順とは別の系統で確かめる）
  - `EXPECTED`：各 PLL のピースの動きを直書きしたもの（上の表）。`setup` の状態が、AUF の違い（前後 4×4 通り）を除いてこれと一致する。
    状態は回転の計算を通さず、ステッカーを直接置いて作る。置換どうしの比較（`classKey`）でも確かめ、ほかの20ケースとは一致しないことも見る
  - `EXPECTED` の21個は、どれも 3x3 で作れる置換（コーナーとエッジの偶奇が同じ）で、互いに違うケース
  - `alg` から前AUFを外した手順が、標準の向き（`EXPECTED` の状態）から最後の AUF を除いて揃う
  - `SITE_ALGS`：出典（roudai.net）で各ケースの2本目以降に載っている手順。`findCase` で同じ名前のケースになる
  - `OTHER_ALGS`：データとは別の、国際的な呼び方で広く知られている手順（各ケース1〜2本）を、名前の入れ替え（Ua⇔Ub・Aa⇔Ab・Ra⇔Rb・Ga⇔Gd・Gb⇔Gc）をしてここでの名前に読み替えたもの。`findCase` で同じ名前のケースになる
  - 逆の関係：Ua⇔Ub、Aa⇔Ab、Ga⇔Gb、Gc⇔Gd は互いに逆、ほかは自分が逆
- `inverse` が実在のケース名で、対になっている（逆の逆が自分）。Ua ↔ Ub、Aa ↔ Ab、Ga ↔ Gb、Gc ↔ Gd、H ↔ H、Ja ↔ Ja
- 全ケースが互いに違うケースで、あるケースの手順でほかのケースは揃わない

名前を入れ替える（たとえば Ua と Ub の `a`・`s` を交換する）と、生成は通るがこのテストが落ちる。
