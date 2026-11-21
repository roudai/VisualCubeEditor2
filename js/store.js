/*
 * 保存の窓口（localStorage）。エディタ・一覧ページの保存はすべてここを通す。ログイン中は cloud-sync.js がクラウドと合わせる。
 * 仕様: reference/CLOUD_SYNC_SPEC.md
 *
 *   Store.get(name)              値を読む（JSON として読めなければ文字列のまま。無ければ null）
 *   Store.set(name, value)       値を書く（前と同じなら何もしない）。更新時刻を記録し、window に 'store-change' を通知する
 *   Store.snapshot()             { data: { name: value }, updated: { name: 時刻(ms) } }（保存されているものだけ）
 *   Store.replace(snapshot)      snapshot の内容で書き換える（cloud-sync.js がクラウドの内容を反映するときに使う。通知しない）
 *   Store.merge(local, remote, { union })
 *                                手元とクラウドの snapshot を合わせた snapshot を返す（DOM 非依存）
 *                                  - 名前ごとに更新時刻の新しい方を使う
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
 *   Store.toCloud(snapshot)      クラウドに書く形に分ける（DOM 非依存）→ { main, logs: { pll, oll, coll, zbll }, inline }
 *                                  - main：練習の記録（practice.log）を抜いた snapshot に logsSplit: true を付けたもの（本体の文書）
 *                                  - logs：PLL・OLL・COLL・ZBLL の記録を短い形（[日時, ケース, タイム, 判定, ヒント]）にしたもの（種類ごとの文書）。
 *                                    1 文書の上限（LOG_LIMIT 文字）を超えるときは古い記録を捨てる
 *                                  - inline：記録を本体に入れたままの以前の形（記録は合わせて最新 INLINE_MAX 件）。
 *                                    種類ごとの文書に書けなかったとき（Firestore のルールが古いなど）に本体だけに書く
 *   Store.fromCloud(main, logs)  クラウドから読んだ本体と種類ごとの記録を 1 つの snapshot に戻す（DOM 非依存）。
 *                                  logsSplit の無い本体（以前の形・古いページが書いたもの）はそのまま使う
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

  // ケースごとに合わせる：older の上に newer を重ねる（{ pll: {…}, oll: {…} } のそれぞれで）
  function mergePerCase(older, newer) {
    const out = {};
    [older, newer].forEach((src) => {
      if (!isObject(src)) return;
      Object.keys(src).forEach((set) => {
        if (!isObject(src[set])) return;
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
      const useLocal = inL && (!inR || tl >= tr);
      out.data[name] = useLocal ? l.data[name] : r.data[name];
      out.updated[name] = useLocal ? tl : tr;
    });
    return out;
  }

  const EMPTY = () => ({ data: {}, updated: {} });

  // ---- クラウドに書く形（js/cloud-sync.js）----
  // Firestore の 1 文書は firestore.rules で json 50 万文字未満。PLL・OLL・COLL・ZBLL の記録（各最大 5000 件）は本体に入らないので、
  // 種類ごとの文書に短い形で分ける（1 件 約 30 文字 → 5000 件で約 16 万文字）
  const LOG_SETS = ['pll', 'oll', 'coll', 'zbll'];
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
    const logs = {};
    LOG_SETS.forEach((set) => {
      let rows = log.filter((e) => e && e.set === set).map(packEntry);
      // 上限を超えるときは古い記録から捨てる（ふつうは 5000 件でも収まる）
      while (rows.length && JSON.stringify({ rows: rows }).length >= LOG_LIMIT) rows = rows.slice(0, Math.floor(rows.length * 0.95));
      logs[set] = rows;
    });
    const data = Object.assign({}, s.data);
    if (practice) {
      const rest = Object.assign({}, practice);
      const others = log.filter((e) => !(e && LOG_SETS.includes(e.set)));
      if (others.length) rest.log = others;
      else delete rest.log;
      data.practice = rest;
    }
    const main = { data: data, updated: Object.assign({}, s.updated), logsSplit: true };
    const inlineData = Object.assign({}, s.data);
    if (practice && log.length > INLINE_MAX) inlineData.practice = Object.assign({}, practice, { log: log.slice(0, INLINE_MAX) });
    const inline = { data: inlineData, updated: Object.assign({}, s.updated) };
    return { main: main, logs: logs, inline: inline };
  }

  function fromCloud(main, logs) {
    if (!main || !isObject(main.data)) return null;
    const out = { data: Object.assign({}, main.data), updated: Object.assign({}, main.updated) };
    if (!main.logsSplit) return out;
    const practice = isObject(out.data.practice) ? out.data.practice : null;
    const log = [];
    LOG_SETS.forEach((set) => {
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
    const logs = (p) => (isObject(p) ? JSON.stringify([p.log || [], (isObject(p.full) && p.full.log) || []]) : '[[],[]]');
    if (filled(l.progress) && JSON.stringify(l.progress) !== JSON.stringify(r.progress)) return true;
    if (filled(l['custom-algs']) && JSON.stringify(l['custom-algs']) !== JSON.stringify(r['custom-algs'])) return true;
    return logs(l.practice) !== '[[],[]]' && logs(l.practice) !== logs(r.practice);
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
    toCloud: toCloud,
    fromCloud: fromCloud,
    LOG_SETS: LOG_SETS,
  };
});
