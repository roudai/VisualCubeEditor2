// data/<pll|oll>/algs_info.json から js/<pll|oll>-data.js を生成する共通部分。
// tools/build-pll-data.js・tools/build-oll-data.js から使う（それぞれ createBuilder('pll') / createBuilder('oll') を呼ぶだけ）。
// 仕様: reference/PLL_SPEC.md・reference/OLL_SPEC.md
//
//   元データ data/<set>/algs_info.json = { "番号": { name, group, algset, s, a } }
//     a: [前AUF] 手順              解く手順。例: "(U') R U R' ..."。最後の AUF は付けない。
//                                  最後の持ち替えは、x … x' のように向きを元に戻すものだけ書いてよい
//     s: [AUF] setup [AUF]         そのケースになる手順。センターを動かさないこと
//                                  （a の前AUFを変えたら s の前後の AUF で合わせる）
//     AUF は括弧付きで直接書く（このスクリプトは足さない）
//
//   確認（js/case-check.js。エディタの「自分の手順」と共通）。合わないケースがあれば直し方の候補を表示してエラーで止める
//     PLL: a が s のケースを最後の AUF を除いて揃える / a の case 表示と s の apply 表示が同じ画像になる
//     OLL: s は最後の層（U層）だけを崩す / a が s のケースの上面の向きを揃える（F2L は崩さない）/
//          a の case 表示と s の apply 表示で上面の向き（OLL配色の画像）が同じになる
//     共通: a の最後に AUF・向きを戻さない持ち替えが無い / 名前が重複しない
//     手順中の持ち替え・2層回し・中層回しによる完成後の向きの違いは無視する（cancelRotation）
//
//   覚える順番 data/<set>/learn_order.json（段階ごとのケース名の配列）があれば、各ケースに stage（段階）と
//   order（覚える順の通し番号）を付ける。全ケースがちょうど1回ずつ無ければエラー。無ければ付けない
//
//   出力 js/<set>-data.js = [{ name, group, (stage, order,) alg, setup }, …]（ブラウザでは window.PLL_DATA / OLL_DATA）
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('../js/case-check.js');

const ROOT = path.join(__dirname, '..');

// 確認の結果（js/case-check.js のコード）→ 表示する文
const MESSAGES = {
  pll: {
    'trailing-y': 'a の最後に持ち替え（x y z）が付いています（向きを元に戻すもの以外は付けない）',
    'trailing-auf': 'a の最後に AUF が付いています（最後の AUF は付けない）',
    'not-solved': 'a で s のケースが揃いません（最後の AUF を除いても揃わない）',
    mismatch: 'Algorithm to solve case（a）と Algorithm to apply（s）の画像が一致しません',
  },
  oll: {
    'trailing-y': 'a の最後に持ち替え（x y z）が付いています（向きを元に戻すもの以外は付けない）',
    'trailing-auf': 'a の最後に AUF が付いています（最後の AUF は付けない）',
    'setup-f2l': 's で最後の層以外が崩れています',
    'not-solved': 'a で s のケースの上面が揃いません',
    mismatch: 'Algorithm to solve case（a）と Algorithm to apply（s）の上面の向きが一致しません',
  },
};

/**
 * set（'pll' / 'oll'）の生成器を作る。options.root は元データと出力先の置き場所（既定はリポジトリのルート。テスト用）
 *   build()        生成するファイルの中身（文字列）。問題があれば Error を投げる
 *   cases()        生成するデータ（配列）
 *   check(a, s)    問題があればその内容（文）、無ければ null
 *   suggest(a, s)  直し方の候補 { a, s }（無ければ null）
 *   SRC / OUT / ORDER_SRC   ファイルの場所
 *   main()         コマンドとして実行したときの処理（書き出して、エラーなら終了コード 1）
 */
