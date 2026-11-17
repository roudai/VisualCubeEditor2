// 実行: node --test test/oll-data.test.js
// OLL 57ケースのデータ（data/oll/algs_info.json → js/oll-data.js）。仕様: reference/OLL_SPEC.md
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('../js/cube-state.js');
const C = require('../js/case-check.js');
const OLL = require('../js/oll-data.js');
const SRC = require('../data/oll/algs_info.json');
const NOTES = require('../js/oll-groups.js');
const { build, check, OUT } = require('../tools/build-oll-data.js');

// ---- 番号とケースの対応の期待値（手順とは別系統） ----
// 一般的な OLL 表（VisualCube の上面図）での各番号の形。手順 a・s から計算したものではなく、表の図を写したもの。
// 書き方：上から見た図を 5 行で書く（x = 上面の色、. = それ以外）
//   1行目 = B 面の上段（左→右）、2〜4行目 = L 面の上段 1枚 ＋ U 面 3枚 ＋ R 面の上段 1枚、5行目 = F 面の上段（左→右）
//   例（27 = Sune）   x..      奥の左のコーナーは B を向いている
//                    ..x.x    右奥のコーナーは R を向いている
//                    .xxx.
//                    .xx..    手前の左のコーナーだけが向いている
//                    ..x      手前の右のコーナーは F を向いている
// 向き（AUF の4通り）は問わない。比べるときは 90° ずつ回した4通りのうち最小のものにそろえる（canon）。
const EXPECTED = {
  1: '.x./x...x/x.x.x/x...x/.x.',
  2: '.xx/x..../x.x.x/x..../.xx',
  3: 'xx./....x/x.x.x/x..x./.x.',
  4: '.x./x..x./x.x.x/....x/xx.',
  5: 'xx./....x/x.xx./x.xx./...',
  6: '.../x.xx./x.xx./....x/xx.',
  7: 'x../..x.x/.xx.x/.x.../.xx',
  8: '.xx/.x.../.xx.x/..x.x/x..',
  9: '..x/x.x../.xx.x/...x./xx.',
  10: 'xx./...x./.xx.x/x.x../..x',
  11: 'xx./....x/x.xx./.xx../..x',
  12: '..x/.xx../x.xx./....x/xx.',
  13: 'xx./....x/.xxx./.x.../.xx',
  14: '.xx/x..../.xxx./...x./xx.',
  15: 'xx./....x/.xxx./x..x./.x.',
  16: '.x./x..x./.xxx./....x/xx.',
  17: '.xx/.x.../x.x.x/x..x./.x.',
  18: '.x./.x.x./x.x.x/...../xxx',
  19: '.x./.x.x./x.x.x/x...x/.x.',
  20: '.x./.x.x./x.x.x/.x.x./.x.',
  21: 'x.x/..x../.xxx./..x../x.x',
  22: '..x/x.x../.xxx./x.x../..x',
  23: '.../.xxx./.xxx./..x../x.x',
  24: 'x../..xx./.xxx./..xx./x..',
  25: '.../.xx.x/.xxx./..xx./x..',
  26: '.../x.xx./.xxx./..x.x/x..',
  27: 'x../..x.x/.xxx./.xx../..x',
  28: '.../.xxx./.xx.x/.x.x./.x.',
  29: '.x./.x.x./.xx.x/x.x.x/...',
  30: '..x/.xx../x.xx./.x.../.xx',
  31: 'x../..xx./x.xx./...x./xx.',
  32: 'xx./...x./x.xx./..xx./x..',
  33: 'xx./...x./.xxx./...x./xx.',
  34: '.x./x...x/.xxx./.x.x./.x.',
  35: '.x./.x..x/x.xx./..xx./x..',
  36: '.x./.x..x/.xx.x/..xx./x..',
  37: '.../.xx.x/.xx.x/...x./xx.',
  38: 'x../..xx./.xx.x/.x..x/.x.',
  39: 'xx./...x./.xxx./.x..x/.x.',
  40: '.xx/.x.../.xxx./x..x./.x.',
  41: 'x.x/..x../.xx.x/.x.x./.x.',
  42: '.x./.x.x./.xx.x/..x../x.x',
  43: '.x./.x..x/.xx.x/.xx.x/...',
  44: '.x./x..x./x.xx./x.xx./...',
  45: '.x./x..x./.xxx./x..x./.x.',
  46: '.../.xx.x/x.x.x/.xx.x/...',
  47: 'x../..x.x/x.xx./....x/xx.',
  48: '..x/x.x../.xx.x/x..../.xx',
  49: '..x/x.x../x.xx./x..../.xx',
  50: '.xx/x..../x.xx./x.x../..x',
  51: '.xx/x..../.xxx./x..../.xx',
  52: 'x../..x.x/x.x.x/..x.x/x..',
  53: '.x./x...x/x.xx./x.x.x/...',
  54: '.../x.x.x/x.xx./x...x/.x.',
  55: '.../x.x.x/x.x.x/x.x.x/...',
  56: '.x./x...x/.xxx./x...x/.x.',
  57: '.x./.x.x./.xxx./.x.x./.x.',
};

