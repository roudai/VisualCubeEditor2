# PORTING_PLAN.md — MegaminxImageEditor → VisualCubeEditor2 移植計画（フェーズ0の結果）

調査日：2026-11-16。調査は読み取りのみ（サブエージェント A・B・C）。ファイルの編集・コミットはしていない。

## 要点

1. **想定と違った点**：VisualCubeEditor2 には `?alg=` / `?case=`、Color Preset、localStorage、ログイン、i18n、PLL/OLL データ、テストが**一切無い**。「既存への追加」ではなく、ほぼ全機能を新しく持ち込む移植になる。流用できる既存部品は、Algorithm の3択（alg / case / state）、手順ボタン、state の手入力、Plan ビュー、配色の x/y/z 入れ替えだけ。
2. **そのまま持ち込めるものは多い**：`store.js`、`cloud-sync.js`、`zip-store.js`、`navbar.js`、`progress.js`、`custom-algs.js`、`case-sections.js`、css 4本、html 6枚は、定数と文言の差し替えで済む。
3. **作り直すもの**：状態計算（`cube-state.js`）、描画の包み（`cube-draw.js`）、PLL 21 / OLL 57 のデータ、スクランブル（通し用・ケース用）、エディタへの組み込み（Vue の mixin）。
4. **画像は既存の srVisualizer で描く**（Plan 表示）。エディタの画像と同じ見た目になる。色は新しい状態計算モジュールで決めて渡す。
5. **参考実装との突き合わせは可能**：`srVisualizer.min.js.map` 内のソースは Node だけで読み込めることを確認した。テストでランダム手順を比較する。
6. **`firestore.rules` はマージ作業が要らない**：移植元の現行ルールに `visualcube-editor` が既に入っている。同一内容を置く。保存先 `users/{uid}/apps/visualcube-editor` は Megaminx の文書と別で、衝突しない。
7. **CI・フック・package.json は両リポジトリとも無い**。自動デプロイかどうかはリポジトリからは分からない（未確認）。
8. **アカウント削除は2サイトにまたがる**：どちらのサイトで実行しても、両方のクラウドのデータとアカウントが消える（移植元の実装どおり）。プライバシーポリシーに明記する。
9. 規模：新規 約55ファイル、既存の変更 3ファイル（`index.html`、`js/main.js`、`README.md`）。実質の新規コードは約 3,000〜3,500 行、写して直すものが約 6,000 行。

## 確認したい点（返事が無ければ【前提】のとおり進める）

| # | 確認したい点 | 【前提】 |
|---|---|---|
| Q1 | PLL 21・OLL 57 の**既定の手順の出典**。あなたの手順表があるか | 広く使われている標準的な手順を私が書き、状態計算で全件検証する。あとで `pll/algs_info.json` / `oll/algs_info.json` を差し替えれば入れ替えられる |
| Q2 | 通しのスクランブルを **random-state**（WCA と同じ。two-phase ソルバを自前実装、約 500〜800 行）にするか、random-move 25 手にするか | random-state。同じソルバでケース用スクランブルも生成する。実装が通らなければ random-move に落として報告する |
| Q3 | **既存エディタのラベル**（Puzzle Type、Arrow、Stage Mask など）も日本語訳を付けるか | 付ける（全ラベルを日英対応） |
| Q4 | 新しい5ページにも **Google Analytics（gtag）** を入れるか | 入れる。プライバシーポリシーに Analytics の記載を足す |
| Q5 | PLL の「覚える順」と OLL の範囲切り替え（No Dot / Dot） | どちらも置かない（Megaminx 固有）。コードはデータ駆動なので、後から `pll/learn_order.json` を置けば覚える順は有効になる |
| Q6 | ケースを選んだとき、3x3・Plan 表示に自動で切り替えるか | 切り替える（保存はしない） |
| Q7 | 既存の不具合（`rotateAngle3` の ± が `rotateAngle1` を変える、id の重複）を直すか | 直さず、報告だけする。ただし `drawCube` の画像が2枚残る不具合は、ケース切り替えで表に出るので直す |
| Q8 | PORTING_TASK.md の未記入欄 | 基準コミット `5c3a7310daa6bb51f2165893c48ca35db8785cec`、未コミットの変更なし、ベースブランチ `master`（HEAD は `alg-input`）。記入はあなたが行う |

