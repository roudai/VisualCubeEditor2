// 実行: node --test test/pll-data.test.js
// PLL 21ケースのデータ（pll/algs_info.json → js/pll-data.js）。仕様: reference/PLL_SPEC.md
//
// a と s が互いに合っているか（生成時の確認と同じ）に加えて、**名前とケースの対応**を手順とは別の系統で確かめる:
//   1. EXPECTED … 各 PLL を「ピースの置換」（どのコーナー・エッジがどこへ動くか）として直書きしたもの。
//      setup の状態から読み取った置換が、AUF の違いを除いてこれと一致すること
//   2. OTHER_ALGS … データとは別の、広く使われている手順。findCase で同じ名前のケースになること
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const M = require('../js/cube-state.js');
const C = require('../js/case-check.js');
const PLL = require('../js/pll-data.js');
const SRC = require('../pll/algs_info.json');
const NOTES = require('../js/pll-groups.js');
const { build, cases, check, OUT } = require('../tools/build-pll-data.js');

const SOLVED = M.solved();
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

const GROUPS = {
  'Edges only': ['Ua', 'Ub', 'H', 'Z'],
  'Corners only': ['Aa', 'Ab', 'E'],
  'Adjacent swap': ['T', 'F', 'Ja', 'Jb', 'Ra', 'Rb'],
  'Diagonal swap': ['Y', 'V', 'Na', 'Nb'],
  G: ['Ga', 'Gb', 'Gc', 'Gd'],
};
const NAMES = Object.values(GROUPS).flat();

// ---- 期待するピースの置換（標準の向き） ----
// 「その PLL を解くと、ピースがどう動くか」を巡回で書く。'UR>UL>UF' は「UR にあるピースが UL へ、UL のが UF へ、UF のが UR へ」。
// 位置は上から見て（B が上）: コーナー UBL UBR UFR UFL、エッジ UB UR UF UL。向きは reference/PLL_SPEC.md「標準の向き」。
//   Ua は3エッジの反時計回り、Ub は時計回り（後ろのエッジは動かない）。Aa は3コーナーの時計回り、Ab は反時計回り。
//   隣接交換は右のコーナー2個（UBR・UFR）の交換で、いっしょに交換するエッジの組で見分ける
//     T: 左右 / F: 前後 / Ja: 後ろと右 / Jb: 右と前 / Ra: 後ろと左 / Rb: 前と左
//   対角交換: Y・V・Nb は UBL と UFR、Na は UBR と UFL。エッジは Y: 後ろと左 / V: 後ろと右 / N: 左右
//   G: 動かないコーナーとその隣の動かないエッジが 1x2 のブロック、左の2コーナーがヘッドライト
const EXPECTED = {
  Ua: 'UR>UL>UF',
  Ub: 'UR>UF>UL',
  H: 'UB>UF UR>UL',
  Z: 'UB>UL UR>UF',
  Aa: 'UBL>UBR>UFR',
  Ab: 'UBL>UFR>UBR',
  E: 'UBL>UFL UBR>UFR',
  T: 'UBR>UFR UR>UL',
  F: 'UBR>UFR UB>UF',
  Ja: 'UBR>UFR UB>UR',
  Jb: 'UBR>UFR UR>UF',
  Ra: 'UBR>UFR UB>UL',
  Rb: 'UBR>UFR UF>UL',
  Y: 'UBL>UFR UB>UL',
  V: 'UBL>UFR UB>UR',
  Na: 'UBR>UFL UR>UL',
  Nb: 'UBL>UFR UR>UL',
  Ga: 'UBL>UBR>UFL UB>UL>UR',
  Gb: 'UBL>UFL>UFR UB>UF>UL',
  Gc: 'UBL>UFL>UFR UR>UF>UL',
  Gd: 'UBL>UBR>UFL UB>UL>UF',
};

