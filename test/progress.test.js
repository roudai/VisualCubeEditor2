// 実行: node --test
// js/progress.js（習得状況・練習の判定と記録・画像の配色）
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/progress.js');
const M = require('../js/cube-state.js');

function withStorage(initial, fn) {
  const map = new Map(Object.entries(initial || {}));
  global.localStorage = {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
  try {
    return fn(map);
  } finally {
    delete global.localStorage;
  }
}

test('thresholdOf：種類ごとの目安。無ければ以前の共通の threshold、それも無ければ OLL 2 秒・ほかは 3 秒（範囲外の値は使わない）', () => {
  assert.equal(P.thresholdOf({ thresholds: { pll: 5, oll: 2, coll: 8 } }, 'pll'), 5);
  assert.equal(P.thresholdOf({ thresholds: { pll: 5, oll: 2, coll: 8 } }, 'oll'), 2);
  assert.equal(P.thresholdOf({ thresholds: { pll: 5, oll: 2, coll: 8 } }, 'coll'), 8);
  assert.equal(P.thresholdOf({ threshold: 10, thresholds: { pll: 6 } }, 'coll'), 10);
  assert.equal(P.thresholdOf({ threshold: 10 }, 'pll'), 10);
  assert.equal(P.thresholdOf({}, 'pll'), 3);
  assert.equal(P.thresholdOf(null, 'oll'), 2);
  assert.equal(P.thresholdOf({}, 'coll'), 3);
  assert.equal(P.thresholdOf({}, 'zbll'), 3);
  assert.equal(P.thresholdOf({ thresholds: { pll: 5 } }, 'oll'), 2);
  assert.equal(P.thresholdOf({ thresholds: { pll: 0, oll: 'x' }, threshold: 500 }, 'pll'), 3);
  // 1〜10 秒・0.5 秒刻みにそろえる（以前は 120 秒まで選べた）
  assert.equal(P.thresholdOf({ thresholds: { pll: 30 } }, 'pll'), 10);
  assert.equal(P.thresholdOf({ threshold: 120 }, 'oll'), 10);
  assert.equal(P.thresholdOf({ thresholds: { pll: 0.5 } }, 'pll'), 1);
  assert.equal(P.thresholdOf({ thresholds: { pll: 6.3 } }, 'pll'), 6.5);
  assert.equal(P.clampThreshold(5.5), 5.5);
  assert.equal(P.clampThreshold(25), 10);
  assert.equal(P.clampThreshold(0.2), 1);
});

test('judge：しきい値以内なら習得済み、超えた・解けなかった（null）なら練習中', () => {
  assert.equal(P.judge(4.99, 5), 'learned');
  assert.equal(P.judge(5, 5), 'learned');
  assert.equal(P.judge(5.01, 5), 'learning');
  assert.equal(P.judge(null, 8), 'learning');
});

test('addTime：新しい順に足し、最大件数を超えた古いものは捨てる', () => {
  assert.deepEqual(P.addTime(undefined, 3.2), [3.2]);
  assert.deepEqual(P.addTime([2, 1], 3, 3), [3, 2, 1]);
  assert.deepEqual(P.addTime([3, 2, 1], 4, 3), [4, 3, 2]);
  assert.equal(P.addTime(new Array(10).fill(1), 2).length, 10);
});

test('statusOf / setStatus：習得状況を読み書きし、未着手は保存しない（ほかの種類は消さない）', () => {
  withStorage({ 'visualcube-editor:progress': '{"oll":{"27":"learned"}}' }, (map) => {
    assert.equal(P.statusOf('pll', 'Aa'), 'new');
    P.setStatus('pll', 'Aa', 'learned');
    assert.equal(P.statusOf('pll', 'Aa'), 'learned');
    P.setStatus('pll', 'Aa', 'new');
    const saved = JSON.parse(map.get('visualcube-editor:progress'));
    assert.equal(typeof saved._at.pll.Aa, 'number'); // 変えたケースの時刻（端末どうしでケースごとに合わせるため。store.js）
    delete saved._at;
    assert.deepEqual(saved, { oll: { '27': 'learned' }, pll: {} });
  });
});

test('displaySettings：PLL は OLL 配色のとき OLL を選ぶ前の配色、OLL は U の色だけを残す', () => {
  const settings = {
    preset: 'oll',
    faceColors: Object.assign({}, ...M.FACES.map((f) => ({ [f]: '#404040' })), { U: '#ffffff' }),
    beforeOll: { preset: 'custom', scheme: Object.assign({}, ...M.FACES.map((f) => ({ [f]: '#123456' }))) },
    imageSize: '5000',
  };
  withStorage({ 'visualcube-editor:settings': JSON.stringify(settings) }, () => {
    const pll = P.displaySettings('pll');
    assert.equal(pll.scheme.F, '#123456');
    assert.equal(pll.size, 1000);
    const oll = P.displaySettings('oll');
    assert.equal(oll.scheme.U, '#ffffff');
    assert.equal(oll.scheme.F, M.OLL_GRAY);
  });
  withStorage({}, () => assert.equal(P.displaySettings('pll').scheme.F, M.DEFAULT_SCHEME.F));
});

test('wrapAuf：前後に AUF を足し、もともと前後にある U とまとめる', () => {
  assert.equal(P.wrapAuf("R U R'", 0, 0), "R U R'");
  assert.equal(P.wrapAuf("R U R'", 1, 3), "U R U R' U'");
  assert.equal(P.wrapAuf("R U R'", 2, 2), "U2 R U R' U2");
  assert.equal(P.wrapAuf("U R U'", 1, 1), 'U2 R');
  assert.equal(P.wrapAuf("U2' R U2", 2, 2), 'R');
  assert.equal(P.wrapAuf("U' R U'2", 3, 3), 'U2 R U');
  assert.equal(P.wrapAuf('U U2', 1, 0), '');
  assert.equal(P.wrapAuf('U', 1, 1), "U'");
});

test('wrapAuf：前後に AUF を足しても同じケースのまま', () => {
  const C = require('../js/case-check.js');
  // 全ケース・全スクランブルでの確認は test/scrambles.test.js で行う。ここでは代表的なケースだけ
  const cases = [
    ['pll', "R U R' U' R' F R2 U' R' U' R U R' F'", "F R U' R' U R U R2 F' R U R U' R'"], // T（逆手順）
    ['pll', "R U' R U R U R U' R' U' R2", "U R2 U R U R' U' R' U' R' U R' U'"], // Ua（前後に U が付いたスクランブル）
    ['oll', "R U R' U R U2 R'", "U R U2 R' U' R U' R' U2"], // Sune
  ];
  cases.forEach(([set, alg, scramble]) => {
    for (let pre = 0; pre < 4; pre++) {
      for (let post = 0; post < 4; post++) {
        const wrapped = P.wrapAuf(scramble, pre, post);
        assert.ok(C.fitSetup(set, alg, wrapped), set + ' ' + wrapped);
      }
    }
  });
});

test('addLog：新しい順に足し、種類ごとの最大件数（既定 5000）を超えた古いものは捨てる', () => {
  const e = (i, set) => ({ at: i, set: set || 'pll', name: 'Aa', sec: 1, status: 'learned' });
  assert.deepEqual(P.addLog(undefined, e(1)), [e(1)]);
  assert.deepEqual(P.addLog([e(2), e(1)], e(3), 2), [e(3), e(2)]);
  // PLL をたくさん足しても、ほかの種類の記録は押し出されない
  assert.deepEqual(P.addLog([e(3), e(2, 'zbll'), e(1)], e(4), 2), [e(4), e(3), e(2, 'zbll')]);
  let log = [];
  for (let i = 0; i < 5005; i++) log = P.addLog(log, e(i));
  log = P.addLog(log, e(5005, 'coll'));
  assert.equal(log.length, 5001);
  assert.equal(log[1].at, 5004);
  assert.equal(log[log.length - 1].at, 5);
});

test('summarize / perCase：種類・期間で絞って集計し、解けなかった（null）は平均に入れない', () => {
  const log = [
    { at: 300, set: 'pll', name: 'Aa', sec: 4, status: 'learned' },
    { at: 200, set: 'pll', name: 'Aa', sec: null, status: 'learning' },
    { at: 150, set: 'pll', name: 'Jb', sec: 10, status: 'learning' },
    { at: 100, set: 'oll', name: '27', sec: 2, status: 'learned' },
    { broken: true },
  ];
  assert.deepEqual(P.summarize(log, { set: 'pll' }), { count: 3, solved: 2, dnf: 1, avg: 7, best: 4 });
  assert.deepEqual(P.summarize(log, { set: 'pll', from: 160 }), { count: 2, solved: 1, dnf: 1, avg: 4, best: 4 });
  assert.deepEqual(P.summarize([], {}), { count: 0, solved: 0, dnf: 0, avg: null, best: null });
  assert.deepEqual(P.perCase(log, { set: 'pll' }), {
    'Aa': { count: 2, solved: 1, dnf: 1, best: 4, avg: 4, last: 300 },
    'Jb': { count: 1, solved: 1, dnf: 0, best: 10, avg: 10, last: 150 },
  });
});

test('recentPerCase：ケースごとの直近 n 回。解けなかった回は平均に入れず、score では dnfAs 秒として数える', () => {
  const log = [
    { at: 100, set: 'pll', name: 'Aa', sec: 20 }, // 直近 3 回から外れる
    { at: 200, set: 'pll', name: 'Aa', sec: 6 },
    { at: 400, set: 'pll', name: 'Aa', sec: 4 },
    { at: 300, set: 'pll', name: 'Aa', sec: null },
    { at: 250, set: 'pll', name: 'Jb', sec: null },
    { at: 260, set: 'oll', name: 'Aa', sec: 1 }, // 種類が違う
    { at: 50, set: 'pll', name: 'Z', sec: 3 }, // 期間外
  ];
  assert.deepEqual(P.recentPerCase(log, { set: 'pll', from: 60, n: 3, dnfAs: 16 }), {
    Aa: { attempts: 3, avg: 5, dnf: 1, score: 26 / 3 },
    Jb: { attempts: 1, avg: null, dnf: 1, score: 16 },
  });
});

test('daily：直近の日ごとの回数と平均（練習していない日は 0）', () => {
  const now = new Date(2026, 10, 16, 15).getTime();
  const at = (d, h) => new Date(2026, 10, d, h).getTime();
  const log = [
    { at: at(16, 9), set: 'pll', name: 'Aa', sec: 4 },
    { at: at(16, 10), set: 'pll', name: 'Aa', sec: 6 },
    { at: at(14, 23), set: 'pll', name: 'Aa', sec: null },
    { at: at(1, 9), set: 'pll', name: 'Aa', sec: 1 }, // 範囲外
  ];
  assert.deepEqual(P.daily(log, { set: 'pll', days: 3, now }), [
    { day: '2026-11-14', count: 1, avg: null },
    { day: '2026-11-15', count: 0, avg: null },
    { day: '2026-11-16', count: 2, avg: 5 },
  ]);
});

test('rollingAverages：各記録の時点の n 回平均（足りなければ undefined、DNF 2つで null）', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  const recs = [r(5), r(1), r(3), r(0, 'DNF'), r(2), r(4), r(0, 'DNF')]; // 新しい順
  assert.deepEqual(P.rollingAverages(recs, 5), [P.average(recs, 5), P.average(recs.slice(1), 5), null, undefined, undefined, undefined, undefined]);
  assert.equal(P.rollingAverages(recs, 5)[0], 3.33);
  assert.deepEqual(P.rollingAverages([], 5), []);
});