## 1. 調査で確認した事実

### 移植元（MegaminxImageEditor、`alg-input` @ 5c3a731）

- 静的サイト。ビルド・`package.json`・CI・フック無し。Bootstrap 5.3.9 の CSS のみ、Vue 無し。
- テストは `node --test test/*.test.js` で 477 件成功（Node v24.22.2）。
- Firebase：modular SDK 10.12.2 を gstatic から動的 import、`signInWithPopup`、Google / Facebook / GitHub、アカウントリンク、`deleteAccount`。プロジェクトは `roudainet-cube-tools`。
- 秘密情報（サービスアカウント鍵など）は見つからなかった。
- 仕様書とコードの食い違いが9件ある（PLL のグループ数、ZIP ボタン名など）。コードを正とする。
- PLL/OLL 用スクランブル（`scrambles.json`）は外部由来。リポジトリに生成スクリプトは無く、`tools/` は検証だけを行う。

### 移植先（VisualCubeEditor2、`main` @ 6692c28）

- `index.html`（665行）＋ `js/main.js`（942行、Vue 3.5.45 グローバルビルド、`#app` にマウント）＋ `library/srVisualizer.min.js`。
- Bootstrap 5.3.9（CSS ＋ `bootstrap.min.js`）、Lodash 4.17.21、gtag `G-2LP5F7RVYQ`。UI は英語のみ。
- ナビバーは `#app` の外。描画は `cubePNG` で非同期に `<img>` を追記。ダウンロードボタンは無い。
- srVisualizer は Node で `require` できない。状態計算と手順パーサは非公開。パーサは括弧・不明文字を黙って読み飛ばし、繰り返し `(R U)2` を無視する。
- 背景色が `#ffffff` のときは実際には透明で出力される（`main.js:283`）。
- CNAME は `visualcube.roudai.net`。`origin/master` は `main` と履歴を共有しない 2022年の1コミット。

## 2. VisualCubeEditor2 に既にある機能・部品（重複実装しない）

| 既存 | 場所 | 移植での扱い |
|---|---|---|
| Algorithm の3択（alg / case / state） | `index.html:98–400` | そのまま使う。移植元 `alg-input.js` の種類切り替えは持ち込まない |
| 手を入れるボタン | `index.html:115–145` | そのまま。移植元の記号ボタン（`alg-input.js:21`）は不要 |
| state の手入力（1〜6） | `index.html:152–393` | そのまま。移植元 `state-editor.js` は不要 |
| 面ごとの色入力6個 | `index.html:486–523`、`main.js:66–71` | 設定 `faceColors` に対応づける |
| 配色の x / y / z 入れ替え | `main.js:376–387` | 移植元の U↻・上下反転（`alg-input.js:350–375`）の代わりに使う |
| Plan ビュー、`case` 描画 | srVisualizer | 一覧・練習・記録・ZIP の画像に使う |
| 画像サイズ、背景色、キューブ色 | `main.js` | 設定 `imageSize` / `bgColor` / `border` に対応づける |
| Stage Mask 22種、Mask Alg、Arrow、NxN、回転角 | `main.js` | 触らない（保存もしない） |

無いもの（新設）：URL パラメータ、Color Preset、設定の保存、Download ボタンと File Name、ログイン、i18n、PLL/OLL データ、練習、記録、法的ページ、`firestore.rules`、テスト、`.gitignore`。

## 3. 機能ごとの分類

パスは移植元 → 移植先（どちらもリポジトリのルートから）。

### そのまま移植（定数・文言の差し替えのみ）

| 移植元 | 移植先 | 差し替える箇所 |
|---|---|---|
| `js/store.js` | 同名 | `PREFIX`（36行）を `visualcube-editor:` に。`PREFIX` を公開する |
| `js/cloud-sync.js` | 同名 | `APP_ID`（24）、`SYNCED_KEY`（25）、`HINT_KEY`（64） |
| `js/firebase-config.js` | 同名 | なし（公開前提の Web 設定値） |
| `js/zip-store.js`、`js/case-sections.js`、`js/navbar.js`、`js/legal.js`、`js/privacy.js` | 同名 | なし |
| `css/common.css`、`cases.css`、`practice.css`、`stats.css` | 同名 | canvas 前提の指定があれば svg 用に直す（未精査） |
| `pll.html`、`oll.html`、`practice.html`、`stats.html` | 同名 | script の一覧、タイトル、GitHub のリンク、gtag |
| `firestore.rules` | 同名 | なし（同一内容。正本の注記を1行足す） |
| `test/store`、`zip-store`、`case-sections` | 同名 | 接頭辞の文字列 |
| `.gitignore` | 同名 | なし（`.DS_Store`） |

