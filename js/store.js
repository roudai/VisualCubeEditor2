/*
 * 保存の窓口（localStorage）。エディタ・一覧ページの保存はすべてここを通す。ログイン中は cloud-sync.js がクラウドと合わせる。
 * 仕様: reference/CLOUD_SYNC_SPEC.md
 *
 *   Store.get(name)              値を読む（JSON として読めなければ文字列のまま。無ければ null）
 *   Store.set(name, value)       値を書く（前と同じなら何もしない）。更新時刻を記録し、window に 'store-change' を通知する。
 *                                  practice では、消した記録の印（practice.removed・practice.cleared）を前の値との違いから付ける（withTombstones）
 *                                  progress・custom-algs では、値が変わったケースに変えた時刻（_at）を付ける（withCaseStamps）
 *   Store.withTombstones(prev, next)
 *                                練習の記録（practice.log・practice.full.log）から消えた記録に印を付けた next を返す（DOM 非依存）。
 *                                  - removed：{ pll|oll|coll|zbll|full: [日時, …] }（新しい順、種類ごとに最大 REMOVED_MAX 件）
 *                                  - cleared：{ pll|oll|coll|zbll|full: 日時 }（種類の記録が空になり、消えた記録が removed に入りきらないとき。その日時以前の記録は消したもの）
 *                                    （移植元は種類の記録が空になれば必ず付けるので、その種類の記録が 1 件だけのときに「取り消す」と、
 *                                      まだ読んでいない別の端末のそれより前の記録まで消えてしまう。こちらは入りきるあいだは 1 件ずつの印にする）
 *                                  - 上限（LOG_MAX。PLL・OLL・COLL・ZBLL 各 5000 件、ソルブ 5000 件）で押し出された古い記録には付けない。消した記録を戻したら（元に戻す）印を外す
 *                                同じアカウントの別の端末の記録と合わせるとき（merge）に、消した記録が戻ってこないようにする
 *   Store.snapshot()             { data: { name: value }, updated: { name: 時刻(ms) } }（保存されているものだけ）
 *   Store.replace(snapshot)      snapshot の内容で書き換える（cloud-sync.js がクラウドの内容を反映するときに使う。通知しない）
 *   Store.merge(local, remote, { union })
 *                                手元とクラウドの snapshot を合わせた snapshot を返す（DOM 非依存）
 *                                  - 名前ごとに更新時刻の新しい方を使う。ただし両方にあれば：
 *                                    practice は記録を両方合わせる（mergePractice）、progress・custom-algs はケースごとにあとで変えた方（mergeCases）
 *                                  - union: true（今はログインのときに使っていない。resolveLogin は合算しない）は、習得状況（progress）と
 *                                    自分の手順（custom-algs）をケースごとに合わせる（両方にあれば新しい方、片方だけなら残す）
 *
 *   Store.resolveLogin(local, remote, { owner, uid, fresh })
 *                                ログインしたときに手元へ反映する snapshot を決める（DOM 非依存）。合算はしない
 *                                  - ログインしたままページを開き直した（fresh でなく owner === uid）：merge（名前ごとに新しい方。
 *                                    まだクラウドに書けていなかった手元の変更を失わない）
 *                                  - 新しくログインした：アカウントにデータがあれば、アカウントの内容で上書きする（ログイン前の手元の内容は捨てる）
 *                                  - 新しくログインしてアカウントが空：手元の内容をそのまま使う（アカウントに入れる）。
 *                                    ただし手元が別のアカウントのもの（owner が別）なら持ち込まず初期状態
 *                                  どれも言語（lang）は手元のものを残す（ログインで表示の言語が急に変わらないように）
 *   Store.discardsLocal(local, remote, who)
 *                                resolveLogin で、ログイン前の手元の内容（習得状況・自分の手順・練習の記録）を
 *                                捨てることになるか（ログインのあとに知らせるため）
 *
 *   Store.toCloud(snapshot)      クラウドに書く形に分ける（DOM 非依存）→ { main, logs: { pll, oll, coll, zbll, full }, inline }
 *                                  - main：練習の記録（practice.log・practice.full.log）を抜いた snapshot に logsSplit: true・fullSplit: true を付けたもの（本体の文書）
 *                                  - logs：PLL・OLL・COLL・ZBLL の記録を短い形（[日時, ケース, タイム, 判定, ヒント]）、ソルブの記録を短い形
 *                                    （[日時, タイム, スクランブル, ペナルティ]）にしたもの（種類ごとの文書）。
 *                                    1 文書の上限（LOG_LIMIT 文字）を超えるときは古い記録を捨てる
 *                                  - inline：記録を本体に入れたままの以前の形（PLL・OLL・COLL・ZBLL は合わせて、ソルブはそれぞれ最新 INLINE_MAX 件）。
 *                                    種類ごとの文書に書けなかったとき（Firestore のルールが古いなど）に本体だけに書く
 *   Store.fromCloud(main, logs)  クラウドから読んだ本体と種類ごとの記録を 1 つの snapshot に戻す（DOM 非依存）。
 *                                  logsSplit の無い本体（以前の形・古いページが書いたもの）はそのまま使う。fullSplit が無ければソルブの記録は本体のもの
 *
 * 名前（NAMES）と localStorage のキー：visualcube-editor:<name>（接頭辞は Store.PREFIX）。更新時刻は visualcube-editor:updated。
 * ブラウザでは window.Store、node では module.exports として公開する（node では global.localStorage があれば使う）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.Store = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PREFIX = 'visualcube-editor:';
  // settings: 配色・画像の設定 / progress: 習得状況 / list-filter: 一覧の絞り込み / custom-algs: 自分の手順 / lang: 言語
  // practice: 練習の設定と最近のタイム（practice.js）
  const NAMES = ['settings', 'progress', 'list-filter', 'custom-algs', 'lang', 'practice'];
  const PER_CASE = ['progress', 'custom-algs']; // { pll: { name: … }, oll: { … } } の形で、ケースごとに合わせられるもの
  const UPDATED = PREFIX + 'updated';

  const storage = () => (typeof localStorage !== 'undefined' ? localStorage : null);

  function readRaw(key) {
    try {
      return storage().getItem(key);
    } catch (e) {
      return null;
    }
  }
  function writeRaw(key, raw) {
    try {
      if (raw === null) storage().removeItem(key);
      else storage().setItem(key, raw);
    } catch (e) {
      // 保存できなくても動作は続ける
    }
  }
  const encode = (value) => (typeof value === 'string' ? value : JSON.stringify(value));
  function decode(raw) {
    if (raw === null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      return raw; // 言語（'ja' など）は文字列のまま保存している
    }
  }
  function readUpdated() {
    const v = decode(readRaw(UPDATED));
    return v && typeof v === 'object' ? v : {};
  }

  const get = (name) => decode(readRaw(PREFIX + name));

  function set(name, value) {
    if (name === 'practice' && isObject(value)) value = withTombstones(get('practice'), value);
    if (PER_CASE.includes(name) && isObject(value)) value = withCaseStamps(get(name), value, Date.now());
    const raw = value === null || value === undefined ? null : encode(value);
    if (readRaw(PREFIX + name) === raw) return; // 変わっていなければ時刻も通知も変えない
    writeRaw(PREFIX + name, raw);
    const updated = readUpdated();
    updated[name] = Date.now();
    writeRaw(UPDATED, JSON.stringify(updated));
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent('store-change', { detail: { name: name } }));
    }
  }

  function snapshot() {
    const updated = readUpdated();
    const out = { data: {}, updated: {} };
    NAMES.forEach((name) => {
      const v = get(name);
      if (v === null) return;
      out.data[name] = v;
      out.updated[name] = typeof updated[name] === 'number' ? updated[name] : 0;
    });
    return out;
  }

  function replace(snap) {
    const updated = {};
    NAMES.forEach((name) => {
      const has = snap && snap.data && Object.prototype.hasOwnProperty.call(snap.data, name);
      writeRaw(PREFIX + name, has ? encode(snap.data[name]) : null);
      if (has) updated[name] = (snap.updated && snap.updated[name]) || 0;
    });
    writeRaw(UPDATED, JSON.stringify(updated));
  }

  const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

  // ---- 習得状況（progress）・自分の手順（custom-algs）をケースごとに合わせるための時刻 ----
  // { pll: { 'A1+': … }, oll: { … }, _at: { pll: { 'A1+': 変えた時刻 }, … } }。読む側は種類（pll・oll・coll・zbll）だけを見るので _at は気にしなくてよい。
  // 未習得に戻した・既定の手順に戻した（値を消した）ケースも時刻を残す（別の端末の古い値で戻ってこないように）
  const STAMPS = '_at';
  const caseSets = (v) => (isObject(v) ? Object.keys(v).filter((k) => k !== STAMPS && isObject(v[k])) : []);
  const stampsOf = (v) => (isObject(v) && isObject(v[STAMPS]) ? v[STAMPS] : {});
  function withCaseStamps(prev, next, now) {
    if (!isObject(next)) return next;
    const base = isObject(next[STAMPS]) ? next[STAMPS] : stampsOf(prev);
    const at = {};
    Object.keys(base).forEach((set) => {
      if (isObject(base[set])) at[set] = Object.assign({}, base[set]);
    });
    const p = isObject(prev) ? prev : {};
    new Set(caseSets(p).concat(caseSets(next))).forEach((set) => {
      const a = isObject(p[set]) ? p[set] : {};
      const b = isObject(next[set]) ? next[set] : {};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach((name) => {
        if (JSON.stringify(a[name]) === JSON.stringify(b[name])) return;
        (at[set] || (at[set] = {}))[name] = now;
      });
    });
    const out = Object.assign({}, next);
    if (Object.keys(at).length) out[STAMPS] = at;
    else delete out[STAMPS];
    return out;
  }
  // ケースごとに、あとで変えた方の値を使う（時刻が無い（この仕組みより前の）ケースは newer の方）
  function mergeCases(older, newer) {
    const o = isObject(older) ? older : {};
    const n = isObject(newer) ? newer : {};
    const so = stampsOf(o);
    const sn = stampsOf(n);
    const out = {};
    const at = {};
    new Set(caseSets(o).concat(caseSets(n), Object.keys(so), Object.keys(sn))).forEach((set) => {
      const vo = isObject(o[set]) ? o[set] : {};
      const vn = isObject(n[set]) ? n[set] : {};
      const to = isObject(so[set]) ? so[set] : {};
      const tn = isObject(sn[set]) ? sn[set] : {};
      const values = {};
      new Set([vo, vn, to, tn].flatMap((x) => Object.keys(x))).forEach((name) => {
        const a = typeof to[name] === 'number' ? to[name] : 0;
        const b = typeof tn[name] === 'number' ? tn[name] : 0;
        const src = b >= a ? vn : vo;
        if (Object.prototype.hasOwnProperty.call(src, name)) values[name] = src[name];
        if (Math.max(a, b) > 0) (at[set] || (at[set] = {}))[name] = Math.max(a, b);
      });
      if (Object.keys(values).length || isObject(n[set])) out[set] = values;
    });
    if (Object.keys(at).length) out[STAMPS] = at;
    return out;
  }

  // ---- 練習の記録（practice.log：PLL・OLL・COLL・ZBLL、practice.full.log：ソルブ）を端末どうしで合わせるための印 ----
  const LOG_MAX = { pll: 5000, oll: 5000, coll: 5000, zbll: 5000, full: 5000 }; // 種類ごとの記録の上限（js/progress.js の LOG_MAX・FULL_LOG_MAX と同じ）
  const REMOVED_MAX = 1000; // 消した記録の印を種類ごとに残す数
  const LOG_KINDS = ['pll', 'oll', 'coll', 'zbll', 'full'];
  // 種類ごとの記録の配列 { pll: [...], oll: [...], coll: [...], zbll: [...], full: [...] }
  function logsByKind(p) {
    const out = { pll: [], oll: [], coll: [], zbll: [], full: [] };
    if (!isObject(p)) return out;
    (Array.isArray(p.log) ? p.log : []).forEach((e) => {
      if (isObject(e) && typeof e.at === 'number' && out[e.set]) out[e.set].push(e);
    });
    const full = isObject(p.full) && Array.isArray(p.full.log) ? p.full.log : [];
    full.forEach((e) => {
      if (isObject(e) && typeof e.at === 'number') out.full.push(e);
    });
    return out;
  }
  function withTombstones(prev, next) {
    if (!isObject(next)) return next;
    const before = logsByKind(prev);
    const after = logsByKind(next);
    const removed = {};
    const cleared = {};
    const src = isObject(next.removed) ? next.removed : isObject(prev) && isObject(prev.removed) ? prev.removed : {};
    const srcCleared = isObject(next.cleared) ? next.cleared : isObject(prev) && isObject(prev.cleared) ? prev.cleared : {};
    LOG_KINDS.forEach((kind) => {
      const now = new Set(after[kind].map((e) => e.at));
      const list = new Set(Array.isArray(src[kind]) ? src[kind].filter((t) => typeof t === 'number') : []);
      let clear = typeof srcCleared[kind] === 'number' ? srcCleared[kind] : null;
      const gone = before[kind].filter((e) => !now.has(e.at)).map((e) => e.at);
      if (gone.length && !after[kind].length && list.size + gone.length > REMOVED_MAX) {
        // 種類の記録がすべて消え（すべての記録を削除）、1 件ずつの印に入りきらない：日時 1 つで印を付ける
        clear = Math.max(clear || 0, ...gone);
      } else if (gone.length && !after[kind].length) {
        // 種類の記録がすべて消えたが、1 件ずつの印に入りきる（その種類の記録が 1 件だけで「取り消す」など）：
        // 消えた記録にだけ印を付ける（日時 1 つの印にすると、まだ読んでいない別の端末のそれより前の記録まで消してしまう）
        gone.forEach((at) => list.add(at));
      } else if (gone.length) {
        // 上限で押し出された古い記録（残った記録より古く、上限まである）には付けない
        const oldest = Math.min(...after[kind].map((e) => e.at));
        const trimmed = after[kind].length >= LOG_MAX[kind];
        gone.forEach((at) => {
          if (!(trimmed && at < oldest)) list.add(at);
        });
      }
      // 戻した記録（元に戻す）は印を外す
      after[kind].forEach((e) => list.delete(e.at));
      if (clear !== null && after[kind].some((e) => e.at <= clear)) clear = null;
      const arr = [...list].sort((a, b) => b - a).slice(0, REMOVED_MAX);
      if (arr.length) removed[kind] = arr;
      if (clear !== null) cleared[kind] = clear;
    });
    const out = Object.assign({}, next);
    if (Object.keys(removed).length) out.removed = removed;
    else delete out.removed;
    if (Object.keys(cleared).length) out.cleared = cleared;
    else delete out.cleared;
    return out;
  }

  // 同じアカウントの 2 つの端末の練習のデータを合わせる：記録は両方（同じ日時は newer の方。消した印のあるものは除く）、
  // ケースごとの最近のタイムは合わせた記録から作り直す。ほかの設定（対象・目安・表示など）は newer のもの
  const TIMES_MAX = 10; // js/practice.js の MAX_TIMES と同じ
  function mergePractice(older, newer) {
    const o = isObject(older) ? older : {};
    const n = isObject(newer) ? newer : {};
    const out = Object.assign({}, n);
    const removed = {};
    const cleared = {};
    LOG_KINDS.forEach((kind) => {
      const list = (p) => (isObject(p.removed) && Array.isArray(p.removed[kind]) ? p.removed[kind] : []);
      const r = [...new Set(list(o).concat(list(n)))].filter((t) => typeof t === 'number').sort((a, b) => b - a).slice(0, REMOVED_MAX);
      if (r.length) removed[kind] = r;
      const c = [o, n].map((p) => (isObject(p.cleared) && typeof p.cleared[kind] === 'number' ? p.cleared[kind] : null)).filter((t) => t !== null);
      if (c.length) cleared[kind] = Math.max(...c);
    });
    const lo = logsByKind(o);
    const ln = logsByKind(n);
    const merged = {};
    LOG_KINDS.forEach((kind) => {
      const gone = new Set(removed[kind] || []);
      const clear = cleared[kind];
      const byAt = new Map();
      lo[kind].concat(ln[kind]).forEach((e) => byAt.set(e.at, e)); // 同じ日時は newer（あとから入れた方）
      merged[kind] = [...byAt.values()]
        .filter((e) => !gone.has(e.at) && !(clear !== undefined && e.at <= clear))
        .sort((a, b) => b.at - a.at)
        .slice(0, LOG_MAX[kind]);
    });
    // 記録の配列の形を保つ（PLL・OLL・COLL・ZBLL は 1 つの配列に新しい順で混ぜる）。どちらにも無ければ足さない
    if (Array.isArray(o.log) || Array.isArray(n.log)) out.log = merged.pll.concat(merged.oll, merged.coll, merged.zbll).sort((a, b) => b.at - a.at);
    if (isObject(o.full) || isObject(n.full)) {
      out.full = Object.assign({}, isObject(o.full) ? o.full : {}, isObject(n.full) ? n.full : {});
      if (merged.full.length || Array.isArray(out.full.log)) out.full.log = merged.full;
    }
    if (Object.keys(removed).length) out.removed = removed;
    else delete out.removed;
    if (Object.keys(cleared).length) out.cleared = cleared;
    else delete out.cleared;
    // 最近のタイム：合わせた記録から（ヒントなし・解けた回の新しい順に最大 TIMES_MAX 回）。
    // 記録の方が少ないケース（記録を残す前の古いタイム・記録を消した）は newer のものを残す
    if (isObject(o.times) || isObject(n.times)) {
      const times = {};
      ['pll', 'oll', 'coll', 'zbll'].forEach((set) => {
        const keep = Object.assign({}, isObject(o.times) && o.times[set], isObject(n.times) && n.times[set]);
        const derived = {};
        merged[set].forEach((e) => {
          if (typeof e.sec !== 'number' || e.hint || typeof e.name !== 'string') return;
          const list = derived[e.name] || (derived[e.name] = []);
          if (list.length < TIMES_MAX) list.push(e.sec);
        });
        const names = new Set(Object.keys(keep).concat(Object.keys(derived)));
        const t = {};
        names.forEach((name) => {
          const d = derived[name] || [];
          const k = Array.isArray(keep[name]) ? keep[name] : [];
          t[name] = d.length >= Math.min(TIMES_MAX, k.length) ? d : k;
        });
        if (Object.keys(t).length) times[set] = t;
      });
      out.times = Object.assign({}, n.times, times);
    }
    return out;
  }

  // ケースごとに合わせる：older の上に newer を重ねる（{ pll: {…}, oll: {…} } のそれぞれで）
  function mergePerCase(older, newer) {
    const out = {};
    [older, newer].forEach((src) => {
      if (!isObject(src)) return;
      Object.keys(src).forEach((set) => {
        if (set === STAMPS || !isObject(src[set])) return;
        out[set] = Object.assign({}, out[set], src[set]);
      });
    });
    return out;
  }

  function merge(local, remote, options) {
    const union = !!(options && options.union);
    const l = local || { data: {}, updated: {} };
    const r = remote || { data: {}, updated: {} };
    const out = { data: {}, updated: {} };
    NAMES.forEach((name) => {
      const inL = l.data && Object.prototype.hasOwnProperty.call(l.data, name);
      const inR = r.data && Object.prototype.hasOwnProperty.call(r.data, name);
      if (!inL && !inR) return;
      const tl = (l.updated && l.updated[name]) || 0;
      const tr = (r.updated && r.updated[name]) || 0;
      if (inL && inR && union && PER_CASE.includes(name)) {
        const localNewer = tl >= tr;
        out.data[name] = localNewer ? mergePerCase(r.data[name], l.data[name]) : mergePerCase(l.data[name], r.data[name]);
        out.updated[name] = Math.max(tl, tr);
        return;
      }
      if (inL && inR && !union && PER_CASE.includes(name)) {
        const localNewer = tl >= tr;
        out.data[name] = localNewer ? mergeCases(r.data[name], l.data[name]) : mergeCases(l.data[name], r.data[name]);
        out.updated[name] = Math.max(tl, tr);
        return;
      }
      if (inL && inR && name === 'practice') {
        const localNewer = tl >= tr;
        out.data[name] = localNewer ? mergePractice(r.data[name], l.data[name]) : mergePractice(l.data[name], r.data[name]);
        out.updated[name] = Math.max(tl, tr);
        return;
      }
      const useLocal = inL && (!inR || tl >= tr);
      out.data[name] = useLocal ? l.data[name] : r.data[name];
      out.updated[name] = useLocal ? tl : tr;
    });
    return out;
  }

  const EMPTY = () => ({ data: {}, updated: {} });

  // ---- クラウドに書く形（js/cloud-sync.js）----
  // Firestore の 1 文書は firestore.rules で json 50 万文字未満。PLL・OLL・COLL・ZBLL の記録（各最大 5000 件）は本体に入らないので、
  // 種類ごとの文書に短い形で分ける（1 件 約 30 文字 → 5000 件で約 16 万文字）。
  // ソルブの記録（practice.full.log。最大 5000 件、1 件 約 45 文字）も本体の余裕のために 'full' の文書に分ける（本体に fullSplit: true）
  const CASE_SETS = ['pll', 'oll', 'coll', 'zbll'];
  const LOG_SETS = ['pll', 'oll', 'coll', 'zbll', 'full'];
  const LOG_LIMIT = 480000;
  const INLINE_MAX = 2000;
  const STATUS = ['new', 'learning', 'learned'];
  const LOG_KEYS = ['at', 'set', 'name', 'sec', 'status', 'hint'];
  // { at, set, name, sec, status, hint } → [at, name, sec, 判定の番号, 1（ヒントを見たときだけ）]。
  // 知らない項目がある記録は失わないよう、そのままのオブジェクトで残す
  function packEntry(e) {
    if (!isObject(e) || Object.keys(e).some((k) => !LOG_KEYS.includes(k))) return e;
    const code = STATUS.indexOf(e.status);
    const row = [e.at, e.name, e.sec === undefined ? null : e.sec, code >= 0 ? code : e.status];
    if (e.hint) row.push(1);
    return row;
  }
  // ソルブ { at, sec, penalty, s } → [at, sec, s（無ければ null）, ペナルティ（'' のときは付けない）]
  const FULL_KEYS = ['at', 'sec', 'penalty', 's'];
  function packFull(e) {
    if (!isObject(e) || Object.keys(e).some((k) => !FULL_KEYS.includes(k))) return e;
    const row = [e.at, e.sec === undefined ? null : e.sec, e.s === undefined ? null : e.s];
    if (e.penalty) row.push(e.penalty);
    return row;
  }
  function unpackFull(row) {
    if (!Array.isArray(row)) return isObject(row) ? row : null;
    const e = { at: row[0], sec: row[1], penalty: typeof row[3] === 'string' ? row[3] : '' };
    if (row[2] !== null && row[2] !== undefined) e.s = row[2];
    return e;
  }
  function unpackEntry(row, set) {
    if (!Array.isArray(row)) return isObject(row) ? Object.assign({ set: set }, row) : null;
    const e = { at: row[0], set: set, name: row[1], sec: row[2], status: typeof row[3] === 'number' ? STATUS[row[3]] : row[3] };
    e.hint = row[4] === 1;
    return e;
  }

  function toCloud(snap) {
    const s = snap || EMPTY();
    const practice = s.data && isObject(s.data.practice) ? s.data.practice : null;
    const log = practice && Array.isArray(practice.log) ? practice.log : [];
    const full = practice && isObject(practice.full) && Array.isArray(practice.full.log) ? practice.full.log : [];
    const logs = {};
    LOG_SETS.forEach((set) => {
      let rows = set === 'full' ? full.map(packFull) : log.filter((e) => e && e.set === set).map(packEntry);
      // 上限を超えるときは古い記録から捨てる（ふつうは 5000 件でも収まる）
      while (rows.length && JSON.stringify({ rows: rows }).length >= LOG_LIMIT) rows = rows.slice(0, Math.floor(rows.length * 0.95));
      logs[set] = rows;
    });
    const data = Object.assign({}, s.data);
    if (practice) {
      const rest = Object.assign({}, practice);
      const others = log.filter((e) => !(e && CASE_SETS.includes(e.set)));
      if (others.length) rest.log = others;
      else delete rest.log;
      if (isObject(practice.full)) {
        rest.full = Object.assign({}, practice.full);
        delete rest.full.log;
      }
      data.practice = rest;
    }
    const main = { data: data, updated: Object.assign({}, s.updated), logsSplit: true, fullSplit: true };
    // 本体だけに書く以前の形：PLL・OLL・COLL・ZBLL（合わせて）とソルブの記録を、それぞれ最新 INLINE_MAX 件まで本体に入れる
    const inlineData = Object.assign({}, s.data);
    if (practice && (log.length > INLINE_MAX || full.length > INLINE_MAX)) {
      inlineData.practice = Object.assign({}, practice, { log: log.slice(0, INLINE_MAX) });
      if (!Array.isArray(practice.log)) delete inlineData.practice.log;
      if (full.length > INLINE_MAX) inlineData.practice.full = Object.assign({}, practice.full, { log: full.slice(0, INLINE_MAX) });
    }
    const inline = { data: inlineData, updated: Object.assign({}, s.updated) };
    return { main: main, logs: logs, inline: inline };
  }

  function fromCloud(main, logs) {
    if (!main || !isObject(main.data)) return null;
    const out = { data: Object.assign({}, main.data), updated: Object.assign({}, main.updated) };
    if (!main.logsSplit) return out;
    let practice = isObject(out.data.practice) ? out.data.practice : null;
    // ソルブの記録：fullSplit があれば 'full' の文書から戻す（無ければ本体の記録のまま。以前の形・古いページが書いた本体）
    if (main.fullSplit) {
      const rows = logs && Array.isArray(logs.full) ? logs.full : [];
      const fullLog = rows.map(unpackFull).filter((e) => e);
      if (fullLog.length || (practice && isObject(practice.full))) {
        practice = Object.assign({}, practice);
        practice.full = Object.assign({}, practice.full, { log: fullLog });
        out.data.practice = practice;
      }
    }
    const log = [];
    CASE_SETS.forEach((set) => {
      const rows = logs && Array.isArray(logs[set]) ? logs[set] : [];
      rows.forEach((row) => {
        const e = unpackEntry(row, set);
        if (e) log.push(e);
      });
    });
    if (practice && Array.isArray(practice.log)) log.push(...practice.log);
    if (!practice && !log.length) return out;
    log.sort((a, b) => (Number(b && b.at) || 0) - (Number(a && a.at) || 0));
    out.data.practice = Object.assign({}, practice, { log: log });
    return out;
  }

  // アカウントにデータがあるか（言語だけなら無いのと同じ）
  const hasData = (snap) => !!(snap && isObject(snap.data) && Object.keys(snap.data).some((name) => name !== 'lang'));
  // 言語は手元のものを残す
  function keepLang(snap, local) {
    const out = { data: Object.assign({}, snap.data), updated: Object.assign({}, snap.updated) };
    if (local && local.data && Object.prototype.hasOwnProperty.call(local.data, 'lang')) {
      out.data.lang = local.data.lang;
      out.updated.lang = (local.updated && local.updated.lang) || 0;
    }
    return out;
  }
  const continuing = (who) => !(who && who.fresh) && !!(who && who.owner) && who.owner === who.uid;

  function resolveLogin(local, remote, who) {
    if (continuing(who)) return merge(local, remote);
    if (hasData(remote)) return keepLang(remote, local);
    if (who && who.owner && who.owner !== who.uid) return keepLang(EMPTY(), local);
    return local ? keepLang(local, local) : EMPTY();
  }

  // 捨てるのは、手元にだけある「使った跡」（習得状況・自分の手順・練習の記録）が、アカウントの内容と違うとき
  function discardsLocal(local, remote, who) {
    if (continuing(who) || !local || !isObject(local.data)) return false;
    if (!hasData(remote) && !(who && who.owner && who.owner !== who.uid)) return false; // 手元をアカウントに入れる
    const r = (remote && remote.data) || {};
    const l = local.data;
    const filled = (v) => isObject(v) && Object.keys(v).some((k) => (isObject(v[k]) ? Object.keys(v[k]).length > 0 : v[k] != null));
    // 練習の記録は日時ごとに比べる（キーの順や、hint の無い古い記録（fromCloud で hint: false が付く）で違うと判定しないように）
    const logs = (p) => {
      const byKind = logsByKind(p);
      return JSON.stringify(
        LOG_KINDS.map((kind) =>
          byKind[kind]
            .map((e) => [e.at, e.sec === undefined ? null : e.sec, e.status || null, !!e.hint, e.penalty || ''])
            .sort((a, b) => b[0] - a[0])
        )
      );
    };
    const noLogs = logs(null);
    // ケースごとの時刻（_at）は比べない（中身が同じなら捨てたことにならない）
    const cases = (v) => {
      if (!isObject(v)) return v;
      const out = Object.assign({}, v);
      delete out[STAMPS];
      return out;
    };
    if (filled(cases(l.progress)) && JSON.stringify(cases(l.progress)) !== JSON.stringify(cases(r.progress))) return true;
    if (filled(cases(l['custom-algs'])) && JSON.stringify(cases(l['custom-algs'])) !== JSON.stringify(cases(r['custom-algs']))) return true;
    return logs(l.practice) !== noLogs && logs(l.practice) !== logs(r.practice);
  }

  return {
    PREFIX: PREFIX,
    NAMES: NAMES,
    get: get,
    set: set,
    snapshot: snapshot,
    replace: replace,
    merge: merge,
    resolveLogin: resolveLogin,
    discardsLocal: discardsLocal,
    withTombstones: withTombstones,
    withCaseStamps: withCaseStamps,
    toCloud: toCloud,
    fromCloud: fromCloud,
    LOG_SETS: LOG_SETS,
  };
});
