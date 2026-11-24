// COLL のグループの説明（選択肢や一覧の見出しに「H (OLL 21)」のように括弧付きで添える）。
// エディタと一覧・練習ページで使う。PLL は js/pll-groups.js、OLL は js/oll-groups.js（どれを先に読み込んでもよい）。
// キーは data/coll/algs_info.json の group と同じ（並びもデータの順）。グループはそのケースの OLL（上面の向き）で分ける。
// 出典（roudai.net の COLL）の見出しは「OLL n26 Sune」「OLL n27 Anti-Sune」だが、OLL の番号（js/oll-data.js・一般の番号）では
// Sune が 27、Anti-Sune が 26 なので、ここでは OLL の番号に合わせた（ケース名も 26-x が Anti-Sune、27-x が Sune）。
// ブラウザでは window.CASE_GROUP_NOTES.coll、node では module.exports（COLL の分だけ）として公開する。
(function (root, notes) {
  if (typeof module === 'object' && module.exports) {
    module.exports = notes;
  } else {
    root.CASE_GROUP_NOTES = root.CASE_GROUP_NOTES || {};
    root.CASE_GROUP_NOTES.coll = notes;
  }
})(typeof self !== 'undefined' ? self : this, {
  H: 'OLL 21',
  Pi: 'OLL 22',
  U: 'OLL 23',
  T: 'OLL 24',
  L: 'OLL 25',
  'Anti-Sune': 'OLL 26',
  Sune: 'OLL 27',
});
