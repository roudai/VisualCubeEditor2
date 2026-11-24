/*
 * 自分の手順（PLL・OLL）。エディタの「My algorithm」で保存し、エディタ・一覧ページ・一括ダウンロードで使う。
 * 仕様: reference/PLL_SPEC.md「自分の手順」
 *
 *   validate(set, c, input, data) 入力した手順がケース c（既定データの要素）を解けるか確かめ、
 *                                 { ok: true, alg, setup, notes }（既定と同じ手順なら isDefault: true）または
 *                                 { ok: false, code, params, error } を返す
 *                                   （error は英語の文。画面では code・params を i18n.js で訳す。notes は 'stripped' など）
 *                                   - 表記を整え（全角の記号を半角に、Rw → r など）、無駄な手順をまとめ（R R' は消し、R R は R2 に。CubeState.simplifyAlg）、
 *                                     最後の AUF・持ち替え（x y z）は外す（どちらも notes で知らせる：'simplified'・'stripped'）
 *                                   - setup は既定の setup の前後に AUF を付け直したもの（js/case-check.js の fitSetup）
 *                                   - 解けなければ、実際に解けるケースを data から探してエラーに添える
 *   get(set, name) / save(set, name, { alg, setup }) / reset(set, name)   localStorage の読み書き
 *   merged(set, data)             既定データに自分の手順を重ねた配列（自分の手順のケースは custom: true）。
 *                                 保存値が壊れている・確認を通らない・既定と同じ手順の場合は既定を使う
 *
 * 保存: store.js の 'custom-algs'（localStorage 'visualcube-editor:custom-algs'）= { pll: { "Aa": { alg, setup } }, oll: { ... } }
 * ブラウザでは window.CustomAlgs、node では module.exports として公開する（node では保存しない）。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cube-state.js'), require('./case-check.js'), require('./store.js'));
  } else {
    root.CustomAlgs = factory(root.CubeState, root.CaseCheck, root.Store);
  }
})(typeof self !== 'undefined' ? self : this, function (M, C, S) {
  'use strict';

  const KEY = 'custom-algs';
  // 最後の AUF・持ち替えを外す（括弧の有無を問わない。最後の U は PLL でも AUF なので外してよい）。
  // 向きを元に戻すための持ち替え（x … x' など）は残る（case-check.js の stripEnd）
  const stripTail = (alg) => C.stripEnd('oll', alg).trim();

  // 回し方が同じか（空白・括弧の有無・R2' と R3 のような書き方の違いは同じとみなす）
  function sameMoves(a, b) {
    try {
      return JSON.stringify(M.parseAlg(C.convert(a))) === JSON.stringify(M.parseAlg(C.convert(b)));
    } catch (e) {
      return false;
    }
  }

  function validate(set, c, input, data) {
    // 表記を整える（全角の記号を半角に、Rw → r。大文字・小文字は別の回し方なので変えない）
    const written = M.canonicalAlg(C.convert(String(input || ''))).replace(/\s+/g, ' ').trim();
    if (!written) return { ok: false, code: 'empty', error: 'Enter an algorithm.' };
    let simple;
    try {
      simple = M.simplifyAlg(written);
    } catch (e) {
      return { ok: false, code: 'parse', error: e.message };
    }
    const notes = [];
    // 無駄な手順をまとめる（R R' は消し、R R は R2 に）。最後の AUF を外すより先にする（… U U' はまとめで消える）
    const raw = simple.alg;
    if (simple.changed) notes.push('simplified'); // 画面では i18n.js の myAlg.simplified
    // 先頭の括弧の無い U は前の AUF なので、既定データと同じく括弧で書く（例：U2 R U … → (U2) R U …）
    const body = stripTail(raw);
    const alg = body.replace(/^U(2'|'2|2|')?(?=\s)/, (m) => `(${m})`);
    if (body !== raw) notes.push('stripped'); // 画面では i18n.js の myAlg.stripped
    if (!alg) return { ok: false, code: 'notSolved', params: { name: c.name }, error: `This algorithm does not solve ${c.name}.` };
    // 既定の手順と同じ回し方なら保存しない（isDefault。画面では自分の手順を消して既定に戻す）
    const defaultAlg = c.defaultAlg || c.alg;
    if (sameMoves(alg, defaultAlg)) return { ok: true, isDefault: true, alg: defaultAlg, setup: c.defaultSetup || c.setup, notes: notes };
    const fit = C.fitSetup(set, alg, c.defaultSetup || c.setup); // 自分の手順を重ねた要素でも既定の setup を元にする
    if (fit) return { ok: true, alg: fit.a, setup: fit.s, notes: notes };
    const other = data ? C.findCase(set, alg, data) : null;
    if (other && other.name !== c.name) {
      return {
        ok: false,
        code: 'solvesOther',
        params: { name: c.name, other: other.name },
        error: `This algorithm does not solve ${c.name} (it solves ${other.name}).`,
      };
    }
    return { ok: false, code: 'notSolved', params: { name: c.name }, error: `This algorithm does not solve ${c.name}.` };
  }

  // ---- 保存 ----
  // 保存は store.js 経由（ログイン中はクラウドにも）
  function readAll() {
    const value = S.get(KEY);
    return value && typeof value === 'object' ? value : {};
  }
  const writeAll = (all) => S.set(KEY, all);

  function get(set, name) {
    const v = (readAll()[set] || {})[name];
    return v && typeof v.alg === 'string' && typeof v.setup === 'string' ? { alg: v.alg, setup: v.setup } : null;
  }

  function save(set, name, value) {
    const all = readAll();
    all[set] = all[set] && typeof all[set] === 'object' ? all[set] : {};
    all[set][name] = { alg: value.alg, setup: value.setup };
    writeAll(all);
  }

  function reset(set, name) {
    const all = readAll();
    if (all[set]) delete all[set][name];
    writeAll(all);
  }

  function merged(set, data) {
    const mine = readAll()[set] || {};
    return data.map((c) => {
      const v = mine[c.name];
      if (!v || typeof v.alg !== 'string' || typeof v.setup !== 'string') return c;
      if (sameMoves(v.alg, c.alg)) return c; // 既定と同じ手順（この修正より前に保存されたもの）は既定として扱う
      // 合わない保存値は使わない（setup が確認を通り、しかもこのケースの手順であること）
      try {
        if (C.check(set, C.convert(v.alg), C.convert(v.setup)) || !C.fitSetup(set, v.alg, c.setup)) return c;
      } catch (e) {
        return c;
      }
      return Object.assign({}, c, { alg: v.alg, setup: v.setup, custom: true, defaultAlg: c.alg, defaultSetup: c.setup });
    });
  }

  return { validate: validate, get: get, save: save, reset: reset, merged: merged };
});
