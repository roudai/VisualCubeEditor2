// 実行: node --test
// js/store.js（保存の窓口と、手元・クラウドのデータの合わせ方）
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../js/store.js');

// メモリ上の localStorage
function memoryStorage(initial) {
  const map = new Map(Object.entries(initial || {}));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    map: map,
  };
}
function withStorage(initial, fn) {
  global.localStorage = memoryStorage(initial);
  try {
    return fn(global.localStorage);
  } finally {
    delete global.localStorage;
  }
}

test('get / set：JSON と文字列を読み書きし、更新時刻を記録する。同じ値なら時刻を変えない', () => {
  withStorage({}, (ls) => {
    Store.set('settings', { preset: 'oll' });
    Store.set('lang', 'ja');
    assert.deepEqual(Store.get('settings'), { preset: 'oll' });
    assert.equal(Store.get('lang'), 'ja');
    assert.equal(ls.getItem('visualcube-editor:lang'), 'ja'); // 言語は今までどおり文字列のまま
    const t = JSON.parse(ls.getItem('visualcube-editor:updated')).settings;
    assert.equal(typeof t, 'number');
    ls.setItem('visualcube-editor:updated', JSON.stringify({ settings: 1 }));
    Store.set('settings', { preset: 'oll' });
    assert.equal(JSON.parse(ls.getItem('visualcube-editor:updated')).settings, 1);
    assert.equal(Store.get('progress'), null);
  });
});

test('今までに保存されたデータ（更新時刻なし）もそのまま読め、snapshot では時刻 0 になる', () => {
  withStorage({ 'visualcube-editor:progress': '{"pll":{"A1+":"learned"}}', 'visualcube-editor:lang': 'en' }, () => {
    assert.deepEqual(Store.snapshot(), {
      data: { progress: { pll: { 'A1+': 'learned' } }, lang: 'en' },
      updated: { progress: 0, lang: 0 },
    });
  });
});

test('replace：snapshot の内容で書き換え、無い名前は消す', () => {
  withStorage({ 'visualcube-editor:lang': 'en', 'visualcube-editor:list-filter': '{"pll":"all"}' }, () => {
    Store.replace({ data: { lang: 'ja', settings: { preset: 'standard' } }, updated: { lang: 5, settings: 6 } });
    assert.deepEqual(Store.snapshot(), { data: { settings: { preset: 'standard' }, lang: 'ja' }, updated: { settings: 6, lang: 5 } });
  });
});

test('merge：名前ごとに新しい方を使う（片方にしかない名前は残す）', () => {
  const local = { data: { settings: { a: 1 }, lang: 'en' }, updated: { settings: 10, lang: 1 } };
  const remote = { data: { settings: { a: 2 }, lang: 'ja', progress: { pll: {} } }, updated: { settings: 5, lang: 9, progress: 3 } };
  assert.deepEqual(Store.merge(local, remote), {
    data: { settings: { a: 1 }, progress: { pll: {} }, lang: 'ja' },
    updated: { settings: 10, progress: 3, lang: 9 },
  });
});

test('merge：union なら習得状況・自分の手順をケースごとに合わせる（両方にあれば新しい方）', () => {
  const local = {
    data: { progress: { pll: { 'A1+': 'learned', 'A1-': 'learning' } }, 'custom-algs': { oll: { '1A': { alg: 'x', setup: 'y' } } } },
    updated: { progress: 20, 'custom-algs': 1 },
  };
  const remote = {
    data: { progress: { pll: { 'A1-': 'learned' }, oll: { '2A': 'learned' } }, 'custom-algs': { pll: { 'J3+': { alg: 'a', setup: 's' } } } },
    updated: { progress: 10, 'custom-algs': 2 },
  };
  const merged = Store.merge(local, remote, { union: true });
  assert.deepEqual(merged.data.progress, { pll: { 'A1+': 'learned', 'A1-': 'learning' }, oll: { '2A': 'learned' } });
  assert.deepEqual(merged.data['custom-algs'], { oll: { '1A': { alg: 'x', setup: 'y' } }, pll: { 'J3+': { alg: 'a', setup: 's' } } });
  assert.equal(merged.updated.progress, 20);
  // union でなければ新しい方をそのまま使う（片方で消したケースが戻らない）
  assert.deepEqual(Store.merge(local, remote).data.progress, local.data.progress);
});

