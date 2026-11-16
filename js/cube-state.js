/*
 * 3x3x3 キューブの状態計算（DOM非依存）
 *
 * 回転記号の列から 54 ステッカーの状態を求め、画像用の色（上面9枚＋側面上段12枚、または全54枚）に変換する。
 * 参考実装: library/srVisualizer.min.js（VisualCube TS）の simulation.ts。ステッカーの並びはこれと同じにしてある
 * （test/cube-state.test.js でランダムな手順の結果を突き合わせている）。
 *
 * 記法:
 *   X   = 面Xを外側から見て時計回りに90°   (X = U D L R F B)
 *   X'  = 反時計回り90°,  X2 = 180°（X2' ・X'2 も可）
 *   u d l r f b / Uw Dw Lw Rw Fw Bw = 2層回し（Rw は r に書き直す）
 *   M E S = 中層（M は L と、E は D と、S は F と同じ向き）
 *   x y z = 全体の持ち替え（x は R と、y は U と、z は F と同じ向き）
 *   ( ... )  = グループ。直後に回数（例: (R U R' U')2）や ' （逆手順）を付けられる
 *   全角アポストロフィ ’ や全角括弧（）、区切りのカンマも可
 *   大文字・小文字は区別する（R と r は別の回し方）
 *
 * 状態は長さ 54 の配列。並びは面 U, R, F, D, L, B の順に 9 枚ずつで、各面は外側から見て左上から右へ・上から下へ
 * （U は B を上に、D は F を上にして見る。R・F・L・B は U を上にして見る）。値はその位置にある色の面名。
 *
 * ブラウザでは window.CubeState、node では module.exports として公開する。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CubeState = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- 幾何 ----
  // 座標は x = 右（R）、y = 上（U）、z = 手前（F）。各面の n = 外向きの法線、r = 面を見たときの右、d = 下
  const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
  const FRAME = {
    U: { n: [0, 1, 0], r: [1, 0, 0], d: [0, 0, 1] },
    R: { n: [1, 0, 0], r: [0, 0, -1], d: [0, -1, 0] },
    F: { n: [0, 0, 1], r: [1, 0, 0], d: [0, -1, 0] },
    D: { n: [0, -1, 0], r: [1, 0, 0], d: [0, 0, -1] },
    L: { n: [-1, 0, 0], r: [0, 0, 1], d: [0, -1, 0] },
    B: { n: [0, 0, -1], r: [-1, 0, 0], d: [0, -1, 0] },
  };

  // ステッカー = { face, cubie: そのピースの位置（-1..1）, normal: 向いている方向 }
  const STICKERS = [];
  FACES.forEach((face) => {
    const f = FRAME[face];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        STICKERS.push({
          face: face,
          cubie: [0, 1, 2].map((i) => f.n[i] + f.r[i] * (col - 1) + f.d[i] * (row - 1)),
          normal: f.n,
        });
      }
    }
  });
  const keyOf = (cubie, normal) => cubie.join(',') + '|' + normal.join(',');
  const LOOKUP = {};
  STICKERS.forEach((s, i) => {
    LOOKUP[keyOf(s.cubie, s.normal)] = i;
  });

  // 軸の正の側から見て時計回りに 90°
  const ROTATE = {
    x: (v) => [v[0], v[2], -v[1]],
    y: (v) => [-v[2], v[1], v[0]],
    z: (v) => [v[1], -v[0], v[2]],
  };
  const AXIS_INDEX = { x: 0, y: 1, z: 2 };

  // 記号 → [軸, 回す層（軸に沿った座標）, 向き（1 = 軸の正の側から見て時計回り、-1 = 負の側から見て時計回り）]
  const ALL = [-1, 0, 1];
  const MOVE_DEFS = {
    U: ['y', [1], 1],
    D: ['y', [-1], -1],
    R: ['x', [1], 1],
    L: ['x', [-1], -1],
    F: ['z', [1], 1],
    B: ['z', [-1], -1],
    u: ['y', [1, 0], 1],
    d: ['y', [-1, 0], -1],
    r: ['x', [1, 0], 1],
    l: ['x', [-1, 0], -1],
    f: ['z', [1, 0], 1],
    b: ['z', [-1, 0], -1],
    M: ['x', [0], -1],
    E: ['y', [0], -1],
    S: ['z', [0], 1],
    x: ['x', ALL, 1],
    y: ['y', ALL, 1],
    z: ['z', ALL, 1],
  };

  // 時計回り90°（記号どおりの向き）の置換 perm[元の位置] = 移動先
  function makeMove(def) {
    const axis = def[0];
    const layers = def[1];
    const quarter = (i) => {
      const s = STICKERS[i];
      if (!layers.includes(s.cubie[AXIS_INDEX[axis]])) return i;
      return LOOKUP[keyOf(ROTATE[axis](s.cubie), ROTATE[axis](s.normal))];
    };
    const times = def[2] === 1 ? 1 : 3;
    return STICKERS.map((_, i) => {
      let to = i;
      for (let t = 0; t < times; t++) to = quarter(to);
      return to;
    });
  }

  const MOVES = {};
  Object.keys(MOVE_DEFS).forEach((name) => {
    MOVES[name] = makeMove(MOVE_DEFS[name]);
  });

  // ---- 記号の解析 ----
  // Rw のような2文字の記号から先に試す
  const FACE_PATTERN = '[UDLRFB]w|[UDLRFBudlrfbMESxyz]';
  const FACE_RE = new RegExp(FACE_PATTERN, 'y');
  // 読んだ記号 → 状態計算で使う記号（Rw → r）
  const canonicalFace = (text) => (text.length === 2 ? text[0].toLowerCase() : text);
  const AMOUNT_RE = /(\d*)(')?(\d*)/y;
  const SUFFIX = ['', '', '2', "'"]; // 90°単位の回数 → 記号の付け方

  function normalize(alg) {
    return String(alg)
      .replace(/[’‘′`´]/g, "'")
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/[\s　,、]+/g, ' ');
  }

  /** 表記を整えた手順（全角の記号を半角に、区切りを空白1つに、Rw を r に。空白・括弧・回数はそのまま） */
  function canonicalAlg(alg) {
    return normalize(alg).replace(/([UDLRFB])w/g, (m, face) => face.toLowerCase());
  }

  function invertMoves(moves) {
    return moves
      .slice()
      .reverse()
      .map((m) => ({ face: m.face, turns: (4 - m.turns) % 4 }));
  }

  // 回数と ' を読む。戻り値 { n, prime, end }。start は記号の先頭（エラー表示用）
  function readAmount(src, pos, start) {
    AMOUNT_RE.lastIndex = pos;
    const m = AMOUNT_RE.exec(src);
    if (m[1] && m[3]) throw new SyntaxError('Invalid move: ' + JSON.stringify(src.slice(start, pos + m[0].length)));
    const digits = m[1] || m[3];
    return { n: digits ? parseInt(digits, 10) : 1, prime: !!m[2], end: pos + m[0].length };
  }

  /** 手順文字列を [{face, turns}] に変換する（turns は時計回り90°単位で 0..3。face は U・r・M・x など） */
  function parseAlg(alg) {
    const src = normalize(alg);
    let pos = 0;

    function seq(depth) {
      let out = [];
      for (;;) {
        while (src[pos] === ' ') pos++;
        if (pos >= src.length) {
          if (depth > 0) throw new SyntaxError('Missing closing parenthesis');
          return out;
        }
        const ch = src[pos];
        if (ch === ')') {
          if (depth === 0) throw new SyntaxError('Unmatched ")"');
          pos++;
          return out;
        }
        if (ch === '(') {
          const start = pos;
          pos++;
          const inner = seq(depth + 1);
          const a = readAmount(src, pos, start);
          pos = a.end;
          let group = [];
          for (let i = 0; i < a.n; i++) group = group.concat(inner);
          out = out.concat(a.prime ? invertMoves(group) : group);
          continue;
        }
        FACE_RE.lastIndex = pos;
        const fm = FACE_RE.exec(src);
        if (!fm) {
          const rest = src.slice(pos).split(' ')[0];
          throw new SyntaxError('Invalid move: ' + JSON.stringify(rest));
        }
        const a = readAmount(src, pos + fm[0].length, pos);
        pos = a.end;
        const n = a.prime ? -a.n : a.n;
        out.push({ face: canonicalFace(fm[0]), turns: ((n % 4) + 4) % 4 });
      }
    }

    return seq(0);
  }

  /** [{face, turns}] を括弧の無い手順文字列にする（回数 0 の記号は省く）。例: [{R,1},{U,3},{r,2}] → "R U' r2" */
  function stringify(moves) {
    return moves
      .filter((m) => m.turns !== 0)
      .map((m) => m.face + SUFFIX[m.turns])
      .join(' ');
  }

  // ---- 状態 ----
  /** 揃った状態（各位置の色 = 初期の面名） */
  function solved() {
    return STICKERS.map((s) => s.face);
  }

  function applyMoves(state, moves) {
    let st = state.slice();
    moves.forEach((m) => {
      const perm = MOVES[m.face];
      for (let t = 0; t < m.turns; t++) {
        const next = st.slice();
        for (let i = 0; i < perm.length; i++) next[perm[i]] = st[i];
        st = next;
      }
    });
    return st;
  }

  // ---- 持ち替えの打ち消し ----
  // センター6枚の並び → その向きにする持ち替えの手順（24 通り）
  const CENTERS = FACES.map((_, i) => i * 9 + 4);
  const centersOf = (state) => CENTERS.map((i) => state[i]).join('');
  const ORIENTATIONS = {};
  (function () {
    const queue = [[]];
    ORIENTATIONS[centersOf(solved())] = [];
    while (queue.length) {
      const moves = queue.shift();
      ['x', 'y', 'z'].forEach((face) => {
        const next = moves.concat([{ face: face, turns: 1 }]);
        const key = centersOf(applyMoves(solved(), next));
        if (key in ORIENTATIONS) return;
        ORIENTATIONS[key] = next;
        queue.push(next);
      });
    }
  })();

  /** 手順でセンターが動いたぶん（持ち替え・2層回し・中層回しの合計）を元に戻す持ち替えの手順 */
  function rotationFix(moves) {
    return invertMoves(ORIENTATIONS[centersOf(applyMoves(solved(), moves))]);
  }

  // applyAlg・flatten で実際に回す手順
  function resolve(alg, opts) {
    let moves = parseAlg(alg);
    if (opts.inverse) moves = invertMoves(moves);
    if (opts.cancelRotation) {
      const fix = rotationFix(moves);
      // 逆手順は「持ち替えを戻してから」、通常の手順は「最後に」打ち消す
      moves = opts.inverse ? fix.concat(moves) : moves.concat(fix);
    }
    return moves;
  }

  /**
   * 手順を適用した状態を返す。
   * options.inverse: true なら逆手順を適用（＝その手順で解けるケースの状態）
   * options.state:   開始状態（省略時は揃った状態）
   * options.cancelRotation: true なら手順でセンターが動いたぶん（x y z・2層回し・M E S の合計）を打ち消し、
   *   センターが元の位置にある状態を返す。手順の最後に持ち替えを書かなくても、完成後の向きの違いを気にせず扱える
   */
  function applyAlg(alg, options) {
    const opts = options || {};
    return applyMoves(opts.state || solved(), resolve(alg, opts));
  }

  /**
   * 括弧と繰り返しを展開した手順文字列を返す（options.inverse・cancelRotation は applyAlg と同じ）。
   * 括弧を読めない描画ライブラリ（srVisualizer）に渡すために使う。例: flatten("(R U)2 Rw'") → "R U R U r'"
   */
  function flatten(alg, options) {
    return stringify(resolve(alg, options || {}));
  }

  // ---- 色 ----
  // エディタ（js/main.js）の初期の配色と同じ
  const DEFAULT_SCHEME = {
    U: '#fefe00',
    R: '#ee0000',
    F: '#0000f2',
    D: '#ffffff',
    L: '#ffa100',
    B: '#00d800',
  };
  const OLL_GRAY = '#404040'; // srVisualizer の DarkGray（Mask Color の既定）と同じ

  /** OLL用マスク：U面の色だけ残し、他は gray にする */
  function ollMask(scheme, gray) {
    const base = scheme || DEFAULT_SCHEME;
    const g = gray || OLL_GRAY;
    const out = {};
    FACES.forEach((f) => {
      out[f] = f === 'U' ? base.U : g;
    });
    return out;
  }

  const colorOf = (scheme) => (face) => {
    if (!(face in scheme)) throw new Error('No color set for face: ' + face);
    return scheme[face];
  };

  /** 状態を 54 枚の色にする（並びは状態と同じ。srVisualizer の stickerColors にそのまま渡せる） */
  function toStickerColors(state, faceColors) {
    return state.map(colorOf(faceColors || DEFAULT_SCHEME));
  }

  // 側面上段を上から見て時計回りに（B の左端 = U の左上の隣から、B → R → F → L）
  const SIDE_RING = [];
  ['B', 'R', 'F', 'L'].forEach((face) => {
    const base = FACES.indexOf(face) * 9;
    [2, 1, 0].forEach((col) => SIDE_RING.push(base + col));
  });

  /**
   * 状態を上面図用の色に変換する。
   *   ucolor[0..8]   : U 面（B を上にして左上から右へ・上から下へ）
   *   scolor[0..11]  : 側面の上段を上から見て時計回りに。scolor[0..2] = B（U の上の辺の左→右）、
   *                    [3..5] = R（右の辺の上→下）、[6..8] = F（下の辺の右→左）、[9..11] = L（左の辺の下→上）
   */
  function toImageColors(state, faceColors) {
    const color = colorOf(faceColors || DEFAULT_SCHEME);
    return {
      ucolor: state.slice(0, 9).map(color),
      scolor: SIDE_RING.map((i) => color(state[i])),
    };
  }

  return {
    FACES: FACES,
    DEFAULT_SCHEME: DEFAULT_SCHEME,
    OLL_GRAY: OLL_GRAY,
    AUFS: ['', 'U', 'U2', "U'"],
    solved: solved,
    parseAlg: parseAlg,
    canonicalAlg: canonicalAlg,
    stringify: stringify,
    flatten: flatten,
    invertMoves: invertMoves,
    applyMoves: applyMoves,
    applyAlg: applyAlg,
    toStickerColors: toStickerColors,
    toImageColors: toImageColors,
    ollMask: ollMask,
  };
});
