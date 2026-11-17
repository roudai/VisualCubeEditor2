// data/<pll|oll>/scrambles.json から練習用のスクランブルのファイル（js/<pll|oll>-scrambles.js）を作る。
// 実行: node tools/build-scrambles.js [pll] [oll]（引数なしで両方）
//   - scrambles.json は { ケース名: [スクランブル, ...] }（ケース名は js/<set>-data.js の name。tools/gen-scrambles.js が作る）
//   - 各スクランブルを確かめ、だめなものがあればエラーで止める（verifyScramble）
//       形式: 素の面回し（U D L R F B と 2・'）だけを空白 1 つで区切ったもの
//       PLL: 揃った状態に適用すると、そのケース（前後の AUF の違いを含む）になる
//       OLL: 最後の層以外は揃ったままで、上面の向きがそのケース（AUF の違いを含む）になる
//       どちらも、そのケースの手順で揃う（js/case-check.js の fitSetup。移植元と同じ確認）ことと、
//       スクランブルの逆手順から引いたケース（findCase）の名前が同じであることを見る
//     ケースごとに 1 本以上あること、同じケースの中で重複が無いこと、データに無いケース名が無いことも確かめる
//   - 出力は { ケース名: [スクランブル, ...] }（ブラウザでは window.PLL_SCRAMBLES / OLL_SCRAMBLES。並びは js/<set>-data.js の順）
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../js/case-check.js');
const Solver = require('../js/cube-solver.js');

const ROOT = path.join(__dirname, '..');
const SETS = ['pll', 'oll'];
const SCRAMBLE_RE = /^[URFDLB][2']?( [URFDLB][2']?)*$/;

/** set（'pll' / 'oll'）のファイルの場所。root は置き場所（既定はリポジトリのルート） */
function paths(set, root) {
  const base = root || ROOT;
  return {
    data: path.join(base, 'js', set + '-data.js'),
    src: path.join(base, 'data', set, 'scrambles.json'),
    out: path.join(base, 'js', set + '-scrambles.js'),
  };
}

/** js/<set>-data.js のケース（[{ name, group, alg, setup }]）。毎回読み直す */
function loadCases(set, root) {
  const file = paths(set, root).data;
  delete require.cache[require.resolve(file)];
  return require(file);
}

/** スクランブルがケース c（cases の要素）になるか。問題があればその内容（文）、無ければ null */
function verifyScramble(set, c, scramble, cases) {
  if (typeof scramble !== 'string' || !SCRAMBLE_RE.test(scramble)) return '形式が違います（素の面回しを空白 1 つで区切る）';
  if (!C.fitSetup(set, C.convert(c.alg), scramble)) return 'このケースになりません';
  const found = C.findCase(set, Solver.invert(scramble), cases);
  if (!found || found.name !== c.name) return 'ケースの名前が合いません（' + (found ? found.name : 'なし') + '）';
  return null;
}

/** raw（scrambles.json の中身）と cases から、生成するファイルの中身（文字列）を作る。問題があれば Error */
function buildFile(set, raw, cases) {
  const errors = [];
  const out = {};
  cases.forEach((c) => {
    const list = raw[c.name];
    if (!Array.isArray(list) || !list.length) {
      errors.push(`${c.name}: スクランブルがありません`);
      return;
    }
    const seen = new Set();
    out[c.name] = list.map((s, i) => {
      const err = verifyScramble(set, c, s, cases);
      if (err) errors.push(`${c.name} の ${i + 1} 番目: ${err}: ${s}`);
      else if (seen.has(s)) errors.push(`${c.name} の ${i + 1} 番目: 重複しています: ${s}`);
      seen.add(s);
      return s;
    });
  });
  const names = new Set(cases.map((c) => c.name));
  Object.keys(raw).forEach((name) => {
    if (!names.has(name)) errors.push(`${name}: js/${set}-data.js に無いケース名です`);
  });
  if (errors.length) throw new Error(`data/${set}/scrambles.json に問題があります:\n  ` + errors.join('\n  '));

  const varName = set.toUpperCase() + '_SCRAMBLES';
  const lines = cases.map((c) => '  ' + JSON.stringify(c.name) + ': ' + JSON.stringify(out[c.name]) + ',');
  return [
    '// 自動生成ファイル。手で編集しないこと。',
    `// 元データ: data/${set}/scrambles.json / 生成: node tools/build-scrambles.js`,
    '(function (root, data) {',
    "  if (typeof module === 'object' && module.exports) module.exports = data;",
    `  else root.${varName} = data;`,
    "})(typeof self !== 'undefined' ? self : this, {",
    ...lines,
    '});',
    '',
  ].join('\n');
}

/** data/<set>/scrambles.json と js/<set>-data.js を読んで、生成するファイルの中身を返す */
function build(set, root) {
  const raw = JSON.parse(fs.readFileSync(paths(set, root).src, 'utf8'));
  return buildFile(set, raw, loadCases(set, root));
}

function main(argv) {
  const sets = argv.length ? argv : SETS;
  for (const set of sets) {
    if (!SETS.includes(set)) {
      console.error('使い方: node tools/build-scrambles.js [pll] [oll]');
      process.exit(1);
    }
  }
  for (const set of sets) {
    try {
      const out = paths(set).out;
      fs.writeFileSync(out, build(set));
      console.log('wrote ' + path.relative(ROOT, out));
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }
}

module.exports = { SETS, paths, loadCases, verifyScramble, buildFile, build };

if (require.main === module) main(process.argv.slice(2));
