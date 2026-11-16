// OLL のグループの説明（選択肢や一覧の見出しに「Dot (No edges oriented)」のように括弧付きで添える）。
// エディタと一覧・練習ページで使う。PLL は js/pll-groups.js（どちらを先に読み込んでもよい）。
// キーは oll/algs_info.json の group と同じ（並びもデータの順）。番号は標準の OLL 番号。
//   Dot              : 1 2 3 4 17 18 19 20（エッジが1枚も向いていない）
//   Square           : 5 6
//   Lightning        : 7 8 11 12 39 40
//   Fish             : 9 10 35 37
//   Knight           : 13 14 15 16
//   OCLL             : 21〜27（エッジが4枚とも向いている。コーナーだけを揃える）
//   Corners oriented : 28 57（コーナーが4個とも向いている。エッジ2枚が裏返っている）
//   Awkward          : 29 30 41 42
//   P                : 31 32 43 44
//   T                : 33 45
//   C                : 34 46
//   W                : 36 38
//   L                : 47 48 49 50 53 54
//   I                : 51 52 55 56
// ブラウザでは window.CASE_GROUP_NOTES.oll、node では module.exports（OLL の分だけ）として公開する。
(function (root, notes) {
  if (typeof module === 'object' && module.exports) {
    module.exports = notes;
  } else {
    root.CASE_GROUP_NOTES = root.CASE_GROUP_NOTES || {};
    root.CASE_GROUP_NOTES.oll = notes;
  }
})(typeof self !== 'undefined' ? self : this, {
  Dot: 'No edges oriented',
  Square: '2x2 block',
  Lightning: 'Lightning bolt',
  Fish: 'Fish shape',
  Knight: 'Knight move',
  OCLL: 'All edges oriented',
  'Corners oriented': 'Edges flipped',
  Awkward: 'Awkward shape',
  P: 'P shape',
  T: 'T shape',
  C: 'C shape',
  W: 'W shape',
  L: 'Small L shape',
  I: 'Line shape',
});
