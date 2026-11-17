'use strict';
// tools/demo-data.js（node tools/serve.js --demo のテストデータ）と、tools/serve.js の --demo の返すもの
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');
const W = require('../js/wca-scramble.js');
const Demo = require('../tools/demo-data.js');

const NOW = Date.UTC(2026, 10, 17, 12);
const data = Demo.build({ now: NOW });

test('demo-data：PLL・OLL の記録は今あるケースだけで、新しい順・過去 60 日以内・保存の上限以内', () => {
  const names = { pll: new Set(PLL.map((c) => c.name)), oll: new Set(OLL.map((c) => c.name)) };
  const log = data.practice.log;
  assert.ok(log.length > 300 && log.length <= 2000, String(log.length));
  log.forEach((e, i) => {
    assert.ok(names[e.set].has(e.name), `${e.set} ${e.name}`);
    assert.ok(e.sec === null || (e.sec > 0 && e.sec < 15), String(e.sec));
    assert.ok(e.at <= NOW && e.at > NOW - 61 * 864e5);
    if (i) assert.ok(log[i - 1].at >= e.at, '新しい順');
  });
  // 習得状況と最近のタイムは記録と合っている
  Object.entries(data.progress.pll).forEach(([name, status]) => assert.equal(log.find((e) => e.set === 'pll' && e.name === name).status, status));
  Object.values(data.practice.times.pll).forEach((list) => assert.ok(list.length >= 1 && list.length <= 10));
});

test('demo-data：通しの記録は新しい順で、スクランブルは 3x3 の短い形', () => {
  const full = data.practice.full.log;
  assert.ok(full.length > 150 && full.length <= 2000, String(full.length));
  full.forEach((r, i) => {
    if (i) assert.ok(full[i - 1].at >= r.at);
    assert.ok(['', '+2', 'DNF'].includes(r.penalty));
    assert.match(W.decode(r.s), /^[URFDLB][2']?( [URFDLB][2']?)+$/);
  });
});

// --demo のサーバーに1回だけ問い合わせる
function get(server, pathname) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http.get({ host: '127.0.0.1', port, path: pathname }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

test('serve.js --demo：ページにテストデータのスクリプトを入れ、ログインを使えなくする（--demo なしでは入れない）', async () => {
  const { createServer, PREFIX } = require('../tools/serve.js');
  const demo = createServer({ demo: true, demoData: data }).listen(0, '127.0.0.1');
  const plain = createServer().listen(0, '127.0.0.1');
  try {
    await Promise.all([demo, plain].map((s) => new Promise((r) => s.once('listening', r))));
    assert.match((await get(demo, '/stats')).body, /<head>\n  <script src="\/__demo\/seed\.js"><\/script>/);
    assert.equal((await get(demo, '/js/firebase-config.js')).body.trim().startsWith('window.FIREBASE_CONFIG = null;'), true);
    const seed = await get(demo, '/__demo/seed.js');
    assert.ok(seed.body.includes(JSON.stringify(PREFIX)));
    assert.ok(seed.body.includes(JSON.stringify(data)), 'テストデータがそのまま入る');
    assert.match((await get(demo, '/__demo/reset')).body, /location\.replace\('\/stats'\)/);
    assert.doesNotMatch((await get(plain, '/stats')).body, /__demo/);
    assert.doesNotMatch((await get(plain, '/js/firebase-config.js')).body, /FIREBASE_CONFIG = null/);
    assert.equal((await get(plain, '/__demo/seed.js')).status, 404);
  } finally {
    demo.close();
    plain.close();
  }
});
