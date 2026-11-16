// 実行: node --test
// js/case-check.js（手順の確認）と js/custom-algs.js の validate（自分の手順の確認）
// ここでは代表的なケースだけを使う。全ケースの確認は test/pll-data.test.js・test/oll-data.test.js で行う
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/cube-state.js');
const C = require('../js/case-check.js');
const CA = require('../js/custom-algs.js');

// setup は alg の逆手順（センターを動かさない手順だけを使う）
const make = (name, alg) => ({ name: name, alg: alg, setup: M.flatten(alg, { inverse: true }) });
const PLL = [
  make('T', "R U R' U' R' F R2 U' R' U' R U R' F'"),
  make('Jb', "R U R' F' R U R' U' R' F R2 U' R'"),
  make('Ua', "R U' R U R U R U' R' U' R2"),
  make('Ub', "R2 U R U R' U' R' U' R' U R'"),
  make('H', 'M2 U M2 U2 M2 U M2'),
  make('Aa', "x R' U R' D2 R U' R' D2 R2 x'"),
];
const OLL = [
  make('27', "R U R' U R U2 R'"), // Sune
  make('26', "R U2 R' U' R U' R'"), // Antisune
  make('45', "F R U R' U' F'"),
  make('44', "f R U R' U' f'"),
  make('21', "R U2 R' U' R U R' U' R U' R'"),
];

const pll = (name) => PLL.find((c) => c.name === name);
const oll = (name) => OLL.find((c) => c.name === name);

test('代表的なケースが確認を通る', () => {
  PLL.forEach((c) => assert.equal(C.check('pll', c.alg, c.setup), null, c.name));
  OLL.forEach((c) => assert.equal(C.check('oll', c.alg, c.setup), null, c.name));
});

test('記法の読み替えは無い（そのまま返す）', () => {
  assert.equal(C.convert("R U R' F2"), "R U R' F2");
});

test('check：問題の種類ごとのコード', () => {
  const t = pll('T');
  assert.equal(C.check('pll', `${t.alg} y`, t.setup), 'trailing-y');
  assert.equal(C.check('pll', `${t.alg} x'`, t.setup), 'trailing-y');
  // 向きを元に戻すための持ち替え（x … x'）は最後に書いてよい
  assert.equal(C.check('pll', pll('Aa').alg, pll('Aa').setup), null);
  assert.equal(C.check('pll', pll('Aa').alg + ' y', pll('Aa').setup), 'trailing-y');
  assert.equal(C.check('pll', `${t.alg} (U)`, t.setup), 'trailing-auf');
  assert.equal(C.check('pll', t.alg, pll('Jb').setup), 'not-solved');
  // 揃うが、case 表示と apply 表示が違う（setup の前に余分な AUF がある）
  assert.equal(C.check('pll', t.alg, `(U) ${t.setup}`), 'mismatch');
  assert.equal(C.check('pll', `(U) ${t.alg}`, t.setup), 'not-solved');
  assert.equal(C.check('pll', `(U) ${t.alg}`, `${t.setup} (U')`), null);

  const sune = oll('27');
  assert.equal(C.check('oll', `${sune.alg} U`, sune.setup), 'trailing-auf');
  assert.equal(C.check('oll', `${sune.alg} z2`, sune.setup), 'trailing-y');
  assert.equal(C.check('oll', sune.alg, `${sune.setup} R`), 'setup-f2l');
  assert.equal(C.check('oll', sune.alg, oll('26').setup), 'not-solved');
  assert.equal(C.check('oll', sune.alg, `${sune.setup} (U)`), 'not-solved');
  assert.equal(C.check('oll', sune.alg, `(U) ${sune.setup}`), null); // 前の AUF は上面の向きに影響しない
});