### 既存を流用・調整

| 移植元 | 移植先 | 直す箇所 |
|---|---|---|
| `js/case-check.js` | 同名 | AUF 5→4（31、69、100、108–109、120）、末尾の持ち替え y → x/y/z（40、43–48）、記法の読み替え（35）を外す |
| `js/custom-algs.js` | 同名 | require 先、`TRAILING`（30） |
| `js/progress.js` | 同名 | require 先、既定サイズ（83）、`wrapAuf` の %5 と `U2'`（229–237） |
| `js/i18n.js` | 同名 | サイト名、scope・覚える順の文言を外す、エディタ固有ラベルのキーを足す |
| `js/cases.js` | 同名 | 描画の呼び出し（88–95、439–445）、scope（135–146 ほか）、ZIP 名（450） |
| `js/practice.js` | 同名 | scope（45–49）、習得の目安（51）、スクランブル（363、620、836）、AUF（389）、描画（574–579） |
| `js/stats.js` | 同名 | scope（28 ほか）、描画（287–291）、CSV 名（329、340）、接頭辞の直書き（617） |
| `index.html`（移植元） | 移植先 `index.html` に足す | ナビバー、ケース選択の行、自分の手順のバー、Color Preset、Background、Download / File Name |
| `privacy.html`、`terms.html` | 同名 | サイト名、Issues の URL、Analytics の記載、アカウント削除が2サイトに及ぶこと |
| `tools/build-pll-data.js`、`build-oll-data.js` | 共通部分を `tools/build-case-data.js` に | 2本は9割重複。D・E は薄いラッパだけ持つ |
| `tools/scrambles-lib.js` | `tools/build-scrambles.js` | データ生成から切り離す |
| `test/progress`、`case-check` | 同名 | 手順の例と AUF |
| `reference/CLOUD_SYNC_SPEC`、`I18N_SPEC`、`PRACTICE_SPEC` | `reference/` | 名前・キー・スクランブルの節 |

### 3x3 向けに作り直し

| 移植元 | 移植先 | 内容 |
|---|---|---|
| `js/megaminx-state.js` | `js/cube-state.js`（`CubeState`） | 同名の API を持たせる（下記 4.1） |
| `js/megaminx-draw.js` | `js/cube-draw.js`（`CubeDraw`） | srVisualizer の `cubeSVG`（Plan）を包む。引数は `MegaminxDraw.draw` と同じ |
| `js/alg-input.js` | `js/editor-cases.js` | Vue の mixin（下記 4.3） |
| `js/wca-scramble.js` | 同名 ＋ `js/cube-solver.js` | 3x3 のスクランブルと短い形の符号化 |
| `js/case-groups.js` | `js/pll-groups.js`、`js/oll-groups.js` | D と E が別々に持てるよう分割 |
| `pll/`・`oll/` の `algs_info.json`、`scrambles.json`、生成物 `js/*-data.js`、`js/*-scrambles.js` | 同名 | 形式は同じ。PLL 21、OLL 57 |
| `test/megaminx-state`、`wca-scramble`、`pll-data`、`oll-data` | `test/cube-state.test.js` ほか | — |
| `reference/PLL_SPEC`、`OLL_SPEC` | `reference/` | ケース数・グループ |

### 不要

| 移植元 | 理由 |
|---|---|
| `js/state-editor.js` | 移植先に state の手入力がある |
| `js/megaminx.js` | 描画は `main.js` の `drawCube` が担う。PNG 保存だけ Vue 側に足す |
| `pll/learn_order.json` | Megaminx 用の記事が出典（Q5） |
| OLL の No Dot / Dot（`algset`、scope） | Megaminx 固有。`algset` フィールドは形だけ残す |
| `reference/HANDOFF.md`、`megaminx_top.py` | Megaminx の実装メモと参考実装 |
| 旧形式の通し記録の変換（`practice.js:830–843`） | 新しいアプリに古い記録は無い |