// データとは別の手順（名前とケースの対応の確認用。どれもその名前で広く知られているもの）
const OTHER_ALGS = {
  Ua: ["R U' R U R U R U' R' U' R2", "R2 U' R' U' R U R U R U' R"],
  Ub: ["R2 U R U R' U' R' U' R' U R'", "R' U R' U' R' U' R' U R U R2"],
  H: ["R2 U2 R U2 R2 U2 R2 U2 R U2 R2"],
  Z: ["M2 U M2 U M' U2 M2 U2 M'", "R' U' R U' R U R U' R' U R U R2 U' R'"],
  Aa: ["l' U R' D2 R U' R' D2 R2 x'", "x L2 D2 L' U' L D2 L' U L' x'"],
  Ab: ["l' R' D2 R U R' D2 R U' R x'", "x' L2 D2 L U L' D2 L U' L x"],
  E: ["x' L' U L D' L' U' L D L' U' L D' L' U L D x"],
  T: ["R U R' U' R' F R2 U' R' U F' L' U L"],
  F: ["R' U2 R' U' y R' F' R2 U' R' U R' F R U' F"],
  Ja: ["R' U L' U2 R U' R' U2 R L", "L' U' L F L' U' L U L F' L2 U L"],
  Jb: ["R U2 R' U' R U2 L' U R' U' L"],
  Ra: ["R U R' F' R U2 R' U2 R' F R U R U2 R'", "L U2 L' U2 L F' L' U' L U L F L2"],
  Rb: ["R' U2 R U2 R' F R U R' U' R' F' R2", "R' U2 R' D' R U' R' D R U R U' R' U' R"],
  Y: ["F R' F R2 U' R' U' R U R' F' R U R' U' F'"],
  V: ["R' U R' U' R D' R' D R' U D' R2 U' R2 D R2", "R' U R' d' R' F' R2 U' R' U R' F R F"],
  Na: ["z U R' D R2 U' R D' U R' D R2 U' R D' z'", "L U' R U2 L' U R' L U' R U2 L' U R'"],
  Nb: ["z U' R D' R2 U R' D U' R D' R2 U R' D z'", "R' U L' U2 R U' L R' U L' U2 R U' L"],
  Ga: ["R2 u R' U R' U' R u' R2 y' R' U R"],
  Gb: ["R' U' R y R2 u R' U R U' R u' R2"],
  Gc: ["R2 u' R U' R U R' u R2 y R U' R'"],
  Gd: ["R U R' y' R2 u' R U' R' U R' u R2"],
};

// ---- 置換 → 状態（CubeState の回転は使わず、ステッカーを直接置く） ----
const SIDES = ['B', 'R', 'F', 'L']; // 上から見て時計回り
const CORNERS = ['UBL', 'UBR', 'UFR', 'UFL']; // コーナー i は面 SIDES[i-1] と SIDES[i] の間
const EDGES = ['UB', 'UR', 'UF', 'UL']; // エッジ i は面 SIDES[i]
// 側面上段 12 枚の、状態の中での位置（B → R → F → L。toImageColors の scolor と同じ並び）
const INDEX = SOLVED.map((_, i) => i);
const RING = M.toImageColors(INDEX, Object.assign({}, INDEX)).scolor;

// 巡回の文字列 → { corners, edges }。corners[i] = 位置 i にあるピースの行き先（＝そのピースの本来の位置）
function parseCycles(text) {
  const perm = { corners: [0, 1, 2, 3], edges: [0, 1, 2, 3] };
  text.split(' ').forEach((cycle) => {
    const names = cycle.split('>');
    const isCorner = names[0].length === 3;
    const list = isCorner ? CORNERS : EDGES;
    const at = names.map((n) => list.indexOf(n));
    assert.ok(at.every((i) => i >= 0) && names.length >= 2, 'EXPECTED の書き方: ' + cycle);
    at.forEach((from, k) => ((isCorner ? perm.corners : perm.edges)[from] = at[(k + 1) % at.length]));
  });
  return perm;
}

