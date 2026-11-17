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
- 手順は、スピードキューブで広く使われている標準的なもの（一覧は下の表）

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
- **`a` の最後の AUF は付けない**。例：Jb の `R U R' F' R U R' U' R' F R2 U' R'` は回し終わると上の層が 90° ずれているが、`(U')` は書かない
- **`a` の最後の持ち替え**は、`x … x'` のように手順全体でセンターが元の位置に戻るものだけ書いてよい（Aa・Ab・E・Ja）。
  向きを戻さない持ち替え（回し終わってから `y` するだけ、など）は付けない
- 手順の途中の持ち替え・2層回し・中層回しで完成後の向きが変わっても、揃ったとみなす（V の `y`、Ua・Ub・H・Z の `M`）。
  Algorithm to solve case の表示と確認では、センターが動いたぶんを自動で打ち消す（`CubeState.applyAlg` の `cancelRotation`）
- **`s` はセンターを動かさない**。素の面回し（`U R F D L B`）と括弧付きの AUF だけで書く。
  `a` に持ち替え・2層回し・中層回しがあるケースは、`a` の逆手順そのままではなく、同じケースになる面回しだけの手順を書く
  （Ua・Ub・H・Z は R と U だけの手順、Aa・Ab・E は `x` を外して面を読み替えたもの、Ja・V は持ち替えの無い別の手順の逆）。
  それ以外のケースの `s` は `a` の逆手順そのもの
- 満たすべき条件（生成スクリプトが確認する。`js/case-check.js` の `check('pll', a, s)`）
  - `s` の状態に `a` を回すと、最後の AUF を除いて揃う
  - `a` を Algorithm to solve case で表示した状態（`a` の逆手順）と、`s` を Algorithm to apply で表示した状態が一致する
- `a` の前AUFを変えると solve case の画像が（ケースを U で回した形に）変わるので、`s` の前後の AUF で合わせる。
  合っていなければ生成スクリプトが直し方の候補を出す

### 標準の向きと前AUF

前AUFは「手順を、そのケースの標準の向きから回し始められるようにする」ために付ける。標準の向きは、その手順が載っている一般的な
PLL 表の図の向き（＝その手順を回し始める向き）とし、下の表のピースの動きで決める。**今の21ケースは、どれも前AUFなしで標準の向きから始まる**
（前AUFが付くのは、標準の向きとは違う向きから始める手順に差し替えたとき）。

表の「ピースの動き」は、解くとピースがどう動くか。`UR>UL>UF` は「UR のピースが UL へ、UL のが UF へ、UF のが UR へ」。
位置は上から見た名前（コーナー UBL UBR UFR UFL、エッジ UB UR UF UL）。`test/pll-data.test.js` の `EXPECTED` と同じ内容。

| 名前 | ピースの動き（標準の向き） | 見た目 | `a`（解く手順） |
|---|---|---|---|
| Ua | UR>UL>UF | 3エッジが反時計回り。後ろが揃ったバー | `M2 U M U2 M' U M2` |
| Ub | UR>UF>UL | 3エッジが時計回り。後ろが揃ったバー | `M2 U' M U2 M' U' M2` |
| H | UB>UF UR>UL | 向かい合うエッジを2組交換 | `M2 U M2 U2 M2 U M2` |
| Z | UB>UL UR>UF | 隣り合うエッジを2組交換（後ろと左、右と前） | `M' U' M2 U' M2 U' M' U2 M2` |
| Aa | UBL>UBR>UFR | 3コーナーが時計回り。UFL は動かない | `x R' U R' D2 R U' R' D2 R2 x'` |
| Ab | UBL>UFR>UBR | 3コーナーが反時計回り。UFL は動かない | `x R2 D2 R U R' D2 R U' R x'` |
| E | UBL>UFL UBR>UFR | 左の2コーナー、右の2コーナーをそれぞれ交換 | `x' R U' R' D R U R' D' R U R' D R U' R' D' x` |
| T | UBR>UFR UR>UL | 右の2コーナー＋左右のエッジ | `R U R' U' R' F R2 U' R' U' R U R' F'` |
| F | UBR>UFR UB>UF | 右の2コーナー＋前後のエッジ。左が揃ったバー | `R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R` |
| Ja | UBR>UFR UB>UR | 右の2コーナー＋後ろと右のエッジ | `x R2 F R F' R U2 r' U r U2 x'` |
| Jb | UBR>UFR UR>UF | 右の2コーナー＋右と前のエッジ | `R U R' F' R U R' U' R' F R2 U' R'` |
| Ra | UBR>UFR UB>UL | 右の2コーナー＋後ろと左のエッジ（ヘッドライトが左） | `R U' R' U' R U R D R' U' R D' R' U2 R'` |
| Rb | UBR>UFR UF>UL | 右の2コーナー＋前と左のエッジ（ヘッドライトが左） | `R2 F R U R U' R' F' R U2 R' U2 R` |
| Y | UBL>UFR UB>UL | 対角のコーナー＋後ろと左のエッジ | `F R U' R' U' R U R' F' R U R' U' R' F R F'` |
| V | UBL>UFR UB>UR | 対角のコーナー＋後ろと右のエッジ | `R' U R' U' y R' F' R2 U' R' U R' F R F` |
| Na | UBR>UFL UR>UL | 対角のコーナー（UBR と UFL）＋左右のエッジ | `R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'` |
| Nb | UBL>UFR UR>UL | 対角のコーナー（UBL と UFR）＋左右のエッジ | `R' U R U' R' F' U' F R U R' F R' F' R U' R` |
| Ga | UBL>UBR>UFL UB>UL>UR | ヘッドライトが左、ブロックは UFR と UF | `R2 U R' U R' U' R U' R2 U' D R' U R D'` |
| Gb | UBL>UFL>UFR UB>UF>UL | ヘッドライトが左、ブロックは UBR と UR | `R' U' R U D' R2 U R' U R U' R U' R2 D` |
| Gc | UBL>UFL>UFR UR>UF>UL | ヘッドライトが左、ブロックは UBR と UB | `R2 U' R U' R U R' U R2 U D' R U' R' D` |
| Gd | UBL>UBR>UFL UB>UL>UF | ヘッドライトが左、ブロックは UFR と UR | `R U R' U' D R2 U' R U' R' U R' U R2 D'` |

