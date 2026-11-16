// 実行: node --test
// tools/build-case-data.js（PLL・OLL のデータ生成の共通部分）。一時フォルダに小さな元データを置いて確かめる
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBuilder } = require('../tools/build-case-data.js');

const T = "R U R' U' R' F R2 U' R' U' R U R' F'";
const JB = "R U R' F' R U R' U' R' F R2 U' R'";
const JB_SETUP = "R U R2 F' R U R U' R' F R U' R'";
const SUNE = "R U R' U R U2 R'";
const SUNE_SETUP = "R U2 R' U' R U' R'";

// 元データを書いた一時フォルダで fn(builder, root) を実行する
function withSource(set, src, fn, order) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'build-case-data-'));
  try {
    fs.mkdirSync(path.join(root, set));
    fs.mkdirSync(path.join(root, 'js'));
    fs.writeFileSync(path.join(root, set, 'algs_info.json'), JSON.stringify(src));
    if (order) fs.writeFileSync(path.join(root, set, 'learn_order.json'), JSON.stringify(order));
    return fn(createBuilder(set, { root: root }), root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const PLL_SRC = {
  1: { name: 'T', group: 'Adjacent swap', algset: 'PLL', s: T, a: T },
  2: { name: 'Jb', group: 'Adjacent swap', algset: 'PLL', s: JB_SETUP, a: JB },
};

test('PLL：元データの順に { name, group, alg, setup } を出力する', () => {
  withSource('pll', PLL_SRC, (b) => {
    assert.deepEqual(b.cases(), [
      { name: 'T', group: 'Adjacent swap', alg: T, setup: T },
      { name: 'Jb', group: 'Adjacent swap', alg: JB, setup: JB_SETUP },
    ]);
    const text = b.build();
    assert.match(text, /^\/\/ 自動生成ファイル。手で編集しないこと。\n\/\/ 元データ: pll\/algs_info\.json \/ 生成: node tools\/build-pll-data\.js\n/);
    assert.match(text, /root\.PLL_DATA = data;/);
    // 生成したファイルは node から読める
    const out = path.join(path.dirname(b.OUT), 'pll-data.js');
    fs.writeFileSync(out, text);
    assert.deepEqual(require(out), b.cases());
  });
});

test('OLL：上面の向きが合えば通り、変数名は OLL_DATA', () => {
  withSource('oll', { 27: { name: '27', group: 'OCLL', algset: 'OLL', s: SUNE_SETUP, a: SUNE } }, (b) => {
    assert.deepEqual(b.cases(), [{ name: '27', group: 'OCLL', alg: SUNE, setup: SUNE_SETUP }]);
    assert.match(b.build(), /root\.OLL_DATA = data;/);
  });
});

test('合わないケースは、内容と直し方の候補を付けてエラーにする', () => {
  // a に前AUFを足したのに s を合わせていない → s の候補が出る
  withSource('pll', { 1: { name: 'T', group: 'G', s: T, a: `(U) ${T}` } }, (b) => {
    assert.throws(() => b.build(), (e) => {
      assert.match(e.message, /pll\/algs_info\.json に問題があります/);
      assert.match(e.message, /T: a で s のケースが揃いません/);
      assert.ok(e.message.includes(`候補 s: ${T} (U')`), e.message);
      return true;
    });
  });
  // a の最後に AUF → 外した a の候補が出る
  withSource('pll', { 1: { name: 'T', group: 'G', s: T, a: `${T} (U2)` } }, (b) => {
    assert.throws(() => b.build(), (e) => {
      assert.match(e.message, /a の最後に AUF が付いています/);
      assert.ok(e.message.includes(`候補 a: ${T}\n`), e.message);
      return true;
    });
  });
  // 別のケースの手順 → 候補なし
  withSource('pll', { 1: { name: 'T', group: 'G', s: JB_SETUP, a: T } }, (b) => {
    assert.throws(() => b.build(), /AUF を付け直しても合いません/);
  });
  // OLL：s が F2L を崩す
  withSource('oll', { 1: { name: '27', group: 'G', s: `${SUNE_SETUP} R`, a: SUNE } }, (b) => {
    assert.throws(() => b.build(), /s で最後の層以外が崩れています/);
  });
});

test('読めない手順・足りない項目・名前の重複はエラーにする', () => {
  withSource('pll', { 1: { name: 'T', group: 'G', s: T, a: 'R Q' } }, (b) => {
    assert.throws(() => b.build(), /T: Invalid move/);
  });
  withSource('pll', { 1: { name: 'T', group: 'G', s: [T], a: T } }, (b) => {
    assert.throws(() => b.build(), /a と s は手順1本の文字列にしてください/);
  });
  withSource('pll', { 1: { name: 'T', s: T, a: T } }, (b) => {
    assert.throws(() => b.build(), /T: group がありません/);
  });
  withSource('pll', { 1: { name: 'T', group: 'G', s: T, a: T }, 2: { name: 'T', group: 'G', s: T, a: T } }, (b) => {
    assert.throws(() => b.build(), /T: 名前が重複しています/);
  });
});

test('check・suggest', () => {
  withSource('pll', PLL_SRC, (b) => {
    assert.equal(b.check(T, T), null);
    assert.match(b.check(`${T} y`, T), /持ち替え/);
    assert.deepEqual(b.suggest(`${T} (U) y`, `(U2) ${T}`), { a: T, s: T });
  });
});

test('覚える順番（learn_order.json）があれば stage・order を付け、過不足はエラーにする', () => {
  withSource(
    'pll',
    PLL_SRC,
    (b) => {
      assert.deepEqual(
        b.cases().map((c) => [c.name, c.stage, c.order]),
        [
          ['T', 2, 2],
          ['Jb', 1, 1],
        ]
      );
      assert.deepEqual(Object.keys(b.cases()[0]), ['name', 'group', 'stage', 'order', 'alg', 'setup']);
    },
    [['Jb'], ['T']]
  );
  withSource('pll', PLL_SRC, (b) => assert.throws(() => b.build(), /learn_order\.json: T がありません/), [['Jb']]);
  withSource('pll', PLL_SRC, (b) => assert.throws(() => b.build(), /learn_order\.json: Jb が2回あります/), [['Jb', 'T'], ['Jb']]);
  withSource('pll', PLL_SRC, (b) => assert.throws(() => b.build(), /learn_order\.json: X は algs_info\.json にありません/), [['Jb', 'T', 'X']]);
});