## 4. 設計の決定

### 4.1 状態計算 `js/cube-state.js`

- UMD・DOM 非依存。状態は srVisualizer と同じ並び（U, R, F, D, L, B）の 54 要素。
- 移植元と同名：`FACES`、`DEFAULT_SCHEME`（hex。`main.js:66–71` の値）、`solved`、`parseAlg`、`canonicalAlg`、`invertMoves`、`applyMoves`、`applyAlg(alg,{inverse,state,cancelRotation})`、`toImageColors`（`{ucolor[9], scolor[12]}`）、`ollMask`。
- 追加：`toStickerColors`（54色）、`flatten`（括弧と繰り返しを展開した素の手順文字列）、`AUFS`。
- 記法：`U D L R F B`、小文字ワイド、`Rw`、`M E S`、`x y z`、`2`・`'`・`2'`、括弧と繰り返し、全角の `’（）`、カンマ。**大文字と小文字を区別する**（Megaminx は区別しない）。`3Rw` などの NxN 記法は対象外。
- `cancelRotation` は、24 通りの向きからセンターが定位置に戻るものを選ぶ（y の合計だけでは足りない）。
- テスト：逆手順で戻る、各面4回で戻る、`R U R' U'` の位数6、`.map` 内の参考実装とランダム手順 数百本で一致。

### 4.2 画像

- 一覧・練習・記録・ZIP は `cubeSVG`（`view:'plan'`、`stickerColors` 指定）。ZIP 用の PNG は SVG → Image → canvas → `toBlob`。
- ライブラリのステージマスクは使わない。OLL のグレーは `ollMask` の配色で出す（色は `#404040`。既定の Mask Color と同じ）。

### 4.3 エディタ（`index.html`、`js/main.js`）

- `js/editor-cases.js` を Vue の mixin として足す。`main.js` の変更は `mixins` の1行と `drawCube` 内の数行。
- 3x3 のときだけ、`CubeState.flatten` の結果を srVisualizer に渡す。他のサイズは今までどおり。Stage Mask・Arrow・NxN はライブラリ任せのまま。
- `#app` の中の文言は `{{ t('…') }}`、`#app` の外（ナビバー）は `data-i18n`。
- ナビバーは移植元の独自 CSS ＋ `navbar.js`。`bootstrap.min.js` は「Show Parameter」のために `index.html` にだけ残す。
- 足す UI：ケース選択（グループ → ケース、Prev / Next）、自分の手順の保存・既定に戻す・元に戻す、Color Preset（standard / oll / custom）、Background（Transparent / Opaque、既定は透明＝現状と同じ）、Download と File Name。
- URL：`?pll=` → `?oll=` → `?case=` → `?alg=` の優先順（移植元と同じ）。
- 保存する設定：`preset`、`faceColors`、`beforeOll`、`customScheme`、`imageSize`、`border`（＝`cubeColor`）、`bgColor`、`bg`。cubeSize・ビュー・マスク・回転・Arrow は保存しない。
- **挙動の変化**：3x3 では、今まで黙って読み飛ばされていた不明な文字がエラー表示になり、`(R U)2` の繰り返しが効くようになる。

### 4.4 スクランブル

- 通し：`WcaScramble.cube3()`。random-state（Q2）。ブラウザでは次の1本を先に作っておく。
- 短い形：1手 = 1文字（18通りを `A`〜`R`）。形式が違うときは全文を保存する逃げ道を残す。
- 保存サイズの概算：通し 2000件 約16万 ＋ 練習記録 2000件 約18.6万 ＋ その他 約1.7万 = **約36万文字**（上限 50万未満）。
- ケース用：`tools/gen-scrambles.js` が「ケースの状態 ＋ ランダムな AUF」をソルバで解き、逆手順をスクランブルにする。各20本。`fitSetup` で全件検証。

### 4.5 PLL / OLL のデータ