`s`（そのケースになる手順）は `data/pll/algs_info.json` を参照。AUF が付くのは Z（最後に `(U')`）と Ja（最後に `(U)`）。

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
    { name: 'Ua', group: 'Edges only', alg: "M2 U M U2 M' U M2", setup: "R2 U R U R' U' R' U' R' U R'" },
    ...
  ]
  ```
- 練習用のスクランブル（`data/pll/scrambles.json` → `js/pll-scrambles.js`）は別のツール（`tools/gen-scrambles.js`・`tools/build-scrambles.js`）で作る。
  このスクリプトは作らない（Megaminx では `build-pll-data.js` が両方作っていた）

## 覚える順番

3x3 では置かない（`data/pll/learn_order.json` は無い。`js/pll-data.js` に `stage`・`order` は付かない）。
`tools/build-case-data.js` と `js/case-sections.js` には、`learn_order.json` があれば読む仕組みだけが残っている。

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
- 配色はエディタで保存した設定：保存した配色（OLL 配色のときは OLL を選ぶ前の配色、それも無ければ Standard）。Cube Color も保存した設定
- ケースを押すと、そのケースを選んだ状態でエディタ（`/?pll=…`）を開く。自分の手順があるケースはその手順と画像で出し、「custom」を付ける
- 覚えた度（未習得 / 練習中 / 習得済み）：カード右上の丸を押すたびに切り替える（`visualcube-editor:progress`）。
  上部に進み具合のバー・件数と絞り込み、グループの見出しに「習得済みの数 / 全体」
- グループのボタン：押したグループだけを表示する（複数選べる。「選択を解除」で戻す）。絞り込みと合わせて `visualcube-editor:list-filter` に保存
- 「練習する」：今の絞り込み・選んだグループのまま練習ページを開く（`reference/PRACTICE_SPEC.md`）
- 「グループ順 / 覚える順」の切り替えは無い（覚える順のデータが無いので出ない）

### 一括ダウンロード
- 「Download ZIP」（スマホの幅では出さない）：全21ケースを一覧と同じ配色で PNG にし、`visualcube-pll.zip`（中は `pll-<名前>.png`）にまとめる（`js/zip-store.js`、無圧縮）
- 画像サイズ・Cube Color・背景はエディタで保存した設定（サイズは 100〜1000 px に収める。保存が無ければ 200 px、透明）。SVG を Image → canvas で PNG にする

## テスト（`test/pll-data.test.js`、`node --test test/pll-data.test.js`）

- 21ケースを元データの順に含み、名前が重複しない。グループは5つで、件数（4・3・6・4・4）と並びが決めたとおり
- `js/pll-groups.js` に全グループの説明がある
- `js/pll-data.js` が最新（生成し直しても変わらない）
- 各ケース
  - `check('pll', alg, setup)` が null。`setup` の状態に `alg` を回すと最後の AUF を除いて揃い、`alg` の case 表示が `setup` の状態と一致する
  - `alg` の最後に AUF・向きを戻さない持ち替えが無い
  - `setup` の状態で崩れているのは側面上段の12枚だけ（上面は U 色、F2L とセンターは揃ったまま）
  - `setup` は素の面回しと括弧付きの AUF だけ
- **名前とケースの対応**（`a` と `s` が互いに合っていても、名前が違うケースを指していたら上の確認では分からないため、手順とは別の系統で確かめる）
  - `EXPECTED`：各 PLL のピースの動きを直書きしたもの（上の表）。`setup` の状態が、AUF の違い（前後 4×4 通り）を除いてこれと一致する。
    状態は回転の計算を通さず、ステッカーを直接置いて作る。置換どうしの比較（`classKey`）でも確かめ、ほかの20ケースとは一致しないことも見る
  - `EXPECTED` の21個は、どれも 3x3 で作れる置換（コーナーとエッジの偶奇が同じ）で、互いに違うケース
  - `alg` から前AUFを外した手順が、標準の向き（`EXPECTED` の状態）から最後の AUF を除いて揃う
  - `OTHER_ALGS`：データとは別の、その名前で広く知られている手順（各ケース1〜2本）。`findCase` で同じ名前のケースになる
  - 逆の関係：Ua⇔Ub、Aa⇔Ab、Ga⇔Gb、Gc⇔Gd は互いに逆、ほかは自分が逆
- 全ケースが互いに違うケースで、あるケースの手順でほかのケースは揃わない

名前を入れ替える（たとえば Ua と Ub の `a`・`s` を交換する）と、生成は通るがこのテストが落ちる。
