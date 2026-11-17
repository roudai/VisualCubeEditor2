// 実行: node --test
// ケース用スクランブル：tools/gen-scrambles.js（生成）、tools/build-scrambles.js（確認と js/<set>-scrambles.js の生成）、
// data/<pll|oll|coll>/scrambles.json と js/<pll|oll|coll>-scrambles.js の全件の確認。
// 前半は代表的なケースを直書きして、生成 → 確認の流れを確かめる（データが無くても動く）。
// 後半は置かれている scrambles.json の全件を確かめる（まだ無ければ skip。置かれたら自動で有効になる）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const M = require('../js/cube-state.js');
const G = require('../tools/gen-scrambles.js');
const B = require('../tools/build-scrambles.js');

const COUNT = 20;
const FORMAT = /^[URFDLB][2']?( [URFDLB][2']?)*$/;

// ---- CaseCheck を使わない確認（状態を直接比べる） ----
const SOLVED = M.solved();
const U_MOVED = M.applyMoves(
  SOLVED.map((_, i) => i),
  M.parseAlg('U')
);
const isLastLayer = (i) => U_MOVED[i] !== i || SOLVED[i] === 'U';
const f2lSolved = (state) => state.every((x, i) => isLastLayer(i) || x === SOLVED[i]);
// 上面の向き（U の色がある場所。U 面 9 枚と側面の上段）
const pattern = (state) => state.map((x, i) => (isLastLayer(i) && x === 'U' ? '1' : '0')).join('');
const join = (...parts) => parts.filter(Boolean).join(' ');

// PLL: スクランブルした状態が「AUF・setup・AUF」のどれかと同じ
function isPllCase(c, scramble) {
  const state = M.applyAlg(scramble).join('');
  return M.AUFS.some((pre) => M.AUFS.some((post) => M.applyAlg(join(pre, c.setup, post)).join('') === state));
}
// OLL: 最後の層以外は揃っていて、上面の向きが「setup・AUF」のどれかと同じ
function isOllCase(c, scramble) {
  const state = M.applyAlg(scramble);
  return f2lSolved(state) && M.AUFS.some((post) => pattern(M.applyAlg(join(c.setup, post))) === pattern(state));
}
// COLL: 最後の層以外は揃っていて、上面のエッジは向いていて、最後の層のエッジ（位置）を除いた状態が「AUF・setup・AUF」のどれかと同じ
// （COLL はエッジの位置を揃えないので、上面のエッジ 1・3・5・7 と側面の上段の真ん中は比べない）
const LL_EDGE = new Set([1, 3, 5, 7, 9 + 1, 18 + 1, 36 + 1, 45 + 1]); // U 面のエッジと R・F・L・B の上段の真ん中
const withoutEdges = (state) => state.map((x, i) => (LL_EDGE.has(i) ? '-' : x)).join('');
function isCollCase(c, scramble) {
  const state = M.applyAlg(scramble);
  if (!f2lSolved(state) || ![1, 3, 5, 7].every((i) => state[i] === 'U')) return false;
  const key = withoutEdges(state);
  return M.AUFS.some((pre) => M.AUFS.some((post) => withoutEdges(M.applyAlg(join(pre, c.setup, post))) === key));
}
const isCase = (set, c, scramble) => (set === 'oll' ? isOllCase(c, scramble) : set === 'coll' ? isCollCase(c, scramble) : isPllCase(c, scramble));

// 生成物（js/<set>-scrambles.js の中身）をブラウザと同じように読む
function loadGenerated(source, varName) {
  const sandbox = {};
  sandbox.self = sandbox;
  vm.runInNewContext(source, sandbox);
  return JSON.parse(JSON.stringify(sandbox[varName]));
}

// ---- 直書きのケース（setup は alg の逆手順） ----
const make = (name, alg) => ({ name: name, group: 'test', alg: alg, setup: M.flatten(alg, { inverse: true }) });
const SAMPLE = {
  pll: [
    make('T', "R U R' U' R' F R2 U' R' U' R U R' F'"),
    make('Jb', "R U R' F' R U R' U' R' F R2 U' R'"),
    make('Ua', "R U' R U R U R U' R' U' R2"),
    make('H', 'M2 U M2 U2 M2 U M2'), // 前後の AUF を変えても 4 通りの状態しか無い
  ],
  oll: [
    make('27', "R U R' U R U2 R'"), // Sune
    make('26', "R U2 R' U' R U' R'"), // Antisune
    make('45', "F R U R' U' F'"),
    make('44', "f R U R' U' f'"),
    make('21', "R U2 R' U' R U R' U' R U' R'"),
  ],
  coll: [
    make('27-1', "R U R' U R U2 R'"), // Sune
    make('21-2', "R U2 R' U' R U R' U' R U' R'"), // H
    make('22-1', "R U2 R2 U' R2 U' R2 U2 R"), // Pi
    make('25-4', "R U2 R D R' U2 R D' R2"), // L
  ],
};
const sample = {};
['pll', 'oll', 'coll'].forEach((set) => {
  sample[set] = G.generate(set, SAMPLE[set]);
});