test('effectiveTime：+2 を足し、DNF は null', () => {
  assert.equal(P.effectiveTime({ sec: 50.1, penalty: '' }), 50.1);
  assert.equal(P.effectiveTime({ sec: 50.1, penalty: '+2' }), 52.1);
  assert.equal(P.effectiveTime({ sec: 50.1, penalty: 'DNF' }), null);
});

test('average（WCA 式）：最速と最遅を除く。DNF 1つは最遅、2つ以上は DNF。足りなければ undefined', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  assert.equal(P.average([r(50), r(60), r(55), r(40), r(70)], 5), 55); // (50+60+55)/3
  assert.equal(P.average([r(50), r(60), r(55), r(40), r(70, 'DNF')], 5), 55); // DNF が最遅で除かれる → 50,60,55
  assert.equal(P.average([r(50, '+2'), r(60), r(55), r(40), r(70)], 5), 55.67); // 52,60,55
  assert.equal(P.average([r(50, 'DNF'), r(60), r(55), r(40, 'DNF'), r(70)], 5), null);
  assert.equal(P.average([r(50), r(60)], 5), undefined);
  // 直近の n 回だけを使う（新しい順）
  assert.equal(P.average([r(10), r(10), r(10), r(10), r(10), r(99)], 5), 10);
});

