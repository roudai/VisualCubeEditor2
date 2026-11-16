// PLL・OLL の練習用のスクランブル（<pll|oll>/scrambles.json）を作る。
// 実行: node tools/gen-scrambles.js [pll] [oll] [--seed=数] [--count=本数]（引数なしで両方。既定は種 1・各 20 本）
//       そのあと node tools/build-scrambles.js で js/<set>-scrambles.js を作る
//
//   js/<set>-data.js の各ケースについて、「そのケースの状態」を two-phase ソルバ（js/cube-solver.js）で解き、
//   その逆手順をスクランブルにする（スクランブルを揃った状態に適用すると、そのケースになる）。
//   覚えた手順の逆がそのまま出ないよう、setup の手順そのものは使わない。
//     PLL: setup の前後にランダムな AUF を付けた状態。この状態はソルバの第 2 段階だけで揃ってしまい、
//          U D と 180° だけの不自然な手順になるので、ランダムな 2 手 t を足した状態を、第 1 段階を 5 手以上に
//          して解き、「解の逆 + t の逆」をスクランブルにする（つなぎ目はまとめる）。
//          前後の AUF は 4×4 通り（H は実質 4 通り）しか無いが、t によって同じ状態でも違う手順になる
//     OLL: 上面の向きはそのケースのまま、最後の層の置換（PLL の部分）を一様ランダムにし、ランダムな AUF を付けた状態
//   どのスクランブルも tools/build-scrambles.js の verifyScramble で確かめ、同じケースの中で重複させない。
//   MIN_MOVES 手より短いものは作り直す。
//   乱数はケースごとに「種・セット・ケース名」から決めるので、同じ種なら何度作っても同じ結果になる
//   （ケースを足しても、ほかのケースのスクランブルは変わらない）。
//
//   出力 <set>/scrambles.json = { ケース名: [スクランブル, ...] }
//   （移植元はケース番号をキーにしていたが、ここでは js/<set>-data.js の name をキーにする。生成物と同じキー）
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('../js/cube-state.js');
const Solver = require('../js/cube-solver.js');
const B = require('./build-scrambles.js');

const ROOT = path.join(__dirname, '..');
const DEFAULT_SEED = 1;
const DEFAULT_COUNT = 20;
const MIN_MOVES = 12;
const MAX_TRIES = 50; // 1 本あたりの作り直しの上限（これを超えたらエラー）
// ソルバの設定（この手数以下が見つかるか、節点数の上限まで探す）
const SOLVE_OPTIONS = { target: 19, maxNodes: 2000000 };
// PLL は第 1 段階を 5 手以上にする（t を戻すだけの 2 手で第 1 段階が終わり、残りが U D と 180° だけになるのを避ける）
const PLL_OPTIONS = Object.assign({ minPhase1: 5 }, SOLVE_OPTIONS);

const FACES = 'URFDLB';
const SUFFIX = ['', '2', "'"];
const pick = (random, n) => Math.min(n - 1, Math.floor(random() * n));

// 文字列 → 種（FNV-1a）
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// PLL 用のランダムな 2 手：R L F B の 90°（第 2 段階の手ではないもの）＋ 別の軸の面の手
function randomTail(random) {
  const first = [1, 2, 4, 5][pick(random, 4)];
  const others = [0, 1, 2, 3, 4, 5].filter((f) => f % 3 !== first % 3);
  const second = others[pick(random, others.length)];
  return FACES[first] + SUFFIX[pick(random, 2) * 2] + ' ' + FACES[second] + SUFFIX[pick(random, 3)];
}

function pllScramble(c, random) {
  const pre = M.AUFS[pick(random, 4)];
  const post = M.AUFS[pick(random, 4)];
  const tail = randomTail(random);
  const state = M.applyAlg([pre, c.setup, post, tail].filter(Boolean).join(' '));
  return Solver.simplify(Solver.invert(Solver.solve(state, PLL_OPTIONS)) + ' ' + Solver.invert(tail));
}