// 標準の OLL 番号とグループの対応（一般的な分類。並びは一覧に出す順）
const GROUPS = [
  ['Dot', [1, 2, 3, 4, 17, 18, 19, 20]],
  ['Square', [5, 6]],
  ['Lightning', [7, 8, 11, 12, 39, 40]],
  ['Fish', [9, 10, 35, 37]],
  ['Knight', [13, 14, 15, 16]],
  ['OCLL', [21, 22, 23, 24, 25, 26, 27]],
  ['Corners oriented', [28, 57]],
  ['Awkward', [29, 30, 41, 42]],
  ['P', [31, 32, 43, 44]],
  ['T', [33, 45]],
  ['C', [34, 46]],
  ['W', [36, 38]],
  ['L', [47, 48, 49, 50, 53, 54]],
  ['I', [51, 52, 55, 56]],
];

// 左右対称のペア（鏡に映すと相手の形になる）と、鏡に映しても自分と同じ形になるケース
const MIRROR_PAIRS = [
  [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [26, 27], [29, 30],
  [31, 32], [36, 38], [39, 40], [41, 42], [43, 44], [47, 48], [49, 50], [53, 54],
];
const SELF_MIRROR = [1, 2, 17, 18, 19, 20, 21, 22, 23, 24, 25, 28, 33, 34, 35, 37, 45, 46, 51, 52, 55, 56, 57];

// ---- 図の扱い ----
const rows = (g) => g.split('/');
const cells = (g) => {
  const r = rows(g);
  // 5x5 の升目（四隅は使わない）
  return [[' ', ...r[0], ' '], [...r[1]], [...r[2]], [...r[3]], [' ', ...r[4], ' ']];
};
const fromCells = (c) => [c[0].slice(1, 4), c[1], c[2], c[3], c[4].slice(1, 4)].map((r) => r.join('')).join('/');
// 上から見て時計回りに 90° 回す（U を回したときの見え方）
const rotate = (g) => {
  const c = cells(g);
  return fromCells(c.map((r, i) => r.map((_, j) => c[4 - j][i])));
};
// 左右を入れ替える（鏡像）
const mirror = (g) => fromCells(cells(g).map((r) => r.slice().reverse()));
const canon = (g) => [g, rotate(g), rotate(rotate(g)), rotate(rotate(rotate(g)))].sort()[0];

// 状態 → 図（toImageColors の ucolor・scolor から。scolor は B(左→右) → R(上→下) → F(右→左) → L(下→上)）
const MASK = M.ollMask(M.DEFAULT_SCHEME);
const diagram = (state) => {
  const c = M.toImageColors(state, MASK);
  const u = c.ucolor.map((x) => (x === MASK.U ? 'x' : '.'));
  const s = c.scolor.map((x) => (x === MASK.U ? 'x' : '.'));
  return [
    s[0] + s[1] + s[2],
    s[11] + u[0] + u[1] + u[2] + s[3],
    s[10] + u[3] + u[4] + u[5] + s[4],
    s[9] + u[6] + u[7] + u[8] + s[5],
    s[8] + s[7] + s[6],
  ].join('/');
};

// 図の中のピース：[上面の位置, 側面の位置…]（[行, 列]。5x5 の升目）
const EDGES = [
  [[1, 2], [0, 2]], // UB
  [[2, 3], [2, 4]], // UR
  [[3, 2], [4, 2]], // UF
  [[2, 1], [2, 0]], // UL
];
// コーナー：[上面, 時計回りにねじれたときに U の色が来る側面, 反時計回りのとき]
const CORNERS = [
  [[1, 1], [1, 0], [0, 1]], // UBL: U → L → B
  [[1, 3], [0, 3], [1, 4]], // UBR: U → B → R
  [[3, 3], [3, 4], [4, 3]], // UFR: U → R → F
  [[3, 1], [4, 1], [3, 0]], // UFL: U → F → L
];
const at = (g, p) => cells(g)[p[0]][p[1]];
const edgesUp = (g) => EDGES.map((e) => at(g, e[0]) === 'x');
const twists = (g) => CORNERS.map((c) => c.findIndex((p) => at(g, p) === 'x'));
const NUMBERS = Array.from({ length: 57 }, (_, i) => i + 1);
const byName = (n) => OLL.find((c) => c.name === String(n));
const setupDiagram = (n) => diagram(M.applyAlg(byName(n).setup));

// ---- 期待値そのものの自己検査 ----
test('期待値：57 個あり、どれも OLL の形として成り立つ（各ピースの U の色はちょうど1枚、コーナーのねじれの合計は 3 の倍数）', () => {
  assert.deepEqual(Object.keys(EXPECTED).map(Number), NUMBERS);
  NUMBERS.forEach((n) => {
    const g = EXPECTED[n];
    assert.match(g, /^[x.]{3}\/[x.]{5}\/[x.]{5}\/[x.]{5}\/[x.]{3}$/, `OLL ${n}`);
    assert.equal(at(g, [2, 2]), 'x', `OLL ${n}: センター`);
    EDGES.concat(CORNERS).forEach((piece) => {
      assert.equal(piece.filter((p) => at(g, p) === 'x').length, 1, `OLL ${n}: ${JSON.stringify(piece)}`);
    });
    assert.equal(twists(g).reduce((a, b) => a + b, 0) % 3, 0, `OLL ${n}: コーナーのねじれ`);
    assert.ok(g.includes('.'), `OLL ${n}`);
  });
});

test('期待値：57 個が互いに違う（回転を除いて）。揃った形は含まない', () => {
  const keys = NUMBERS.map((n) => canon(EXPECTED[n]));
  assert.equal(new Set(keys).size, 57);
  assert.ok(!keys.includes(canon('.../.xxx./.xxx./.xxx./...')));
});

test('期待値：向いているエッジの数（0枚 = Dot の 8、4枚 = OCLL の 7、2枚 = 残り 42。うち隣り合う 27・向かい合う 15）', () => {
  const group = {};
  GROUPS.forEach(([g, list]) => list.forEach((n) => (group[n] = g)));
  const count = (n) => edgesUp(EXPECTED[n]).filter(Boolean).length;
  assert.deepEqual(NUMBERS.filter((n) => count(n) === 0), GROUPS[0][1]);
  assert.deepEqual(NUMBERS.filter((n) => count(n) === 4), GROUPS[5][1]);
  const two = NUMBERS.filter((n) => count(n) === 2);
  assert.equal(two.length, 42);
  assert.equal(NUMBERS.filter((n) => count(n) === 1 || count(n) === 3).length, 0);
  const line = two.filter((n) => {
    const e = edgesUp(EXPECTED[n]);
    return e[0] === e[2];
  });
  // 向かい合う2枚（棒）：Knight・T・C・I の全部と、Lightning の 39・40、57
  assert.deepEqual(line, [13, 14, 15, 16, 33, 34, 39, 40, 45, 46, 51, 52, 55, 56, 57]);
  assert.equal(two.length - line.length, 27);
  // グループごとの形
  NUMBERS.forEach((n) => {
    const corners = twists(EXPECTED[n]).filter((t) => t === 0).length;
    if (group[n] === 'Corners oriented') assert.equal(corners, 4, `OLL ${n}`);
    if (group[n] === 'Square') assert.equal(corners, 1, `OLL ${n}`);
    if (group[n] === 'T' || group[n] === 'C' || group[n] === 'P' || group[n] === 'W') assert.equal(corners, 2, `OLL ${n}`);
    if (group[n] === 'I' || group[n] === 'L') assert.equal(corners, 0, `OLL ${n}`);
    if (group[n] === 'Knight') assert.equal(corners, 1, `OLL ${n}`);
  });
  // コーナーが4個とも向いているのは 20（エッジ0枚）・28（隣り合う2枚が裏）・57（向かい合う2枚が裏）だけ
  assert.deepEqual(NUMBERS.filter((n) => twists(EXPECTED[n]).every((t) => t === 0)), [20, 28, 57]);
});

test('期待値：左右対称のペアは鏡像の関係にあり、それ以外は鏡に映しても同じ形', () => {
  assert.deepEqual(MIRROR_PAIRS.flat().concat(SELF_MIRROR).sort((a, b) => a - b), NUMBERS);
  MIRROR_PAIRS.forEach(([a, b]) => {
    assert.equal(canon(mirror(EXPECTED[a])), canon(EXPECTED[b]), `OLL ${a} / ${b}`);
    assert.notEqual(canon(EXPECTED[a]), canon(EXPECTED[b]), `OLL ${a} / ${b}`);
  });
  SELF_MIRROR.forEach((n) => assert.equal(canon(mirror(EXPECTED[n])), canon(EXPECTED[n]), `OLL ${n}`));
});

// ---- データ ----
test('57 ケースあり、名前は "1"〜"57" がちょうど1回ずつ。元データの順番どおり', () => {
  assert.equal(OLL.length, 57);
  assert.deepEqual(OLL.map((c) => c.name), Object.values(SRC).map((c) => c.name));
  assert.deepEqual(OLL.map((c) => Number(c.name)).sort((a, b) => a - b), NUMBERS);
  OLL.forEach((c) => assert.match(c.name, /^[1-9][0-9]?$/));
  assert.deepEqual(Object.keys(SRC), NUMBERS.map(String));
  Object.values(SRC).forEach((c) => assert.equal(c.algset, 'OLL'));
});

test('グループは 14 個。番号との対応が一般的な分類どおりで、並びはグループ順 → 番号順', () => {
  assert.deepEqual(
    OLL.map((c) => c.group + ' ' + c.name),
    GROUPS.flatMap(([g, list]) => list.map((n) => g + ' ' + n))
  );
  assert.equal(GROUPS.length, 14);
  assert.equal(GROUPS.reduce((sum, [, list]) => sum + list.length, 0), 57);
});

test('グループの説明（js/oll-groups.js）がデータのグループと同じ並びで全部ある', () => {
  assert.deepEqual(Object.keys(NOTES), GROUPS.map(([g]) => g));
  Object.values(NOTES).forEach((note) => assert.ok(typeof note === 'string' && note.length > 0));
});

test('js/oll-data.js が最新（生成し直しても変わらない）', () => {
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
});

test('生成データの項目は name・group・alg・setup だけ', () => {
  OLL.forEach((c) => assert.deepEqual(Object.keys(c), ['name', 'group', 'alg', 'setup']));
});

test('setup はセンターを動かさない素の面回しだけ（ワイド・中層・持ち替えを含まない）', () => {
  OLL.forEach((c) => {
    assert.match(c.setup, /^([UDLRFB][2']?|\(U[2']?\))( ([UDLRFB][2']?|\(U[2']?\)))*$/, `OLL ${c.name}: ${c.setup}`);
  });
});