test('merge：初めてのログイン（クラウドが空）は手元のまま。壊れた値でも落ちない', () => {
  const local = { data: { lang: 'ja' }, updated: { lang: 3 } };
  assert.deepEqual(Store.merge(local, null, { union: true }), local);
  assert.deepEqual(Store.merge(local, { data: { progress: 'broken' }, updated: {} }, { union: true }).data, { progress: 'broken', lang: 'ja' });
  assert.deepEqual(
    Store.merge({ data: { progress: 'broken' }, updated: { progress: 1 } }, { data: { progress: { pll: { x: 'learned' } } }, updated: { progress: 2 } }, { union: true }).data.progress,
    { pll: { x: 'learned' } }
  );
});

test('resolveLogin：新しいログインはアカウントの内容で上書き（合算しない）。アカウントが空なら手元を入れる。ログインしたままなら新しい方', () => {
  const log = (name, at) => ({ at: at, set: 'pll', name: name, sec: 5, status: 'learned' });
  const local = {
    data: { settings: { preset: 'custom' }, progress: { pll: { 'A1+': 'learned' } }, practice: { log: [log('A1+', 300)] }, lang: 'en' },
    updated: { settings: 50, progress: 300, practice: 300, lang: 5 },
  };
  const remote = {
    data: { settings: { preset: 'standard' }, progress: { pll: { 'B1+': 'learned' } }, practice: { log: [log('B1+', 2), log('B2+', 1)] }, lang: 'ja' },
    updated: { settings: 10, progress: 10, practice: 10, lang: 1 },
  };
  const fromRemote = { data: Object.assign({}, remote.data, { lang: 'en' }), updated: Object.assign({}, remote.updated, { lang: 5 }) };
  // ログインしたままページを開き直した：設定などは新しい方、練習の記録は両方（同じアカウントの別の端末の記録を消さない）
  const cont = Store.resolveLogin(local, remote, { owner: 'A', uid: 'A' }).data;
  assert.deepEqual(cont.settings, local.data.settings);
  assert.deepEqual(cont.progress, local.data.progress);
  assert.deepEqual(cont.practice.log.map((e) => e.name), ['A1+', 'B1+', 'B2+']);
  assert.equal(Store.discardsLocal(local, remote, { owner: 'A', uid: 'A' }), false);
  // 新しいログイン（ログインせずに使っていた・同じアカウントに戻った・別のアカウント）：アカウントの内容で上書き。言語だけ手元
  [{ owner: null, uid: 'A', fresh: true }, { owner: 'A', uid: 'A', fresh: true }, { owner: 'B', uid: 'A', fresh: true }, { owner: 'B', uid: 'A' }].forEach((who) => {
    assert.deepEqual(Store.resolveLogin(local, remote, who), fromRemote);
    assert.equal(Store.discardsLocal(local, remote, who), true); // ログイン前の記録・習得状況を捨てる
  });
  // アカウントの記録が手元より多くても、手元で数件練習しただけで消えない（以前の合わせ方の不具合）
  assert.equal(Store.resolveLogin(local, remote, { owner: 'A', uid: 'A', fresh: true }).data.practice.log.length, 2);
  // アカウントが空（初めてのログイン・アカウントを削除して作り直した）：手元の内容をそのまま入れる
  assert.deepEqual(Store.resolveLogin(local, null, { owner: null, uid: 'A', fresh: true }), local);
  assert.deepEqual(Store.resolveLogin(local, { data: { lang: 'ja' }, updated: { lang: 1 } }, { owner: null, uid: 'A', fresh: true }), local);
  assert.equal(Store.discardsLocal(local, null, { owner: null, uid: 'A', fresh: true }), false);
  // アカウントが空でも、手元が別のアカウントのものなら持ち込まない（言語だけ残す）
  assert.deepEqual(Store.resolveLogin(local, null, { owner: 'B', uid: 'A', fresh: true }), { data: { lang: 'en' }, updated: { lang: 5 } });
  assert.equal(Store.discardsLocal(local, null, { owner: 'B', uid: 'A', fresh: true }), true);
  // 手元に使った跡が無い（設定・言語だけ）、または手元がアカウントと同じなら、捨てたことにしない
  const blank = { data: { settings: { preset: 'custom' }, lang: 'en' }, updated: { settings: 50, lang: 5 } };
  assert.equal(Store.discardsLocal(blank, remote, { owner: null, uid: 'A', fresh: true }), false);
  assert.equal(Store.discardsLocal(remote, remote, { owner: 'A', uid: 'A', fresh: true }), false);
});