- 形式は移植元と同じ `{番号:{name,group,algset,s,a}}`。`a` は `[前AUF] 手順`（末尾の AUF・持ち替え無し）、`s` は `[AUF] setup [AUF]`。
- PLL 5グループ：Edges only（Ua Ub H Z）、Corners only（Aa Ab E）、Adjacent swap（T F Ja Jb Ra Rb）、Diagonal swap（Y V Na Nb）、G（Ga Gb Gc Gd）。
- OLL 14グループ（名前は 1〜57）：Dot、Square、Lightning、Fish、Knight、OCLL、Corners oriented、Awkward、P、T、C、W、L、I。
- 移植元の検証（`a` と `s` の整合）に加えて、**名前とケースの対応**をテストで確かめる（ケースごとの期待パターン、または別系統の手順をテストに持つ）。移植元は外部データを信頼していて、この検証が無い。

## 5. 3x3 で変わる点

| 項目 | Megaminx | 3x3 | 主な該当箇所（移植元） |
|---|---|---|---|
| AUF | 5通り、`U2'` あり | 4通り | `case-check.js:31,69,100,108–109,120`、`progress.js:229–237`、`practice.js:389` |
| 持ち替え | y のみ | x / y / z、ワイド・スライスでセンターが動く | `case-check.js:40,43–48`、`custom-algs.js:30`、`megaminx-state.js:227–238` |
| 大文字小文字 | 区別しない | 区別する（`r` と `R`） | `megaminx-state.js` の parseAlg、`custom-algs.js:42–43` |
| 面・色 | 12面、色コード14種 | 6面、hex | `megaminx-state.js:269–282`、`alg-input.js:292–306` |
| 画像のステッカー | 上面11 ＋ 側面15 | 上面9 ＋ 側面12 | `megaminx-state.js:296–319`、各画面の `D.draw` |
| 配色の操作 | U↻、上下反転 | 既存の x / y / z | `alg-input.js:350–375` |
| OLL の範囲 | No Dot / Dot / All | 無し | `cases.js:135–146`、`practice.js:45–49`、`stats.js:28`、`i18n.js:99–100,317–321` |
| 覚える順 | 27段階 | 無し | `cases.js:204–219`、`practice.js:89–120`、`build-pll-data.js:51–65` |
| 習得の目安 | 5 / 8 / 10 / 15 秒、既定8 | 2 / 3 / 5 / 8 秒、既定3【前提】 | `practice.js:51,57,73` |
| 通しのスクランブル | Pochmann 7行、13文字に短縮 | 1行・約20手、1手1文字 | `wca-scramble.js` 全体、`practice.js:363,620,836`、`stats.js:327,584` |
| ケース数 | PLL 151、OLL 259 | PLL 21、OLL 57 | データ一式 |
| ファイル名 | `megaminx-*.zip` / `.csv` / `.png` | `visualcube-*` | `cases.js:450`、`stats.js:329,340`、`megaminx.js:44` |
| 接頭辞・アプリ名 | `megaminx-image-editor` | `visualcube-editor` | `store.js:36`、`cloud-sync.js:24,25,64`、`stats.js:617`、テスト |

CSV の列（`date,time,penalty,result,scramble` と `date,set,case,time,status,hint`）は変えない。

## 6. フェーズ分けとファイル担当

ブランチは `feature/training`（`main` から作る）。push と PR は指示があるまで行わない。

### フェーズ1：基盤（メインのみ）

- 共有ファイル：`js/store.js`、`js/i18n.js`、`js/navbar.js`、`css/common.css`、`js/firebase-config.js`、`js/cloud-sync.js`、`firestore.rules`、`.gitignore`
- 状態計算と検証：`js/cube-state.js`、`js/case-check.js`、`js/progress.js`、`js/custom-algs.js`、`js/case-sections.js`、`js/zip-store.js`
- ビルドの共通部分：`tools/build-case-data.js`
- テスト：`test/cube-state`、`store`、`case-check`、`progress`、`case-sections`、`zip-store`
- 既存の変更：`index.html`（ナビバーの差し替え、ログイン・言語切替、script の追加）
- 完了条件：`node --test` が全件成功。`index.html` をローカルで開き、既存の描画が変わらないこと、言語切替が動くことを確認。

### フェーズ2：並列実装（サブエージェント D〜G）

