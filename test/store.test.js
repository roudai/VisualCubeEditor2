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

test('resolveLogin：手元のデータの持ち主によって合わせ方を変える', () => {
  const local = { data: { settings: { preset: 'custom' }, progress: { pll: { 'A1+': 'learned' } } }, updated: { settings: 50, progress: 50 } };
  const remote = { data: { settings: { preset: 'standard' }, progress: { pll: { 'B1+': 'learned' } } }, updated: { settings: 10, progress: 10 } };
  // 同じアカウント：新しい方
  assert.deepEqual(Store.resolveLogin(local, remote, { owner: 'A', uid: 'A' }).data, local.data);
  // まだどのアカウントとも合わせていない：ケースごとに合わせて持ち込む
  assert.deepEqual(Store.resolveLogin(local, remote, { owner: null, uid: 'A' }).data.progress, { pll: { 'B1+': 'learned', 'A1+': 'learned' } });
  // 別のアカウントのデータ：持ち込まず、アカウントの内容だけ（アカウントが空なら初期状態）
  assert.deepEqual(Store.resolveLogin(local, remote, { owner: 'A', uid: 'B' }), remote);
  assert.deepEqual(Store.resolveLogin(local, null, { owner: 'A', uid: 'B' }), { data: {}, updated: {} });
});
