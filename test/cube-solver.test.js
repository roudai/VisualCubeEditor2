// 実行: node --test
// js/cube-solver.js（two-phase ソルバと random-state の生成）
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/cube-state.js');
const S = require('../js/cube-solver.js');

const SOLVED = M.solved().join('');
const MOVES = [];
for (const f of 'URFDLB') for (const s of ['', '2', "'"]) MOVES.push(f + s);
const count = (alg) => (alg ? alg.split(' ').length : 0);
const solves = (state, alg) => M.applyAlg(alg, { state: state }).join('') === SOLVED;
const FORMAT = /^[URFDLB][2']?( [URFDLB][2']?)*$/;

test('キュービー表現の 18 通りの手が cube-state.js の状態計算と一致する', () => {
  MOVES.forEach((m) => {
    assert.equal(S.toState(S.applyToCubie(S.solvedCubie(), m)).join(''), M.applyAlg(m).join(''), m);
  });
  const alg = "R U2 F' D L2 B' U R' F2 D' L B2 U' R2 F D2 L' B";
  assert.equal(S.toState(S.applyToCubie(S.solvedCubie(), alg)).join(''), M.applyAlg(alg).join(''));
});

test('fromState / toState は往復で元に戻る。multiply と inverse', () => {
  const rnd = S.rng(11);
  for (let k = 0; k < 50; k++) {
    const c = S.randomCubie(rnd);
    assert.deepEqual(S.fromState(S.toState(c)), c);
    assert.ok(S.isSolved(S.multiply(c, S.inverse(c))));
    assert.ok(S.isSolved(S.multiply(S.inverse(c), c)));
  }
  assert.ok(S.isSolved(S.fromState(M.solved())));
  assert.equal(S.toState(S.solvedCubie()).join(''), SOLVED);
});

test('表の初期化は 1 回だけで、2 秒以内に終わる', () => {
  const ms = S.init();
  assert.ok(ms > 0 && ms < 2000, 'init ' + ms + ' ms');
  assert.equal(S.initMs, ms);
  assert.equal(S.init(), ms); // 2 回目は作り直さない
});

test('揃った状態は空の手順、1 手の状態は（target: 0 で短い解を探せば）1 手で揃う', () => {
  assert.equal(S.solve(M.solved()), '');
  assert.equal(S.solve(S.solvedCubie()), '');
  MOVES.forEach((m) => {
    const state = M.applyAlg(m);
    const sol = S.solve(state, { target: 0 });
    assert.equal(count(sol), 1, m + ' → ' + sol);
    assert.ok(solves(state, sol));
    // 既定（21 手以下が見つかったらすぐ返す）でも揃う
    assert.ok(solves(state, S.solve(state)));
  });
});

test('短い手順で崩した状態は、その手数以下で揃う', () => {
  ["R U", "R U R' U'", "F2 D' L", "R U R' U R U2 R'", "R2 L2 U2 D2"].forEach((alg) => {
    const state = M.applyAlg(alg);
    const sol = S.solve(state, { target: 0 });
    assert.ok(solves(state, sol), alg);
    assert.ok(count(sol) <= count(alg), alg + ' → ' + sol);
  });
});

test('ランダムな状態 300 本（種は固定）：最初に見つけた解でも揃い、24 手以下', () => {
  const rnd = S.rng(20261117);
  let total = 0;
  let worst = 0;
  const t0 = Date.now();
  for (let k = 0; k < 300; k++) {
    const state = S.randomState(rnd);
    const sol = S.solve(state, { maxNodes: 0 });
    assert.match(sol, FORMAT);
    assert.ok(solves(state, sol), 'not solved: ' + sol);
    const n = count(sol);
    assert.ok(n <= 24, n + ' moves: ' + sol);
    total += n;
    worst = Math.max(worst, n);
  }
  const ms = Date.now() - t0;
  assert.ok(ms < 20000, '300 solves took ' + ms + ' ms'); // 目安は 1〜2 秒（遅い環境でも落ちない程度の上限）
});

test('ランダムな状態 100 本（種は固定）：既定の設定で揃い、22 手以下・平均 21 手以下', () => {
  const rnd = S.rng(7);
  let total = 0;
  const t0 = Date.now();
  for (let k = 0; k < 100; k++) {
    const state = S.randomState(rnd);
    const sol = S.solve(state);
    assert.ok(solves(state, sol), 'not solved: ' + sol);
    const n = count(sol);
    assert.ok(n <= 22, n + ' moves: ' + sol);
    assert.equal(S.lastStats.length, n);
    total += n;
    // 同じ面が続かない・向かい合う面の A B A が無い
    const faces = sol.split(' ').map((m) => 'URFDLB'.indexOf(m[0]));
    faces.forEach((f, i) => {
      assert.notEqual(f, faces[i - 1], sol);
      if (i >= 2 && f === faces[i - 2]) assert.notEqual(f % 3, faces[i - 1] % 3, sol);
    });
  }
  assert.ok(total / 100 <= 21, 'average ' + total / 100);
  const ms = Date.now() - t0;
  assert.ok(ms < 30000, '100 solves took ' + ms + ' ms（目安は平均 100ms 以内）');
});

test('同じ入力なら同じ解になる（時間ではなく節点数で打ち切る）', () => {
  const state = S.randomState(S.rng(3));
  assert.equal(S.solve(state), S.solve(state));
  assert.equal(S.randomState(S.rng(3)).join(''), state.join(''));
});

