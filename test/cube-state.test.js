// 実行: node --test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../js/cube-state.js');

const SOLVED = M.solved();
const INDEX = SOLVED.map((_, i) => i);
const ALL_MOVES = 'U D L R F B u d l r f b M E S x y z'.split(' ');

function order(alg) {
  const moves = M.parseAlg(alg);
  let st = SOLVED;
  for (let n = 1; n <= 10000; n++) {
    st = M.applyMoves(st, moves);
    if (st.every((c, i) => c === SOLVED[i])) return n;
  }
  return Infinity;
}

// 乱数（再現性のため固定シード）
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function randomAlg(rand, len, moves) {
  const list = moves || ALL_MOVES;
  const suf = ['', "'", '2', "2'"];
  return Array.from({ length: len }, () => list[Math.floor(rand() * list.length)] + suf[Math.floor(rand() * 4)]).join(' ');
}

// ---- 参考実装（srVisualizer の simulation.ts・algorithm.ts）----
// library/srVisualizer.min.js は読み込み時に document を使うので node では require できない。
// ソースマップに入っているコンパイル済みのソース（CommonJS）から、DOM を使わない部分だけを読み込む
function loadReference() {
  const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../library/srVisualizer.min.js.map'), 'utf8'));
  const sources = {};
  map.sources.forEach((name, i) => {
    const m = name.match(/\.\/src\/(.*)\.ts$/);
    if (m) sources[m[1]] = map.sourcesContent[i];
  });
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name].exports;
    const mod = { exports: {} };
    cache[name] = mod;
    const req = (rel) => load(path.posix.normalize(path.posix.join(path.posix.dirname(name), rel)));
    new Function('exports', 'require', 'module', sources[name])(mod.exports, req, mod);
    return mod.exports;
  }
  const CubeData = load('cube/simulation').CubeData;
  const parseAlgorithm = load('cube/parsing/algorithm').parseAlgorithm;
  // 位置の番号（0..53）を初期値にして手順を回し、状態と同じ並び（U R F D L B）で返す
  return function apply(alg) {
    const faces = {};
    M.FACES.forEach((_, f) => {
      faces[f] = INDEX.slice(f * 9, f * 9 + 9);
    });
    const cube = new CubeData(3, faces);
    parseAlgorithm(alg).forEach((turn) => cube.turn(turn));
    return M.FACES.reduce((out, _, f) => out.concat(cube.faces[f]), []);
  };
}
const reference = loadReference();

