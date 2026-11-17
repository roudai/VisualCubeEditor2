/*
 * 通しの練習用の 3x3x3 のスクランブル（WCA と同じ random-state。DOM 非依存）。
 *
 *   WcaScramble.cube3(random)     スクランブル（1 行の文字列。例 "R U2 F' D ..."、20 手前後・最大 22 手程度）
 *     一様ランダムな合法状態を作り、two-phase ソルバ（js/cube-solver.js）で解いて、その逆手順を返す
 *     （スクランブルを揃った状態に適用すると、その状態になる）。2 手未満で揃う状態は作り直す（WCA の規定と同じ）。
 *     random は 0 以上 1 未満を返す関数（省略時は crypto.getRandomValues、無ければ Math.random）。
 *     random を省略したときは、prepare() で先に作っておいた 1 本があればそれを返す（待たせない）
 *   WcaScramble.prepare(callback) （ブラウザ向け）次の 1 本を、今の処理が終わったあと（setTimeout）に作っておく。
 *     最初の 1 回はソルバの表の初期化（約 0.5 秒）もここで済む。ページを開いたときと、cube3() で 1 本使うたびに呼ぶ。
 *     作り終えたら callback()（省略可）。すでに 1 本あれば何もしない
 *   WcaScramble.hasNext()         先に作っておいた 1 本があるか
 *   WcaScramble.encode(text)      スクランブルを短い文字列にする（記録を軽くするため）。1 手 = 1 文字
 *     （U U2 U' R R2 R' F F2 F' D D2 D' L L2 L' B B2 B' の順に A〜R）。形式が違えば（18 通り以外の記号を含む・空）null
 *   WcaScramble.decode(code)      encode した文字列を元のスクランブルに戻す。形式が違えば null
 *   WcaScramble.textOf(rec)       通しの記録のスクランブル（rec.s を戻したもの。全文で保存した rec.scramble もそのまま）
 *   WcaScramble.render(el, text)  （ブラウザ）el の中にスクランブルを div.scramble-line で入れる（1 行。移植元と同じ呼び方）
 *
 * 記録するとき: const s = WcaScramble.encode(text); s ? { s: s } : { scramble: text }（移植元 practice.js と同じ逃げ道）
 * ブラウザでは window.WcaScramble、node では module.exports として公開する。cube-solver.js が必要。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cube-solver.js'));
  } else {
    root.WcaScramble = factory(root.CubeSolver);
  }
})(typeof self !== 'undefined' ? self : this, function (Solver) {
  'use strict';

  const MIN_MOVES = 2; // これより短い手数で揃う状態は使わない（WCA 規則 4b3 と同じ）
  const FACES = 'URFDLB';
  const SUFFIX = ['', '2', "'"];
  const MOVES = []; // 18 通り（短い形の文字の順）
  for (const f of FACES) for (const s of SUFFIX) MOVES.push(f + s);
  const ALPHABET = 'ABCDEFGHIJKLMNOPQR';

  // 揃っている・1 手で揃う状態か（ソルバの解は最短とは限らないので、状態を直接調べる）
  const tooEasy = (cubie) => Solver.isSolved(cubie) || MOVES.some((m) => Solver.isSolved(Solver.applyToCubie(cubie, m)));

  function generate(random) {
    for (;;) {
      const cubie = Solver.randomCubie(random);
      if (tooEasy(cubie)) continue;
      return Solver.invert(Solver.solve(cubie));
    }
  }

  // ---- 次の 1 本を先に作っておく ----
  let queued = null;
  let scheduled = false;
  let waiting = []; // 作成の予約中に渡された callback（作り終えたらまとめて呼ぶ）

  function cube3(random) {
    if (typeof random === 'function') return generate(random);
    if (queued) {
      const out = queued;
      queued = null;
      return out;
    }
    return generate();
  }

  function prepare(callback) {
    const done = typeof callback === 'function' ? callback : null;
    if (queued) {
      if (done) done();
      return;
    }
    if (done) waiting.push(done);
    if (scheduled) return;
    scheduled = true;
    setTimeout(function () {
      scheduled = false;
      if (!queued) queued = generate();
      const callbacks = waiting;
      waiting = [];
      callbacks.forEach((f) => f());
    }, 0);
  }

  const hasNext = () => queued !== null;

  // ---- 記録用の短い形 ----
  function encode(text) {
    const tokens = String(text || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!tokens.length) return null;
    let code = '';
    for (const tok of tokens) {
      const i = MOVES.indexOf(tok);
      if (i < 0) return null;
      code += ALPHABET[i];
    }
    return code;
  }

  function decode(code) {
    if (typeof code !== 'string' || !/^[A-R]+$/.test(code)) return null;
    return Array.from(code, (ch) => MOVES[ALPHABET.indexOf(ch)]).join(' ');
  }

  const textOf = (rec) => (rec && typeof rec.s === 'string' ? decode(rec.s) || '' : (rec && rec.scramble) || '');

  function render(el, text) {
    el.replaceChildren(
      ...String(text || '')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const d = el.ownerDocument.createElement('div');
          d.className = 'scramble-line';
          d.textContent = line;
          return d;
        })
    );
  }

  return { cube3: cube3, prepare: prepare, hasNext: hasNext, encode: encode, decode: decode, textOf: textOf, render: render, MOVES: MOVES, MIN_MOVES: MIN_MOVES };
});
