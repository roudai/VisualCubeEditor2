// PLL のグループの説明（選択肢や一覧の見出しに「Edges only (EPLL)」のように括弧付きで添える）。
// エディタと一覧・練習ページで使う。OLL は js/oll-groups.js（どちらを先に読み込んでもよい）。
// キーは data/pll/algs_info.json の group と同じ（並びもデータの順）。
//   Edges only    : Ua Ub H Z
//   Corners only  : Aa Ab E
//   Adjacent swap : T F Ja Jb Ra Rb（隣り合うコーナー2個とエッジ2個の交換）
//   Diagonal swap : Y V Na Nb（対角のコーナー2個とエッジ2個の交換）
//   G             : Ga Gb Gc Gd（コーナー3個とエッジ3個の巡回）
// ブラウザでは window.CASE_GROUP_NOTES.pll、node では module.exports（PLL の分だけ）として公開する。
(function (root, notes) {
  if (typeof module === 'object' && module.exports) {
    module.exports = notes;
  } else {
    root.CASE_GROUP_NOTES = root.CASE_GROUP_NOTES || {};
    root.CASE_GROUP_NOTES.pll = notes;
  }
})(typeof self !== 'undefined' ? self : this, {
  'Edges only': 'EPLL',
  'Corners only': 'CPLL',
  'Adjacent swap': 'Adjacent corner swap',
  'Diagonal swap': 'Diagonal corner swap',
  G: 'Double cycle',
});
