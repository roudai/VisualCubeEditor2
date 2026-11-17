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
 *                                  - union: true（この端末で初めてそのアカウントと合わせるとき）は、習得状況（progress）と
 *                                    自分の手順（custom-algs）をケースごとに合わせる（両方にあれば新しい方、片方だけなら残す）
 *
 *   Store.resolveLogin(local, remote, { owner, uid })
 *                                ログインしたときに手元へ反映する snapshot を決める（DOM 非依存）
 *                                  - 手元のデータがそのアカウントのもの（owner === uid）：merge（名前ごとに新しい方）
 *                                  - 手元のデータがまだどのアカウントとも合わせていない（owner が空）：merge（union。
 *                                    ログインする前に使っていた内容をアカウントに持ち込む）
 *                                  - 手元のデータが別のアカウントのもの：手元は使わず、アカウントの内容だけにする
 *                                    （別のアカウントの配色などを持ち込まない。アカウントが空なら初期状態）
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

  function resolveLogin(local, remote, who) {
    const owner = (who && who.owner) || '';
    const uid = who && who.uid;
    if (owner && owner !== uid) return remote && remote.data ? remote : EMPTY();
    return merge(local, remote, { union: owner !== uid });
  }

  return { PREFIX: PREFIX, NAMES: NAMES, get: get, set: set, snapshot: snapshot, replace: replace, merge: merge, resolveLogin: resolveLogin };
});
