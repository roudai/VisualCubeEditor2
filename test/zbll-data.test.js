// 実行: node --test test/zbll-data.test.js
// ZBLL 472 ケースのデータ（data/zbll/algs_info.json → js/zbll-data.js）。仕様: reference/ZBLL_SPEC.md
//
// a（1本目）と s が互いに合っているか（生成時の確認と同じ）、別解も同じケースを揃えるかに加えて、手順とは別の系統で確かめる:
//   1. 各ケースの手順で、その OCLL の OLL が揃う（H → 21、Pi → 22、U → 23、T → 24、L → 25、Antisune → 26、Sune → 27。OLL のデータで引く）
//   2. 472 ケースの状態が、前後の AUF の違いを除いてすべて違う（状態を直接比べる）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../js/cube-state.js');
const C = require('../js/case-check.js');
const CS = require('../js/case-sections.js');
const ZBLL = require('../js/zbll-data.js');
const OLL = require('../js/oll-data.js');
const SRC = require('../data/zbll/algs_info.json');
const { build, cases, OUT } = require('../tools/build-zbll-data.js');

const SOLVED = M.solved();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

// OCLL（段階の順）と、そのケースの数・OLL の番号
const OCLL = [
  ['T', 72, '24'],
  ['U', 72, '23'],
  ['L', 72, '25'],
  ['H', 40, '21'],
  ['Pi', 72, '22'],
  ['Sune', 72, '27'],
  ['Antisune', 72, '26'],
];
const ocllOf = (c) => c.name.split('-')[0];

test('472 ケースあり、名前は「OCLL-名前」で重ならない。OCLL の 7 種類と件数・段階の順が決めたとおり', () => {
  assert.equal(ZBLL.length, 472);
  assert.equal(new Set(ZBLL.map((c) => c.name)).size, 472);
  ZBLL.forEach((c) => assert.match(c.name, /^(T|U|L|H|Pi|Sune|Antisune)-\S+$/, c.name));
  OCLL.forEach(([o, n], i) => {
    const list = ZBLL.filter((c) => ocllOf(c) === o);
    assert.equal(list.length, n, o);
    list.forEach((c) => assert.equal(c.stage, i + 1, c.name));
  });
  assert.deepEqual(ZBLL.map((c) => c.order), ZBLL.map((_, i) => i + 1));
  assert.deepEqual(CS.list(ZBLL, true).map((s) => s.label), OCLL.map(([o]) => o));
});

test('グループは「OCLL / 小グループ」で 40 組、データの順にまとまっている', () => {
  const groups = ZBLL.map((c) => c.group).filter((g, i, all) => all.indexOf(g) === i);
  assert.equal(groups.length, 40);
  ZBLL.forEach((c) => assert.ok(c.group.startsWith(ocllOf(c) + ' / '), c.name + ': ' + c.group));
  // 同じグループのケースはひとかたまり（見出しごとにデータの順で並ぶ）
  const runs = ZBLL.map((c) => c.group).filter((g, i, all) => i === 0 || all[i - 1] !== g);
  assert.equal(runs.length, 40);
});

test('js/zbll-data.js が最新（生成し直しても変わらない）で、項目は name・group・stage・order・alg・alts・setup', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
  assert.deepEqual(ZBLL, cases());
  ZBLL.forEach((c) => assert.deepEqual(Object.keys(c), ['name', 'group', 'stage', 'order', 'alg', 'alts', 'setup']));
  Object.values(SRC).forEach((c) => {
    assert.deepEqual(Object.keys(c), ['name', 'group', 'algset', 's', 'a']);
    assert.ok(Array.isArray(c.a) && c.a.length >= 1, c.name);
  });
});

test('どのケースも、1本目は確認を通り、別解も同じケースを揃える。setup は面回しと括弧付きの AUF だけ', () => {
  ZBLL.forEach((c) => {
    assert.equal(C.check('zbll', c.alg, c.setup), null, c.name);
    assert.ok(same(M.applyAlg(c.alg, { inverse: true, cancelRotation: true }), M.applyAlg(c.setup)), c.name);
    c.alts.forEach((x) => assert.ok(C.fitSetup('zbll', x, c.setup), `${c.name}: ${x}`));
    const body = c.setup.replace(/\(U[2']?\)/g, ' ').trim();
    assert.match(body, /^[URFDLB][2']?( +[URFDLB][2']?)*$/, c.name);
  });
});

test('どのケースも最後の層だけを崩し、手順でその OCLL の OLL が揃う', () => {
  const number = Object.fromEntries(OCLL.map(([o, , n]) => [o, n]));
  const moved = M.applyMoves(SOLVED.map((_, i) => i), M.parseAlg('U'));
  ZBLL.forEach((c) => {
    const st = M.applyAlg(c.setup);
    assert.ok(st.every((x, i) => moved[i] !== i || i < 9 || x === SOLVED[i]), c.name + ': 最後の層以外が崩れている');
    assert.ok([1, 3, 5, 7].every((i) => st[i] === 'U'), c.name + ': 上面のエッジが向いていない');
    // setup の逆（面回しだけ）で引く。手順そのもので引くと、持ち替えのあとの最後の U を OLL の確認が AUF とみなして外してしまう
    // （H-Diag2 の x' … U など。ZBLL の確認は PLL と同じで、括弧の無い U は外さないので問題ない）
    const found = C.findCase('oll', M.flatten(c.setup, { inverse: true }), OLL);
    assert.equal(found && found.name, number[ocllOf(c)], c.name);
  });
});

test('472 ケースの状態が、前後の AUF の違いを除いてすべて違う（状態を直接比べる）', () => {
  const key = (setup) => {
    const all = [];
    M.AUFS.forEach((pre) => {
      const st = M.applyAlg(setup, { state: M.applyAlg(pre) });
      M.AUFS.forEach((post) => all.push(M.applyAlg(post, { state: st }).join('')));
    });
    return all.sort()[0];
  };
  assert.equal(new Set(ZBLL.map((c) => key(c.setup))).size, 472);
});
