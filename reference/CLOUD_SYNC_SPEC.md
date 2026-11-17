# ログインとクラウド保存の仕様

MegaminxImageEditor の `reference/CLOUD_SYNC_SPEC.md` を VisualCube Editor 用に書き直したもの。仕組みは同じで、アプリ名・保存する名前・ドメインが違う。
コードと食い違うときはコードを正とする。

## 目的
配色・画像の設定、習得状況、一覧の絞り込み、自分の手順、練習の設定と記録、言語を、ログインしたアカウントに保存し、どの端末・ブラウザでも同じ状態で使えるようにする。
ログインしなくても今までどおりブラウザ（localStorage）だけで使える。

## 構成
- サイトは静的ページ（`visualcube.roudai.net`）のまま。Firebase（Authentication + Firestore）をブラウザの JS から直接使う（SDK は gstatic の CDN から ES モジュールで読み込む。バージョン固定）
- ログイン：Google / Facebook / GitHub（ポップアップ。メニューもこの順）
- 保存先：Firestore の `users/{uid}/apps/visualcube-editor` の1文書 `{ json, savedAt }`。`json` は下の snapshot を JSON にした文字列
- Firebase プロジェクト（`roudainet-cube-tools`）とアカウントは Megaminx Image Editor と共通。各アプリは `users/{uid}/apps/<アプリ名>` に保存し、互いの保存先はぶつからない
  - ほかのアプリも同じ形（`{ json, savedAt }`）で保存すれば、`firestore.rules` は変えなくてよい
  - localStorage のキーの頭は `visualcube-editor:`（`Store.PREFIX`）。Megaminx Image Editor（`megaminx-image-editor:`）と同じドメインに置いても混ざらない
- `firestore.rules`：本人の `users/{uid}/apps/{アプリ名}` だけ読み書きでき、中身は `json`（50万文字未満の文字列）と `savedAt` だけ（プロジェクト共通のルール）。作る・書き換えるのはルールの `appIds()` に書いたアプリ名（`megaminx-image-editor`・`visualcube-editor`）だけ。アプリを増やしたら名前を足して Firebase コンソールに貼り直す。
  このリポジトリの `firestore.rules` は Megaminx Image Editor のものと同じ内容（どちらか片方を直したら、もう片方も同じ内容にする）

## 保存の窓口（`js/store.js`）
- エディタ・一覧・練習・記録のページの保存はすべて `Store.get(name)` / `Store.set(name, value)` を通す（localStorage のキーは `visualcube-editor:<name>`）
- 名前：`settings`（配色・画像の設定）、`progress`（習得状況。`{ pll: {…}, oll: {…}, coll: {…} }`）、`list-filter`（一覧の絞り込み）、`custom-algs`（自分の手順）、`practice`（練習の設定と記録）、`lang`（言語）
  - `settings` = `{ preset, faceColors: { U, R, F, D, L, B }, beforeOll, customScheme, imageSize, border, bgColor, bg }`
    （`border` はエディタの Cube Color、`bgColor`・`bg` は Background Color と Background。パズルの種類・表示・マスク・回転・矢印は保存しない）
- `set` は値が変わったときだけ、名前ごとの更新時刻（`visualcube-editor:updated`）を記録し、`store-change` を通知する
- `snapshot()` = `{ data: { name: value }, updated: { name: 時刻 } }`

## ログインしたときの合わせ方（`Store.resolveLogin`）
- 手元のデータがどのアカウントのものかを `visualcube-editor:synced-uid` に覚えておき、ログインしたときに次のように決める
  - そのアカウントのもの：下の `Store.merge`（名前ごとに新しい方）
  - まだどのアカウントとも合わせていない（ログインせずに使っていた）：`Store.merge` の union（その内容をアカウントに持ち込む）
  - 別のアカウントのもの：手元の内容は使わず、ログインしたアカウントの内容に入れ替える（アカウントが空なら初期状態）。別のアカウントの配色・習得状況・自分の手順が混ざらないように
- ログアウトするときは、まだクラウドに書いていない変更を先に書いてからログアウトする。手元のデータはそのまま残る（持ち主もそのまま）

## 合わせ方（`Store.merge`）
- 名前ごとに更新時刻の新しい方を使う（片方にしか無い名前は残す）
- この端末で初めてそのアカウントと合わせるとき（`visualcube-editor:synced-uid` が違う）は、習得状況と自分の手順をケースごとに合わせる（両方にあれば新しい方、片方にしか無いケースは残す）。2回目以降は名前ごとに新しい方をそのまま使う（片方で消したケースが戻ってこないように）