test('toCloud / fromCloud：PLL・OLL・COLL・ZBLL の記録を種類ごとの短い形に分け、読んだら元に戻す', () => {
  const log = [
    { at: 7, set: 'zbll', name: 'U-Diag5', sec: 5.79, status: 'learning', hint: false },
    { at: 6, set: 'coll', name: 'H1', sec: 3.1, status: 'learned', hint: false },
    { at: 5, set: 'oll', name: '21', sec: 12.34, status: 'learned', hint: false },
    { at: 4, set: 'pll', name: 'Aa', sec: null, status: 'learning', hint: true },
    { at: 3, set: 'pll', name: 'H', sec: 7.28, status: 'learned', hint: false },
  ];
  const snap = { data: { practice: { set: 'pll', log: log, full: { log: [{ at: 1, sec: 50, penalty: '', s: 'x' }] } }, lang: 'ja' }, updated: { practice: 9, lang: 1 } };
  const cloud = Store.toCloud(snap);
  // 本体には記録を入れない（ソルブの記録は本体のまま）
  assert.equal(cloud.main.logsSplit, true);
  assert.equal('log' in cloud.main.data.practice, false);
  assert.deepEqual(cloud.main.data.practice.full, snap.data.practice.full);
  assert.deepEqual(cloud.logs.pll, [[4, 'Aa', null, 1, 1], [3, 'H', 7.28, 2]]);
  assert.deepEqual(cloud.logs.oll, [[5, '21', 12.34, 2]]);
  assert.deepEqual(cloud.logs.coll, [[6, 'H1', 3.1, 2]]);
  assert.deepEqual(cloud.logs.zbll, [[7, 'U-Diag5', 5.79, 1]]);
  // 手元の snapshot は変えない
  assert.equal(snap.data.practice.log.length, 5);
  // JSON を通して読み戻すと同じ
  const back = Store.fromCloud(JSON.parse(JSON.stringify(cloud.main)), JSON.parse(JSON.stringify(cloud.logs)));
  assert.deepEqual(back, snap);
});

test('fromCloud：以前の形（logsSplit の無い本体）はそのまま。種類ごとの文書が無ければ記録は空', () => {
  const old = { data: { practice: { log: [{ at: 1, set: 'pll', name: 'Aa', sec: 3, status: 'learned', hint: false }] } }, updated: { practice: 1 } };
  assert.deepEqual(Store.fromCloud(old, { pll: [[9, 'Z', 1, 2]] }), old);
  const split = { data: { practice: { set: 'oll' } }, updated: { practice: 2 }, logsSplit: true };
  assert.deepEqual(Store.fromCloud(split, {}).data.practice, { set: 'oll', log: [] });
  assert.equal(Store.fromCloud(null, {}), null);
});

test('toCloud：4 種類 × 5000 件でも各文書が上限に収まる。本体だけに書く以前の形（inline）は最新 2000 件', () => {
  const sets = Store.LOG_SETS;
  assert.deepEqual(sets, ['pll', 'oll', 'coll', 'zbll']);
  const log = [];
  for (let i = 0; i < 20000; i++) {
    log.push({ at: 1795158456787 - i * 1000, set: sets[i % 4], name: 'U-Diag5', sec: 12.34, status: 'learned', hint: i % 7 === 0 });
  }
  const full = [];
  for (let i = 0; i < 2000; i++) full.push({ at: 1795158456787 - i * 1000, sec: 12.34, penalty: '', s: "R U R' U' F2 L2 D B2 R2 F' U2 L D2 R' B U' F2 L' D R2" });
  const cloud = Store.toCloud({ data: { practice: { log: log, full: { log: full } } }, updated: {} });
  sets.forEach((set) => {
    assert.equal(cloud.logs[set].length, 5000);
    assert.ok(JSON.stringify({ rows: cloud.logs[set] }).length < 500000);
  });
  assert.ok(JSON.stringify(cloud.main).length < 500000);
  assert.equal(cloud.inline.data.practice.log.length, 2000);
  assert.equal(cloud.inline.data.practice.log[0].at, log[0].at);
  // 知らない項目のある記録はそのまま残す
  const odd = { at: 1, set: 'pll', name: 'Aa', sec: 1, status: 'learned', extra: 1 };
  assert.deepEqual(Store.toCloud({ data: { practice: { log: [odd] } }, updated: {} }).logs.pll, [odd]);
});