test('手順中の持ち替え・2層回し・中層回しがあっても確認を通る', () => {
  const t = pll('T');
  // 持ち替えてから回す T パーム（完成後の向きが違う）。setup は AUF を付け直せば通る
  assert.ok(C.fitSetup('pll', `y ${t.alg}`, t.setup));
  assert.equal(C.check('pll', pll('H').alg, pll('H').setup), null); // M を使う
  assert.equal(C.check('pll', pll('Aa').alg, pll('Aa').setup), null); // x … x'
  assert.equal(C.check('oll', oll('44').alg, oll('44').setup), null); // f を使う
  // 持ち替えたまま終える手順（Aa の最後の x' を書かない）でも、同じケースとして通る
  const open = "x R' U R' D2 R U' R' D2 R2";
  assert.equal(C.check('pll', open, pll('Aa').setup), null);
  assert.equal(C.findCase('pll', open, PLL).name, 'Aa');
  // 最後の x' は向きを元に戻すためのものなので、外されない
  assert.equal(C.stripEnd('pll', pll('Aa').alg), pll('Aa').alg);
  assert.equal(C.stripEnd('pll', pll('Aa').alg + ' (U) y'), pll('Aa').alg);
});

test('PLL：前の AUF が違う正しい手順でも、setup の AUF を付け直して確認を通る', () => {
  const c = pll('Jb');
  ['', 'U', 'U2', "U'"].forEach((u) => {
    const a = u ? `(${u}) ${c.alg}` : c.alg;
    const fit = C.fitSetup('pll', a, c.setup);
    assert.ok(fit, u);
    assert.equal(C.check('pll', fit.a, fit.s), null, u);
  });
});

test('fitSetup：付ける AUF が少ないものを選ぶ', () => {
  const c = pll('T');
  assert.deepEqual(C.fitSetup('pll', c.alg, `(U) ${c.setup} (U2)`), { a: c.alg, s: c.setup });
  // H パームは前後の AUF をどう付けても同じケース。付けないものが選ばれる
  assert.equal(C.fitSetup('pll', pll('H').alg, pll('H').setup).s, pll('H').setup);
});

test('最後の AUF・持ち替えは外される', () => {
  const c = pll('T');
  const fit = C.fitSetup('pll', `${c.alg} (U2) y`, c.setup);
  assert.equal(fit.a, c.alg);
  assert.equal(C.stripEnd('pll', `${c.alg} (U) x' y2`), c.alg);
  assert.equal(C.stripEnd('oll', `${oll('27').alg} U2 z`), oll('27').alg);
  const r = CA.validate('pll', c, `${c.alg} U'`, PLL);
  assert.ok(r.ok);
  assert.equal(r.alg, c.alg);
  assert.deepEqual(r.notes, ['stripped']);
});

test('別のケースの手順はエラーになり、実際に解けるケースを示す', () => {
  const r = CA.validate('pll', pll('T'), `(U2) ${pll('Jb').alg}`, PLL);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'solvesOther');
  assert.deepEqual(r.params, { name: 'T', other: 'Jb' });
  assert.match(r.error, /does not solve T \(it solves Jb\)/);
  assert.equal(C.findCase('pll', pll('Ub').alg, PLL).name, 'Ub');
  assert.equal(C.findCase('pll', `(U') y ${pll('Ua').alg}`, PLL).name, 'Ua');
  assert.equal(C.findCase('oll', oll('26').alg, OLL).name, '26');
  assert.equal(C.findCase('oll', `U ${oll('45').alg}`, OLL).name, '45');
  assert.equal(C.findCase('pll', "R U R' U'", PLL), null);
});

test('記法の誤り・空の入力はエラー', () => {
  const r = CA.validate('pll', pll('T'), 'R X', PLL);
  assert.equal(r.code, 'parse');
  assert.match(r.error, /Invalid move/);
  assert.equal(CA.validate('pll', pll('T'), '   ', PLL).code, 'empty');
});