test('54ステッカー、6色×9枚', () => {
  assert.equal(SOLVED.length, 54);
  M.FACES.forEach((f) => assert.equal(SOLVED.filter((c) => c === f).length, 9));
  assert.equal(SOLVED.join(''), 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');
});

test('各面・2層回し・中層・持ち替えは4回で元に戻る、1〜3回では戻らない', () => {
  ALL_MOVES.forEach((f) => assert.equal(order(f), 4, f));
});

test('手順＋逆手順で元に戻る', () => {
  const rand = rng(42);
  for (let i = 0; i < 50; i++) {
    const alg = randomAlg(rand, 20);
    const st = M.applyAlg(alg);
    assert.deepEqual(M.applyAlg(alg, { inverse: true, state: st }), SOLVED, alg);
  }
});

test("R U R' U' の位数は6、R U の位数は105、T パームは2回で戻る", () => {
  assert.equal(order("R U R' U'"), 6);
  assert.equal(order('R U'), 105);
  assert.equal(order("R U R' U' R' F R2 U' R' U' R U R' F'"), 2);
});

test('参考実装（srVisualizer）と一致：全ての記号', () => {
  ALL_MOVES.forEach((f) => {
    ['', "'", '2', "2'", "'2", '3'].forEach((suffix) => {
      const alg = f + suffix;
      assert.deepEqual(M.applyMoves(INDEX, M.parseAlg(alg)), reference(alg), alg);
    });
  });
  ['Uw', "Dw'", 'Lw2', 'Rw', "Fw'", 'Bw2'].forEach((alg) => {
    assert.deepEqual(M.applyMoves(INDEX, M.parseAlg(alg)), reference(alg), alg);
  });
});

test('参考実装（srVisualizer）と一致：ランダムな手順 500 本', () => {
  const rand = rng(7);
  for (let i = 0; i < 500; i++) {
    const alg = randomAlg(rand, 25);
    assert.deepEqual(M.applyMoves(INDEX, M.parseAlg(alg)), reference(alg), alg);
  }
});

test('2層回し・中層・持ち替えの関係', () => {
  const same = (a, b) => assert.deepEqual(M.applyAlg(a), M.applyAlg(b), a + ' = ' + b);
  same('r', "R M'");
  same('l', 'L M');
  same('u', "U E'");
  same('d', 'D E');
  same('f', 'F S');
  same('b', "B S'");
  same('x', "R M' L'");
  same('y', "U E' D'");
  same('z', "F S B'");
  same('Rw', 'r');
  same("Rw2'", 'r2');
});

test("回数と ' の書き方", () => {
  const moves = (alg) => M.parseAlg(alg);
  assert.deepEqual(moves('R2'), [{ face: 'R', turns: 2 }]);
  assert.deepEqual(moves("R2'"), [{ face: 'R', turns: 2 }]);
  assert.deepEqual(moves("R'2"), [{ face: 'R', turns: 2 }]);
  assert.deepEqual(moves("R'"), [{ face: 'R', turns: 3 }]);
  assert.deepEqual(moves('R3'), [{ face: 'R', turns: 3 }]);
  assert.deepEqual(moves('R4'), [{ face: 'R', turns: 0 }]);
  assert.deepEqual(moves("Rw'"), [{ face: 'r', turns: 3 }]);
});

test('大文字・小文字を区別する（R と r は別の回し方）', () => {
  assert.notDeepEqual(M.applyAlg('R'), M.applyAlg('r'));
  assert.deepEqual(M.parseAlg('r'), [{ face: 'r', turns: 1 }]);
  assert.throws(() => M.parseAlg('X'), SyntaxError);
  assert.throws(() => M.parseAlg('m'), SyntaxError);
});

test('括弧・繰り返し・逆手順・全角の記号・カンマ', () => {
  assert.deepEqual(M.applyAlg("(R U R' U')6"), SOLVED);
  assert.deepEqual(M.applyAlg("(R U R' U')3"), M.applyAlg("R U R' U' R U R' U' R U R' U'"));
  assert.deepEqual(M.applyAlg("(R U R' U')'"), M.applyAlg("U R U' R'"));
  assert.deepEqual(M.applyAlg("((R U)2 F)2"), M.applyAlg('R U R U F R U R U F'));
  assert.deepEqual(M.applyAlg('（R’ U）2、F,B　D'), M.applyAlg("R' U R' U F B D"));
  assert.deepEqual(M.applyAlg("(U) R U R'"), M.applyAlg("U R U R'"));
  assert.deepEqual(M.applyAlg(''), SOLVED);
});

test('読めない手順はエラーにする', () => {
  ['Q', 'R U (', 'R U)', "R2'2", '2R', '3Rw', 'R+', 'BR'].forEach((alg) => {
    if (alg === 'BR') {
      assert.deepEqual(M.parseAlg(alg), [
        { face: 'B', turns: 1 },
        { face: 'R', turns: 1 },
      ]);
      return;
    }
    assert.throws(() => M.parseAlg(alg), SyntaxError, alg);
  });
});

test('括弧の繰り返しの展開は 1000 手まで（入れ子で爆発させない）', () => {
  assert.equal(M.parseAlg('(R)1000').length, 1000);
  assert.throws(() => M.parseAlg('(R)1001'), /Too many moves/);
  const start = Date.now();
  assert.throws(() => M.parseAlg('((((((((R)9)9)9)9)9)9)9)9'), /Too many moves/);
  assert.throws(() => M.parseAlg('(R U)99999999'), /Too many moves/);
  assert.ok(Date.now() - start < 1000);
});

test('canonicalAlg：全角を半角に、Rw を r に（大文字・小文字は変えない）', () => {
  assert.equal(M.canonicalAlg("Rw U Rw’ （U2） r"), "r U r' (U2) r");
  assert.equal(M.canonicalAlg('R,U'), 'R U');
});

test('stringify・flatten：括弧と繰り返しを展開する', () => {
  assert.equal(M.flatten("(R U)2 Rw' (R U R' U')'"), "R U R U r' U R U' R'");
  assert.equal(M.flatten('R4 U2 (F)0'), 'U2');
  assert.equal(M.flatten("R U R'", { inverse: true }), "R U' R'");
  assert.equal(M.stringify([{ face: 'M', turns: 2 }, { face: 'x', turns: 3 }]), "M2 x'");
  // 展開した手順は、参考実装で回しても同じ状態になる（srVisualizer に渡す使い方）
  const rand = rng(3);
  for (let i = 0; i < 50; i++) {
    const alg = '(' + randomAlg(rand, 5) + ')3 (' + randomAlg(rand, 4) + ")'";
    [{}, { inverse: true }, { cancelRotation: true }, { inverse: true, cancelRotation: true }].forEach((opts) => {
      assert.deepEqual(reference(M.flatten(alg, opts)), M.applyAlg(alg, Object.assign({ state: INDEX }, opts)), alg);
    });
  }
});

test('cancelRotation：センターが元の位置に戻る（持ち替え・2層回し・中層）', () => {
  const centers = (st) => M.FACES.map((_, i) => st[i * 9 + 4]).join('');
  const rand = rng(11);
  for (let i = 0; i < 200; i++) {
    const alg = randomAlg(rand, 12);
    assert.equal(centers(M.applyAlg(alg, { cancelRotation: true })), 'URFDLB', alg);
    assert.equal(centers(M.applyAlg(alg, { inverse: true, cancelRotation: true })), 'URFDLB', alg);
  }
  // 持ち替えだけの手順は揃った状態になる
  ['x', "y'", 'z2', 'x y z', "x2 y' z"].forEach((alg) => {
    assert.deepEqual(M.applyAlg(alg, { cancelRotation: true }), SOLVED, alg);
  });
  // 持ち替えが無ければ何も変えない
  assert.deepEqual(M.applyAlg("R U R' U'", { cancelRotation: true }), M.applyAlg("R U R' U'"));
});

test('cancelRotation + inverse：その手順で（向きを除いて）揃うケースになる', () => {
  const rand = rng(5);
  const rotations = ['', 'y', 'y2', "y'", 'x', "x'", 'x2', 'z', "z'", 'x y', "x y'", 'x y2', "x' y", "x' y'", "x' y2", 'x2 y', "x2 y'", 'z y', "z y'", 'z y2', "z' y", "z' y'", "z' y2", 'z2'];
  const solvedInSomeOrientation = (st) => rotations.some((r) => M.applyAlg(r, { state: st }).join('') === SOLVED.join(''));
  for (let i = 0; i < 100; i++) {
    const alg = randomAlg(rand, 12);
    const caseState = M.applyAlg(alg, { inverse: true, cancelRotation: true });
    assert.ok(solvedInSomeOrientation(M.applyAlg(alg, { state: caseState })), alg);
  }
});

test('画像の色：揃った状態', () => {
  const c = M.toImageColors(SOLVED);
  assert.deepEqual(c.ucolor, Array(9).fill(M.DEFAULT_SCHEME.U));
  const S = M.DEFAULT_SCHEME;
  assert.deepEqual(c.scolor, [S.B, S.B, S.B, S.R, S.R, S.R, S.F, S.F, S.F, S.L, S.L, S.L]);
  assert.deepEqual(M.toStickerColors(SOLVED).slice(9, 18), Array(9).fill(S.R));
});

test('画像の色：U で側面の上段が時計回りに1面ぶん動く', () => {
  const names = Object.fromEntries(M.FACES.map((f) => [f, f]));
  const before = M.toImageColors(M.applyAlg("R U R' U'"), names);
  const after = M.toImageColors(M.applyAlg("R U R' U' U"), names);
  assert.deepEqual(after.scolor, before.scolor.slice(9).concat(before.scolor.slice(0, 9)));
  // 上面は時計回りに90°：新しい (行, 列) = 元の (2 - 列, 行)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      assert.equal(after.ucolor[row * 3 + col], before.ucolor[(2 - col) * 3 + row]);
    }
  }
});