## 動き（`js/cloud-sync.js`）
- `js/firebase-config.js` の `window.FIREBASE_CONFIG` が `null`、または SDK を読み込めないときは何もしない（ログインのボタンも出さない）
- ログインしたとき・ログイン中にページを開いたとき：クラウドを読み → 手元と合わせ → 両方に書く。手元の内容が変わったらページを1回読み直して画面に反映する
- ログイン中：`store-change` を受けて 1.5 秒まとめてからクラウドに書く。ページを離れる（非表示になる）ときは待たずに書く
- 別の端末で変えた内容は、次にページを開いたときに反映される
- ログアウトしても手元のデータは消さない

## 画面（全ページ共通のナビバー）
- ログイン前：言語の切り替えの右に、人のアイコン付きの濃い色のボタン **ログイン / Sign in**（角の丸い四角。マウスを乗せると少し浮く）。押すと Google・Facebook・GitHub のロゴ付きの「Google でログイン」「Facebook でログイン」「GitHub でログイン」のメニュー（よく使われる順）
- ログイン中：ナビバーにはアイコン（写真、無ければ名前の頭文字の丸）だけを出し、右下の小さな点で保存の状態を示す（緑＝保存済み、琥珀＝保存中で点滅、赤＝エラー。マウスを乗せると文で出る）
  - アイコンの右上に、ログインに使ったサービス（Google / GitHub / Facebook）のロゴを小さく出す。マウスを乗せると「Google でログイン中 · アカウントに保存済み」のように出る
  - アイコンを押すとメニュー：大きめのアイコン・名前・メールアドレス・「（ロゴ）GitHub でログイン中」、保存の状態（失敗したときはエラーの種類も）、**ログアウト**
- Facebook のプロフィール写真：Firebase が受け取る写真の URL はアクセストークンが無いと Facebook の既定の人型になるので、そのままは使わない。Facebook でログインした直後に、そのときのトークンで Graph API（`/me/picture`）から本人の写真の URL を受け取り、Firebase のプロフィールに保存する（トークンは保存しない）。写真の URL は Facebook 側で期限が切れるので、読めなくなったら頭文字の丸にする（次に Facebook でログインしたときに更新される）
- ページを開いたときのちらつきを防ぐ：ログイン状態が分かるまでは「ログイン」ボタンを出さない。前回ログインしていたときは、そのアカウントのアイコン・名前・ログイン方法を `visualcube-editor:account-hint` に覚えておき、ログイン状態が分かる前からアイコンを出しておく（分かるまではメニューは開かない。ログアウトしたら消す）
- メニューはメニューの外を押すか Esc で閉じる。ログインできなかったときはメニューの中にエラーを出す
- 同じメールアドレスのログイン方法をつなげる（アカウントのリンク）：Firebase の「同じメールアドレスを使用するアカウントをリンク」では、同じメールで別の方法を使うと `auth/account-exists-with-different-credential` になる（自動ではつながない）。このとき
  - 新しい方法の資格情報（`credentialFromError`）とメールアドレスをメモリに覚え、メニューに「{email} は別のログイン方法で登録されています。前に使った方法でログインすると、{provider} でもログインできるようにつなげます。」と、新しい方法以外のログインのボタンを出す（メールの列挙対策で、どの方法で登録したかは調べられないので本人に選んでもらう）
  - 前の方法でログインできて、メールアドレスが同じなら `linkWithCredential` で新しい方法をつなげ、「{provider} をつなげました」と出す。以後はどちらの方法でも同じアカウント（同じ uid・同じデータ）に入れる。メールアドレスが違えばつながずにそのままログインし、その旨を出す
  - ポップアップを閉じたときは覚えたまま。メニューを閉じる・ページを離れると捨てる（保存しない）
- 文は `js/i18n.js`（`account.*`）、見た目は `css/common.css`