test('OLL：別の正しい手順は保存でき、向きは揃っても F2L を崩す手順はエラー', () => {
  const c = oll('27');
  // Sune を別の向きから回す手順（y2 してから左手の Sune）
  const r = CA.validate('oll', c, "U2 R U R' U R U2' R'", OLL);
  assert.ok(r.ok);
  assert.equal(r.alg, "(U2) R U R' U R U2' R'");
  assert.equal(C.check('oll', r.alg, r.setup), null);
  // 正しい手順のあとに F2L を崩して戻さない手順を足すと、向きが揃っても F2L が崩れる
  assert.equal(CA.validate('oll', c, `${c.alg} R`, OLL).ok, false);
});

test('既定と同じ手順は isDefault になる（空白・括弧・書き方の違いも同じとみなす）', () => {
  const c = pll('T');
  assert.equal(CA.validate('pll', c, c.alg, PLL).isDefault, true);
  assert.equal(CA.validate('pll', c, '  ' + c.alg.replace(/ /g, '  ') + ' (U)', PLL).isDefault, true);
  assert.equal(CA.validate('pll', c, c.alg.replace(/^R /, 'R5 ').replace('R2', "R2'"), PLL).isDefault, true);
  assert.equal(CA.validate('pll', c, '（' + c.alg.replace(/'/g, '’') + '）', PLL).isDefault, true);
  const o = oll('44'); // Fw は f と同じ回し方
  const r = CA.validate('oll', o, "Fw R U R' U' Fw'", OLL);
  assert.equal(r.isDefault, true);
  assert.equal(CA.validate('pll', c, `y ${c.alg}`, PLL).isDefault, undefined);
});

test('大文字・小文字を区別する（小文字は2層回しなので、同じ手順にはならない）', () => {
  const c = pll('T');
  const r = CA.validate('pll', c, c.alg.toLowerCase(), PLL);
  assert.equal(r.ok, false);
  assert.equal(r.code, 'notSolved');
  // Rw は r に書き直して保存する
  const o = oll('45');
  const wide = CA.validate('oll', o, "Fw R U R' U' Fw'", OLL);
  assert.equal(wide.ok, false); // 45 ではなく 44 の手順
  assert.equal(wide.params.other, '44');
  const saved = CA.validate('oll', oll('44'), "(U2) Fw R U R' U' Fw'", OLL);
  assert.ok(saved.ok);
  assert.equal(saved.alg, "(U2) f R U R' U' f'");
});

test('merged：保存値が無ければ既定のまま。既定と同じ手順の保存値も既定として扱う', () => {
  assert.deepEqual(CA.merged('pll', PLL), PLL);
  const mine = CA.validate('pll', pll('Jb'), `y ${pll('Jb').alg}`, PLL);
  assert.ok(mine.ok);
  const saved = {
    pll: {
      T: { alg: pll('T').alg, setup: pll('T').setup }, // 既定と同じ
      Jb: { alg: mine.alg, setup: mine.setup }, // 別の手順
      Ua: { alg: pll('Ub').alg, setup: pll('Ub').setup }, // 別のケースの手順（使わない）
      H: { alg: 'R Q', setup: 'R' }, // 壊れた保存値（使わない）
    },
  };
  global.localStorage = { getItem: () => JSON.stringify(saved), setItem() {} };
  try {
    const merged = CA.merged('pll', PLL);
    const get = (name) => merged.find((c) => c.name === name);
    assert.equal(get('T').custom, undefined);
    assert.equal(get('Jb').custom, true);
    assert.equal(get('Jb').alg, mine.alg);
    assert.equal(get('Jb').defaultAlg, pll('Jb').alg);
    assert.equal(get('Ua').custom, undefined);
    assert.equal(get('H').custom, undefined);
    assert.deepEqual(CA.get('pll', 'Jb'), { alg: mine.alg, setup: mine.setup });
    assert.equal(CA.get('pll', 'Aa'), null);
  } finally {
    delete global.localStorage;
  }
});