test('average：ao100 は速い方・遅い方を 5 回ずつ除く。DNF 5 回までは最遅として除き、6 回で DNF', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  // 1..100 秒：6..95 の平均 = 50.5
  const recs = Array.from({ length: 100 }, (_, i) => r(i + 1));
  assert.equal(P.average(recs, 100), 50.5);
  // 遅い 5 回を DNF にしても同じ
  const dnf5 = recs.map((x, i) => (i >= 95 ? r(0, 'DNF') : x));
  assert.equal(P.average(dnf5, 100), 50.5);
  const dnf6 = recs.map((x, i) => (i >= 94 ? r(0, 'DNF') : x));
  assert.equal(P.average(dnf6, 100), null);
  assert.equal(P.average(recs.slice(0, 99), 100), undefined);
});

test('meanTime：DNF を除いたタイムの平均（+2 は足す）。解けた記録が無ければ null', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  assert.equal(P.meanTime([r(50), r(60, 'DNF'), r(55, '+2')]), 53.5); // (50 + 57) / 2
  assert.equal(P.meanTime([r(10), r(10), r(11)]), 10.33);
  assert.equal(P.meanTime([r(50, 'DNF')]), null);
  assert.equal(P.meanTime([]), null);
});

test('bestAverage / bestSingle：これまでで最も速い平均と1回（DNF は除く）', () => {
  const r = (sec, penalty) => ({ sec, penalty: penalty || '' });
  const recs = [r(70), r(50), r(51), r(52), r(53), r(54), r(40, 'DNF')];
  assert.equal(P.bestSingle(recs), 50);
  assert.equal(P.bestAverage(recs, 5), 52); // 50..54 の窓：(51+52+53)/3
  assert.equal(P.bestAverage(recs, 12), undefined);
  assert.equal(P.bestSingle([r(1, 'DNF')]), null);
});