## プライバシーポリシーとデータの削除（`privacy.html`・`js/privacy.js`）
- 保存する情報には、練習の記録（タイム・日時・ケース・判定、通しのスクランブルとペナルティ）と練習の設定も含める。ブラウザへの保存の項には、ログイン中にアカウントの名前・メールアドレス・写真の URL・ログイン方法をブラウザに覚えること（ログアウトで消す）を書く
- 本文は日本語・英語の両方を HTML に書き、言語の切り替えに合わせて片方を出す（ログインで受け取る情報・保存する情報・使い方・保存先・アクセス解析（Google Analytics）・削除の方法・問い合わせ先＝GitHub の Issues。運営は roudai.net）
- ナビバーのログインのメニューからリンクする：ログイン前は「ログイン」ボタンのメニュー、ログイン中はアイコンのメニューの「プライバシーポリシー」（データの削除はページの一番下）。Facebook のアプリの「プライバシーポリシーの URL」「データ削除の手順の URL」にこのページを登録する
- 「アカウントのデータを削除」（ログイン中だけ押せる）：押すと確認の文と「削除する」「キャンセル」を出し、「削除する」で削除する（ブラウザの確認ダイアログは使わない）
  - `CloudSync.deleteAccount()`：`users/{uid}/apps` の下の全アプリの文書を消し、ログインのアカウントも消す（アカウントは共通なので、Megaminx Image Editor に保存した内容も消える。確認の文とプライバシーポリシーに明記している）。しばらく前にログインした場合は Firebase が再ログインを求めるので、ログインしたときと同じサービスでもう一度ログインしてもらってから消す
  - ブラウザに保存された設定は残す（この端末とアカウントの結び付き `synced-uid`・アイコンの情報 `account-hint` は消す）
- `firestore.rules`：本人は自分の文書を削除できる（`allow delete`）

## 利用規約（`terms.html`）
- 本文は日本語・英語（言語の切り替えは `js/legal.js`。プライバシーポリシーと共通）。制定日・運営（roudai.net）・問い合わせ（GitHub の Issues）はプライバシーポリシーと同じ
- 内容：適用、無料、アカウント（各サービスの規約にも従う）、禁止事項、作った画像は自由に使える、保存できる記録の量（PLL・OLL・COLL の練習の記録は合わせて最新 2000 件、ケースごとの最近のタイムは各 10 件、通しは最新 2000 件。超えると古い順に自動で削除・元に戻せない・上限は予告なく変わることがある）、無保証・免責（故意・重大な過失を除く）、予告なしの変更・停止・終了、規約の変更、準拠法（日本法）、個人情報はプライバシーポリシー
- ログインのメニュー（ログイン前・ログイン中とも）の「プライバシーポリシー」の下に「利用規約」。プライバシーポリシーの本文の最後からもリンク

## Firebase の設定（サイトの管理者がやる）
プロジェクト・ログイン方法・Firestore は Megaminx Image Editor で設定済みのものをそのまま使う（手順は MegaminxImageEditor の `reference/CLOUD_SYNC_SPEC.md`）。
VisualCube Editor を公開するときに足すこと：

1. Authentication → 設定 → 承認済みドメインに `visualcube.roudai.net` を追加する（`localhost` は最初から入っている）
2. Firestore の「ルール」が、`appIds()` に `visualcube-editor` を含む版（このリポジトリの `firestore.rules`）になっているか確かめ、違えば貼って公開する。
   古い版のままだと `users/{uid}/apps/visualcube-editor` を作れず、保存の状態が赤（エラー）になる
3. Google / GitHub / Facebook のリダイレクト URI は Firebase の `https://<project-id>.firebaseapp.com/__/auth/handler` のままなので、追加は要らない見込み（未確認）
4. Facebook アプリ（開発者サイト）の「アプリドメイン」「ウェブサイト」に `visualcube.roudai.net` を足す必要があるか、アプリが「ライブ」かは未確認
5. 公開したサイトで、3つの方法のログイン・同じメールのアカウントのリンク・データの削除を確かめる

公開（`main` へのマージ）で自動的にサイトが更新される場合は、1・2 が済むまでマージしない（ログインのボタンは出るのに、ログインや保存が失敗する状態で公開されるため）。

## 使い方（`guide.html`、URL は `/guide`）
- サイトの使い方（エディタ・PLL一覧 / OLL一覧 / COLL一覧・練習・記録・保存とログイン・問い合わせ）を日本語・英語で書いたページ（言語の切り替えは `js/legal.js`。画像は入れず文章だけ）
- ログインのメニュー（ログイン前・ログイン中とも）の区切り線のすぐ下、「プライバシーポリシー」の上に「使い方」（MegaminxImageEditor 06459e1）
