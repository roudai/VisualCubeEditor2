// js/cube-draw.js：上面図の色（ucolor・scolor）を srVisualizer の 54 枚の並びに置き直す部分を確かめる。
// 実行: node --test test/cube-draw.test.js
// （描画そのものは srVisualizer と DOM が要るので、ここでは色の置き場所だけを見る）
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../js/cube-state.js');

// ブラウザ用のスクリプト（window.CubeDraw を作る）を、window だけ用意して読み込む
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/cube-draw.js'), 'utf8'), sandbox);
const D = sandbox.window.CubeDraw;

// 54 枚それぞれを別の色にして、どこに置かれたかを追えるようにする
const UNIQUE = M.solved().map((_, i) => 's' + i);
// 上面図に出る場所：U 面の 9 枚と、R・F・L・B の上段 3 枚ずつ
const VISIBLE = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8]);
[9, 18, 36, 45].forEach((base) => [0, 1, 2].forEach((col) => VISIBLE.add(base + col)));

function imageColors(state) {
  // toImageColors は面名 → 色の対応を受け取るので、位置ごとの色は自分で引く
  const ring = [];
  ['B', 'R', 'F', 'L'].forEach((face) => {
    const base = M.FACES.indexOf(face) * 9;
    [2, 1, 0].forEach((col) => ring.push(state[base + col]));
  });
  return { ucolor: state.slice(0, 9), scolor: ring };
}

test('stickerColors：上面図に出る 21 枚は元の位置に戻り、ほかは fill になる', () => {
  const c = imageColors(UNIQUE);
  const out = D.stickerColors(c.ucolor, c.scolor, 'fill');
  assert.equal(out.length, 54);
  out.forEach((color, i) => {
    assert.equal(color, VISIBLE.has(i) ? UNIQUE[i] : 'fill', `位置 ${i}`);
  });
});

test('stickerColors：cube-state.js の toImageColors の並び（B → R → F → L）と合っている', () => {
  const scheme = M.DEFAULT_SCHEME;
  ["R U R' U'", "x R' U R' D2 R U' R' D2 R2 x'", "F R U R' U' F' U2", "M2 U M U2 M' U M2 y"].forEach((alg) => {
    const state = M.applyAlg(alg, { inverse: true, cancelRotation: true });
    const c = M.toImageColors(state, scheme);
    const out = D.stickerColors(c.ucolor, c.scolor, '#000000');
    const all = M.toStickerColors(state, scheme);
    VISIBLE.forEach((i) => assert.equal(out[i], all[i], `${alg}: 位置 ${i}`));
  });
});
