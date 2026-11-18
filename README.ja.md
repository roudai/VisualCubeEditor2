# VisualCube Editor 3.0

[English](README.md) | **日本語**

ルービックキューブの画像を GUI で作るための Web アプリです。最後の層の手順（PLL・OLL・COLL・ZBLL）を覚え、タイマーで練習することもできます。
画像の描画には [VisualCube TS](https://github.com/tdecker91/visualcube) を使っています。

URL：https://visualcube.roudai.net/

## できること

### 画像エディタ（`/`）
- 1x1x1〜17x17x17 のキューブを、手順から、またはステッカーの色を直接指定して描けます
  - **手順を回した状態**：手順を回したあとの状態
  - **この手順で揃う状態**：その手順で揃う状態（3x3x3 では、手順中の持ち替え・2層回し・中層回しによる向きの違いを打ち消します）
  - **色を直接指定**：ステッカーごとに色を塗ります
- 通常（立体）と Plan（上から見た図）の表示、ステージマスク（F2L・OLL・COLL など）、矢印、回転、色、透明度、投影の距離を設定できます
- 配色プリセット（標準 / OLL / カスタム）、背景の透明・不透明、画像サイズを選び、好きなファイル名で PNG を保存できます
- PLL・OLL・COLL のケースを一覧から選べます。手順・表示・配色が自動で切り替わり、ファイル名は `pll-Aa.png`・`oll-27.png`・`coll-21-1.png` になります
- ケースごとに**自分の手順**を保存できます。保存する前に、その手順で本当にそのケースが揃うかを確かめます。
  保存した手順は一覧・練習・記録でも使われます。既定の手順に戻すことも、元に戻すこともできます
- 3x3x3 の手順は入力しながら確かめます。読めない記号はその場で知らせ、`(R U)2` のような繰り返しも使えます

### ケースの一覧（`/pll`・`/oll`・`/coll`・`/zbll`）
- PLL 21・OLL 57・COLL 40・ZBLL 472 の全ケースを、画像と手順付きで並べます。ケースを押すとエディタで開きます
  （ZBLL はエディタに選ぶ行が無いので、名前と手順を `/?zbll=名前&case=手順` で渡し、Plan の表示で開きます）
- ケースごとに**未習得 / 練習中 / 習得済み**を付けられ、進み具合が分かり、状態で絞り込めます
- 並びはグループ順と**覚える順**（PLL・OLL とも 13 段階）。OLL は番号順（1〜57）でも並べられます
- 選んだグループ・段階だけを表示し、そのケースだけを練習できます。すべて未習得に戻すこともできます（元に戻せます）
- 全ケースの画像を ZIP でまとめて保存できます（エディタで保存した配色・画像の設定を使います）
- ZBLL は小グループ（T / 2GLL など 40）か OCLL（T・U・L・H・Pi・Sune・Antisune の 7）で分けて並べます
- COLL・ZBLL の一覧へは、OLL の一覧からリンクしています

### 練習（`/practice`）
- **PLL・OLL・COLL・ZBLL**：ランダムなケースのスクランブルが出ます。手元のキューブで解いてタイマーを止めます。
  習得の目安（2 / 3 / 5 / 8 秒、または好きな秒数。PLL・OLL・COLL・ZBLL で別々に設定）以内に解けたケースは、自動で習得済みになります。
  ヒント（最初の数手）、解けなかった、スキップ、取り消しもあります
- **通し**：ブラウザの中で作る WCA と同じ形のランダムステートのスクランブル、15 秒のインスペクション（+2・DNF は自動）、
  ao5・ao12、ペナルティの変更と削除
- パソコンではスペースキーでスタート・ストップ、スマホではタップします

### 記録（`/stats`）
- 集計と、1回ごとのタイムの推移のグラフ（通しは ao5・ao12、ケースは習得の目安の線付き）
- ケースごとの表。並びは**苦手順**（直近 10 回の平均）・グループ順・覚える順。ケースを押すとそのケースを練習できます
- すべての記録の一覧（1 ページ 50 件）。1件ずつでもまとめてでも削除でき、元に戻せます

### アカウントと言語
- 日本語と英語。どのページでも切り替えられます
- 内容はすべてブラウザに保存されます。Google・Facebook・GitHub でログインすると（Firebase）、設定・習得状況・自分の手順・練習の記録を
  アカウントにも保存し、どの端末でも同じ状態で使えます。アカウントは [Megaminx Image Editor](https://github.com/roudai/MegaminxImageEditor) と共通です
- アカウントのデータは、プライバシーポリシーのページからいつでもご自身で削除できます
- 使い方のページ（`/guide`。日本語・英語）があり、アカウントのメニューから開けます

## URL パラメータ

| 例 | 意味 |
|---|---|
| `/?alg=R U R' U'` | 手順を回した状態を描く |
| `/?case=R U R' U'` | その手順で揃う状態を描く |
| `/?pll=Aa`・`/?oll=27`・`/?coll=21-1` | そのケースを選んだ状態でエディタを開く（優先順位は `pll` → `oll` → `coll` → `case` → `alg`） |
| `/practice?set=oll&filter=new` | 種類（`pll` / `oll` / `coll` / `zbll` / `full`）と対象（`new` / `learning` / `learned` / `all`）を指定して練習を開く |
| `/stats?set=coll` | その種類の記録を開く |

ページの URL には `.html` を付けません。以前のリンク（`/index.html?alg=…` など）も開け、アドレスバーは `/?alg=…` の形に書き換わります。

## 出典

- PLL・OLL・COLL の手順・ケース名・図の向き：[roudai.net](https://roudai.net/)
  （[PLL](https://roudai.net/pll/pll/)・[OLL](https://roudai.net/oll/oll/)・[COLL](https://roudai.net/oll/coll/)）。
  PLL の名前はそのページに合わせています。国際的に多い呼び方とは Ua/Ub・Aa/Ab・Ra/Rb・Ga/Gd・Gb/Gc が入れ替わっています
- ZBLL の手順・スクランブル：用意されたデータ（`data/zbll/`）を整形して使っています（`reference/ZBLL_SPEC.md`）
- 覚える順：[Cube Voyage](https://cubevoyage.net/)
  （[PLL](https://cubevoyage.net/how-to-solve/advanced/pllsequence/)・[OLL](https://cubevoyage.net/how-to-solve/advanced/ollsequence/)）
- ケースの一覧・練習・記録は [Megaminx Image Editor](https://github.com/roudai/MegaminxImageEditor) から移植しました

## 開発

静的なサイトです。ビルドもインストールも要りません。付属のサーバーで配信してください。
GitHub Pages と同じく `/pll` で `pll.html` を返します（`python3 -m http.server` などの普通の静的サーバーはこれを返せないので、ページ間のリンクが 404 になります）。

```sh
node tools/serve.js 8000      # http://localhost:8000/
node tools/serve.js --demo    # http://localhost:8001/stats （テストデータ入り。ログインは使えない）
```

`--demo` はポートを分けているので、ブラウザの保存も普段のものとは別になります。練習の記録・最近のタイム・習得状況を入れた状態で開き
（`tools/demo-data.js`）、画面の右下に入れ直すためのリンク（`/__demo/reset`）を出します。
`tools/demo-data.js` の `VERSION` を上げると、古いテストデータが入ったブラウザにも入れ直します。

テスト（Node.js 標準のテストランナー。Node.js 24 で確認）：

```sh
node --test
```

生成するデータ：JSON を直してから作り直します。生成物が古いとテストが失敗します。

```sh
node tools/build-pll-data.js     # data/pll/algs_info.json（＋ learn_order.json）→ js/pll-data.js
node tools/build-oll-data.js     # data/oll/algs_info.json（＋ learn_order.json）→ js/oll-data.js
node tools/build-coll-data.js    # data/coll/algs_info.json → js/coll-data.js
node tools/build-zbll-data.js    # data/zbll/algs_info.json → js/zbll-data.js
node tools/gen-scrambles.js      # ケースごとのスクランブル → data/{pll,oll,coll}/scrambles.json（ZBLL は用意されたものを使い、作らない）
node tools/build-scrambles.js    # → js/{pll,oll,coll,zbll}-scrambles.js（全件を確かめる）
```

各ケースは `a`（そのケースを解く手順）と `s`（そのケースになる手順）を持ちます。生成のときに両者が合っているかを確かめ、
合わなければ直し方の候補を出します。ケースのスクランブルは付属の two-phase ソルバ（`js/cube-solver.js`）で作り、1本ずつ確かめています。

### ファイルの構成

| 場所 | 内容 |
|---|---|
| `index.html`・`pll.html`・`oll.html`・`coll.html`・`zbll.html`・`practice.html`・`stats.html`・`guide.html`・`privacy.html`・`terms.html` | 各ページ |
| `js/` | スクリプト（モジュールやバンドラーは使わない）：`cube-state.js`（3x3x3 の状態）、`case-check.js`（手順の確認）、`cube-solver.js`（ソルバ）、`store.js`・`cloud-sync.js`（保存）、`i18n.js`（訳）、各ページのスクリプト |
| `css/` | スタイル |
| `data/` | 元データ（手順・覚える順・スクランブル）。ページと同じ名前のフォルダ（`pll/`・`oll/` など）をルートに置かないこと（GitHub Pages で `/pll` がフォルダの方を見てしまうため） |
| `tools/` | データの生成、スクランブルの生成、ローカルのサーバー |
| `test/` | テスト |
| `reference/` | 仕様書：`PLL_SPEC.md`・`OLL_SPEC.md`・`COLL_SPEC.md`・`ZBLL_SPEC.md`・`PRACTICE_SPEC.md`・`I18N_SPEC.md`・`CLOUD_SYNC_SPEC.md` |
| `library/` | VisualCube TS（`srVisualizer.min.js`） |
| `firestore.rules` | Firestore のセキュリティルール（Megaminx Image Editor と共通） |

### ライブラリ

- Vue.js 3.5.45
- Lodash 4.17.21
- VisualCube TS 1.0.13
- Bootstrap 5.3.9
- Firebase 10.12.2（Authentication、Firestore）

## お問い合わせ

[GitHub の Issues](https://github.com/roudai/VisualCubeEditor2/issues) からお願いします。
[プライバシーポリシー](https://visualcube.roudai.net/privacy)・[利用規約](https://visualcube.roudai.net/terms)もご覧ください。