function createBuilder(set, options) {
  const root = (options && options.root) || ROOT;
  const SRC = path.join(root, 'data', set, 'algs_info.json');
  const OUT = path.join(root, 'js', set + '-data.js');
  const ORDER_SRC = path.join(root, 'data', set, 'learn_order.json');
  const srcName = 'data/' + set + '/algs_info.json';

  // a・s を確認し、問題があればその内容を返す
  function check(a, s) {
    const code = C.check(set, C.convert(a), C.convert(s));
    return code ? MESSAGES[set][code] : null;
  }

  // 直し方の候補：書かれた a の前AUFを活かし、s の前後の AUF を付け直して確認を通るものを探す
  // （a の最後に AUF や向きを戻さない持ち替えがあれば外す。PLL は s に付ける AUF が少ないものを優先する）
  const suggest = (a, s) => C.fitSetup(set, a, s);

  // 覚える順番：ケース名 → { stage, order }。ファイルが無ければ null。全ケースをちょうど1回ずつ含まなければエラーを足す
  function learnOrder(names, errors) {
    if (!fs.existsSync(ORDER_SRC)) return null;
    const stages = JSON.parse(fs.readFileSync(ORDER_SRC, 'utf8'));
    const at = {};
    let order = 0;
    stages.forEach((list, i) =>
      list.forEach((name) => {
        if (at[name]) errors.push(`learn_order.json: ${name} が2回あります`);
        else if (!names.includes(name)) errors.push(`learn_order.json: ${name} は algs_info.json にありません`);
        at[name] = { stage: i + 1, order: ++order };
      })
    );
    names.filter((n) => !at[n]).forEach((n) => errors.push(`learn_order.json: ${n} がありません`));
    return at;
  }

  function cases() {
    const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    const errors = [];
    const list = Object.values(src);
    const names = list.map((c) => c.name);
    names.forEach((name, i) => {
      if (typeof name !== 'string' || !name) errors.push(`${Object.keys(src)[i]}: name がありません`);
      else if (names.indexOf(name) !== i) errors.push(`${name}: 名前が重複しています`);
    });
    const learn = learnOrder(names, errors);
    const out = list.map((c) => {
      if (typeof c.group !== 'string' || !c.group) errors.push(`${c.name}: group がありません`);
      if (typeof c.a !== 'string' || typeof c.s !== 'string') {
        errors.push(`${c.name}: a と s は手順1本の文字列にしてください`);
        return null;
      }
      const alg = C.convert(c.a);
      const setup = C.convert(c.s);
      let problem;
      try {
        problem = check(c.a, c.s);
      } catch (e) {
        errors.push(`${c.name}: ${e.message}`);
        return null;
      }
      if (problem) {
        const fix = suggest(c.a, c.s);
        errors.push(
          `${c.name}: ${problem}` +
            (fix ? (fix.a !== c.a ? `\n    候補 a: ${fix.a}` : '') + `\n    候補 s: ${fix.s}` : '\n    （AUF を付け直しても合いません。手順を確認してください）')
        );
        return null;
      }
      const at = learn ? learn[c.name] || {} : null;
      return at ? { name: c.name, group: c.group, stage: at.stage, order: at.order, alg: alg, setup: setup } : { name: c.name, group: c.group, alg: alg, setup: setup };
    });
    if (errors.length) throw new Error(`${srcName} に問題があります:\n  ` + errors.join('\n  '));
    return out;
  }

  function build() {
    const lines = cases().map((c) => '  ' + JSON.stringify(c) + ',');
    return [
      '// 自動生成ファイル。手で編集しないこと。',
      `// 元データ: ${srcName} / 生成: node tools/build-${set}-data.js`,
      '(function (root, data) {',
      "  if (typeof module === 'object' && module.exports) module.exports = data;",
      `  else root.${set.toUpperCase()}_DATA = data;`,
      "})(typeof self !== 'undefined' ? self : this, [",
      ...lines,
      ']);',
      '',
    ].join('\n');
  }

  function main() {
    try {
      fs.writeFileSync(OUT, build());
      console.log('wrote ' + path.relative(root, OUT));
    } catch (e) {
      console.error(e.message);
      process.exit(1);
    }
  }

  return { set: set, SRC: SRC, OUT: OUT, ORDER_SRC: ORDER_SRC, check: check, suggest: suggest, cases: cases, build: build, main: main };
}

module.exports = { createBuilder: createBuilder, MESSAGES: MESSAGES };
