/*
 * 3x3 の Plan 表示（上から見た図）の画像で、ある位置にあるステッカーを調べる（当たり判定）。DOM 非依存。
 * エディタの「色を直接指定」で、上の画像のステッカーを押して色を選ぶのに使う（js/state-picker.js）。
 * 仕様: reference/PLL_SPEC.md「色を直接指定」
 *
 *   PlanHit.polygons(dist)        Plan 表示に出るステッカーの多角形 [{ face, index, points: [[x, y] × 4] }]
 *                                 U 面の 9 枚と、側面（R・F・L・B）の上の段の 3 枚ずつ（縁に細く出る分）
 *   PlanHit.hitTest(x, y, dist)   その位置のステッカー { face, index }。無ければ null
 *     x・y は srVisualizer の画像の座標（viewbox は -0.9〜0.9。画像の左上が (-0.9, -0.9)、右下が (0.9, 0.9)）
 *     dist はエディタの Distance（srVisualizer の dist。既定 5）
 *     face は 'U' | 'R' | 'F' | 'L' | 'B'、index はその面の facelets の番号（0〜8。srVisualizer の facelets の並び）
 *
 * 座標の計算は srVisualizer（library/srVisualizer.min.js。src/cube/geometry.ts・drawing.ts）の Plan 表示と同じ：
 *   x 軸で -90° 回し、dist だけ奥に置いて投影する。U 面は 3x3 のマス、側面は上の段のマスを外へ 0.2 ずらした縁。
 *   描くときはマスを 0.85（縁は 0.94）倍に縮めて隙間を空けるが、当たり判定は縮めない（隙間を押しても近いステッカーになるように）
 * ブラウザでは window.PlanHit、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.PlanHit = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const N = 3; // 3x3 だけ
  const DEFAULT_DIST = 5;
  // 面の外向きのベクトル（srVisualizer の defaultFaceRotations）
  const FACE_VECTORS = { U: [0, -1, 0], R: [1, 0, 0], F: [0, 0, -1], L: [-1, 0, 0], B: [0, 0, 1] };
  const RIM_OFFSET = 0.2; // 縁を外へずらす量（renderOLLStickers）

  // srVisualizer の makeStickerPosition
  function stickerPosition(face, x, y) {
    switch (face) {
      case 'U':
        return [x, 0, N - y];
      case 'R':
        return [N, y, x];
      case 'F':
        return [x, y, 0];
      case 'L':
        return [0, y, N - x];
      case 'B':
        return [N - x, y, N];
      default:
        throw new Error('unknown face: ' + face);
    }
  }
  // x 軸で -90° 回す（Plan 表示の viewportRotations。srVisualizer の rotate）
  function rotatePlan(p) {
    const r = -Math.PI / 2;
    return [p[0], p[2] * Math.sin(r) + p[1] * Math.cos(r), p[2] * Math.cos(r) - p[1] * Math.sin(r)];
  }
  // 面の格子点（(N+1)×(N+1)。[row][col]）を画像の座標にする（srVisualizer の makeFaceStickers）
  function faceGrid(face, dist) {
    const grid = [];
    for (let row = 0; row <= N; row++) {
      grid[row] = [];
      for (let col = 0; col <= N; col++) {
        let p = stickerPosition(face, row, col).map((v) => (v - N / 2) / N);
        p = rotatePlan(p);
        p = [p[0], p[1], p[2] + dist];
        grid[row][col] = [(p[0] * dist) / p[2], (p[1] * dist) / p[2]];
      }
    }
    return grid;
  }
  const add = (p, v) => [p[0] + v[0], p[1] + v[1]];

  function polygons(dist) {
    const d = Number.isFinite(dist) && dist > 0 ? dist : DEFAULT_DIST;
    const list = [];
    // U 面：renderFaceStickers と同じく、マス (i, j) は grid[j][i]〜grid[j+1][i+1]、番号は i * N + j
    const u = faceGrid('U', d);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        list.push({ face: 'U', index: i * N + j, points: [u[j][i], u[j + 1][i], u[j + 1][i + 1], u[j][i + 1]] });
      }
    }
    // 側面の上の段の縁：renderOLLStickers と同じく、grid[i][0]〜grid[i+1][1] の外側を面の向きへ 0.2 ずらす。番号は i
    ['R', 'F', 'L', 'B'].forEach((face) => {
      const g = faceGrid(face, d);
      const v3 = rotatePlan(FACE_VECTORS[face]);
      const v = [v3[0] * RIM_OFFSET, v3[1] * RIM_OFFSET];
      for (let i = 0; i < N; i++) {
        list.push({ face: face, index: i, points: [g[i][0], g[i + 1][0], add(g[i + 1][1], v), add(g[i][1], v)] });
      }
    });
    return list;
  }

  // 凸な四角形の中か（辺の上も中とみなす）
  function inside(points, x, y) {
    let sign = 0;
    for (let k = 0; k < points.length; k++) {
      const a = points[k];
      const b = points[(k + 1) % points.length];
      const cross = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (Math.abs(cross) < 1e-12) continue;
      const s = cross > 0 ? 1 : -1;
      if (sign && s !== sign) return false;
      sign = s;
    }
    return true;
  }

  function hitTest(x, y, dist) {
    const hit = polygons(dist).find((p) => inside(p.points, x, y));
    return hit ? { face: hit.face, index: hit.index } : null;
  }

  return { polygons, hitTest };
});