test('formatTime：60 秒未満は秒、60 秒以上は分表記（丸めてから分ける）', () => {
  assert.equal(P.formatTime(5.2), '5.20');
  assert.equal(P.formatTime(59.994), '59.99');
  assert.equal(P.formatTime(59.996), '1:00.00');
  assert.equal(P.formatTime(65.234), '1:05.23');
  assert.equal(P.formatTime(600), '10:00.00');
  assert.equal(P.formatTime(70.4, 0), '1:10');
  assert.equal(P.formatTime(0), '0.00');
});

test('caseColors：COLL は側面のエッジのステッカー（側面上段の真ん中）だけを OLL_GRAY にする', () => {
  const c = { name: '27-1', alg: "R U R' U R U2 R'" };
  const plain = P.caseColors(c, M.DEFAULT_SCHEME);
  const coll = P.caseColors(c, M.DEFAULT_SCHEME, 'coll');
  assert.deepEqual(coll.ucolor, plain.ucolor);
  coll.scolor.forEach((x, i) => assert.equal(x, i % 3 === 1 ? M.OLL_GRAY : plain.scolor[i], String(i)));
  assert.deepEqual(P.caseColors(c, M.DEFAULT_SCHEME, 'pll'), plain);
});

test('weakScores：回数の少ないケースを全体の平均に寄せる。解けなかった回は dnfAs として数える', () => {
  const log = [
    { at: 1, set: 'pll', name: 'A', sec: 4 },
    { at: 2, set: 'pll', name: 'A', sec: 4 },
    { at: 3, set: 'pll', name: 'A', sec: 4 },
    { at: 4, set: 'pll', name: 'A', sec: 4 },
    { at: 5, set: 'pll', name: 'B', sec: null },
    { at: 6, set: 'oll', name: 'X', sec: 30 },
  ];
  const w = P.weakScores(log, { set: 'pll', dnfAs: 16 });
  assert.equal(w.overall, (4 * 4 + 16) / 5);
  assert.equal(w.scores.A, (4 * 4 + w.overall * 2) / 6);
  assert.equal(w.scores.B, (16 + w.overall * 2) / 3);
  assert.ok(!('X' in w.scores));
  assert.deepEqual(P.weakScores([], {}), { scores: {}, overall: 0 });
  // prior: 0 なら寄せない
  assert.equal(P.weakScores(log, { set: 'pll', dnfAs: 16, prior: 0 }).scores.B, 16);
});

