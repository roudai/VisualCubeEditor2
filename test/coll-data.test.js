// 実行: node --test test/coll-data.test.js
// COLL 40ケースのデータ（data/coll/algs_info.json → js/coll-data.js）。仕様: reference/COLL_SPEC.md
//
// a と s が互いに合っているか（生成時の確認と同じ）に加えて、手順とは別の系統で確かめる:
//   1. 各ケースの手順で、そのグループの OLL（H → 21 … Sune → 27）が揃う（OLL のデータ js/oll-data.js で引く）
//   2. 上面のコーナーの状態（向きと位置）を、CaseCheck を通さずに状態から直接読み、40 ケースが互いに違う
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../js/cube-state.js');
const C = require('../js/case-check.js');
const COLL = require('../js/coll-data.js');
const OLL = require('../js/oll-data.js');
const SRC = require('../data/coll/algs_info.json');
const NOTES = require('../js/coll-groups.js');
const { build, cases, check, OUT } = require('../tools/build-coll-data.js');

const SOLVED = M.solved();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// グループと、そのグループの OLL の番号・ケースの数（出典の見出し「OLL n21 H Orientation」など。
// 出典では Sune が n26、Anti-Sune が n27 だが、OLL の番号に合わせて Anti-Sune を 26、Sune を 27 とした）
const GROUPS = [
  ['H', 21, 4],
  ['Pi', 22, 6],
  ['U', 23, 6],
  ['T', 24, 6],
  ['L', 25, 6],
  ['Anti-Sune', 26, 6],
  ['Sune', 27, 6],
];
const NAMES = GROUPS.flatMap(([, n, k]) => Array.from({ length: k }, (_, i) => `${n}-${i + 1}`));

test('40ケースを元データの順に含み、名前は「OLL の番号-通し番号」でグループどおり', () => {
  assert.equal(COLL.length, 40);
  assert.deepEqual(COLL.map((c) => c.name), NAMES);
  assert.deepEqual(Object.keys(SRC), NAMES.map((_, i) => String(i + 1)));
  const number = Object.fromEntries(GROUPS.map(([g, n]) => [g, n]));
  COLL.forEach((c) => assert.equal(c.name.split('-')[0], String(number[c.group]), c.name));
  assert.deepEqual(
    COLL.map((c) => c.group).filter((g, i, all) => all.indexOf(g) === i),
    GROUPS.map(([g]) => g)
  );
});

test('グループの説明（js/coll-groups.js）が全グループにあり、OLL の番号を書いている', () => {
  assert.deepEqual(Object.keys(NOTES), GROUPS.map(([g]) => g));
  GROUPS.forEach(([g, n]) => assert.equal(NOTES[g], `OLL ${n}`));
});

test('js/coll-data.js が最新（生成し直しても変わらない）で、項目は name・group・alg・setup だけ', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
  assert.deepEqual(COLL, cases());
  COLL.forEach((c) => assert.deepEqual(Object.keys(c), ['name', 'group', 'alg', 'setup']));
  Object.values(SRC).forEach((c) => {
    assert.deepEqual(Object.keys(c), ['name', 'group', 'algset', 's', 'a']);
    assert.equal(c.algset, 'COLL');
  });
});

COLL.forEach((c) => {
  test(`${c.name}: 確認を通り、setup は素の面回しと括弧付きの AUF だけ`, () => {
    assert.equal(C.check('coll', c.alg, c.setup), null);
    assert.equal(check(c.alg, c.setup), null);
    const body = c.setup.replace(/\(U[2']?\)/g, ' ').trim();
    assert.match(body, /^[URFDLB][2']?( +[URFDLB][2']?)*$/);
    // solve case の状態（a の逆）と setup の状態はちょうど同じ（図が出典と同じになる）
    assert.ok(same(M.applyAlg(c.alg, { inverse: true, cancelRotation: true }), M.applyAlg(c.setup)));
  });

  test(`${c.name}: 手順でそのグループの OLL（${c.group}）が揃う`, () => {
    const number = String(GROUPS.find(([g]) => g === c.group)[1]);
    const found = C.findCase('oll', c.alg, OLL);
    assert.equal(found && found.name, number);
  });
});

// 上面のコーナーの状態を、状態から直接読む（コーナーごとに、U 面・左隣の側面・右隣の側面のステッカーの色）。
// setup の前後に AUF を付けた 16 通りのうち最小をキーにする（AUF の違いを除いて同じケースなら同じキー）
const INDEX = SOLVED.map((_, i) => i);
const RING = M.toImageColors(INDEX, Object.assign({}, INDEX)).scolor; // 側面上段 12 枚の位置（B → R → F → L）
const UCORNER = [0, 2, 8, 6]; // U 面のコーナー（UBL UBR UFR UFL。上から見て時計回り）
const readCorners = (st) => UCORNER.map((u, i) => [st[u], st[RING[(3 * i + 11) % 12]], st[RING[3 * i]]].join('')).join(' ');
function cornerKey(setup) {
  const keys = [];
  M.AUFS.forEach((pre) => {
    const st = M.applyAlg(setup, { state: M.applyAlg(pre) });
    M.AUFS.forEach((post) => keys.push(readCorners(M.applyAlg(post, { state: st }))));
  });
  return keys.sort()[0];
}

test('40ケースのコーナーの状態（向きと位置）が、AUF の違いを除いてすべて違う', () => {
  const keys = COLL.map((c) => cornerKey(c.setup));
  assert.equal(new Set(keys).size, 40);
});

test('どのケースも、上面のエッジは向いていて、F2L は揃っている', () => {
  COLL.forEach((c) => {
    const st = M.applyAlg(c.setup);
    assert.ok([1, 3, 5, 7].every((i) => st[i] === 'U'), c.name);
    const moved = M.applyMoves(INDEX, M.parseAlg('U'));
    assert.ok(st.every((x, i) => moved[i] !== i || i < 9 || x === SOLVED[i]), c.name);
  });
});

test('全ケースが互いに違うケースで、自分の手順でしか揃わない', () => {
  COLL.forEach((c) => {
    assert.equal(C.findCase('coll', c.alg, COLL).name, c.name);
    COLL.filter((d) => d !== c).forEach((d) => assert.equal(C.fitSetup('coll', c.alg, d.setup), null, `${c.name} の手順で ${d.name} が揃う`));
  });
});