| 担当 | 作成するファイル |
|---|---|
| D（PLL 21） | `pll/algs_info.json`、`tools/build-pll-data.js`、`js/pll-data.js`、`js/pll-groups.js`、`test/pll-data.test.js`、`reference/PLL_SPEC.md` |
| E（OLL 57） | `oll/algs_info.json`、`tools/build-oll-data.js`、`js/oll-data.js`、`js/oll-groups.js`、`test/oll-data.test.js`、`reference/OLL_SPEC.md` |
| F（スクランブル） | `js/cube-solver.js`、`js/wca-scramble.js`、`tools/gen-scrambles.js`、`tools/build-scrambles.js`、`pll/scrambles.json`、`oll/scrambles.json`、`js/pll-scrambles.js`、`js/oll-scrambles.js`、`test/cube-solver.test.js`、`test/wca-scramble.test.js`、`test/scrambles.test.js` |
| G（法的ページ） | `privacy.html`、`terms.html`、`js/legal.js`、`js/privacy.js` |

**競合の確認**

- 4者のファイルに重なりは無い。`pll/` と `oll/` は D・E と F が同じディレクトリを使うが、ファイルは別。
- 共有ファイル（フェーズ1の一覧）は誰も編集しない。必要な変更は報告に書かせ、メインが反映する。i18n のキー（グループ名、法的ページのタイトル）もメインが足す。
- 重なりを避けるため移植元と変える点：`case-groups.js` を2ファイルに分ける。ビルドの共通部分をフェーズ1で作る。データ生成とスクランブル生成を切り離す。
- **順序の依存**：F のケース用スクランブルは D・E のデータが要る。F は並列の間にソルバ・`wca-scramble.js`・ツールを作り、テストは数ケース（T-perm、Sune など）を直書きして通す。D・E の統合後に、メインが生成ツールを実行して `scrambles.json` と生成物を作る。`test/scrambles.test.js` はそこで有効にする。

### フェーズ3：画面実装（メイン）

- 新規：`pll.html`、`oll.html`、`practice.html`、`stats.html`、`css/cases.css`、`css/practice.css`、`css/stats.css`、`js/cube-draw.js`、`js/cases.js`、`js/practice.js`、`js/stats.js`、`js/editor-cases.js`
- 変更：`index.html`（ケース選択ほかの UI）、`js/main.js`（mixin、`drawCube` の橋渡しと画像2枚の不具合の修正）、`README.md`
- `reference/` の仕様書3本（CLOUD_SYNC、I18N、PRACTICE）

### フェーズ4：検証（サブエージェント H・I、編集なし）

- H：移植元との挙動の差、Megaminx 固有の記述の取り残し、既存機能の回帰（NxN、Arrow、Mask、state）。
- I：`node --test` 全件、描画のスクリーンショット比較、スマホ幅。
- 指摘はメインが直し、再度テストを通す。

### コミットの分け方

- フェーズごと、または意味のある単位。日本語、1行目に要約、本文に箇条書き。
- データ生成（PLL・OLL・スクランブルの json と生成物）は、それ以外と別のコミット。
- コミット前に `node --test`。

## 7. Firebase

- **`firestore.rules` の現状**：VisualCubeEditor2 には無い。移植元のルールは `users/{userId}/apps/{appId}` に対して、本人だけ読み書き・削除でき、作成・更新は `appIds()` の `['megaminx-image-editor', 'visualcube-editor']` に限り、`{json, savedAt}` のみ、`json` は 50万文字未満。
- **マージ方針**：移植元のルールをそのまま置く（`visualcube-editor` が既に入っているので、足す行は無い）。Megaminx 用の許可は残る。「どちらのリポジトリが正本か」の注記を1行足す。
- **保存先の衝突**：`users/{uid}/apps/visualcube-editor` は Megaminx の文書（`…/megaminx-image-editor`）と別の文書。互いに読み書きしない。uid は同じプロジェクトなので共通。
- **localStorage**：接頭辞を `visualcube-editor:` にする。キー名（`settings`、`progress`、`list-filter`、`custom-algs`、`lang`、`practice`、`updated`、`synced-uid`、`account-hint`）は移植元と同じ。オリジンが別なら元々衝突せず、同じでも接頭辞が違うので衝突しない。
- **アカウント削除**：`users/{uid}/apps` の全文書とアカウントを消すので、Megaminx 側のクラウドのデータも消える。プライバシーポリシーの削除の欄に明記する。
- **未確認**：Firebase コンソールに公開済みのルールがこの版か。古い版のままだと、`visualcube-editor` の文書を作れず同期エラーになる。

