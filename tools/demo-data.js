// 動作確認用のテストデータ（node tools/serve.js --demo で使う。本番のページは読まない）
// 練習の記録（PLL・OLL・COLL・ZBLL・通し）・ケースごとの最近のタイム・習得状況を、今から過去 60 日ぶん作る。
// 乱数は種を固定しているので、同じ日時なら毎回同じデータになる（日時は今に合わせてずらす）。
// MegaminxImageEditor の tools/demo-data.js を 3x3 用にしたもの（タイム・習得の目安を 3x3 の速さに合わせ、
// 覚える順・範囲（algset）が無いのでデータの順に使い、通しのスクランブルは random-state の 3x3）。
//
//   build({ now })  → { practice, progress }（store.js の 'practice'・'progress' にそのまま入れる形）
//   buildMax({ now, scramblePool }) → { practice, progress, 'custom-algs' }：最大のデータ（node tools/serve.js --demo --max。下の説明）
//   VERSION         テストデータの中身（種類・量）を変えたら上げる。serve.js --demo は、ブラウザに入れた版と違えば入れ直す
'use strict';
const PLL = require('../js/pll-data.js');
const OLL = require('../js/oll-data.js');
const COLL = require('../js/coll-data.js');
const ZBLL = require('../js/zbll-data.js');
const W = require('../js/wca-scramble.js');

const DAY = 24 * 60 * 60 * 1000;
// 習得の目安（秒）。種類ごと（移植元の PLL 8・OLL 5 を、このテストデータの速さ 1.2〜6.5 秒に合わせて読み替えた）
const THRESHOLDS = { pll: 3, oll: 2, coll: 3, zbll: 3 };
const VERSION = 5; // 2：COLL・ZBLL の記録を入れた。3：記録のページを通しで開くよう practice.set を full に。4：どの種類も最近まで記録があるようにした（通しが 12 日前で終わっていた）。5：最大のデータの自分の手順を「(U) ＋既定」に（R R' は保存のときにまとめられて既定と同じになるため）

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
  const start = now - days * DAY;
  let t = start;
  const step = (days * DAY) / count;
  let reached = false;
  for (let i = 0; i < count; i++) {
    // ときどき数日あける（練習しない日）。それ以外は数分おき
    t += random() < 0.04 ? step * (8 + random() * 20) : step * (0.2 + random() * 0.6);
    if (t > now - 60 * 1000) {
      reached = true;
      break;
    }
    out.push(t);
  }
  // 練習しない日が少ないと、今に届く前に count 回を使い切り、最近の記録が無くなる（期間「7日」が空になる）。
  // そのときは、最後の記録が今の少し前（平均の間隔の半分前）に来るよう全体を引き伸ばす。
  // 乱数は使わない（あとの種類のテストデータが変わらないように）
  if (!reached && out.length) {
    const last = out[out.length - 1];
    const k = (now - step / 2 - start) / (last - start);
    if (k > 1) for (let i = 0; i < out.length; i++) out[i] = start + (out[i] - start) * k;
  }
  return out.map(Math.round);
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
    const status = !hint && sec !== null && sec <= THRESHOLDS[set] ? 'learned' : 'learning';
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
    .concat(caseLog(random, 'coll', COLL, 320, 30, now))
    .concat(caseLog(random, 'zbll', ZBLL.slice(0, 144), 360, 25, now)) // ZBLL は T・U の 144 ケース
    .sort((a, b) => b.at - a.at) // 新しい順
    .slice(0, 2000);

  // ケースごとの最近のタイム（新しい順、最大 10 件。解けなかった・ヒントを見たものは入れない）と、習得状況（最後の判定）
  const times = { pll: {}, oll: {}, coll: {}, zbll: {} };
  const progress = { pll: {}, oll: {}, coll: {}, zbll: {} };
  caseRecords.forEach((e) => {
    if (!progress[e.set][e.name]) progress[e.set][e.name] = e.status;
    if (e.sec === null || e.hint) return;
    const list = times[e.set][e.name] || (times[e.set][e.name] = []);
    if (list.length < 10) list.push(e.sec);
  });

  const practice = {
    set: 'full', // 練習と記録で共通の種類（記録のページを通しで開く）
    filter: 'all',
    thresholds: THRESHOLDS,
    log: caseRecords,
    times: times,
    full: { inspection: true, log: fullLog(random, 260, 60, now).reverse() }, // 新しい順
    stats: { set: 'full', period: 'all', sort: 'weak', desc: true, sortV: 2, tab: 'cases' },
  };
  return { practice: practice, progress: progress };
}

// ---- 最大のデータ（node tools/serve.js --demo --max）----
// 保存できる上限いっぱいの記録の状態。画面が重くならないか・ブラウザの保存に収まるかの確認用（MegaminxImageEditor の buildMax を 3x3 用にしたもの。称号・バッジは無いので入れない）
//   - 記録：PLL・OLL・COLL・ZBLL それぞれ 5000 件（Progress.addLog の上限）、ソルブ・LL それぞれ 5000 件（FULL_LOG_MAX・LL_LOG_MAX）。
//     過去 400 日、毎日練習したことにする（今日まで続いている）
//   - 習得状況：すべて習得済み。最近のタイムは全ケース 10 件ずつ
//   - 自分の手順：PLL・OLL・COLL の全ケース（既定の手順の前に AUF (U) を足したもの。CustomAlgs.validate を通した形。ZBLL は自分の手順を持たない。
//     R R' のような打ち消し合う手順はまとめて既定と同じになるので使わない）
//   - ソルブのスクランブルは 1 つ作るのに 30ms ほどかかり、5000 件では数分かかるので、scramblePool 個（既定 300）を作って使い回す
const MAX_DAYS = 400;