test('確認処理は向きの揃わない手順・最後の AUF・最後の持ち替えをエラーにする', () => {
  const c = byName(27);
  assert.equal(check(c.alg, c.setup), null);
  assert.match(check("R U R'", c.setup), /揃いません/);
  assert.match(check(c.alg + ' U', c.setup), /最後に AUF/);
  assert.match(check(c.alg + ' (U2)', c.setup), /最後に AUF/);
  assert.match(check(c.alg + ' y', c.setup), /持ち替え/);
  // 別のケースの手順（26 と 27 は鏡像）
  assert.notEqual(check(byName(26).alg, c.setup), null);
});

test('57 ケースの上面の向きがすべて違う（AUF 違いを除いて重複しない）', () => {
  assert.equal(new Set(NUMBERS.map((n) => canon(setupDiagram(n)))).size, 57);
});

test('左右対称のペアの setup は鏡像の関係にある', () => {
  MIRROR_PAIRS.forEach(([a, b]) => {
    assert.equal(canon(mirror(setupDiagram(a))), canon(setupDiagram(b)), `OLL ${a} / ${b}`);
  });
  SELF_MIRROR.forEach((n) => assert.equal(canon(mirror(setupDiagram(n))), canon(setupDiagram(n)), `OLL ${n}`));
});