test('withTombstones：消した記録に印を付ける（上限で押し出したものには付けない。戻したら外す。入りきらないすべて削除は日時 1 つ）', () => {
  const e = (set, at) => ({ at: at, set: set, name: 'A1+', sec: 5, status: 'learned' });
  const prev = { log: [e('pll', 5), e('pll', 4), e('oll', 3)], full: { log: [{ at: 9, sec: 60, penalty: '' }, { at: 8, sec: 61, penalty: '' }] } };
  // 1 件消す
  let next = Store.withTombstones(prev, Object.assign({}, prev, { log: [e('pll', 5), e('oll', 3)] }));
  assert.deepEqual(next.removed, { pll: [4] });
  // 戻す（元に戻す）と印を外す
  next = Store.withTombstones(next, Object.assign({}, next, { log: prev.log }));
  assert.equal(next.removed, undefined);
  // ソルブをすべて削除（2 件）：1 件ずつの印に入りきるので、消えた記録にだけ印を付ける（移植元は日時 1 つの cleared）。戻せば外す
  next = Store.withTombstones(prev, Object.assign({}, prev, { full: { log: [] } }));
  assert.deepEqual(next.removed, { full: [9, 8] });
  assert.equal(next.cleared, undefined);
  next = Store.withTombstones(next, Object.assign({}, next, { full: prev.full }));
  assert.equal(next.removed, undefined);
  // 1 件ずつの印（1000 件）に入りきらないすべて削除：日時 1 つ（cleared）。戻せば外す
  const lots = { log: [], full: { log: Array.from({ length: 1500 }, (_, i) => ({ at: 5000 - i, sec: 60, penalty: '' })) } };
  next = Store.withTombstones(lots, { log: [], full: { log: [] } });
  assert.deepEqual(next.cleared, { full: 5000 });
  assert.equal(next.removed, undefined);
  next = Store.withTombstones(next, Object.assign({}, next, { full: lots.full }));
  assert.equal(next.cleared, undefined);
  // 上限（5000 件）で押し出された古い記録には付けない
  const many = Array.from({ length: 5000 }, (_, i) => e('pll', 20000 - i));
  const pushed = [e('pll', 30000)].concat(many.slice(0, 4999));
  next = Store.withTombstones({ log: many }, { log: pushed });
  assert.equal(next.removed, undefined);
});

test('withTombstones・merge：その種類の記録が 1 件だけのときに「取り消す」しても、別の端末のそれより前の記録は消さない', () => {
  const e = (set, at) => ({ at: at, set: set, name: '1', sec: 3, status: 'learned', hint: false });
  // 端末 B：OLL・ソルブを練習してクラウドに書いた（端末 A はまだ読んでいない）
  const remote = { data: { practice: { log: [e('oll', 1003), e('oll', 1002), e('zbll', 1001)], full: { log: [{ at: 1000, sec: 30, penalty: '' }] } } }, updated: { practice: 50 } };
  // 端末 A：OLL・ZBLL・ソルブを 1 回ずつ練習して、それぞれすぐ「取り消す」
  const prev = { log: [e('oll', 2000), e('zbll', 2001)], full: { log: [{ at: 2002, sec: 40, penalty: '' }] } };
  const next = Store.withTombstones(prev, { log: [], full: { log: [] } });
  assert.deepEqual(next.removed, { oll: [2000], zbll: [2001], full: [2002] });
  assert.equal(next.cleared, undefined);
  const m = Store.merge({ data: { practice: next }, updated: { practice: 60 } }, remote).data.practice;
  assert.deepEqual(m.log.map((x) => x.at), [1003, 1002, 1001]); // B の記録は残る
  assert.deepEqual(m.full.log.map((x) => x.at), [1000]);
});