// days 日前から今まで、毎日 count / days 回前後の日時（古い順）。朝 5〜7 時の練習も混ぜる
function dailyTimes(random, count, days, now) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const left = count - out.length;
    const n = d === 0 ? left : Math.max(1, Math.round((left / (d + 1)) * (0.6 + random() * 0.8)));
    const start = today.getTime() - d * DAY;
    for (let i = 0; i < n && out.length < count; i++) {
      const hour = random() < 0.05 ? 5 + random() * 2 : 7 + random() * 16;
      let at = start + Math.floor(hour * 3600000);
      if (at > now - 60 * 1000) at = now - 60 * 1000 - Math.floor(random() * 3600000);
      out.push(at);
    }
  }
  // 同じ日時が重ならないように 1 ms ずつずらす（記録は日時で見分ける）
  out.sort((a, b) => a - b);
  for (let i = 1; i < out.length; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] + 1;
  return out.slice(0, count);
}

function buildMax(opts) {
  const now = (opts && opts.now) || Date.now();
  const poolSize = (opts && opts.scramblePool) || 300;
  const random = rng(20261122);
  const P = require('../js/progress.js');
  const CA = require('../js/custom-algs.js');
  const pick = (list) => list[Math.floor(random() * list.length)];
  const SETS = { pll: PLL, oll: OLL, coll: COLL, zbll: ZBLL };

  // PLL・OLL・COLL・ZBLL：全ケースを順にまわしながら、古いほど遅く、新しいほど速く。最新 150 件はヒントなしで目安以内
  function caseRecords(set, cases) {
    const ats = dailyTimes(random, 5000, MAX_DAYS, now); // Progress.addLog の上限（種類ごと）
    return ats.map((at, i) => {
      const progress = i / ats.length;
      const c = i < cases.length ? cases[i] : pick(cases);
      const recent = i >= ats.length - 150;
      const hint = !recent && random() < 0.03;
      const sec = !recent && random() < 0.04 ? null : round2(Math.max(1.2, (recent ? 0.55 : 1.4 - progress * 0.7) * THRESHOLDS[set] * (0.7 + random() * 0.6)));
      const status = !hint && sec !== null && sec <= THRESHOLDS[set] ? 'learned' : 'learning';
      return { at: at, set: set, name: c.name, sec: sec, status: status, hint: hint };
    });
  }
  const caseLog = [].concat(...Object.entries(SETS).map(([set, cases]) => caseRecords(set, cases))).sort((a, b) => b.at - a.at); // 新しい順

  // ソルブ：40 秒前後から 15 秒前後へ。最新 150 回は DNF なし
  const pool = [];
  for (let i = 0; i < poolSize; i++) pool.push(W.encode(W.cube3(random)));
  const fullAts = dailyTimes(random, P.FULL_LOG_MAX, MAX_DAYS, now);
  const full = fullAts.map((at, i) => {
    const progress = i / fullAts.length;
    const recent = i >= fullAts.length - 150;
    const r = random();
    const sec = round2(Math.max(12, 40 - progress * 25 + (random() - 0.5) * 6));
    const penalty = recent ? '' : r < 0.02 ? 'DNF' : r < 0.05 ? '+2' : '';
    return { at: at, sec: sec, penalty: penalty, s: pool[i % pool.length] };
  });

  // LL：OLL → PLL（PLL スキップもある）。4% は DNF（sec: null）
  const llAts = dailyTimes(random, P.LL_LOG_MAX, MAX_DAYS, now);
  const ll = llAts.map((at, i) => {
    const progress = i / llAts.length;
    const rec = { at: at, sec: random() < 0.04 ? null : round2(Math.max(4, 14 - progress * 7 + (random() - 0.5) * 4)), o: pick(OLL).name };
    if (random() > 0.02) rec.p = pick(PLL).name;
    return rec;
  });

  // 習得状況はすべて習得済み、最近のタイムは各ケースの記録から 10 件（足りなければ目安以内のタイムで埋める）
  const progress = {};
  const times = {};
  Object.entries(SETS).forEach(([set, cases]) => {
    progress[set] = {};
    times[set] = {};
    cases.forEach((c) => {
      progress[set][c.name] = 'learned';
      times[set][c.name] = [];
    });
  });
  caseLog.forEach((e) => {
    const list = times[e.set][e.name];
    if (e.sec !== null && !e.hint && list.length < 10) list.push(e.sec);
  });
  Object.keys(times).forEach((set) => {
    Object.values(times[set]).forEach((list) => {
      while (list.length < 10) list.push(round2(THRESHOLDS[set] * (0.5 + random() * 0.4)));
    });
  });

  // 自分の手順：PLL・OLL・COLL の全ケース
  const customAlgs = {};
  ['pll', 'oll', 'coll'].forEach((set) => {
    customAlgs[set] = {};
    SETS[set].forEach((c) => {
      const v = CA.validate(set, c, '(U) ' + c.alg, SETS[set]);
      if (v.ok && !v.isDefault) customAlgs[set][c.name] = { alg: v.alg, setup: v.setup };
    });
  });

  const practice = {
    set: 'pll',
    filter: 'all',
    thresholds: THRESHOLDS,
    log: caseLog,
    times: times,
    full: { inspection: true, log: full.reverse() }, // 新しい順
    ll: { oll: 'all', pll: 'all', log: ll.reverse() },
    stats: { set: 'pll', period: 'all', sort: 'weak', desc: true, sortV: 2, tab: 'cases' },
  };
  return { practice: practice, progress: progress, 'custom-algs': customAlgs };
}

module.exports = { build: build, buildMax: buildMax, THRESHOLDS: THRESHOLDS, VERSION: VERSION };