test("画像の色：R U R' U' のあと（上面図の並びの確認）", () => {
  const names = Object.fromEntries(M.FACES.map((f) => [f, f]));
  const c = M.toImageColors(M.applyAlg("R U R' U'"), names);
  // 参考実装の結果から、同じ場所（U 面と、B・R・F・L の上段を上から見て時計回り）を取り出して比べる
  const ref = reference("R U R' U'").map((i) => SOLVED[i]);
  assert.deepEqual(c.ucolor, ref.slice(0, 9));
  const ring = [47, 46, 45, 11, 10, 9, 20, 19, 18, 38, 37, 36].map((i) => ref[i]);
  assert.deepEqual(c.scolor, ring);
  assert.equal(c.ucolor.join(''), 'UULUUFUUF');
});

test('色が決まっていない面があればエラーにする', () => {
  assert.throws(() => M.toImageColors(SOLVED, { U: '#ffffff' }), /No color set/);
});

test('OLL用マスク：U 以外をグレーにする', () => {
  const mask = M.ollMask();
  assert.equal(mask.U, M.DEFAULT_SCHEME.U);
  ['R', 'F', 'D', 'L', 'B'].forEach((f) => assert.equal(mask[f], M.OLL_GRAY));
  assert.equal(M.ollMask({ U: '#123456' }, '#888888').R, '#888888');
  assert.equal(M.ollMask({ U: '#123456' }).U, '#123456');
  // Sune のケース：上面は U が 6 枚
  const c = M.toImageColors(M.applyAlg("R U R' U R U2 R'", { inverse: true }), mask);
  assert.equal(c.ucolor.filter((x) => x === mask.U).length, 6);
  assert.equal(c.scolor.filter((x) => x === mask.U).length, 3);
});

