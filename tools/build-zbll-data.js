// data/zbll/algs_info.json から js/zbll-data.js を生成する。
// 実行: node tools/build-zbll-data.js
// 仕様: reference/ZBLL_SPEC.md
//   処理は tools/build-case-data.js（PLL・OLL・COLL と共通）。ZBLL は a が手順の配列（1本目が主な手順、残りは別解）で、
//   確認は PLL と同じ（状態をまるごと比べる）。段階は OCLL（T・U・L・H・Pi・Sune・Antisune）。
//   合わないケースがあれば、直し方の候補を表示してエラーで止まる（js/zbll-data.js は書き出さない）
'use strict';
const builder = require('./build-case-data.js').createBuilder('zbll');

module.exports = builder;

if (require.main === module) builder.main();
