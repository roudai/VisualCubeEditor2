'use strict';
// tools/demo-data.js（node tools/serve.js --demo のテストデータ）と、tools/serve.js の --demo の返すもの
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');
const COLL = require('../js/coll-data.js');
const ZBLL = require('../js/zbll-data.js');
const W = require('../js/wca-scramble.js');
const Demo = require('../tools/demo-data.js');

const NOW = Date.UTC(2026, 10, 17, 12);
const data = Demo.build({ now: NOW });

test('demo-data：PLL・OLL・COLL の記録は今あるケースだけで、新しい順・過去 60 日以内・保存の上限以内', () => {
  const names = { pll: new Set(PLL.map((c) => c.name)), oll: new Set(OLL.map((c) => c.name)), coll: new Set(COLL.map((c) => c.name)), zbll: new Set(ZBLL.map((c) => c.name)) };
  assert.ok(data.practice.log.some((e) => e.set === 'coll'), 'COLL の記録がある');
  ['coll', 'zbll'].forEach((set) => {
    assert.ok(data.practice.log.filter((e) => e.set === set).length >= 150, `${set} の記録が 150 件以上ある`);
    assert.ok(Object.keys(data.progress[set]).length >= 30, `${set} の習得状況が 30 ケース以上ある`);
  });
  // 習得の目安は種類ごと（判定もその目安で付いている）
  assert.deepEqual(Object.keys(data.practice.thresholds).sort(), ['coll', 'oll', 'pll', 'zbll']);
  data.practice.log.forEach((e) => {
    if (e.sec !== null && !e.hint) assert.equal(e.status, e.sec <= data.practice.thresholds[e.set] ? 'learned' : 'learning');
  });
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

test('demo-data：どの種類も最近まで記録がある（記録のページの期間「7日」が空にならない）', () => {
  const recent = (list) => list.filter((r) => r.at > NOW - 7 * 864e5).length;
  ['pll', 'oll', 'coll', 'zbll'].forEach((set) => {
    const list = data.practice.log.filter((e) => e.set === set);
    assert.ok(recent(list) >= 10, `${set}：7 日以内 ${recent(list)} 件`);
    assert.ok(NOW - list[0].at < 2 * 864e5, `${set}：最後の記録が 2 日以内`);
  });
  const full = data.practice.full.log;
  assert.ok(recent(full) >= 10, `通し：7 日以内 ${recent(full)} 件`);
  assert.ok(NOW - full[0].at < 2 * 864e5, '通し：最後の記録が 2 日以内');
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
    assert.ok(seed.body.includes(`VERSION = "demo:v${Demo.VERSION}"`), '入れた版・モードが違えば入れ直す');
    assert.ok(seed.body.includes("'/__demo/data.json'"), 'データは別に読む（ページに埋め込まない）');
    assert.deepEqual(JSON.parse((await get(demo, '/__demo/data.json')).body), data, 'テストデータがそのまま入る');
    assert.match((await get(demo, '/__demo/reset')).body, /location\.replace\('\/stats'\)/);
    assert.doesNotMatch((await get(plain, '/stats')).body, /__demo/);
    assert.doesNotMatch((await get(plain, '/js/firebase-config.js')).body, /FIREBASE_CONFIG = null/);
    assert.equal((await get(plain, '/__demo/seed.js')).status, 404);
    assert.equal((await get(plain, '/__demo/data.json')).status, 404);
  } finally {
    demo.close();
    plain.close();
  }
});

test('serve.js --demo --max：印のモードが max になる（同じポートで --max の有無を変えたら入れ直す）', async () => {
  const { createServer } = require('../tools/serve.js');
  const server = createServer({ demo: true, max: true, demoData: { practice: {} } }).listen(0, '127.0.0.1');
  try {
    await new Promise((r) => server.once('listening', r));
    const seed = await get(server, '/__demo/seed.js');
    assert.ok(seed.body.includes(`VERSION = "max:v${Demo.VERSION}"`));
    assert.ok(seed.body.includes('最大のデータ'));
    assert.deepEqual(JSON.parse((await get(server, '/__demo/data.json')).body), { practice: {} });
  } finally {
    server.close();
  }
});

test('demo-data：buildMax は記録がどれも上限まで（過去 400 日・毎日）、全ケース習得・自分の手順', () => {
  const max = Demo.buildMax({ now: NOW, scramblePool: 3 });
  const sets = { pll: PLL, oll: OLL, coll: COLL, zbll: ZBLL };
  const log = max.practice.log;
  Object.entries(sets).forEach(([set, cases]) => {
    const list = log.filter((e) => e.set === set);
    assert.equal(list.length, 5000, set);
    const names = new Set(cases.map((c) => c.name));
    assert.ok(list.every((e) => names.has(e.name)), `${set} は今あるケースだけ`);
    assert.equal(new Set(list.map((e) => e.name)).size, cases.length, `${set} は全ケースが出る`);
    assert.ok(cases.every((c) => max.progress[set][c.name] === 'learned'), `${set} はすべて習得済み`);
    assert.ok(cases.every((c) => max.practice.times[set][c.name].length === 10), `${set} の最近のタイムは 10 件ずつ`);
  });
  log.forEach((e, i) => {
    if (i) assert.ok(log[i - 1].at >= e.at, '新しい順');
    assert.ok(e.at <= NOW && e.at > NOW - 401 * 864e5);
  });
  assert.equal(new Set(log.map((e) => Math.floor((NOW - e.at) / 864e5))).size >= 399, true, '毎日の記録がある');
  assert.equal(max.practice.full.log.length, 5000);
  assert.equal(max.practice.ll.log.length, 5000);
  [max.practice.full.log, max.practice.ll.log].forEach((list) => list.forEach((r, i) => i && assert.ok(list[i - 1].at >= r.at, '新しい順')));
  assert.ok(max.practice.ll.log.every((r) => OLL.some((c) => c.name === r.o) && (r.p === undefined || PLL.some((c) => c.name === r.p))));
  ['pll', 'oll', 'coll'].forEach((set) => assert.equal(Object.keys(max['custom-algs'][set]).length, sets[set].length, `${set} は全ケースが自分の手順`));
});
