/*
 * 3x3x3 の two-phase ソルバ（Kociemba 方式。DOM 非依存・外部ライブラリなし）と、一様ランダムな状態の生成。
 * 通しの練習用のスクランブル（js/wca-scramble.js）と、ケース用スクランブルの生成（tools/gen-scrambles.js）で使う。
 *
 * 状態は 2 通りの形で扱う。
 *   - 54 要素の配列（js/cube-state.js と同じ並び。U,R,F,D,L,B の順に 9 枚ずつ、値は面名）。センターは動かさないこと
 *   - キュービー表現 { cp[8], co[8], ep[12], eo[12] }
 *       cp[i] = コーナーの位置 i にあるピース、co[i] = その向き（0..2）。位置は URF,UFL,ULB,UBR,DFR,DLF,DBL,DRB
 *       ep[i] = エッジの位置 i にあるピース、eo[i] = その向き（0..1）。位置は UR,UF,UL,UB,DR,DF,DL,DB,FR,FL,BL,BR
 *
 *   CubeSolver.init()                 表を作る（1 回だけ。solve から自動で呼ばれる）。かかった時間（ms）を返す
 *   CubeSolver.initMs                 表を作るのにかかった時間（ms。まだなら null）
 *   CubeSolver.solve(state, options)  state（54 要素またはキュービー表現）を揃える手順（例 "R U2 F' ..."。揃っていれば ''）。
 *                                     不正な状態なら Error（message は verify のコード）
 *       options.target     この手数以下の解が見つかったらすぐ返す（既定 21）
 *       options.maxNodes   探索した節点がこの数を超えたら、それまでに見つけた最短の解を返す（既定 1000 万。時間ではなく
 *                          節点数で打ち切るので、同じ入力なら必ず同じ解になる）
 *                          実測（node）: 既定で平均 約 12ms・最悪 約 160ms、手数は 22 以下（ほとんどが 20〜21）。
 *                          0 にすると最初に見つけた解を返す（平均 約 3ms、手数は 23 以下が目安）
 *       options.maxLength  最初の解を探すときの手数の上限（既定 24。見つからなければ自動で広げる）
 *       options.minPhase1  第 1 段階の手数の下限（既定 0）。第 2 段階だけで揃う状態（PLL など）で、U D と 180° だけの
 *                          手順を避けたいときに使う（tools/gen-scrambles.js）
 *   CubeSolver.lastStats              直前の solve の { nodes, length }
 *   CubeSolver.randomCubie(random)    一様ランダムな合法状態（キュービー表現）。random は 0 以上 1 未満を返す関数
 *                                     （省略時は crypto.getRandomValues、無ければ Math.random）
 *   CubeSolver.randomState(random)    同じく 54 要素の状態
 *   CubeSolver.fromState(state)       54 要素 → キュービー表現（読めなければ Error）
 *   CubeSolver.toState(cubie)         キュービー表現 → 54 要素
 *   CubeSolver.verify(cubie)          合法なら null。そうでなければ 'corner-perm' 'edge-perm' 'twist' 'flip' 'parity'
 *   CubeSolver.solvedCubie() / multiply(a, b)（a のあとに b） / inverse(a) / isSolved(cubie) / applyToCubie(cubie, alg)
 *   CubeSolver.invert(alg)            素の面回しの手順の逆手順（"R U2 F'" → "F U2 R'"）
 *   CubeSolver.simplify(alg)          同じ面の連続（向かい合う面をはさんだものも）をまとめる（"R L R" → "R2 L"）
 *   CubeSolver.rng(seed)              種を決めた乱数（mulberry32。テストとデータ生成用）
 *   CubeSolver.defaultRandom()        既定の乱数
 *
 * ブラウザでは window.CubeSolver、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CubeSolver = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FACES = 'URFDLB';
  const SUFFIX = ['', '2', "'"];

  // ---- ステッカーとピースの対応（54 要素の並びは js/cube-state.js と同じ = Kociemba の並び） ----
  // コーナーの位置ごとのステッカー（1 枚目が U / D 面、そこから時計回り）
  const CORNER_FACELET = [
    [8, 9, 20], // URF
    [6, 18, 38], // UFL
    [0, 36, 47], // ULB
    [2, 45, 11], // UBR
    [29, 26, 15], // DFR
    [27, 44, 24], // DLF
    [33, 53, 42], // DBL
    [35, 17, 51], // DRB
  ];
  const EDGE_FACELET = [
    [5, 10], // UR
    [7, 19], // UF
    [3, 37], // UL
    [1, 46], // UB
    [32, 16], // DR
    [28, 25], // DF
    [30, 43], // DL
    [34, 52], // DB
    [23, 12], // FR
    [21, 41], // FL
    [50, 39], // BL
    [48, 14], // BR
  ];
  const faceOf = (i) => FACES[(i / 9) | 0];
  const CORNER_COLOR = CORNER_FACELET.map((f) => f.map(faceOf));
  const EDGE_COLOR = EDGE_FACELET.map((f) => f.map(faceOf));

  // ---- キュービー表現 ----
  const solvedCubie = () => ({
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  });

  // a のあとに b を行った状態
  function multiply(a, b) {
    const c = { cp: [], co: [], ep: [], eo: [] };
    for (let i = 0; i < 8; i++) {
      c.cp[i] = a.cp[b.cp[i]];
      c.co[i] = (a.co[b.cp[i]] + b.co[i]) % 3;
    }
    for (let i = 0; i < 12; i++) {
      c.ep[i] = a.ep[b.ep[i]];
      c.eo[i] = (a.eo[b.ep[i]] + b.eo[i]) % 2;
    }
    return c;
  }

  function inverse(a) {
    const c = { cp: [], co: [], ep: [], eo: [] };
    for (let i = 0; i < 8; i++) {
      c.cp[a.cp[i]] = i;
      c.co[a.cp[i]] = (3 - a.co[i]) % 3;
    }
    for (let i = 0; i < 12; i++) {
      c.ep[a.ep[i]] = i;
      c.eo[a.ep[i]] = a.eo[i];
    }
    return c;
  }

  // 面を時計回りに 90° 回す操作（U, R, F, D, L, B）
  const BASE_MOVES = [
    { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2], ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0], ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
    { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0], ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0], ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1], ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
  ];
  // 18 通りの手（番号 = 面 * 3 + (回数 - 1)）
  const MOVE_CUBIE = [];
  BASE_MOVES.forEach((base) => {
    let c = solvedCubie();
    for (let p = 0; p < 3; p++) {
      c = multiply(c, base);
      MOVE_CUBIE.push(c);
    }
  });
  const moveName = (m) => FACES[(m / 3) | 0] + SUFFIX[m % 3];

  function permParity(p) {
    let s = 0;
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) s ^= 1;
    return s;
  }

  function isPerm(p, n) {
    if (!Array.isArray(p) || p.length !== n) return false;
    const seen = [];
    for (let i = 0; i < n; i++) {
      if (!Number.isInteger(p[i]) || p[i] < 0 || p[i] >= n || seen[p[i]]) return false;
      seen[p[i]] = true;
    }
    return true;
  }
  const isOri = (o, n, mod) => Array.isArray(o) && o.length === n && o.every((x) => Number.isInteger(x) && x >= 0 && x < mod);
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  function verify(c) {
    if (!c || !isPerm(c.cp, 8)) return 'corner-perm';
    if (!isPerm(c.ep, 12)) return 'edge-perm';
    if (!isOri(c.co, 8, 3) || sum(c.co) % 3 !== 0) return 'twist';
    if (!isOri(c.eo, 12, 2) || sum(c.eo) % 2 !== 0) return 'flip';
    if (permParity(c.cp) !== permParity(c.ep)) return 'parity';
    return null;
  }

  function isSolved(c) {
    for (let i = 0; i < 8; i++) if (c.cp[i] !== i || c.co[i] !== 0) return false;
    for (let i = 0; i < 12; i++) if (c.ep[i] !== i || c.eo[i] !== 0) return false;
    return true;
  }

  function fromState(state) {
    if (!state || state.length !== 54) throw new Error('state-length');
    for (let i = 0; i < 54; i++) if (typeof state[i] !== 'string' || state[i].length !== 1 || FACES.indexOf(state[i]) < 0) throw new Error('state-value');
    for (let f = 0; f < 6; f++) if (state[f * 9 + 4] !== FACES[f]) throw new Error('centers');
    const c = { cp: [], co: [], ep: [], eo: [] };
    for (let i = 0; i < 8; i++) {
      const fac = CORNER_FACELET[i];
      let ori = 0;
      while (ori < 3 && state[fac[ori]] !== 'U' && state[fac[ori]] !== 'D') ori++;
      if (ori === 3) throw new Error('corner-perm');
      const key = state[fac[ori]] + state[fac[(ori + 1) % 3]] + state[fac[(ori + 2) % 3]];
      const j = CORNER_COLOR.findIndex((col) => col.join('') === key);
      if (j < 0) throw new Error('corner-perm');
      c.cp[i] = j;
      c.co[i] = ori;
    }
    for (let i = 0; i < 12; i++) {
      const a = state[EDGE_FACELET[i][0]];
      const b = state[EDGE_FACELET[i][1]];
      let j = EDGE_COLOR.findIndex((col) => col[0] === a && col[1] === b);
      let ori = 0;
      if (j < 0) {
        j = EDGE_COLOR.findIndex((col) => col[0] === b && col[1] === a);
        ori = 1;
      }
      if (j < 0) throw new Error('edge-perm');
      c.ep[i] = j;
      c.eo[i] = ori;
    }
    return c;
  }

  function toState(c) {
    const state = new Array(54);
    for (let f = 0; f < 6; f++) state[f * 9 + 4] = FACES[f];
    for (let i = 0; i < 8; i++) for (let n = 0; n < 3; n++) state[CORNER_FACELET[i][(n + c.co[i]) % 3]] = CORNER_COLOR[c.cp[i]][n];
    for (let i = 0; i < 12; i++) for (let n = 0; n < 2; n++) state[EDGE_FACELET[i][(n + c.eo[i]) % 2]] = EDGE_COLOR[c.ep[i]][n];
    return state;
  }

  // ---- 手順（素の面回しだけ）の文字列 ----
  const MOVE_RE = /^([URFDLB])(2'?|'2?|)$/;
  function parse(alg) {
    return String(alg || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((tok) => {
        const m = MOVE_RE.exec(tok);
        if (!m) throw new SyntaxError('Invalid move: ' + JSON.stringify(tok));
        const pow = m[2] === '' ? 0 : m[2][0] === '2' || m[2] === "'2" ? 1 : 2;
        return FACES.indexOf(m[1]) * 3 + pow;
      });
  }
  const format = (moves) => moves.map(moveName).join(' ');

  function invert(alg) {
    return format(
      parse(alg)
        .reverse()
        .map((m) => m - (m % 3) + (2 - (m % 3)))
    );
  }

  // 同じ面の連続をまとめる。向かい合う面は入れ替えられるので、A B A（B は A の向かい）もまとめる
  function simplify(alg) {
    const out = []; // [面, 90°単位の回数]
    parse(alg).forEach((m) => {
      const face = (m / 3) | 0;
      const turns = (m % 3) + 1;
      let k = out.length - 1;
      if (k >= 0 && out[k][0] !== face && out[k][0] % 3 === face % 3) k--;
      if (k >= 0 && out[k][0] === face) {
        out[k][1] = (out[k][1] + turns) % 4;
        if (out[k][1] === 0) out.splice(k, 1);
      } else {
        out.push([face, turns]);
      }
    });
    return out.map((x) => FACES[x[0]] + SUFFIX[x[1] - 1]).join(' ');
  }

  function applyToCubie(cubie, alg) {
    return parse(alg).reduce((c, m) => multiply(c, MOVE_CUBIE[m]), cubie);
  }

  // ---- 乱数と random-state ----
  function defaultRandom() {
    const c = typeof crypto !== 'undefined' ? crypto : null;
    if (c && typeof c.getRandomValues === 'function') {
      const buf = new Uint32Array(1);
      c.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const randInt = (random, n) => Math.min(n - 1, Math.floor(random() * n));

  function shuffled(random, n) {
    const p = [];
    for (let i = 0; i < n; i++) p.push(i);
    for (let i = n - 1; i > 0; i--) {
      const j = randInt(random, i + 1);
      const t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    return p;
  }

  // 置換は一様に選び、パリティが合わなければエッジを 1 回入れ替える（どの合法状態も同じ確率になる）
  function randomCubie(random) {
    const rand = typeof random === 'function' ? random : defaultRandom;
    const c = { cp: shuffled(rand, 8), co: [], ep: shuffled(rand, 12), eo: [] };
    if (permParity(c.cp) !== permParity(c.ep)) {
      const t = c.ep[0];
      c.ep[0] = c.ep[1];
      c.ep[1] = t;
    }
    let s = 0;
    for (let i = 0; i < 7; i++) {
      c.co[i] = randInt(rand, 3);
      s += c.co[i];
    }
    c.co[7] = (3 - (s % 3)) % 3;
    s = 0;
    for (let i = 0; i < 11; i++) {
      c.eo[i] = randInt(rand, 2);
      s += c.eo[i];
    }
    c.eo[11] = s % 2;
    return c;
  }
  const randomState = (random) => toState(randomCubie(random));

  // ---- 座標 ----
  const N_TWIST = 2187; // 3^7
  const N_FLIP = 2048; // 2^11
  const N_SLICE = 495; // 12C4（中層の 4 エッジがどの位置にあるか）
  const N_PERM8 = 40320; // 8!
  const N_PERM4 = 24;
  const N_MOVE = 18;

  const CNK = [];
  for (let n = 0; n <= 12; n++) {
    CNK.push([]);
    for (let k = 0; k <= 4; k++) CNK[n][k] = k === 0 ? 1 : n === 0 ? 0 : CNK[n - 1][k - 1] + CNK[n - 1][k];
  }

  function twistOf(co) {
    let t = 0;
    for (let i = 0; i < 7; i++) t = t * 3 + co[i];
    return t;
  }
  function flipOf(eo) {
    let t = 0;
    for (let i = 0; i < 11; i++) t = t * 2 + eo[i];
    return t;
  }
  function sliceOf(ep) {
    let idx = 0;
    let k = 0;
    for (let i = 0; i < 12; i++) {
      if (ep[i] >= 8) {
        k++;
        idx += CNK[i][k];
      }
    }
    return idx;
  }
  // 置換 p[from .. from+n) を番号にする（base を引いた値の並びの辞書順）
  function permOf(p, from, n, base) {
    let idx = 0;
    for (let i = 0; i < n; i++) {
      let less = 0;
      const v = p[from + i];
      for (let j = i + 1; j < n; j++) if (p[from + j] < v) less++;
      idx = idx * (n - i) + less;
    }
    return idx;
  }
  function setPerm(p, from, n, base, idx) {
    const digits = [];
    for (let i = n - 1; i >= 0; i--) {
      digits[i] = idx % (n - i);
      idx = (idx / (n - i)) | 0;
    }
    const pool = [];
    for (let i = 0; i < n; i++) pool.push(base + i);
    for (let i = 0; i < n; i++) p[from + i] = pool.splice(digits[i], 1)[0];
  }

  // ---- 表（遅延して作る） ----
  let T = null;
  let initMs = null;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // 手ごとの座標の移動表。decode(番号, 作業用の配列) → apply(配列, 手, 出力) → encode(出力)
  function moveTable(size, Type, decode, apply, encode, len) {
    const table = new Type(size * N_MOVE);
    let a = new Array(len);
    let b = new Array(len);
    for (let i = 0; i < size; i++) {
      for (let f = 0; f < 6; f++) {
        decode(i, a);
        for (let p = 0; p < 3; p++) {
          apply(a, BASE_MOVES[f], b);
          const t = a;
          a = b;
          b = t;
          table[i * N_MOVE + f * 3 + p] = encode(a);
        }
      }
    }
    return table;
  }

  // 2 つの座標の組について、揃った状態までの手数の下限の表（幅優先）
  function pruneTable(sizeA, sizeB, tabA, tabB, moves, startA, startB) {
    const n = sizeA * sizeB;
    const table = new Int8Array(n).fill(-1);
    const queue = new Int32Array(n);
    let head = 0;
    let tail = 0;
    const start = startA * sizeB + startB;
    table[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const i = queue[head++];
      const a = ((i / sizeB) | 0) * N_MOVE;
      const b = (i % sizeB) * N_MOVE;
      const d = table[i] + 1;
      for (let k = 0; k < moves.length; k++) {
        const m = moves[k];
        const j = tabA[a + m] * sizeB + tabB[b + m];
        if (table[j] < 0) {
          table[j] = d;
          queue[tail++] = j;
        }
      }
    }
    return table;
  }

  const ALL_MOVES = [];
  for (let m = 0; m < N_MOVE; m++) ALL_MOVES.push(m);
  // 第 2 段階で使う手（U D は全部、ほかは 180° だけ）
  const PHASE2_MOVES = [0, 1, 2, 9, 10, 11, 4, 13, 7, 16];
  const IS_PHASE2_MOVE = ALL_MOVES.map((m) => PHASE2_MOVES.indexOf(m) >= 0);

  function init() {
    if (T) return initMs;
    const t0 = now();
    const cornerPerm = (a, mv, b) => {
      for (let i = 0; i < 8; i++) b[i] = a[mv.cp[i]];
    };
    const edgePerm = (a, mv, b) => {
      for (let i = 0; i < 12; i++) b[i] = a[mv.ep[i]];
    };
    const twistMove = moveTable(
      N_TWIST,
      Uint16Array,
      (idx, a) => {
        let s = 0;
        for (let i = 6; i >= 0; i--) {
          a[i] = idx % 3;
          s += a[i];
          idx = (idx / 3) | 0;
        }
        a[7] = (3 - (s % 3)) % 3;
      },
      (a, mv, b) => {
        for (let i = 0; i < 8; i++) b[i] = (a[mv.cp[i]] + mv.co[i]) % 3;
      },
      twistOf,
      8
    );
    const flipMove = moveTable(
      N_FLIP,
      Uint16Array,
      (idx, a) => {
        let s = 0;
        for (let i = 10; i >= 0; i--) {
          a[i] = idx & 1;
          s ^= a[i];
          idx >>= 1;
        }
        a[11] = s;
      },
      (a, mv, b) => {
        for (let i = 0; i < 12; i++) b[i] = a[mv.ep[i]] ^ mv.eo[i];
      },
      flipOf,
      12
    );
    const sliceMove = moveTable(
      N_SLICE,
      Uint16Array,
      (idx, a) => {
        let k = 4;
        for (let i = 11; i >= 0; i--) {
          if (k > 0 && CNK[i][k] <= idx) {
            idx -= CNK[i][k];
            k--;
            a[i] = 8;
          } else {
            a[i] = 0;
          }
        }
      },
      edgePerm,
      sliceOf,
      12
    );
    const cpMove = moveTable(N_PERM8, Uint16Array, (idx, a) => setPerm(a, 0, 8, 0, idx), cornerPerm, (a) => permOf(a, 0, 8, 0), 8);
    // 第 2 段階のエッジ（上下の 8 個と中層の 4 個）。第 2 段階で使わない手の欄は使わない
    const epMove = moveTable(
      N_PERM8,
      Uint16Array,
      (idx, a) => {
        setPerm(a, 0, 8, 0, idx);
        for (let i = 8; i < 12; i++) a[i] = i;
      },
      edgePerm,
      (a) => permOf(a, 0, 8, 0),
      12
    );
    const spMove = moveTable(
      N_PERM4,
      Uint8Array,
      (idx, a) => {
        for (let i = 0; i < 8; i++) a[i] = i;
        setPerm(a, 8, 4, 8, idx);
      },
      edgePerm,
      (a) => permOf(a, 8, 4, 8),
      12
    );
    const sliceSolved = sliceOf(solvedCubie().ep);
    T = {
      twistMove: twistMove,
      flipMove: flipMove,
      sliceMove: sliceMove,
      cpMove: cpMove,
      epMove: epMove,
      spMove: spMove,
      sliceSolved: sliceSolved,
      twistSlice: pruneTable(N_TWIST, N_SLICE, twistMove, sliceMove, ALL_MOVES, 0, sliceSolved),
      flipSlice: pruneTable(N_FLIP, N_SLICE, flipMove, sliceMove, ALL_MOVES, 0, sliceSolved),
      cpSp: pruneTable(N_PERM8, N_PERM4, cpMove, spMove, PHASE2_MOVES, 0, 0),
      epSp: pruneTable(N_PERM8, N_PERM4, epMove, spMove, PHASE2_MOVES, 0, 0),
    };
    initMs = now() - t0;
    api.initMs = initMs;
    return initMs;
  }

  // ---- 探索 ----
  const PHASE2_CAP = 11; // 第 2 段階の手数の上限（これより長い第 2 段階は探さず、第 1 段階の別の解に進む）
  const HARD_LIMIT = 31;

  function solveCubie(start, options) {
    const opts = options || {};
    const target = opts.target === undefined ? 21 : opts.target;
    const maxNodes = opts.maxNodes === undefined ? 10000000 : opts.maxNodes;
    let limit = opts.maxLength === undefined ? 24 : opts.maxLength;
    init();
    const { twistMove, flipMove, sliceMove, cpMove, epMove, spMove, twistSlice, flipSlice, cpSp, epSp, sliceSolved } = T;

    const path = new Int8Array(HARD_LIMIT + PHASE2_CAP + 1);
    let best = null;
    let nodes = 0;
    let stop = false;
    let cpA = new Array(8);
    let cpB = new Array(8);
    let epA = new Array(12);
    let epB = new Array(12);

    function phase2(cp, ep, sp, togo, last, depth) {
      if (togo === 0) return true;
      for (let face = 0; face < 6; face++) {
        if (face === last || face + 3 === last) continue;
        const quarter = face % 3 === 0;
        for (let pow = quarter ? 0 : 1; pow < (quarter ? 3 : 2); pow++) {
          const m = face * 3 + pow;
          const cp2 = cpMove[cp * N_MOVE + m];
          const ep2 = epMove[ep * N_MOVE + m];
          const sp2 = spMove[sp * N_MOVE + m];
          nodes++;
          if (cpSp[cp2 * N_PERM4 + sp2] >= togo || epSp[ep2 * N_PERM4 + sp2] >= togo) continue;
          path[depth] = m;
          if (phase2(cp2, ep2, sp2, togo - 1, face, depth + 1)) return true;
        }
      }
      return false;
    }

    // 第 1 段階の解（path[0..d1)）から第 2 段階を探す。target 以下の解が見つかったら true
    function tryPhase2(d1, last) {
      const max2 = Math.min(limit - d1, PHASE2_CAP);
      if (max2 < 0) return false;
      for (let i = 0; i < 8; i++) cpA[i] = start.cp[i];
      for (let i = 0; i < 12; i++) epA[i] = start.ep[i];
      for (let k = 0; k < d1; k++) {
        const mv = MOVE_CUBIE[path[k]];
        for (let i = 0; i < 8; i++) cpB[i] = cpA[mv.cp[i]];
        for (let i = 0; i < 12; i++) epB[i] = epA[mv.ep[i]];
        let t = cpA;
        cpA = cpB;
        cpB = t;
        t = epA;
        epA = epB;
        epB = t;
      }
      const cp = permOf(cpA, 0, 8, 0);
      const ep = permOf(epA, 0, 8, 0);
      const sp = permOf(epA, 8, 4, 8);
      const h = Math.max(cpSp[cp * N_PERM4 + sp], epSp[ep * N_PERM4 + sp]);
      for (let d2 = h; d2 <= max2; d2++) {
        if (phase2(cp, ep, sp, d2, last, d1)) {
          best = Array.prototype.slice.call(path, 0, d1 + d2);
          limit = best.length - 1;
          return best.length <= target;
        }
      }
      return false;
    }

    function phase1(tw, fl, sl, togo, last, depth) {
      if (togo === 0) {
        // 第 2 段階の手で終わる解は、もっと短い第 1 段階の解として調べてある
        if (depth > 0 && IS_PHASE2_MOVE[path[depth - 1]]) return false;
        return tryPhase2(depth, last);
      }
      for (let face = 0; face < 6; face++) {
        if (face === last || face + 3 === last) continue;
        for (let pow = 0; pow < 3; pow++) {
          const m = face * 3 + pow;
          const tw2 = twistMove[tw * N_MOVE + m];
          const fl2 = flipMove[fl * N_MOVE + m];
          const sl2 = sliceMove[sl * N_MOVE + m];
          nodes++;
          if (twistSlice[tw2 * N_SLICE + sl2] >= togo || flipSlice[fl2 * N_SLICE + sl2] >= togo) continue;
          path[depth] = m;
          if (phase1(tw2, fl2, sl2, togo - 1, face, depth + 1)) return true;
          if (best && nodes > maxNodes) {
            stop = true;
            return true;
          }
        }
      }
      return false;
    }

    const tw = twistOf(start.co);
    const fl = flipOf(start.eo);
    const sl = sliceOf(start.ep);
    const h1 = Math.max(twistSlice[tw * N_SLICE + sl], flipSlice[fl * N_SLICE + sl]);
    for (let d1 = Math.max(h1, opts.minPhase1 || 0); ; d1++) {
      if (d1 > limit) {
        if (best) break;
        limit = HARD_LIMIT; // 上限が厳しすぎて見つからなかった：広げて続ける
      }
      if (d1 > HARD_LIMIT) break;
      if (phase1(tw, fl, sl, d1, -1, 0) || stop) break;
    }
    api.lastStats = { nodes: nodes, length: best ? best.length : -1 };
    if (!best) throw new Error('no-solution');
    return best;
  }

  function solve(state, options) {
    const cubie = Array.isArray(state) || (state && state.length === 54) ? fromState(state) : state;
    const err = verify(cubie);
    if (err) throw new Error(err);
    if (isSolved(cubie)) {
      api.lastStats = { nodes: 0, length: 0 };
      return '';
    }
    return format(solveCubie(cubie, options));
  }

  const api = {
    init: init,
    initMs: null,
    lastStats: null,
    solve: solve,
    randomCubie: randomCubie,
    randomState: randomState,
    fromState: fromState,
    toState: toState,
    verify: verify,
    solvedCubie: solvedCubie,
    multiply: multiply,
    inverse: inverse,
    isSolved: isSolved,
    applyToCubie: applyToCubie,
    invert: invert,
    simplify: simplify,
    rng: rng,
    defaultRandom: defaultRandom,
  };
  return api;
});