test('キュービー表現でも解ける。minPhase1 を付けても揃う', () => {
  const c = S.randomCubie(S.rng(5));
  assert.ok(S.isSolved(S.applyToCubie(c, S.solve(c))));
  // T パーム（第 2 段階だけで揃う状態）
  const state = M.applyAlg("R U R' U' R' F R2 U' R' U' R U R' F'");
  const plain = S.solve(state, { target: 0 });
  const forced = S.solve(state, { minPhase1: 5 });
  assert.ok(solves(state, plain));
  assert.ok(solves(state, forced));
  assert.match(forced.split(' ').slice(0, 5).join(' '), /[RLFB]'?( |$)/); // 第 1 段階に R L F B の 90° が入る
});

test('生成した状態は合法（置換のパリティ・コーナーの向きの合計・エッジの向きの合計）で、偏らない', () => {
  const rnd = S.rng(99);
  const seen = new Set();
  const cornerAt0 = new Array(8).fill(0);
  const edgeAt0 = new Array(12).fill(0);
  const twistAt0 = [0, 0, 0];
  let flips = 0;
  const N = 2400;
  for (let k = 0; k < N; k++) {
    const c = S.randomCubie(rnd);
    assert.equal(S.verify(c), null);
    assert.equal(c.co.reduce((a, b) => a + b) % 3, 0);
    assert.equal(c.eo.reduce((a, b) => a + b) % 2, 0);
    const state = S.toState(c);
    'URFDLB'.split('').forEach((f) => assert.equal(state.filter((x) => x === f).length, 9));
    seen.add(state.join(''));
    cornerAt0[c.cp[0]]++;
    edgeAt0[c.ep[0]]++;
    twistAt0[c.co[7]]++;
    flips += c.eo[11];
  }
  assert.equal(seen.size, N);
  cornerAt0.forEach((n) => assert.ok(n > N / 8 - 80 && n < N / 8 + 80, 'corner ' + cornerAt0));
  edgeAt0.forEach((n) => assert.ok(n > N / 12 - 70 && n < N / 12 + 70, 'edge ' + edgeAt0));
  twistAt0.forEach((n) => assert.ok(n > N / 3 - 120 && n < N / 3 + 120, 'twist ' + twistAt0));
  assert.ok(flips > N / 2 - 150 && flips < N / 2 + 150, 'flip ' + flips);
  // 乱数を省略しても合法
  assert.equal(S.verify(S.randomCubie()), null);
  assert.equal(S.randomState().length, 54);
});

test('不正な状態は解かずにエラーにする', () => {
  const swap = (state, i, j) => {
    const s = state.slice();
    const t = s[i];
    s[i] = s[j];
    s[j] = t;
    return s;
  };
  const solved = M.solved();
  assert.throws(() => S.solve(solved.slice(0, 53)), /state-length/);
  assert.throws(() => S.solve(solved.map((x, i) => (i === 0 ? 'X' : x))), /state-value/);
  assert.throws(() => S.solve(M.applyAlg('x')), /centers/); // センターが動いた状態は受け付けない
  assert.throws(() => S.solve(swap(solved, 5, 10)), /flip/); // エッジ 1 個の反転（2 枚の入れ替え）
  assert.throws(() => S.solve(swap(solved, 8, 9)), /corner-perm/); // コーナーの 2 枚の入れ替え（存在しないピース）
  assert.throws(() => S.solve(swap(solved, 1, 19)), /edge-perm/); // 同じ色が 2 枚あるエッジ

  const c = S.solvedCubie();
  assert.equal(S.verify(c), null);
  assert.equal(S.verify(Object.assign({}, c, { co: [1, 0, 0, 0, 0, 0, 0, 0] })), 'twist');
  assert.equal(S.verify(Object.assign({}, c, { eo: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] })), 'flip');
  assert.equal(S.verify(Object.assign({}, c, { cp: [1, 0, 2, 3, 4, 5, 6, 7] })), 'parity'); // コーナー 2 個の入れ替え
  assert.equal(S.verify(Object.assign({}, c, { ep: [1, 0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] })), 'parity');
  assert.equal(S.verify(Object.assign({}, c, { cp: [0, 0, 2, 3, 4, 5, 6, 7] })), 'corner-perm');
  assert.equal(S.verify(Object.assign({}, c, { ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12] })), 'edge-perm');
  assert.throws(() => S.solve(Object.assign({}, c, { cp: [1, 0, 2, 3, 4, 5, 6, 7] })), /parity/);
  // 54 要素の状態でも同じ（コーナー 2 個の入れ替え、コーナー 1 個のひねり）
  assert.throws(() => S.solve(S.toState(Object.assign({}, c, { cp: [1, 0, 2, 3, 4, 5, 6, 7] }))), /parity/);
  assert.throws(() => S.solve(S.toState(Object.assign({}, c, { co: [1, 0, 0, 0, 0, 0, 0, 0] }))), /twist/);
});

test('invert と simplify', () => {
  assert.equal(S.invert("R U2 F'"), "F U2 R'");
  assert.equal(S.invert(''), '');
  assert.equal(S.simplify("R R U U' F"), 'R2 F');
  assert.equal(S.simplify('R L R'), 'R2 L');
  assert.equal(S.simplify("R L R' L'"), '');
  assert.equal(S.simplify("U D U2 D' F"), "U' F");
  assert.equal(S.simplify('R U R'), 'R U R');
  assert.throws(() => S.invert('R x'), SyntaxError);
  const rnd = S.rng(1);
  for (let k = 0; k < 50; k++) {
    const alg = Array.from({ length: 30 }, () => MOVES[Math.floor(rnd() * 18)]).join(' ');
    assert.equal(M.applyAlg(S.simplify(alg)).join(''), M.applyAlg(alg).join(''));
    assert.equal(M.applyAlg(alg + ' ' + S.invert(alg)).join(''), SOLVED);
  }
});