NUMBERS.forEach((n) => {
  test(`OLL ${n}: 番号どおりの形になり、alg で上面が揃う`, () => {
    const c = byName(n);
    assert.ok(c, 'データに無い');
    // 番号とケースの対応：setup の状態が、期待値の形（回転を除いて）になる
    assert.equal(canon(setupDiagram(n)), canon(EXPECTED[n]), `setup の形が OLL ${n} と違う: ${setupDiagram(n)}`);
    // alg と setup の整合：alg で setup の上面が揃い（F2L を崩さない）、case 表示の上面の向きが setup と一致する
    assert.equal(check(c.alg, c.setup), null);
    assert.equal(diagram(M.applyAlg(c.alg, { inverse: true, cancelRotation: true })), setupDiagram(n));
    // alg の逆から求めた形も期待値と同じ
    assert.equal(canon(diagram(M.applyAlg(c.alg, { inverse: true, cancelRotation: true }))), canon(EXPECTED[n]));
  });
});

// roudai.net の OLL 手順（https://roudai.net/oll/oll/）で、2本目に載っている手順（データは1本目）。同じ番号のケースになること
// （手順はそのページのまま。U'2 を U2 にするなど、書き方だけそろえた）
const SITE_ALGS = {
  8: ["y2 R U2 R' U2 R' F R F'"],
  10: ["y2 L U L' y' R' F R U' R' F' R"],
  32: ["S R U R' U' R' F R Fw'"],
  36: ["R' U' R U' R' U R U x' R U' R' U x"],
  37: ["F R' F' R U R U' R'"],
  39: ["y2 R U R' F' U' F U R U2 R'"],
  41: ["y2 R U' R' U2 R U y R U' R' U' F'"],
  42: ["y R' U2 R U R' U R2 y R U R' U' F'"],
  44: ["y2 F U R U' R' F'"],
  50: ["y' R U2 R' U' R U' R' F R U R' U' F'"],
  51: ["F U R U' R' U R U' R' F'"],
  55: ["R U2 R2 U' R U' R' U2 F R F'"],
  56: ["F R U R' U' R F' Rw U R' U' Rw'"],
};

test('roudai.net のほかの手順（SITE_ALGS）でも同じ番号のケースになる', () => {
  Object.entries(SITE_ALGS).forEach(([n, algs]) =>
    algs.forEach((alg) => {
      assert.notEqual(M.flatten(alg), M.flatten(byName(n).alg), 'データと同じ手順では確認にならない');
      const found = C.findCase('oll', alg, OLL);
      assert.equal(found && found.name, n, alg);
    })
  );
});