// その置換で揃うケースの状態（センターと F2L は揃っていて、上面は U 色）
function stateOf(perm) {
  const st = SOLVED.slice();
  for (let i = 0; i < 4; i++) {
    const c = perm.corners[i];
    st[RING[3 * i]] = SIDES[c]; // コーナー i の、面 SIDES[i] 側
    st[RING[(3 * i + 11) % 12]] = SIDES[(c + 3) % 4]; // コーナー i の、面 SIDES[i-1] 側
    st[RING[3 * i + 1]] = SIDES[perm.edges[i]];
  }
  return st;
}
const expectedState = (name) => stateOf(parseCycles(EXPECTED[name]));

// 手順 alg（センターを動かさない）で作ったケースの、前後の AUF 違い 16 通り（CubeState で実際に回す）
function variants(alg) {
  const out = [];
  M.AUFS.forEach((pre) => {
    const st = M.applyAlg(alg, { state: M.applyAlg(pre) });
    M.AUFS.forEach((post) => out.push(M.applyAlg(post, { state: st })));
  });
  return out;
}
const key = (alg) => variants(alg).map((s) => s.join('')).sort()[0];

// ---- 件数・並び・生成物 ----
test('21ケースを元データの順に含み、名前が重複しない', () => {
  assert.deepEqual(PLL.map((c) => c.name), Object.values(SRC).map((c) => c.name));
  assert.deepEqual(PLL.map((c) => c.name), NAMES);
  assert.equal(PLL.length, 21);
  assert.equal(new Set(PLL.map((c) => c.name)).size, 21);
  assert.deepEqual(Object.keys(SRC), NAMES.map((_, i) => String(i + 1)));
});

test('グループは5つで、件数と並びが決めたとおり', () => {
  const groups = {};
  PLL.forEach((c) => (groups[c.group] = (groups[c.group] || []).concat(c.name)));
  assert.deepEqual(groups, GROUPS);
  assert.deepEqual(Object.keys(groups), Object.keys(GROUPS));
  assert.deepEqual(Object.values(groups).map((g) => g.length), [4, 3, 6, 4, 4]);
});

test('グループの説明（js/pll-groups.js）が全グループにあり、余分が無い', () => {
  assert.deepEqual(Object.keys(NOTES), Object.keys(GROUPS));
  Object.values(NOTES).forEach((note) => assert.ok(typeof note === 'string' && note.length > 0));
});

test('js/pll-data.js が最新（生成し直しても変わらない）で、項目は name・group・alg・setup だけ', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
  assert.deepEqual(PLL, cases());
  PLL.forEach((c) => assert.deepEqual(Object.keys(c), ['name', 'group', 'alg', 'setup']));
  Object.values(SRC).forEach((c) => {
    assert.deepEqual(Object.keys(c), ['name', 'group', 'algset', 's', 'a']);
    assert.equal(c.algset, 'PLL');
  });
});

