// 実行: node --test
// js/wca-scramble.js（通しの練習用の 3x3x3 の random-state スクランブル）
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/cube-state.js');
const S = require('../js/cube-solver.js');
const W = require('../js/wca-scramble.js');

const SOLVED = M.solved().join('');

test('形式：素の面回しを空白 1 つで区切った 1 行。同じ面が続かず、向かい合う面の A B A も無い。22 手以下', () => {
  const rnd = S.rng(42);
  const lengths = [];
  for (let k = 0; k < 60; k++) {
    const text = W.cube3(rnd);
    assert.match(text, /^[URFDLB][2']?( [URFDLB][2']?)*$/);
    const moves = text.split(' ');
    assert.ok(moves.length >= W.MIN_MOVES && moves.length <= 22, moves.length + ': ' + text);
    lengths.push(moves.length);
    const faces = moves.map((m) => 'URFDLB'.indexOf(m[0]));
    faces.forEach((f, i) => {
      assert.notEqual(f, faces[i - 1], text);
      if (i >= 2 && f === faces[i - 2]) assert.notEqual(f % 3, faces[i - 1] % 3, text);
    });
  }
  const avg = lengths.reduce((a, b) => a + b) / lengths.length;
  assert.ok(avg >= 18 && avg <= 21.5, 'average ' + avg);
});

test('適用した状態は毎回違い、合法で、揃っていない', () => {
  const seen = new Set();
  for (let k = 0; k < 40; k++) {
    const state = M.applyAlg(W.cube3());
    assert.notEqual(state.join(''), SOLVED);
    assert.equal(S.verify(S.fromState(state)), null);
    seen.add(state.join(''));
  }
  assert.equal(seen.size, 40);
});

test('乱数を差し替えると決まった出力になり、その乱数の random-state になる', () => {
  const a = W.cube3(S.rng(123));
  assert.equal(a, W.cube3(S.rng(123)));
  assert.notEqual(a, W.cube3(S.rng(124)));
  // スクランブルを揃った状態に適用すると、同じ種で作ったランダムな状態になる
  assert.equal(M.applyAlg(a).join(''), S.randomState(S.rng(123)).join(''));
});

test('encode / decode：1 手 1 文字（A〜R）にして、元のスクランブルに戻せる', () => {
  const rnd = S.rng(8);
  for (let k = 0; k < 40; k++) {
    const text = W.cube3(rnd);
    const code = W.encode(text);
    assert.equal(code.length, text.split(' ').length);
    assert.match(code, /^[A-R]+$/);
    assert.equal(W.decode(code), text);
  }
  assert.equal(W.MOVES.length, 18);
  assert.equal(W.encode(W.MOVES.join(' ')), 'ABCDEFGHIJKLMNOPQR');
  assert.equal(W.decode('ABCDEFGHIJKLMNOPQR'), "U U2 U' R R2 R' F F2 F' D D2 D' L L2 L' B B2 B'");
  assert.equal(W.encode("  R  U2\tF' "), 'DBI'); // 空白の違いは無視する
});

test('encode / decode：形式が違えば null（全文を保存する逃げ道）。textOf は短い形も全文の形も読める', () => {
  assert.equal(W.encode(''), null);
  assert.equal(W.encode(null), null);
  assert.equal(W.encode("R U Rw' F"), null); // 18 通り以外の記号
  assert.equal(W.encode('R U x'), null);
  assert.equal(W.encode('R++ D--'), null);
  assert.equal(W.encode("R2' U"), null);
  assert.equal(W.decode(''), null);
  assert.equal(W.decode('ABS'), null);
  assert.equal(W.decode('abc'), null);
  assert.equal(W.decode(null), null);
  const text = W.cube3(S.rng(1));
  assert.equal(W.textOf({ s: W.encode(text) }), text);
  assert.equal(W.textOf({ scramble: "R U Rw' F" }), "R U Rw' F");
  assert.equal(W.textOf({ s: '???' }), '');
  assert.equal(W.textOf({}), '');
  assert.equal(W.textOf(null), '');
  // 記録するときの使い方（移植元 practice.js と同じ）
  const record = (scramble) => {
    const s = W.encode(scramble);
    return s ? { s: s } : { scramble: scramble };
  };
  assert.deepEqual(record("R U2 F'"), { s: 'DBI' });
  assert.deepEqual(record('R U M'), { scramble: 'R U M' });
  assert.equal(W.textOf(record('R U M')), 'R U M');
});

test('prepare：次の 1 本を先に作っておき、cube3() がそれを返す', async () => {
  assert.equal(W.hasNext(), false);
  await new Promise((resolve) => W.prepare(resolve));
  assert.equal(W.hasNext(), true);
  // すでに 1 本あるときは作り直さない（callback はすぐ呼ばれる）
  let called = false;
  W.prepare(() => {
    called = true;
  });
  assert.equal(called, true);
  const text = W.cube3();
  assert.match(text, /^[URFDLB][2']?( [URFDLB][2']?)+$/);
  assert.equal(W.hasNext(), false);
  // 乱数を渡したときは先読みを使わない
  await new Promise((resolve) => W.prepare(resolve));
  W.cube3(S.rng(1));
  assert.equal(W.hasNext(), true);
  // 続けて 2 回呼んでも 1 本だけ作る
  W.cube3();
  let n = 0;
  await new Promise((resolve) => {
    W.prepare(() => n++);
    W.prepare(() => n++);
    setTimeout(resolve, 200);
  });
  assert.equal(W.hasNext(), true);
  W.cube3();
});

test('render：1 行を div.scramble-line で入れる', () => {
  const made = [];
  const el = {
    ownerDocument: { createElement: (tag) => ({ tag: tag, className: '', textContent: '' }) },
    replaceChildren: (...nodes) => made.push(...nodes),
  };
  W.render(el, "R U2 F'");
  assert.deepEqual(made, [{ tag: 'div', className: 'scramble-line', textContent: "R U2 F'" }]);
});