test('simplifyAlg：続けて並んだ同じ記号をまとめる（R R\' は消し、R R は R2 に）', () => {
  const S = (alg) => M.simplifyAlg(alg);
  assert.deepEqual(S("R R'"), { alg: '', changed: true });
  assert.deepEqual(S('R R'), { alg: 'R2', changed: true });
  assert.deepEqual(S('R2 R'), { alg: "R'", changed: true });
  assert.deepEqual(S("R U U' R'"), { alg: '', changed: true }); // 消えたあとに並んだ同じ記号もまとめる
  assert.deepEqual(S("R U U' R2 F"), { alg: "R' F", changed: true });
  assert.deepEqual(S('R4 U'), { alg: 'U', changed: true });
  assert.deepEqual(S('y y2'), { alg: "y'", changed: true });
  assert.deepEqual(S('Rw r'), { alg: 'r2', changed: true }); // Rw は r
  // まとめないもの
  assert.deepEqual(S("R r R' L R"), { alg: "R r R' L R", changed: false }); // 大文字・小文字は別、向かい合う面をはさんだものも
  assert.deepEqual(S("R3  U2'"), { alg: "R3 U2'", changed: false }); // 書いたまま（空白はそろえる）
  assert.deepEqual(S("(R U) U' R'"), { alg: "(R U) U' R'", changed: false }); // 括弧はまたがない
  assert.deepEqual(S("(U) (R U R' U')2 F"), { alg: "(U) (R U R' U')2 F", changed: false });
  // 括弧の中もまとめ、空になった括弧は回数ごと消す
  assert.deepEqual(S("(R R')2 U (F F)'"), { alg: "U (F2)'", changed: true });
  assert.throws(() => S('R ('), /Missing closing parenthesis/);
  assert.throws(() => S('R X'), /Invalid move/);
});
