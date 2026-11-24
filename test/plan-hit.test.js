// js/plan-hit.js：Plan 表示の画像で、押した位置のステッカーを調べる当たり判定を確かめる。
// 座標は srVisualizer の Plan 表示と同じ計算（ブラウザで、1x1x1〜6x6x6 の実際の画像の色と全部のステッカーで合うことを確かめた。dist 5・3）。
// 実行: node --test test/plan-hit.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/plan-hit.js');

const center = (p) => p.points.reduce((a, q) => [a[0] + q[0] / 4, a[1] + q[1] / 4], [0, 0]);

test('U 面の 9 枚と側面の上の段の 3 枚ずつ（21 枚）', () => {
  const list = H.polygons(5);
  assert.equal(list.length, 21);
  assert.deepEqual(list.filter((p) => p.face === 'U').map((p) => p.index), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  ['R', 'F', 'L', 'B'].forEach((face) => assert.deepEqual(list.filter((p) => p.face === face).map((p) => p.index), [0, 1, 2]));
});

test('U 面は上から見て左上から右下へ 0〜8、側面は外側に並ぶ', () => {
  assert.deepEqual(H.hitTest(-0.37, -0.37, 5), { face: 'U', index: 0 });
  assert.deepEqual(H.hitTest(0, 0, 5), { face: 'U', index: 4 });
  assert.deepEqual(H.hitTest(0.37, 0.37, 5), { face: 'U', index: 8 });
  // 側面の番号はその面を正面から見た左から：F は左から 0・1・2、R は F 側が 0、B は R 側が 0、L は B 側が 0
  assert.deepEqual(H.hitTest(-0.36, 0.64, 5), { face: 'F', index: 0 });
  assert.deepEqual(H.hitTest(0.64, 0.36, 5), { face: 'R', index: 0 });
  assert.deepEqual(H.hitTest(0.36, -0.64, 5), { face: 'B', index: 0 });
  assert.deepEqual(H.hitTest(-0.64, -0.36, 5), { face: 'L', index: 0 });
});

test('どのステッカーも真ん中を押すとそのステッカー。dist を変えても同じ', () => {
  [5, 3, 10].forEach((dist) => {
    H.polygons(dist).forEach((p) => {
      const [x, y] = center(p);
      assert.deepEqual(H.hitTest(x, y, dist), { face: p.face, index: p.index }, `${dist} ${p.face}${p.index}`);
    });
  });
});

test('背景・角の外は null。dist・大きさが数でなければ既定の 5・3', () => {
  assert.equal(H.hitTest(-0.88, -0.88, 5), null);
  assert.equal(H.hitTest(0, 0.88, 5), null);
  assert.deepEqual(H.hitTest(0, 0, undefined), { face: 'U', index: 4 });
  assert.equal(H.polygons(5, 'x').length, 21);
});

test('ほかの大きさ（1x1x1〜6x6x6）：U 面 n×n 枚と側面の上の段 n 枚ずつ。どのステッカーも真ん中を押すとそのステッカー', () => {
  [1, 2, 4, 5, 6].forEach((size) => {
    const list = H.polygons(5, size);
    assert.equal(list.length, size * size + 4 * size, String(size));
    assert.deepEqual(
      list.filter((p) => p.face === 'U').map((p) => p.index),
      Array.from({ length: size * size }, (_, i) => i)
    );
    [5, 3].forEach((dist) => {
      H.polygons(dist, size).forEach((p) => {
        const [x, y] = center(p);
        assert.deepEqual(H.hitTest(x, y, dist, size), { face: p.face, index: p.index }, `${size} ${dist} ${p.face}${p.index}`);
      });
    });
  });
  // 4x4：U 面の左上・右下、F の縁の左端
  assert.deepEqual(H.hitTest(-0.45, -0.45, 5, 4), { face: 'U', index: 0 });
  assert.deepEqual(H.hitTest(0.45, 0.45, 5, 4), { face: 'U', index: 15 });
  assert.equal(H.hitTest(-0.4, 0.64, 5, 4).face, 'F');
  assert.equal(H.hitTest(-0.4, 0.64, 5, 4).index, 0);
});