for (const set of ['pll', 'oll', 'coll']) {
  const cases = SAMPLE[set];

  test(`${set}（直書きのケース）：各ケース ${COUNT} 本、どれもそのケースになり、重複が無く、短すぎない`, () => {
    // （OLL の名前は数字なので、オブジェクトのキーは数の順に並ぶ。並びは比べない）
    assert.deepEqual(Object.keys(sample[set]).sort(), cases.map((c) => c.name).sort());
    cases.forEach((c) => {
      const list = sample[set][c.name];
      assert.equal(list.length, COUNT);
      assert.equal(new Set(list).size, COUNT, c.name + ': 重複');
      list.forEach((s) => {
        assert.match(s, FORMAT);
        assert.ok(s.split(' ').length >= G.MIN_MOVES && s.split(' ').length <= 24, c.name + ': ' + s);
        assert.ok(isCase(set, c, s), c.name + ': ' + s);
        assert.equal(B.verifyScramble(set, c, s, cases), null, c.name + ': ' + s);
        // ほかのケースにはならない
        cases.forEach((other) => {
          if (other !== c) assert.notEqual(B.verifyScramble(set, other, s, cases), null, `${c.name} → ${other.name}: ${s}`);
        });
        // 覚えた手順の逆（setup）そのものではない
        assert.notEqual(s, c.setup);
      });
    });
  });

  test(`${set}（直書きのケース）：同じ種なら同じ結果、種を変えると変わる。ケースを減らしても残りは変わらない`, () => {
    assert.deepEqual(G.generate(set, cases, { count: 5 }), G.generate(set, cases, { count: 5, seed: G.DEFAULT_SEED }));
    const first = cases[0].name;
    assert.deepEqual(G.generate(set, cases, { count: 5 })[first], sample[set][first].slice(0, 5));
    assert.notDeepEqual(G.generate(set, cases, { count: 5, seed: 2 })[first], sample[set][first].slice(0, 5));
    const last = cases[cases.length - 1];
    assert.deepEqual(G.generate(set, [last], { count: 5 })[last.name], sample[set][last.name].slice(0, 5));
  });

  test(`${set}（直書きのケース）：生成物は { ケース名: [スクランブル] } で、json と同じ中身になる`, () => {
    const source = B.buildFile(set, sample[set], cases);
    assert.match(source, new RegExp('^// 自動生成ファイル。手で編集しないこと。\\n// 元データ: data/' + set + '/scrambles.json / 生成: node tools/build-scrambles.js\\n'));
    assert.deepEqual(loadGenerated(source, set.toUpperCase() + '_SCRAMBLES'), sample[set]);
    // json の文字列にして読み直しても同じ（scrambles.json の形）
    assert.deepEqual(JSON.parse(G.toJson(sample[set])), sample[set]);
  });

  test(`${set}（直書きのケース）：だめなスクランブルがあれば生成を止める`, () => {
    const [a, b] = cases;
    const copy = () => JSON.parse(JSON.stringify(sample[set]));
    const fails = (change, re) => {
      const raw = copy();
      change(raw);
      assert.throws(() => B.buildFile(set, raw, cases), re);
    };
    // 別のケースのスクランブル
    fails((raw) => {
      raw[a.name][3] = raw[b.name][3];
    }, new RegExp(a.name + ' の 4 番目: (このケースになりません|ケースの名前が合いません)'));
    // 重複
    fails((raw) => {
      raw[a.name][5] = raw[a.name][0];
    }, /6 番目: 重複しています/);
    // スクランブルが無い・空
    fails((raw) => {
      delete raw[a.name];
    }, /スクランブルがありません/);
    fails((raw) => {
      raw[b.name] = [];
    }, /スクランブルがありません/);
    // データに無いケース名
    fails((raw) => {
      raw.Zz = raw[a.name];
    }, /Zz: js\/.*-data\.js に無いケース名です/);
    // 形式（素の面回し以外・余分な空白）
    fails((raw) => {
      raw[a.name][0] = "x " + raw[a.name][0];
    }, /形式が違います/);
    fails((raw) => {
      raw[a.name][0] = raw[a.name][0].replace(' ', '  ');
    }, /形式が違います/);
    // 1 手足すと、そのケースにならない
    fails((raw) => {
      raw[a.name][0] = raw[a.name][0] + ' R';
    }, /1 番目: /);
    // 手順そのもの（setup）は、形式が合えばそのケースとして通る（確認は「そのケースになるか」だけを見る）
    assert.equal(B.verifyScramble(set, cases[0], cases[0].setup, cases), null);
  });
}