test('pickWeighted：重みに比例して選ぶ。重みがすべて 0 なら一様', () => {
  const seq = (values) => {
    let i = 0;
    return () => values[i++ % values.length];
  };
  const list = ['a', 'b', 'c'];
  const weight = (x) => ({ a: 1, b: 0, c: 3 })[x];
  // 合計 4：[0,1) → a、[1,4) → c（b は重み 0 なので選ばれない）
  assert.equal(P.pickWeighted(list, weight, seq([0.2])), 'a');
  assert.equal(P.pickWeighted(list, weight, seq([0.3])), 'c');
  assert.equal(P.pickWeighted(list, weight, seq([0.99])), 'c');
  assert.equal(P.pickWeighted(list, () => 0, seq([0.5])), 'b');
  assert.equal(P.pickWeighted([], weight), undefined);
  let r = 0;
  const counts = { a: 0, b: 0, c: 0 };
  for (let i = 0; i < 4000; i++) counts[P.pickWeighted(list, weight, () => ((r = (r + 0.6180339887) % 1)))]++;
  assert.equal(counts.b, 0);
  assert.ok(Math.abs(counts.c / counts.a - 3) < 0.1);
});

test('joinMoves：手順をつなぎ、となり合う同じ面の回転をまとめる（90° 単位）', () => {
  assert.equal(P.joinMoves('F R2', 'R U'), "F R' U");
  assert.equal(P.joinMoves('F R U2', "U2 R' F'"), '');
  assert.equal(P.joinMoves('R U', "U' R'"), '');
  assert.equal(P.joinMoves('R U', 'U F'), 'R U2 F');
  assert.equal(P.joinMoves("R2 U'", "U2 R"), "R2 U R");
  assert.equal(P.joinMoves("R U2'", 'U'), "R U'");
  assert.equal(P.joinMoves('R U', 'F'), 'R U F');
  assert.equal(P.joinMoves('', "U' R", ''), "U' R");
  // 合わせても同じ状態
  const a = "R U R' U'";
  const b = "U R U2 R'";
  assert.deepEqual(M.applyAlg(P.joinMoves(a, b)), M.applyAlg(`${a} ${b}`));
});