// ---- a と s の整合（生成時の確認と同じ内容を、テストでも直接確かめる） ----
PLL.forEach((c) => {
  test(`${c.name}: alg は最後のAUFなしで setup を揃え、case 表示は setup の状態と一致する`, () => {
    assert.equal(C.check('pll', c.alg, c.setup), null);
    assert.equal(check(c.alg, c.setup), null);
    const caseState = M.applyAlg(c.setup);
    // 手順中の持ち替え・2層回し・中層回しによる完成後の向きの違いは無視する（画面の case 表示と同じ扱い）
    const end = M.applyAlg(c.alg, { state: caseState, cancelRotation: true });
    assert.ok(M.AUFS.some((u) => same(M.applyAlg(u, { state: end }), SOLVED)), 'setup + alg + AUF で揃わない');
    assert.ok(same(M.applyAlg(c.alg, { inverse: true, cancelRotation: true }), caseState), 'case 表示が setup と違う');
    assert.ok(!/\(U[^)]*\)\s*$/.test(c.alg), '最後にAUFが付いている');
    assert.equal(C.stripEnd('pll', c.alg), c.alg, '最後に AUF か、向きを戻さない持ち替えが付いている');
    // PLL は最後の層の位置だけを崩す: 側面上段の 12 枚以外は揃ったまま（上面は U 色、F2L とセンターはそのまま）
    assert.ok(caseState.every((x, i) => RING.includes(i) || x === SOLVED[i]), '側面上段以外が崩れている');
    assert.ok(!same(caseState, SOLVED), '揃った状態のまま');
  });

  test(`${c.name}: setup は素の面回しと括弧付きの AUF だけ（センターを動かさない）`, () => {
    const body = c.setup.replace(/\(U[2']?\)/g, ' ').trim();
    assert.match(body, /^[URFDLB][2']?( +[URFDLB][2']?)*$/);
    assert.match(c.setup, /^(\(U[2']?\) )?[^()]+( \(U[2']?\))?$/);
    assert.ok(M.parseAlg(c.setup).every((m) => 'URFDLB'.includes(m.face)));
  });
});

// ---- 名前とケースの対応 ----
test('EXPECTED は21ケースぶんあり、どれも偶置換の正しい PLL で、互いに違うケース', () => {
  assert.deepEqual(Object.keys(EXPECTED), NAMES);
  const parity = (p) => {
    let n = 0;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) if (p[i] > p[j]) n++;
    return n % 2;
  };
  const keys = NAMES.map((name) => {
    const perm = parseCycles(EXPECTED[name]);
    assert.deepEqual([...perm.corners].sort(), [0, 1, 2, 3], name);
    assert.deepEqual([...perm.edges].sort(), [0, 1, 2, 3], name);
    assert.equal(parity(perm.corners), parity(perm.edges), name + ': 3x3 で作れない置換');
    // 前後の AUF 違い 16 通りの最小（状態を U で回すのは、揃った状態に対する置換として合成する）
    return classKey(expectedState(name));
  });
  assert.equal(new Set(keys).size, 21);
});

// 状態（揃った状態からの置換とみなす）の、前後の AUF 違いを除いたキー
function classKey(state) {
  // 色は面ごとに 9 枚同じなので、ステッカー単位の置換に直す: 側面上段の 12 枚だけが動く
  // perm[i] = 位置 i に来るステッカーの元の位置。ピース単位で決まるので、コーナー・エッジの置換から作る
  const cp = [];
  const ep = [];
  for (let i = 0; i < 4; i++) {
    cp[i] = SIDES.indexOf(state[RING[3 * i]]);
    ep[i] = SIDES.indexOf(state[RING[3 * i + 1]]);
  }
  let best = null;
  for (let pre = 0; pre < 4; pre++) {
    for (let post = 0; post < 4; post++) {
      // U^pre → 置換 → U^post を、位置の番号の足し算で表す（U は位置 i のピースを i+1 へ動かす）
      const c = [];
      const e = [];
      for (let i = 0; i < 4; i++) {
        c[(i + post) % 4] = (cp[i] + 4 - pre) % 4;
        e[(i + post) % 4] = (ep[i] + 4 - pre) % 4;
      }
      const k = c.join('') + e.join('');
      if (best === null || k < best) best = k;
    }
  }
  return best;
}

test('classKey（置換から求めた AUF 違いを除くキー）は、CubeState で回した結果と同じ分け方になる', () => {
  // T を U で挟んだ 16 通りはすべて同じキー、Jb とは違うキー
  const t = PLL.find((c) => c.name === 'T');
  const jb = PLL.find((c) => c.name === 'Jb');
  const keys = new Set(variants(t.setup).map(classKey));
  assert.equal(keys.size, 1);
  assert.ok(!keys.has(classKey(M.applyAlg(jb.setup))));
});

