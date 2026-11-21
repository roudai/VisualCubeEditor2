// data/oll/algs_info.json から js/oll-data.js を生成する。
// 実行: node tools/build-oll-data.js
// 仕様: reference/OLL_SPEC.md
//   処理は tools/build-case-data.js（PLL と共通）。a・s の書き方と確認の内容はそちらの先頭を参照。
//   合わないケースがあれば、直し方の候補を表示してエラーで止まる（js/oll-data.js は書き出さない）
'use strict';
const builder = require('./build-case-data.js').createBuilder('oll');

module.exports = builder;

if (require.main === module) builder.main();