test('pll（直書きのケース）：前後の AUF が変わる（H 以外は 4 通りより多くの状態が出る）', () => {
  SAMPLE.pll.forEach((c) => {
    const states = new Set(sample.pll[c.name].map((s) => M.applyAlg(s).join('')));
    if (c.name === 'H') assert.ok(states.size >= 2 && states.size <= 4, 'H: ' + states.size);
    else assert.ok(states.size > 4, c.name + ': ' + states.size);
  });
});

test('pll（直書きのケース）：U D と 180° だけの手順にならない', () => {
  SAMPLE.pll.forEach((c) => {
    sample.pll[c.name].forEach((s) => assert.match(s, /(^| )[RLFB]'?( |$)/, c.name + ': ' + s));
  });
});

test('oll（直書きのケース）：最後の層の置換（PLL の部分）がランダムで、向きも変わる', () => {
  SAMPLE.oll.forEach((c) => {
    const list = sample.oll[c.name];
    // 上面の向きを揃えたあとの状態（PLL の部分）がいろいろある
    const after = new Set(list.map((s) => M.applyAlg(c.alg, { state: M.applyAlg(s), cancelRotation: true }).join('')));
    assert.ok(after.size >= 10, c.name + ': ' + after.size);
    // 向き（AUF）が 2 通り以上ある
    const patterns = new Set(list.map((s) => pattern(M.applyAlg(s))));
    assert.ok(patterns.size >= 2 && patterns.size <= 4, c.name + ': ' + patterns.size);
  });
});

// ---- 置かれているデータの全件の確認 ----
for (const set of ['pll', 'oll', 'coll']) {
  const p = B.paths(set);
  const missing = [p.data, p.src].filter((f) => !fs.existsSync(f)).map((f) => f.replace(/^.*[\\/](?=[^\\/]+[\\/][^\\/]+$)/, ''));
  const skip = missing.length ? missing.join('・') + ' がまだ無い（node tools/gen-scrambles.js で作る）' : false;

  test(`data/${set}/scrambles.json：全ケースに ${COUNT} 本ずつあり、どれもそのケースになり、重複が無い`, { skip: skip }, () => {
    const cases = B.loadCases(set);
    const raw = JSON.parse(fs.readFileSync(p.src, 'utf8'));
    assert.deepEqual(Object.keys(raw).sort(), cases.map((c) => c.name).sort());
    cases.forEach((c) => {
      const list = raw[c.name];
      assert.equal(list.length, COUNT, c.name);
      assert.equal(new Set(list).size, COUNT, c.name + ': 重複');
      list.forEach((s) => {
        assert.match(s, FORMAT);
        assert.ok(s.split(' ').length >= G.MIN_MOVES && s.split(' ').length <= 24, c.name + ': ' + s);
        assert.ok(isCase(set, c, s), c.name + ': ' + s);
        assert.equal(B.verifyScramble(set, c, s, cases), null, c.name + ': ' + s);
      });
    });
    // セット全体でも重複が無い
    const all = Object.values(raw).flat();
    assert.equal(new Set(all).size, all.length);
  });

  test(`js/${set}-scrambles.js：scrambles.json から作り直したものと一致し、全ケース分ある`, { skip: skip }, () => {
    assert.ok(fs.existsSync(p.out), `js/${set}-scrambles.js が無い（node tools/build-scrambles.js で作る）`);
    const source = fs.readFileSync(p.out, 'utf8');
    assert.equal(source, B.build(set));
    const raw = JSON.parse(fs.readFileSync(p.src, 'utf8'));
    assert.deepEqual(loadGenerated(source, set.toUpperCase() + '_SCRAMBLES'), raw);
    delete require.cache[require.resolve(p.out)];
    assert.deepEqual(require(p.out), raw);
  });
}