test('merge：COLL・ZBLL の記録と最近のタイムも合わせる', () => {
  const e = (set, name, at, sec) => ({ at: at, set: set, name: name, sec: sec, status: 'learned', hint: false });
  const a = { log: [e('coll', 'H1', 30, 2), e('pll', 'Aa', 20, 3)], times: { coll: { H1: [2] }, pll: { Aa: [3] } } };
  const b = { log: [e('zbll', 'T-1', 25, 4), e('coll', 'H1', 10, 5)], times: { zbll: { 'T-1': [4] }, coll: { H1: [5] } } };
  const m = Store.merge({ data: { practice: a }, updated: { practice: 2 } }, { data: { practice: b }, updated: { practice: 1 } }).data.practice;
  assert.deepEqual(m.log.map((x) => x.at), [30, 25, 20, 10]);
  assert.deepEqual(m.times.coll.H1, [2, 5]);
  assert.deepEqual(m.times.zbll['T-1'], [4]);
  assert.deepEqual(m.times.pll.Aa, [3]);
});

test('merge：同じアカウントの 2 つの端末の練習の記録を合わせる（消した記録は戻らない。最近のタイムは作り直す。設定は新しい方）', () => {
  const e = (set, name, at, sec, extra) => Object.assign({ at: at, set: set, name: name, sec: sec, status: 'learned' }, extra);
  // パソコン（クラウド）：PLL を 3 回、そのうち 1 回（at 2）をスマホが前に見ていた
  const pc = {
    set: 'pll',
    thresholds: { pll: 8 },
    log: [e('pll', 'A1+', 30, 3), e('pll', 'A1+', 20, 4), e('pll', 'H+', 2, 9)],
    times: { pll: { 'A1+': [3, 4], 'H+': [9] } },
    full: { inspection: true, log: [{ at: 50, sec: 70, penalty: '' }] },
  };
  // スマホ：あとから OLL を 1 回と PLL を 1 回。at 2 の記録は消した（印）。設定も変えた
  const phone = Store.withTombstones(
    { log: [e('pll', 'H+', 2, 9)] },
    {
      set: 'oll',
      thresholds: { pll: 6 },
      log: [e('oll', '1A', 40, 5), e('pll', 'A1+', 35, 2, { hint: true })],
      times: { oll: { '1A': [5] }, pll: {} },
      full: { inspection: false, log: [{ at: 45, sec: 80, penalty: 'DNF' }] },
    }
  );
  const local = { data: { practice: phone }, updated: { practice: 200 } };
  const remote = { data: { practice: pc }, updated: { practice: 100 } };
  const m = Store.merge(local, remote).data.practice;
  assert.deepEqual(m.log.map((x) => x.at), [40, 35, 30, 20]); // at 2 は消した印があるので戻らない
  assert.deepEqual(m.full.log.map((x) => x.at), [50, 45]);
  assert.equal(m.set, 'oll'); // 設定は新しい方
  assert.deepEqual(m.thresholds, { pll: 6 });
  assert.equal(m.full.inspection, false);
  // 最近のタイム：合わせた記録から（ヒントを見た回は入れない）
  assert.deepEqual(m.times.pll['A1+'], [3, 4]);
  assert.deepEqual(m.times.oll['1A'], [5]);
  assert.deepEqual(m.removed, { pll: [2] });
  // 逆向き（クラウドの方が新しい）でも記録は同じ
  const m2 = Store.merge({ data: { practice: phone }, updated: { practice: 100 } }, { data: { practice: pc }, updated: { practice: 200 } }).data.practice;
  assert.deepEqual(m2.log.map((x) => x.at), [40, 35, 30, 20]);
  assert.equal(m2.set, 'pll');
  // すべて削除（cleared）した種類は、その日時以前の記録を戻さない
  const cleared = Object.assign({}, phone, { cleared: { full: 60 }, full: { inspection: false, log: [] } });
  const m3 = Store.merge({ data: { practice: cleared }, updated: { practice: 200 } }, remote).data.practice;
  assert.deepEqual(m3.full.log, []);
});
