// 動作確認用のテストデータ（node tools/serve.js --demo で使う。本番のページは読まない）
// 練習の記録（PLL・OLL・通し）・ケースごとの最近のタイム・習得状況を、今から過去 60 日ぶん作る。
// 乱数は種を固定しているので、同じ日時なら毎回同じデータになる（日時は今に合わせてずらす）。
// MegaminxImageEditor の tools/demo-data.js を 3x3 用にしたもの（タイム・習得の目安を 3x3 の速さに合わせ、
// 覚える順・範囲（algset）が無いのでデータの順に使い、通しのスクランブルは random-state の 3x3）。
//
//   build({ now })  → { practice, progress }（store.js の 'practice'・'progress' にそのまま入れる形）
'use strict';
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');
const W = require('../js/wca-scramble.js');

const DAY = 24 * 60 * 60 * 1000;
const THRESHOLD = 3; // 習得の目安（秒。練習ページの既定と同じ）

// 種を固定した乱数（mulberry32）
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const round2 = (x) => Math.round(x * 100) / 100;

// count 回の練習の日時（古い順）。days 日前から今まで、練習する日と1日の中の時刻をばらつかせる
function sessions(random, count, days, now) {
  const out = [];
  let t = now - days * DAY;
  const step = (days * DAY) / count;
  for (let i = 0; i < count; i++) {
    // ときどき数日あける（練習しない日）。それ以外は数分おき
    t += random() < 0.04 ? step * (8 + random() * 20) : step * (0.2 + random() * 0.6);
    if (t > now - 60 * 1000) break;
    out.push(Math.round(t));
  }
  return out;
}

// PLL・OLL：前の方のケースほど多く、速く解けるようにする（6 秒前後から 2 秒前後へ）
function caseLog(random, set, cases, count, days, now) {
  const log = [];
  sessions(random, count, days, now).forEach((at, i, all) => {
    const progress = i / all.length; // 0 → 1 で全体に速くなる
    // 前の方のケースを選びやすくする
    const k = Math.floor(Math.pow(random(), 1.6) * cases.length);
    const c = cases[k];
    const skill = 1 - k / cases.length; // 前の方のケースほど慣れている
    const hint = random() < 0.04;
    let sec = null;
    if (random() > 0.05 + (1 - skill) * 0.06) {
      sec = round2(Math.max(1.2, 6.5 - progress * 2.5 - skill * 2 + (random() - 0.4) * 2.5));
    }
    const status = !hint && sec !== null && sec <= THRESHOLD ? 'learned' : 'learning';
    log.push({ at: at, set: set, name: c.name, sec: sec, status: status, hint: hint });
  });
  return log;
}

// 通し：35 秒前後から 22 秒前後へ。+2 と DNF をときどき
function fullLog(random, count, days, now) {
  return sessions(random, count, days, now).map((at, i, all) => {
    const base = 35 - (i / all.length) * 13;
    const r = random();
    const sec = round2(base + (random() - 0.45) * 6 + (random() < 0.03 ? 10 : 0));
    return { at: at, sec: sec, penalty: r < 0.025 ? 'DNF' : r < 0.06 ? '+2' : '', s: W.encode(W.cube3(random)) };
  });
}

function build(opts) {
  const now = (opts && opts.now) || Date.now();
  const random = rng(20261117);
  const caseRecords = caseLog(random, 'pll', PLL, 420, 45, now)
    .concat(caseLog(random, 'oll', OLL.slice(0, 40), 260, 30, now))
    .sort((a, b) => b.at - a.at) // 新しい順
    .slice(0, 2000);

  // ケースごとの最近のタイム（新しい順、最大 10 件。解けなかった・ヒントを見たものは入れない）と、習得状況（最後の判定）
  const times = { pll: {}, oll: {} };
  const progress = { pll: {}, oll: {} };
  caseRecords.forEach((e) => {
    if (!progress[e.set][e.name]) progress[e.set][e.name] = e.status;
    if (e.sec === null || e.hint) return;
    const list = times[e.set][e.name] || (times[e.set][e.name] = []);
    if (list.length < 10) list.push(e.sec);
  });

  const practice = {
    set: 'pll',
    filter: 'all',
    threshold: THRESHOLD,
    log: caseRecords,
    times: times,
    full: { inspection: true, log: fullLog(random, 260, 60, now).reverse() }, // 新しい順
    stats: { set: 'full', period: 'all', sort: 'weak', desc: true, sortV: 2, tab: 'cases' },
  };
  return { practice: practice, progress: progress };
}

module.exports = { build: build, THRESHOLD: THRESHOLD };