function shuffle4(random) {
  const p = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) {
    const j = pick(random, i + 1);
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  return p;
}
const parity = (p) => p.reduce((s, x, i) => s + p.slice(i + 1).filter((y) => y < x).length, 0) % 2;

function ollScramble(c, random) {
  const cubie = Solver.fromState(M.applyAlg(c.setup));
  // 最後の層（位置 0〜3）のピースを入れ替える。向き（co・eo）は位置ごとの値をそのまま残すので、上面の向きは変わらない
  const cp = shuffle4(random);
  const ep = shuffle4(random);
  if (parity(cp) !== parity(ep)) {
    const t = ep[0];
    ep[0] = ep[1];
    ep[1] = t;
  }
  for (let i = 0; i < 4; i++) {
    if (cubie.cp[i] > 3 || cubie.ep[i] > 3) throw new Error(`${c.name}: setup が最後の層以外を崩しています`);
    cubie.cp[i] = cp[i];
    cubie.ep[i] = ep[i];
  }
  const state = M.applyAlg(M.AUFS[pick(random, 4)], { state: Solver.toState(cubie) });
  return Solver.invert(Solver.solve(state, SOLVE_OPTIONS));
}

/**
 * cases（[{ name, alg, setup }]）の各ケースのスクランブルを作る。戻り値 { ケース名: [スクランブル, ...] }
 * options.seed（既定 1）、options.count（既定 20）
 */
function generate(set, cases, options) {
  const opts = options || {};
  const seed = opts.seed === undefined ? DEFAULT_SEED : opts.seed;
  const count = opts.count === undefined ? DEFAULT_COUNT : opts.count;
  const make = set === 'oll' ? ollScramble : pllScramble;
  const out = {};
  cases.forEach((c) => {
    const random = Solver.rng(hash(seed + ':' + set + ':' + c.name));
    const list = [];
    let tries = 0;
    while (list.length < count) {
      if (++tries > count * MAX_TRIES) throw new Error(`${set} ${c.name}: スクランブルを ${count} 本作れませんでした`);
      const scramble = make(c, random);
      if (scramble.split(' ').length < MIN_MOVES || list.includes(scramble)) continue;
      const err = B.verifyScramble(set, c, scramble, cases);
      if (err) throw new Error(`${set} ${c.name}: 作ったスクランブルが確認を通りません（${err}）: ${scramble}`);
      list.push(scramble);
    }
    out[c.name] = list;
  });
  return out;
}

const toJson = (data) => JSON.stringify(data, null, 2) + '\n';

function main(argv) {
  const options = {};
  const sets = [];
  for (const arg of argv) {
    const m = /^--(seed|count)=(\d+)$/.exec(arg);
    if (m) options[m[1]] = parseInt(m[2], 10);
    else if (B.SETS.includes(arg)) sets.push(arg);
    else {
      console.error('使い方: node tools/gen-scrambles.js [pll] [oll] [--seed=数] [--count=本数]');
      process.exit(1);
    }
  }
  for (const set of sets.length ? sets : B.SETS) {
    const t0 = Date.now();
    const data = generate(set, B.loadCases(set), options);
    const out = B.paths(set).src;
    fs.writeFileSync(out, toJson(data));
    const lengths = {};
    Object.values(data).forEach((list) =>
      list.forEach((s) => {
        const n = s.split(' ').length;
        lengths[n] = (lengths[n] || 0) + 1;
      })
    );
    console.log(`wrote ${path.relative(ROOT, out)}（${Object.keys(data).length} ケース、${Date.now() - t0} ms、手数の分布 ${JSON.stringify(lengths)}）`);
  }
}

module.exports = { generate, toJson, DEFAULT_SEED, DEFAULT_COUNT, MIN_MOVES };

if (require.main === module) main(process.argv.slice(2));