## 8. CI・フック・デプロイ

- `.github/`、`.husky`、有効な git フック：**無い**（両リポジトリ）。`package.json` も無い。
- テストの実行：`node --test`（`test/` の `*.test.js` を拾う）。移植元のコメントにある `node --test test/` は Node 24 では失敗する。
- デプロイ：`CNAME`（`visualcube.roudai.net`）があり GitHub Pages と見られるが、公開元のブランチと自動公開かどうかは**未確認**（リポジトリ内に設定が無い）。GitHub の Settings → Pages で確認が要る。
- `origin/master` は `main` と履歴を共有しない古い1コミット。作業の基準は `main`。

## 9. 懸念点・リスク

1. **two-phase ソルバの自前実装**：規模と、表の初期化時間（0.1〜数秒）。通らなければ random-move に落とす（Q2）。
2. **手順データの正しさ**：名前とケースの対応を検証しないと、誤ったケースがテストを通る（4.5 で対処）。
3. **既存の描画の不具合**：`drawCube` は古い画像を同期で消し、新しい画像を非同期で足す。Prev / Next の連打で画像が2枚残る。フェーズ3で直す。
4. **手順欄の 500ms の遅延**：ケース選択時は遅延を通さず直接描く。
5. **3x3 の入力が厳しくなる**（4.3 の挙動の変化）。既存の利用者に見える変化。
6. **SVG → PNG の変換**を ZIP で 57 枚続けて行う。Safari での挙動と速度は未確認。
7. **一覧 78 枚の描画時間**は未実測。
8. **Facebook ログイン**：移植元の仕様書に「ライブ未対応」の記載があり、現状は未確認。
9. **css 4本**に canvas 前提の指定があるかは未精査。

## 10. あなたが手作業で行うこと（現時点）

- [ ] PORTING_TASK.md の「参照元」の3欄を記入する（Q8 の値）。
- [ ] Firebase Authentication の承認済みドメインに `visualcube.roudai.net` を追加する（ローカル確認用の `localhost` も確認）。
- [ ] Google / Facebook / GitHub の各コンソールで、リダイレクト URI・アプリ設定を確認する。`authDomain` が Megaminx と同じなので追加は不要の見込みだが、未確認。
- [ ] `firestore.rules` を Firebase コンソールに貼って公開する（公開済みの版に `visualcube-editor` が入っているかの確認を含む）。
- [ ] GitHub の Settings → Pages で、公開元のブランチと自動公開かどうかを確認する。`main` へのマージで公開されるなら、上の3つが済むまでマージしない。
- [ ] 「確認したい点」Q1〜Q7 の判断。
- [ ] ログインの実機確認（3つのプロバイダ、アカウントリンク、データ削除）。私の環境からは確認できない。

## 11. 規模の見積もり

| フェーズ | 新規 | 変更 | おおよその行数 |
|---|---|---|---|
| 1 基盤 | 約20 | 1（`index.html`） | 約3,700。うち写して直すもの 約2,600、実質の新規 約900〜1,100 |
| 2-D PLL | 6 | 0 | 約250 ＋ 生成物 |
| 2-E OLL | 6 | 0 | 約450 ＋ 生成物 |
| 2-F スクランブル | 11 | 0 | 900〜1,300（random-move なら 約250）＋ json |
| 2-G 法的ページ | 4 | 0 | 約450（大半は文面の修正） |
| 3 画面 | 約12 ＋ 仕様書3 | 3（`index.html`、`js/main.js`、`README.md`） | 約3,900。うち実質の新規 約700〜900 |
| 4 検証 | 0 | 0 | 報告と、指摘の修正 |

Q3（既存ラベルの日英化）を行う場合、`index.html` の変更と i18n のキーが約100件増える。

## 12. 承認後の手順

1. この計画を `VisualCubeEditor2/reference/PORTING_PLAN.md` に保存する。
2. `./PROGRESS.md` を作る（完了したフェーズ、決定事項＝上の【前提】、次にやること、未解決の問題、手作業の一覧）。
3. `git -C VisualCubeEditor2 switch -c feature/training` で作業ブランチを作る。
4. フェーズ1だけを実行し、`node --test` を通してコミットする。
5. 報告して止まる。フェーズ2には進まない。
