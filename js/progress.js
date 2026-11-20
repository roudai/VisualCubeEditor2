/*
 * 習得状況と練習の記録、ケースの画像の色（一覧ページ cases.js と練習ページ practice.js で共通）。
 * 保存は store.js 経由（ログイン中はクラウドにも）。仕様: reference/PLL_SPEC.md「一覧ページ」、reference/PRACTICE_SPEC.md
 *
 *   STATUSES                        ['new', 'learning', 'learned']（表示名は i18n.js の status.*）
 *   statuses(set)                   { ケース名: 'learning' | 'learned' }（未着手は入っていない）
 *   statusOf(set, name)             'new' | 'learning' | 'learned'
 *   setStatus(set, name, status)    習得状況を書く（'new' なら消す）
 *   judge(time, threshold)          練習の判定：time（秒）がしきい値以内なら 'learned'、超えた・null（解けなかった）なら 'learning'
 *   thresholdOf(practice, set)      練習の設定（store.js の 'practice'）から、その種類（'pll' | 'oll' | 'coll'）の習得の目安（秒）。
 *                                     thresholds[set] → 以前の共通の threshold → 既定（OLL 2 秒、ほかは 3 秒）の順に使う（0〜120 秒の範囲外は使わない）。
 *                                     THRESHOLD_MIN〜THRESHOLD_MAX（1〜10 秒）の 0.5 秒刻みにそろえる（以前は 120 秒まで選べた）
 *   clampThreshold(v)               目安の秒数を 1〜10 秒・0.5 秒刻みにそろえる
 *   addTime(list, time, max)        最近のタイムの配列に足した新しい配列（新しい順、最大 max 件）
 *   displaySettings(set)            エディタで保存した設定から、画像の配色・線の色・背景・サイズを決める
 *                                     PLL：保存した配色（OLL 配色のときは OLL を選ぶ前の配色、無ければ Standard）
 *                                     OLL：保存した U の色だけを残した OLL 配色
 *                                     COLL：PLL と同じ配色（側面のエッジのステッカーは caseColors でグレーにする）
 *   caseColors(c, scheme, set)      solve case（alg の逆手順を適用、持ち替えは打ち消す）の状態の画像の色
 *                                     set が 'coll' なら、側面のエッジのステッカー（scolor の 3i+1）を OLL_GRAY にする
 *                                     （sr-visualizer の coll マスクと同じ見た目。COLL はエッジの位置を揃えないため）
 *   addLog(log, entry, max)         練習の記録（日時付き）の配列に足した新しい配列（新しい順、種類（PLL・OLL・COLL・ZBLL）ごとに最大 max 件。既定 5000）
 *                                     entry = { at: 日時(ms), set, name, sec(null=解けなかった), status, hint }
 *   summarize(log, { set, from })   期間（from 以降。無ければすべて）の集計 { count, solved, dnf, avg, best }
 *   daily(log, { set, days, now })  直近 days 日の日ごとの { day: 'YYYY-MM-DD', count, avg }（古い順。練習していない日も 0 で入る）
 *   perCase(log, { set, from })     ケースごとの { name: { count, solved, dnf, best, avg, last } }
 *   recentPerCase(log, { set, from, n, dnfAs })
 *                                   ケースごとの直近 n 回（既定 10）の { attempts, avg（解けた回の平均。無ければ null）, dnf, score }
 *                                     score は苦手の度合い：解けなかった回を dnfAs 秒として数えた平均（記録のページの「苦手順」）
 *   weakScores(log, { set, from, n, dnfAs, prior })
 *                                   ケースごとの苦手の度合い { scores: { name: 寄せた score }, overall }。回数の少ないケースが
 *                                     たまたまの1回で目立たないよう、全体の平均（overall）で prior 回（既定 2）解いたものとして足す
 *   pickWeighted(list, weightOf, random)
 *                                   list から weightOf(item) に比例した確率で1つ選ぶ（重みがすべて 0 以下なら一様。random 既定 Math.random）
 *   通しの練習（WCA と同じ扱い）。rec = { at, sec, penalty: '' | '+2' | 'DNF' }
 *   effectiveTime(rec)              ペナルティを含めたタイム（+2 なら sec + 2、DNF なら null）
 *   average(recs, n)                直近 n 回（recs は新しい順）の WCA 式の平均：速い方・遅い方を ceil(n × 5%) 回ずつ除いた平均
 *                                     （ao5・ao12 は 1 回ずつ、ao100 は 5 回ずつ。csTimer と同じ）。
 *                                     DNF は最遅とみなし、DNF が除く回数より多ければ null（DNF）。n 回に足りなければ undefined
 *   rollingAverages(recs, n)        各記録の時点の n 回平均の配列（recs と同じ並び。i 番目は recs[i] から古い方へ n 回の average）
 *   bestAverage(recs, n)            これまでで最も速い n 回平均（DNF・足りなければ null / undefined）
 *   bestSingle(recs)                最速の1回（DNF を除く。無ければ null）
 *   meanTime(recs)                  DNF を除いたタイムの平均（小数 2 桁に丸める。解けた記録が無ければ null）
 *   formatTime(sec, digits)         タイムの表示。60 秒以上は分表記（例：65.234 → "1:05.23"、5.2 → "5.20"）。digits は小数の桁数（既定 2）
 *   wrapAuf(scramble, pre, post)    スクランブルの前後に U を pre・post 回（90°単位 0〜3）足す。もともと前後にある U とはまとめる
 *                                     （例：wrapAuf("U R U'", 1, 1) → "U2 R"）。前後の AUF を足しても同じケースのまま（練習の出題用）
 *
 * ブラウザでは window.Progress、node では module.exports として公開する。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./cube-state.js'), require('./store.js'));
  } else {
    root.Progress = factory(root.CubeState, root.Store);
  }
})(typeof self !== 'undefined' ? self : this, function (M, S) {
  'use strict';

  const STATUSES = ['new', 'learning', 'learned'];
  const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  function statuses(set) {
    const all = S.get('progress');
    return isObject(all) && isObject(all[set]) ? all[set] : {};
  }

  function statusOf(set, name) {
    const s = statuses(set)[name];
    return STATUSES.includes(s) ? s : 'new';
  }

  function setStatus(set, name, status) {
    const all = isObject(S.get('progress')) ? S.get('progress') : {}; // 別タブの変更を消さないように読み直してから書く
    const mine = isObject(all[set]) ? all[set] : {};
    if (status === 'new') delete mine[name];
    else mine[name] = status;
    all[set] = mine;
    S.set('progress', all);
  }

  const judge = (time, threshold) => (typeof time === 'number' && time <= threshold ? 'learned' : 'learning');

  // 習得の目安は種類ごと（thresholds: { pll, oll, coll }）。以前は共通の threshold だったので、無ければそれを使う
  // 既定：OLL は手順が短いものが多いので短め（移植元は PLL 8 秒・OLL 5 秒）
  const DEFAULT_THRESHOLDS = { pll: 3, oll: 2, coll: 3, zbll: 3 };
  // 範囲は 3x3 の LL に合わせて 1〜10 秒（移植元は 2〜20 秒）
  const THRESHOLD_MIN = 1;
  const THRESHOLD_MAX = 10;
  // 以前の範囲（120 秒まで）の値は読み、1〜10 秒にそろえる。それ以外の壊れた値は使わない
  const validThreshold = (v) => typeof v === 'number' && v > 0 && v <= 120;
  const clampThreshold = (v) => Math.min(THRESHOLD_MAX, Math.max(THRESHOLD_MIN, Math.round(v * 2) / 2));
  function thresholdOf(practice, set) {
    const p = isObject(practice) ? practice : {};
    const own = isObject(p.thresholds) ? p.thresholds[set] : undefined;
    if (validThreshold(own)) return clampThreshold(own);
    return validThreshold(p.threshold) ? clampThreshold(p.threshold) : DEFAULT_THRESHOLDS[set] || DEFAULT_THRESHOLDS.pll;
  }

  function addTime(list, time, max) {
    const prev = Array.isArray(list) ? list.filter((t) => typeof t === 'number') : [];
    return [time].concat(prev).slice(0, max || 10);
  }

  const HEX = /^#[0-9a-f]{6}$/i;
  function displaySettings(set) {
    const saved = S.get('settings');
    const settings = isObject(saved) ? saved : null;
    // OLL 配色（U の色だけ）のままだと PLL が見分けられないので、そのときは OLL を選ぶ前の配色
    // （エディタが beforeOll に保存）を使い、それも無ければ Standard にする（エディタで PLL を選んだときと同じ）
    let faceColors = {};
    if (settings && settings.preset !== 'oll') faceColors = settings.faceColors || {};
    else if (settings && settings.beforeOll && settings.beforeOll.scheme) faceColors = settings.beforeOll.scheme;
    const scheme = {};
    M.FACES.forEach((face) => {
      scheme[face] = HEX.test(faceColors[face]) ? faceColors[face] : M.DEFAULT_SCHEME[face];
    });
    const size = settings && /^\d+$/.test(settings.imageSize) ? Math.min(1000, Math.max(100, Number(settings.imageSize))) : 200;
    const common = {
      border: settings && HEX.test(settings.border) ? settings.border : '#000000',
      background: settings && settings.bg === 'n' && HEX.test(settings.bgColor) ? settings.bgColor : null,
      size: size,
    };
    if (set === 'oll') {
      // U の色は OLL 配色のときも保存されている
      const u = settings && settings.faceColors && settings.faceColors.U;
      return Object.assign(common, { scheme: M.ollMask({ U: HEX.test(u) ? u : M.DEFAULT_SCHEME.U }) });
    }
    return Object.assign(common, { scheme: scheme });
  }

  function caseColors(c, scheme, set) {
    const state = M.applyAlg(c.alg, { inverse: true, cancelRotation: true });
    const colors = M.toImageColors(state, scheme);
    if (set === 'coll') colors.scolor = colors.scolor.map((x, i) => (i % 3 === 1 ? M.OLL_GRAY : x));
    return colors;
  }

  // ---- 練習の記録（日時付き） ----
  // 最大件数は種類（PLL・OLL・COLL・ZBLL）ごと（ある種類をたくさん練習しても、ほかの種類の記録が押し出されないように）。
  // 4 種類 × 5000 件で、ブラウザの保存（localStorage）に約 190 万文字
  const LOG_MAX = 5000;
  function addLog(log, entry, max) {
    const prev = Array.isArray(log) ? log : [];
    const limit = max || LOG_MAX;
    const count = {};
    return [entry].concat(prev).filter((e) => {
      const set = e && e.set;
      count[set] = (count[set] || 0) + 1;
      return count[set] <= limit;
    });
  }

  // 記録を種類・期間で絞る（壊れた記録は除く）
  function pick(log, opts) {
    const o = opts || {};
    return (Array.isArray(log) ? log : []).filter(
      (e) =>
        e &&
        typeof e.at === 'number' &&
        typeof e.name === 'string' &&
        (!o.set || e.set === o.set) &&
        (!o.from || e.at >= o.from)
    );
  }
  const solvedTimes = (list) => list.map((e) => e.sec).filter((t) => typeof t === 'number');
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  function summarize(log, opts) {
    const list = pick(log, opts);
    const times = solvedTimes(list);
    return {
      count: list.length,
      solved: times.length,
      dnf: list.length - times.length,
      avg: mean(times),
      best: times.length ? Math.min(...times) : null,
    };
  }

  // 日付のキー（その端末の時刻で 'YYYY-MM-DD'）
  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (ms) => {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  function daily(log, opts) {
    const o = opts || {};
    const days = o.days || 30;
    const now = o.now || Date.now();
    const out = [];
    const index = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(12, 0, 0, 0); // 夏時間などで日付がずれないよう昼で数える
      d.setDate(d.getDate() - i);
      const key = dayKey(d.getTime());
      index[key] = out.length;
      out.push({ day: key, count: 0, avg: null, times: [] });
    }
    pick(log, { set: o.set }).forEach((e) => {
      const i = index[dayKey(e.at)];
      if (i === undefined) return;
      out[i].count++;
      if (typeof e.sec === 'number') out[i].times.push(e.sec);
    });
    return out.map((d) => ({ day: d.day, count: d.count, avg: mean(d.times) }));
  }

  function perCase(log, opts) {
    const out = {};
    pick(log, opts).forEach((e) => {
      const c = out[e.name] || (out[e.name] = { count: 0, solved: 0, dnf: 0, best: null, avg: null, last: 0, times: [] });
      c.count++;
      if (typeof e.sec === 'number') c.times.push(e.sec);
      if (e.at > c.last) c.last = e.at;
    });
    Object.values(out).forEach((c) => {
      c.solved = c.times.length;
      c.dnf = c.count - c.solved;
      c.best = c.times.length ? Math.min(...c.times) : null;
      c.avg = mean(c.times);
      delete c.times;
    });
    return out;
  }

  function recentPerCase(log, opts) {
    const o = opts || {};
    const n = o.n || 10;
    const out = {};
    pick(log, o)
      .slice()
      .sort((a, b) => b.at - a.at) // 新しい順
      .forEach((e) => {
        const list = out[e.name] || (out[e.name] = []);
        if (list.length < n) list.push(typeof e.sec === 'number' ? e.sec : null);
      });
    Object.keys(out).forEach((name) => {
      const list = out[name];
      const times = list.filter((t) => t !== null);
      out[name] = {
        attempts: list.length,
        avg: mean(times),
        dnf: list.length - times.length,
        score: mean(list.map((t) => (t === null ? o.dnfAs : t))),
      };
    });
    return out;
  }

  function weakScores(log, opts) {
    const o = opts || {};
    const prior = o.prior == null ? 2 : o.prior;
    const recent = recentPerCase(log, o);
    const all = Object.values(recent);
    const total = all.reduce((sum, x) => sum + x.attempts, 0);
    const overall = total ? all.reduce((sum, x) => sum + x.score * x.attempts, 0) / total : 0;
    const scores = {};
    Object.keys(recent).forEach((name) => {
      const x = recent[name];
      scores[name] = (x.score * x.attempts + overall * prior) / (x.attempts + prior);
    });
    return { scores: scores, overall: overall };
  }

  function pickWeighted(list, weightOf, random) {
    const rand = random || Math.random;
    if (!list.length) return undefined;
    const weights = list.map((x) => {
      const w = Number(weightOf(x));
      return w > 0 && isFinite(w) ? w : 0;
    });
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!(sum > 0)) return list[Math.floor(rand() * list.length)];
    let r = rand() * sum;
    for (let i = 0; i < list.length; i++) {
      r -= weights[i];
      if (r < 0) return list[i];
    }
    return list[list.length - 1];
  }

  // ---- タイムの表示 ----
  function formatTime(sec, digits) {
    const d = digits == null ? 2 : digits;
    const unit = Math.pow(10, d);
    const total = Math.round(sec * unit); // 丸めてから分と秒に分ける（59.999 → 1:00.00 になるように）
    const whole = Math.floor(total / unit);
    const frac = d ? '.' + String(total % unit).padStart(d, '0') : '';
    if (whole < 60) return whole + frac;
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}${frac}`;
  }

  // ---- 通しの練習（WCA と同じ扱い） ----
  function effectiveTime(rec) {
    if (!rec || typeof rec.sec !== 'number' || rec.penalty === 'DNF') return null;
    return rec.penalty === '+2' ? Math.round((rec.sec + 2) * 100) / 100 : rec.sec;
  }

  function average(recs, n) {
    const list = Array.isArray(recs) ? recs.slice(0, n) : [];
    if (list.length < n) return undefined;
    const times = list.map(effectiveTime);
    const trim = Math.ceil(n * 0.05); // 速い方・遅い方を除く回数（ao5・ao12 は 1、ao100 は 5）
    const dnf = times.filter((t) => t === null).length;
    if (dnf > trim) return null;
    // DNF は最遅とみなすので、DNF が除く回数までなら最遅として除かれる
    const sorted = times.map((t) => (t === null ? Infinity : t)).sort((a, b) => a - b);
    const kept = sorted.slice(trim, n - trim);
    return Math.round((kept.reduce((a, b) => a + b, 0) / kept.length) * 100) / 100;
  }

  function rollingAverages(recs, n) {
    const list = Array.isArray(recs) ? recs : [];
    return list.map((_, i) => average(list.slice(i, i + n), n));
  }

  function bestAverage(recs, n) {
    const list = Array.isArray(recs) ? recs : [];
    if (list.length < n) return undefined;
    let best = null;
    for (let i = 0; i + n <= list.length; i++) {
      const a = average(list.slice(i), n);
      if (typeof a === 'number' && (best === null || a < best)) best = a;
    }
    return best;
  }

  function bestSingle(recs) {
    const times = (Array.isArray(recs) ? recs : []).map(effectiveTime).filter((t) => typeof t === 'number');
    return times.length ? Math.min(...times) : null;
  }

  function meanTime(recs) {
    const times = (Array.isArray(recs) ? recs : []).map(effectiveTime).filter((t) => typeof t === 'number');
    return times.length ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 100) / 100 : null;
  }

  // ---- 練習の出題 ----
  const U_AMOUNT = { U: 1, U2: 2, "U2'": 2, "U'2": 2, "U'": 3 };
  const U_TEXT = M.AUFS; // ['', 'U', 'U2', "U'"]
  function wrapAuf(scramble, pre, post) {
    const tokens = String(scramble).trim().split(/\s+/).filter(Boolean);
    let head = pre % 4;
    let tail = post % 4;
    while (tokens.length && U_AMOUNT[tokens[0]] !== undefined) head = (head + U_AMOUNT[tokens.shift()]) % 4;
    while (tokens.length && U_AMOUNT[tokens[tokens.length - 1]] !== undefined) tail = (tail + U_AMOUNT[tokens.pop()]) % 4;
    if (!tokens.length) return U_TEXT[(head + tail) % 4];
    return [U_TEXT[head]].concat(tokens, [U_TEXT[tail]]).filter(Boolean).join(' ');
  }

  return {
    STATUSES: STATUSES,
    thresholdOf: thresholdOf,
    clampThreshold: clampThreshold,
    THRESHOLD_MIN: THRESHOLD_MIN,
    THRESHOLD_MAX: THRESHOLD_MAX,
    weakScores: weakScores,
    pickWeighted: pickWeighted,
    wrapAuf: wrapAuf,
    formatTime: formatTime,
    effectiveTime: effectiveTime,
    average: average,
    rollingAverages: rollingAverages,
    bestAverage: bestAverage,
    bestSingle: bestSingle,
    meanTime: meanTime,
    addLog: addLog,
    summarize: summarize,
    daily: daily,
    perCase: perCase,
    recentPerCase: recentPerCase,
    dayKey: dayKey,
    statuses: statuses,
    statusOf: statusOf,
    setStatus: setStatus,
    judge: judge,
    addTime: addTime,
    displaySettings: displaySettings,
    caseColors: caseColors,
  };
});
