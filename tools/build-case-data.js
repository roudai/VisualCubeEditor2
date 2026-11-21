// data/<set>/algs_info.json から js/<set>-data.js を生成する共通部分（set は pll・oll・coll・zbll）。
// tools/build-<set>-data.js から使う（それぞれ createBuilder('<set>') を呼ぶだけ）。
// 仕様: reference/PLL_SPEC.md・OLL_SPEC.md・COLL_SPEC.md・ZBLL_SPEC.md
//
//   元データ data/<set>/algs_info.json = { "番号": { name, group, algset, s, a } }
//     a: [前AUF] 手順              解く手順。例: "(U') R U R' ..."。最後の AUF は付けない。
//                                  手順の配列でもよい（ZBLL）。1本目が主な手順（alg）で s と完全に合うこと。
//                                  2本目以降は別解（alts）で、同じケースを前後の AUF を除いて揃えること
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
//   ZBLL は learn_order.json を使わず、OCLL（algset の T-ZBLL など）を段階にする（stage は OCLL が出てくる順、order はデータの順）。
//   group は「T / 2GLL」のように OCLL と小グループを合わせたものにする
//
//   PLL は各ケースに inverse（逆手順のケース名）を付ける：そのケースの手順 alg を揃った状態に回してできる状態（前後の AUF の違いは無視）が、
//   setup の状態と一致するケース（自分自身のこともある）。ちょうど 1 つでなければエラー。練習で直前の逆手順を続けて出さないのに使う
//
//   出力 js/<set>-data.js = [{ name, group, (stage, order,) alg, (alts,) setup, (inverse) }, …]（ブラウザでは window.<SET>_DATA）
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
  // ZBLL は PLL と同じ確認（状態をまるごと比べる）
  zbll: {
    'trailing-y': 'a の最後に持ち替え（x y z）が付いています（向きを元に戻すもの以外は付けない）',
    'trailing-auf': 'a の最後に AUF が付いています（最後の AUF は付けない）',
    'not-solved': 'a で s のケースが揃いません（最後の AUF を除いても揃わない）',
    mismatch: 'Algorithm to solve case（a の1本目）と Algorithm to apply（s）の画像が一致しません',
  },
  coll: {
    'trailing-y': 'a の最後に持ち替え（x y z）が付いています（向きを元に戻すもの以外は付けない）',
    'trailing-auf': 'a の最後に AUF が付いています（最後の AUF は付けない）',
    'setup-f2l': 's で最後の層以外が崩れているか、上面のエッジが向いていません',
    'not-solved': 'a で s のケースの上面の向きとコーナーの位置が揃いません（最後の AUF を除いても揃わない）',
    mismatch: 'Algorithm to solve case（a）と Algorithm to apply（s）の画像（上面と側面のコーナー）が一致しません',
  },
};

/**
 * set（'pll' / 'oll' / 'coll'）の生成器を作る。options.root は元データと出力先の置き場所（既定はリポジトリのルート。テスト用）
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

  // ZBLL の OCLL（algset "T-ZBLL" → "T"）と、OCLL を段階にした { name: { stage, order } }
  const ocllOf = (c) => String(c.algset || '').replace(/-ZBLL$/, '');
  function ocllStages(list) {
    const stages = [];
    const at = {};
    list.forEach((c, i) => {
      const o = ocllOf(c);
      if (!stages.includes(o)) stages.push(o);
      at[c.name] = { stage: stages.indexOf(o) + 1, order: i + 1 };
    });
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
    const learn = set === 'zbll' ? ocllStages(list) : learnOrder(names, errors);
    const out = list.map((c) => {
      if (typeof c.group !== 'string' || !c.group) errors.push(`${c.name}: group がありません`);
      // a は手順1本、または手順の配列（1本目が主な手順、2本目以降は別解）
      const many = Array.isArray(c.a);
      const algs = many ? c.a : [c.a];
      if (!algs.length || algs.some((x) => typeof x !== 'string') || typeof c.s !== 'string') {
        errors.push(`${c.name}: a は手順の文字列（または手順の配列）、s は手順1本の文字列にしてください`);
        return null;
      }
      const main = algs[0];
      const alg = C.convert(main);
      const setup = C.convert(c.s);
      let problem;
      try {
        problem = check(main, c.s);
      } catch (e) {
        errors.push(`${c.name}: ${e.message}`);
        return null;
      }
      if (problem) {
        const fix = suggest(main, c.s);
        errors.push(
          `${c.name}: ${problem}` +
            (fix ? (fix.a !== main ? `\n    候補 a: ${fix.a}` : '') + `\n    候補 s: ${fix.s}` : '\n    （AUF を付け直しても合いません。手順を確認してください）')
        );
        return null;
      }
      // 別解：同じケースを、前後の AUF を除いて揃えること
      const alts = algs.slice(1).map((x) => C.convert(x));
      alts.forEach((x, i) => {
        let ok = false;
        try {
          ok = !!C.fitSetup(set, x, c.s);
        } catch (e) {
          ok = false;
        }
        if (!ok) errors.push(`${c.name}: a の ${i + 2} 本目（別解）でこのケースが揃いません: ${x}`);
      });
      const group = set === 'zbll' ? `${ocllOf(c)} / ${c.group}` : c.group;
      const at = learn ? learn[c.name] || {} : null;
      const item = { name: c.name, group: group };
      if (at) Object.assign(item, { stage: at.stage, order: at.order });
      item.alg = alg;
      if (many) item.alts = alts;
      item.setup = setup;
      return item;
    });
    if (errors.length) throw new Error(`${srcName} に問題があります:\n  ` + errors.join('\n  '));
    // PLL：逆手順のケース
    if (set === 'pll') {
      const keys = out.map((c) => C.caseKey('pll', c.setup));
      out.forEach((c) => {
        const k = C.caseKey('pll', c.alg, { cancelRotation: true });
        const found = out.filter((x, i) => keys[i] === k);
        if (found.length === 1) c.inverse = found[0].name;
        else errors.push(`${c.name}: 逆手順のケースが ${found.length} 個あります（${found.map((x) => x.name).join(', ')}）`);
      });
      if (errors.length) throw new Error(`${srcName} に問題があります:\n  ` + errors.join('\n  '));
    }
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
