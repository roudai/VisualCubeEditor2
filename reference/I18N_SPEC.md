# 日本語・英語の切り替えの仕様

MegaminxImageEditor の `reference/I18N_SPEC.md` を VisualCube Editor 用に書き直したもの。コードと食い違うときはコードを正とする。

## 画面
- 全ページのナビバーに **EN / JA** の切り替えを置く（セグメント型。見た目は `css/common.css`）。スマホの幅ではメニューの中に入る（下の「ナビバー」）
- 押すとその場で画面の文を入れ替える（再読み込みしないので、エディタの手順・選択中のケース・色などはそのまま）
- 選んだ言語は localStorage の `visualcube-editor:lang` に保存し、全ページで共通にする。保存が無ければブラウザの言語（`ja` で始まれば日本語、それ以外は英語）
- `<html lang>` とページのタイトルも切り替える

## 訳す範囲
- ナビバー、エディタの見出し・ボタン・選択肢・ツールチップ（もともとある項目＝Puzzle Type、Arrow Definition、Stage Mask なども含む）
- 自分の手順の欄・メッセージ・エラー、手順の解析エラー（`Invalid move` など）
- 一覧ページの見出し・説明・件数・絞り込み・覚えた度の名前・一括ダウンロードのボタン、練習・記録のページ
- 訳さないもの：ケース名・グループ名とその説明（`Edges only (EPLL)` など）、回転記号、ステージマスクの名前（`F2L` など）、`PLL` / `OLL`、`ao5` / `ao12` / `DNF`、`presented by`、エディタの「Show Parameter」で出るパラメータ
- 覚えた度の日本語：未習得 / 練習中 / 習得済み

## 仕組み（`js/i18n.js`）
- 訳は `DICT.en` / `DICT.ja` に key ごとに書く。`{name}` のような部分は params で埋める
- HTML の文は `data-i18n="key"`（属性は `data-i18n-title` / `data-i18n-placeholder` / `data-i18n-aria-label`、埋める値は `data-i18n-params`）。HTML には英語の文をそのまま書いておく
- JS で作る文は `I18N.set(el, key, params, attr)` で入れる（言語を切り替えたときに自動で入れ直す）。件数など毎回作る文は `I18N.onChange(fn)` で作り直す
- **エディタ（`index.html`）の Vue の中（`#app`）** は Vue が描き直すので `data-i18n` を使わず、`{{ t('key') }}`・`:title="t('key')"` と書く
  （`js/main.js` の `t`。言語を切り替えると `I18N.onChange` で `lang` が変わり、Vue が描き直す）。ナビバーは `#app` の外なので `data-i18n`
- 各ページで、ほかのスクリプトより先に `js/store.js` → `js/i18n.js` を読み込む
- `test/pages.test.js` が、英語と日本語のキーがそろっていること、html と画面のスクリプトで使うキーがあることを確かめる

## ナビバー（全ページ共通。`js/navbar.js`・`css/common.css`）
- 中身：タイトル、言語の切り替え、アカウント（ログイン）、ページへのリンク（エディタ・PLL一覧・OLL一覧・練習・記録）、GitHub。今いるページのリンクは太字（`aria-current="page"`）
- 広い画面（md 以上）：言語 → アカウント → リンク → GitHub を1行に並べる
- スマホ（md 未満）：1行に収めるため、タイトル・アカウントのアイコン・メニューのボタン（☰）だけを出す。ボタンを押すと、言語の切り替えとリンクが縦に並んだメニューが開く（外を押す・Esc で閉じる）