PLL.forEach((c) => {
  test(`${c.name}: setup の状態のピースの置換が、名前どおりの PLL（AUF の違いを除く）`, () => {
    const state = M.applyAlg(c.setup);
    const target = expectedState(c.name);
    // 1. CubeState で前後に AUF を付けた 16 通りのどれかが、直書きの置換から作った状態と一致する
    assert.ok(variants(c.setup).some((s) => same(s, target)), `${c.name} の置換にならない`);
    // 2. 置換どうしを比べても同じ（状態計算を通さない比較）
    assert.equal(classKey(state), classKey(target));
    // 3. ほかの 20 ケースの置換とは一致しない
    const others = NAMES.filter((n) => n !== c.name && classKey(expectedState(n)) === classKey(state));
    assert.deepEqual(others, []);
  });

  test(`${c.name}: alg は標準の向きのケースを、最後の AUF を除いて揃える（前AUFは標準の向きに合わせるためだけ）`, () => {
    // 標準の向きの状態（EXPECTED の置換から作ったもの）に、前AUF を外した手順を回すと、最後の AUF を除いて揃う
    const body = c.alg.replace(/^(\s*\(U[0-9']*\))+\s*/, '');
    const pre = c.alg.slice(0, c.alg.length - body.length).trim();
    const solves = (alg) => {
      const end = M.applyAlg(alg, { state: expectedState(c.name), cancelRotation: true });
      return M.AUFS.some((u) => same(M.applyAlg(u, { state: end }), SOLVED));
    };
    assert.ok(solves(body), '標準の向きから揃わない（前AUFが要る・違う）');
    // 前AUFが付いているなら、付けたままでは標準の向きから揃わない（＝前AUFに意味がある）
    if (pre) assert.ok(!solves(c.alg));
  });

  test(`${c.name}: 別の手順（OTHER_ALGS）でも同じ名前のケースになる`, () => {
    assert.ok(OTHER_ALGS[c.name].length > 0);
    OTHER_ALGS[c.name].forEach((alg) => {
      assert.notEqual(M.flatten(alg), M.flatten(c.alg), 'データと同じ手順では確認にならない');
      const found = C.findCase('pll', alg, PLL);
      assert.equal(found && found.name, c.name, alg);
      // 状態から直接求めた置換でも同じ
      const st = M.applyAlg(alg, { inverse: true, cancelRotation: true });
      assert.ok(st.every((x, i) => RING.includes(i) || x === SOLVED[i]), alg);
      assert.equal(classKey(st), classKey(expectedState(c.name)), alg);
    });
  });
});

test('全ケースが互いに違うケース（AUF の違いを除く）で、自分の手順でしか揃わない', () => {
  assert.equal(new Set(PLL.map((c) => key(c.setup))).size, 21);
  assert.equal(new Set(PLL.map((c) => classKey(M.applyAlg(c.setup)))).size, 21);
  PLL.forEach((c) => {
    assert.equal(C.findCase('pll', c.alg, PLL).name, c.name);
    PLL.filter((d) => d !== c).forEach((d) => assert.equal(C.fitSetup('pll', c.alg, d.setup), null, `${c.name} の手順で ${d.name} が揃う`));
  });
});

test('逆の関係にある組: Ua⇔Ub、Aa⇔Ab、Ga⇔Gb、Gc⇔Gd は互いに逆、ほかは自分が逆', () => {
  const inverse = { Ua: 'Ub', Ub: 'Ua', Aa: 'Ab', Ab: 'Aa', Ga: 'Gb', Gb: 'Ga', Gc: 'Gd', Gd: 'Gc' };
  PLL.forEach((c) => {
    // setup（そのケースになる手順）を解く手順として見ると、逆のケースを解く
    const found = C.findCase('pll', c.setup.replace(/\s*\(U[0-9']*\)\s*$/, ''), PLL);
    assert.equal(found && found.name, inverse[c.name] || c.name, c.name);
  });
});
