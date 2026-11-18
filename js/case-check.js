/*
 * PLL・OLL・COLL の手順の確認（DOM非依存）。生成スクリプト（tools/build-*-data.js）とエディタの「自分の手順」で使う。
 *
 *   convert(alg)            記法を読み替える（3x3 では読み替えは無く、そのまま返す。移植元と同じ呼び方を保つために残している）
 *   check(set, a, s)        a（解く手順）と s（そのケースになる手順）を確認し、問題があればコード、無ければ null
 *                             'trailing-y'    a の最後に、向きを元に戻すためではない持ち替え（x y z）がある
 *                                             （x … x' のように手順全体でセンターが元の位置に戻るなら、最後の持ち替えは書いてよい）
 *                             'trailing-auf'  a の最後に AUF がある
 *                             'setup-f2l'     （OLL）s が最後の層以外を崩す（COLL）s が最後の層以外を崩すか、上面のエッジが向いていない
 *                             'not-solved'    a で s のケースが揃わない（PLL: 最後の AUF を除いて揃わない / OLL: 上面が揃わない /
 *                                             COLL: 上面の向きとコーナーの位置が、最後の AUF を除いて揃わない。エッジの位置は問わない）
 *                             'mismatch'      a の case 表示と s の apply 表示が違う（OLL は上面の向きだけ、COLL は図に見える部分
 *                                             ＝上面と側面のコーナーのステッカーだけを比べる）
 *   fitSetup(set, a, s)     a の最後の AUF・持ち替えを外し、s の前後の AUF を付け直して check を通る { a, s } を返す（無ければ null）
 *                             PLL・COLL は s の前後の AUF を 4×4 通り試し、付ける AUF が少ない → s の前に付けない を優先する。
 *                             OLL は s の前の AUF が上面の向きに影響しないので、最後の AUF だけを試す
 *   stripEnd(set, a)        a の最後の AUF・持ち替え（x y z）を外す（OLL では括弧の無い U も最後の AUF とみなす）。
 *                             向きを元に戻すための持ち替え（手順全体でセンターが元の位置に戻る）は外さない
 *   findCase(set, a, data)  a で揃うケース（data の要素）を探す（無ければ null）
 *
 * a・s は読み替え済み（convert 後）の手順。set は 'pll' / 'oll' / 'coll' / 'zbll'（ZBLL は PLL と同じ確認）。
 * 手順中の持ち替え・2層回し・中層回しで完成後の向きが変わっても揃ったとみなす（cancelRotation）。
 * s（そのケースになる手順）はセンターを動かさないこと（動かすと mismatch になる）。
 * ブラウザでは window.CaseCheck、node では module.exports として公開する。cube-state.js が必要。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cube-state.js'));
  } else {
    root.CaseCheck = factory(root.CubeState);
  }
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  // 90°単位の回数 → 記号の付け方
  const AMOUNT = ['', '', '2', "'"];
  const TURNS = [0, 1, 2, 3];
  const turn = (face, n) => (n === 0 ? '' : face + AMOUNT[n]);
  const auf = (n) => (n === 0 ? '' : '(' + turn('U', n) + ')');

  const convert = (alg) => alg;
  const join = (...parts) => parts.filter(Boolean).join(' ');
  const same = (a, b) => a.every((x, i) => x === b[i]);

  const LEADING_AUF = /^(\s*\(U[0-9']*\))+\s*/;
  const ROTATION_END = /(^|\s+)[xyz][0-9']*\s*$/;
  // PLL の最後の AUF は括弧付きのものだけを見る。OLL では最後の U は向きに影響しないので括弧の無い U も含める
  const TRAILING_AUF = {
    pll: /(\s*\(U[0-9']*\))+\s*$/,
    oll: /(\s*\(U[0-9']*\)|\s+U[0-9']*)+\s*$/,
  };
  TRAILING_AUF.coll = TRAILING_AUF.pll; // COLL は最後の U でコーナーの位置が変わるので、PLL と同じく括弧付きのものだけを見る
  TRAILING_AUF.zbll = TRAILING_AUF.pll; // ZBLL は PLL と同じ確認（状態をまるごと比べる。check・fitSetup・caseKey も PLL の経路）

  // ---- OLL 用：最後の層（U層）と上面の向き ----
  const SOLVED = M.solved();
  const INDEX = SOLVED.map((_, i) => i);
  const MOVED_BY_U = M.applyMoves(INDEX, M.parseAlg('U'));
  const LAST_LAYER = new Set(INDEX.filter((i) => MOVED_BY_U[i] !== i || SOLVED[i] === 'U'));
  const f2lSolved = (state) => state.every((x, i) => LAST_LAYER.has(i) || x === SOLVED[i]);
  const MASK = M.ollMask(M.DEFAULT_SCHEME);
  // 上面の向き（OLL配色での画像の色）
  const pattern = (state) => {
    const c = M.toImageColors(state, MASK);
    return c.ucolor.join('') + '|' + c.scolor.join('');
  };
  const oriented = (state) => M.toImageColors(state, MASK).ucolor.every((x) => x === MASK.U);

  // ---- COLL 用：図に見える部分（sr-visualizer の coll マスク）＝上面 9 枚と側面のコーナーのステッカー ----
  // 側面のエッジのステッカー（側面上段の真ん中）は比べない（COLL はエッジの位置を揃えない）
  const IDENTITY = {};
  M.FACES.forEach((f) => (IDENTITY[f] = f));
  const collPattern = (state) => {
    const c = M.toImageColors(state, IDENTITY);
    return c.ucolor.join('') + '|' + c.scolor.map((x, i) => (i % 3 === 1 ? '-' : x)).join('');
  };
  const SOLVED_COLL = collPattern(SOLVED);
  const edgesOriented = (state) => [1, 3, 5, 7].every((i) => state[i] === SOLVED[i]); // 上面のエッジ（U の 1・3・5・7）
  // 最後の持ち替えのうち、向きを元に戻すためのもの（x … x' など。手順全体でセンターが元の位置に戻る）は残してよい。
  // それ以外（回し終わったあとに持ち替えるだけ）は意味が無いので、最後の AUF と同じく書かない
  const CENTERS = INDEX.filter((i) => i % 9 === 4);
  function keepsOrientation(a) {
    try {
      const st = M.applyAlg(a);
      return CENTERS.every((i) => st[i] === SOLVED[i]);
    } catch (e) {
      return false;
    }
  }
  const hasTrailingRotation = (a) => ROTATION_END.test(a) && !keepsOrientation(a);

  function checkPll(a, s) {
    if (hasTrailingRotation(a)) return 'trailing-y';
    if (TRAILING_AUF.pll.test(a)) return 'trailing-auf';
    const end = M.applyAlg(a, { state: M.applyAlg(s), cancelRotation: true });
    if (!TURNS.some((n) => same(M.applyAlg(turn('U', n), { state: end }), SOLVED))) return 'not-solved';
    if (!same(M.applyAlg(a, { inverse: true, cancelRotation: true }), M.applyAlg(s))) return 'mismatch';
    return null;
  }

  function checkOll(a, s) {
    if (hasTrailingRotation(a)) return 'trailing-y';
    if (TRAILING_AUF.oll.test(a)) return 'trailing-auf';
    const caseState = M.applyAlg(s);
    if (!f2lSolved(caseState)) return 'setup-f2l';
    const end = M.applyAlg(a, { state: caseState, cancelRotation: true });
    if (!f2lSolved(end) || !oriented(end)) return 'not-solved';
    if (pattern(M.applyAlg(a, { inverse: true, cancelRotation: true })) !== pattern(caseState)) return 'mismatch';
    return null;
  }

  function checkColl(a, s) {
    if (hasTrailingRotation(a)) return 'trailing-y';
    if (TRAILING_AUF.coll.test(a)) return 'trailing-auf';
    const caseState = M.applyAlg(s);
    if (!f2lSolved(caseState) || !edgesOriented(caseState)) return 'setup-f2l';
    const end = M.applyAlg(a, { state: caseState, cancelRotation: true });
    if (!f2lSolved(end)) return 'not-solved';
    if (!TURNS.some((n) => collPattern(M.applyAlg(turn('U', n), { state: end })) === SOLVED_COLL)) return 'not-solved';
    if (collPattern(M.applyAlg(a, { inverse: true, cancelRotation: true })) !== collPattern(caseState)) return 'mismatch';
    return null;
  }

  const check = (set, a, s) => (set === 'oll' ? checkOll(a, s) : set === 'coll' ? checkColl(a, s) : checkPll(a, s));

  function stripEnd(set, a) {
    let out = a;
    for (;;) {
      let next = out;
      if (TRAILING_AUF[set].test(out)) next = out.replace(TRAILING_AUF[set], '');
      else if (hasTrailingRotation(out)) next = out.replace(ROTATION_END, '');
      if (next === out) return out;
      out = next;
    }
  }

  function fitSetup(set, a, s) {
    const a2 = stripEnd(set, a);
    const ok = (s2) => {
      try {
        return !check(set, convert(a2), convert(s2));
      } catch (e) {
        return false;
      }
    };
    if (set === 'oll') {
      const sBody = s.replace(TRAILING_AUF.oll, '');
      for (let post = 0; post < TURNS.length; post++) {
        const s2 = join(sBody, auf(post));
        if (ok(s2)) return { a: a2, s: s2 };
      }
      return null;
    }
    const sBody = s.replace(LEADING_AUF, '').replace(TRAILING_AUF.pll, '');
    const candidates = [];
    for (let pre = 0; pre < TURNS.length; pre++) {
      for (let post = 0; post < TURNS.length; post++) {
        const s2 = join(auf(pre), sBody, auf(post));
        if (ok(s2)) candidates.push({ a: a2, s: s2, cost: [(pre > 0) + (post > 0), pre > 0] });
      }
    }
    candidates.sort((x, y) => x.cost[0] - y.cost[0] || x.cost[1] - y.cost[1]);
    return candidates.length ? { a: candidates[0].a, s: candidates[0].s } : null;
  }

  // AUF の違いを除いたケースの見分け用のキー。手順 alg（options は applyAlg と同じ）の前後に AUF を付けた状態のうち、
  // PLL は状態そのもの、OLL は上面の向き（前の AUF は影響しないので最後の AUF だけ）、COLL は図に見える部分の最小をとる
  const AUFS = M.AUFS;
  function caseKey(set, alg, options) {
    let best = null;
    (set === 'oll' ? [''] : AUFS).forEach((pre) => {
      const st = M.applyAlg(alg, Object.assign({}, options, { state: M.applyAlg(pre) }));
      AUFS.forEach((post) => {
        const end = M.applyAlg(post, { state: st });
        const k = set === 'oll' ? pattern(end) : set === 'coll' ? collPattern(end) : end.join();
        if (best === null || k < best) best = k;
      });
    });
    return best;
  }

  const keyCache = new WeakMap();
  function findCase(set, a, data) {
    let keys = keyCache.get(data);
    if (!keys) {
      keys = data.map((c) => caseKey(set, convert(c.setup)));
      keyCache.set(data, keys);
    }
    let target;
    try {
      // 解く手順の逆＝そのケースの状態（先に AUF を回した状態から始めると、ケースの前に AUF を付けたものになる）
      target = caseKey(set, convert(a), { inverse: true, cancelRotation: true });
    } catch (e) {
      return null;
    }
    return data.find((c, i) => keys[i] === target && fitSetup(set, a, c.setup)) || null;
  }

  return {
    convert: convert,
    check: check,
    fitSetup: fitSetup,
    stripEnd: stripEnd,
    findCase: findCase,
  };
});
