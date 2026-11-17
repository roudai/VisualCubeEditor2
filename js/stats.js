// 記録のページ（stats.html）：練習の記録（store.js の practice.log）を、期間の集計・タイムの推移・ケースごとの表で見る。
// 通し（practice.full.log）は、回数・ベスト・ベスト ao5/ao12（今の ao5/ao12）、タイムの推移、記録の一覧で見る。
// PLL・OLL は「ケースごと」の表と「記録の一覧」を切り替えられる（記録の一覧は日時・ケース・タイム・判定）。
// 記録の一覧（通し・PLL・OLL）は、行ごとの × で1件、チェックで選んで「選択した記録を削除」でまとめて削除できる（どちらも元に戻せる）。
// 仕様: reference/PRACTICE_SPEC.md「記録」
//   - 種類（PLL / OLL / 通し）・期間（7日 / 30日 / すべて）で絞る（選んだものは practice.stats に保存）
//   - 集計（回数・平均・解けなかった・習得済みの数）、タイムの推移（横軸＝1回ごと、点＝タイム、線＝ao5・ao12）の SVG、
//     ケースごとの表（並び：苦手順（既定。直近 10 回の平均の遅い順）/ グループ順（OLL は番号順）/ 覚える順。見出しでも並べ替え。
//     ケースを押すとそのケースを練習ページで出題）
(function () {
  'use strict';
  const S = window.Store;
  const I = window.I18N;
  const P = window.Progress;
  const D = window.CubeDraw;
  const CA = window.CustomAlgs;
  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  };

  const DATA = {
    pll: CA ? CA.merged('pll', window.PLL_DATA || []) : window.PLL_DATA || [],
    oll: CA ? CA.merged('oll', window.OLL_DATA || []) : window.OLL_DATA || [],
  };
  const PERIODS = { 7: 7, 30: 30, all: null };
  const DAY = 24 * 60 * 60 * 1000;

  const practice = () => {
    const p = S.get('practice');
    return p && typeof p === 'object' ? p : {};
  };
  const saved = practice().stats || {};
  const view = {
    set: ['pll', 'oll', 'full'].includes(saved.set) ? saved.set : ['oll', 'full'].includes(practice().set) ? practice().set : 'pll',
    period: Object.prototype.hasOwnProperty.call(PERIODS, saved.period) ? saved.period : '30',
    // 並びの既定は苦手順。苦手順を足す前（sortV が無い）に保存した並び（平均の遅い順）は使わず、苦手順にする
    sort: saved.sortV === 2 && saved.sort ? saved.sort : 'weak',
    desc: saved.sortV === 2 ? saved.desc !== false : true,
    sortV: 2,
    tab: saved.tab === 'solves' ? 'solves' : 'cases', // PLL・OLL の表：ケースごと / 記録の一覧
  };
  // 練習ページの「すべての記録を見る」から開いたとき（?set=oll など）は、その種類を出す（表示の設定として保存する）
  const params = new URLSearchParams(location.search);
  if (['pll', 'oll', 'full'].includes(params.get('set'))) view.set = params.get('set');
  if (params.has('set')) saveView();
  function saveView() {
    S.set('practice', Object.assign({}, practice(), { stats: Object.assign({}, view) }));
  }

  const fmt = (sec) => (typeof sec === 'number' ? P.formatTime(sec) : '–'); // 60 秒以上は分表記（1:05.23）
  const from = () => (PERIODS[view.period] ? Date.now() - PERIODS[view.period] * DAY : 0);
  const casesInScope = () => DATA[view.set];
  // 今のデータにあるケースの記録だけを使う
  function logInScope() {
    const names = new Set(casesInScope().map((c) => c.name));
    return (practice().log || []).filter((e) => e && e.set === view.set && names.has(e.name));
  }

  // ---- 種類・期間 ----
  function segment(items, current, onPick) {
    const box = el('div', 'stats-segment');
    box.setAttribute('role', 'group');
    items.forEach((item) => {
      const b = el('button');
      b.type = 'button';
      if (item.key) I.set(b, item.key, item.params);
      else b.textContent = item.text;
      b.classList.toggle('active', item.value === current);
      b.setAttribute('aria-pressed', String(item.value === current));
      b.addEventListener('click', () => onPick(item.value));
      box.append(b);
    });
    return box;
  }

  function renderControls() {
    const box = $('statsControls');
    box.replaceChildren(
      segment(
        [
          { value: 'pll', text: 'PLL' },
          { value: 'oll', text: 'OLL' },
          { value: 'full', key: 'practice.full' },
        ],
        view.set,
        (v) => change({ set: v })
      )
    );
    box.append(
      segment(
        [
          { value: '7', key: 'stats.days', params: { n: 7 } },
          { value: '30', key: 'stats.days', params: { n: 30 } },
          { value: 'all', key: 'stats.allTime' },
        ],
        view.period,
        (v) => change({ period: v })
      )
    );
  }

  function change(next) {
    // 種類・表を変えたら、記録の選択と削除のメッセージを消す
    if ((next.set && next.set !== view.set) || (next.tab && next.tab !== view.tab)) {
      selected.clear();
      confirmingDelete = false;
      deleteMessage = null;
    }
    // 種類・範囲・期間・表を変えたら 1 ページ目に戻す
    if (['set', 'scope', 'period', 'tab'].some((k) => k in next && next[k] !== view[k])) page = 1;
    Object.assign(view, next);
    saveView();
    render();
  }

  // ---- 集計のカード ----
  function renderCards(log) {
    const sum = P.summarize(log, { from: from() });
    const cases = casesInScope();
    const learned = cases.filter((c) => P.statusOf(view.set, c.name) === 'learned').length;
    const card = (labelKey, value, sub) => {
      const c = el('div', 'stats-card');
      const label = el('div', 'stats-card-label');
      I.set(label, labelKey);
      c.append(label, el('div', 'stats-card-value', value));
      if (sub) c.append(el('div', 'stats-card-sub', sub));
      return c;
    };
    $('statsCards').replaceChildren(
      card('stats.count', String(sum.count)),
      card('stats.average', sum.avg == null ? '–' : fmt(sum.avg), sum.best == null ? '' : I.t('stats.best', { t: fmt(sum.best) })),
      card('stats.dnf', String(sum.dnf)),
      card('stats.learned', `${learned} / ${cases.length}`)
    );
  }

  // ---- タイムの推移（横軸＝1回ごとの記録、縦軸＝タイム） ----
  // recs：記録すべて（新しい順。{ at, sec, penalty, name?, status? }）。表示は期間内だけ
  // 通し：点＝1回のタイム、線＝その時点の ao5・ao12（期間の前の記録も使って出す）
  // PLL・OLL：線＝1回ごとのタイム（ao は出さない）。点の色＝判定（習得済み・練習中）、解けなかった＝×。破線＝今の習得の目安
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  };
  // 目盛りの間隔（だいたい ticks 本になる、きりのよい秒数）
  function niceStep(range, ticks) {
    const raw = range / ticks;
    const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600];
    return steps.find((st) => st >= raw) || Math.ceil(raw / 600) * 600;
  }
  const axisTime = (v, step) => (v >= 60 ? P.formatTime(v, step < 1 ? 1 : 0) : (step < 1 ? v.toFixed(1) : String(Math.round(v))) + 's');
  const dateTime = (ms) => {
    const d = new Date(ms);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  function renderChart(recs) {
    const box = $('statsChart');
    box.replaceChildren();
    lastWidth = box.clientWidth;
    const f = from();
    const cases = view.set !== 'full';
    const ao5All = cases ? [] : P.rollingAverages(recs, 5);
    const ao12All = cases ? [] : P.rollingAverages(recs, 12);
    // 期間内を古い順に
    const pts = [];
    for (let i = recs.length - 1; i >= 0; i--) {
      if (recs[i].at < f) continue;
      pts.push({ r: recs[i], t: P.effectiveTime(recs[i]), ao5: ao5All[i], ao12: ao12All[i] });
    }
    const n = pts.length;
    if (!n) {
      const empty = el('p', 'stats-chart-empty text-muted small');
      I.set(empty, 'stats.empty');
      box.append(empty);
      return;
    }
    const target = cases ? practice().threshold : null;

    // 表示する幅そのままの大きさで描く（スマホでも目盛りの文字が小さくならないように）
    const W = Math.round(Math.min(1200, Math.max(280, box.clientWidth || 720)));
    const H = W < 500 ? 210 : 260;
    const pad = { l: 40, r: 10, t: 12, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    // 縦軸：1回のタイムの外れ値で平均の線がつぶれないよう、上は平均の最大と 1 回のタイムの 95% 点の大きい方まで
    // （それより遅い点は上の端に △ で出す）
    const singles = pts.map((p) => p.t).filter((t) => typeof t === 'number').sort((a, b) => a - b);
    const avgs = pts.flatMap((p) => [p.ao5, p.ao12]).filter((a) => typeof a === 'number');
    const p95 = singles.length ? singles[Math.min(singles.length - 1, Math.floor(singles.length * 0.95))] : 0;
    let hi = Math.max(p95, ...avgs, typeof target === 'number' ? target : 0);
    let lo = Math.min(...(singles.length ? singles : [0]), ...avgs);
    if (!(hi > lo)) {
      hi = (hi || 1) * 1.2;
      lo = Math.max(0, lo * 0.8);
    }
    const step = niceStep(hi - lo, 4);
    lo = Math.max(0, Math.floor((lo - (hi - lo) * 0.05) / step) * step);
    hi = Math.ceil((hi + (hi - lo) * 0.04) / step) * step;
    const x = (i) => pad.l + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const y = (v) => pad.t + ih * (1 - (Math.min(v, hi) - lo) / (hi - lo));

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stats-svg', role: 'img' });
    svg.setAttribute('aria-label', I.t('stats.trend'));
    // 横の目盛り（タイム）
    for (let v = lo; v <= hi + step / 1000; v += step) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'stats-grid' }));
      const t = svgEl('text', { x: pad.l - 6, y: y(v) + 3.5, class: 'stats-axis', 'text-anchor': 'end' });
      t.textContent = axisTime(v, step);
      svg.append(t);
    }
    // 縦の目盛り（何回目か。期間内で 1 から数える）
    const maxTicks = W < 500 ? 5 : 8;
    const xStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((st) => n / st <= maxTicks) || 1000;
    for (let k = xStep; k <= n; k += xStep) {
      const t = svgEl('text', { x: x(k - 1), y: H - 6, class: 'stats-axis', 'text-anchor': 'middle' });
      t.textContent = String(k);
      svg.append(t);
    }
    const first = svgEl('text', { x: x(0), y: H - 6, class: 'stats-axis', 'text-anchor': n === 1 ? 'middle' : 'start' });
    first.textContent = '1';
    if (xStep > 1 || n === 1) svg.append(first);
    // 習得の目安（PLL・OLL）
    if (typeof target === 'number' && target >= lo && target <= hi) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(target), y2: y(target), class: 'stats-target' }));
    }
    // 線。gaps：値が無い（DNF・平均が出ない）ところで途切れさせるか（false なら前後の値を結ぶ）
    const line = (key, cls, gaps) => {
      let d = '';
      let pen = false;
      pts.forEach((p, i) => {
        const v = p[key];
        if (typeof v !== 'number') {
          if (gaps) pen = false;
          return;
        }
        d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1);
        pen = true;
      });
      if (d) svg.append(svgEl('path', { d: d, class: cls }));
    };
    // PLL・OLL：1回ごとのタイムを結ぶ線（解けなかったところは飛ばして結ぶ）。点はその上に描く
    if (cases) line('t', 'stats-time-line', false);
    // 1回のタイム（点）。多いときは小さく
    const r = n > 600 ? 1.4 : n > 200 ? 1.9 : n > 60 ? 2.4 : 3;
    const dots = svgEl('g');
    pts.forEach((p, i) => {
      const cx = x(i);
      if (p.t === null) {
        // DNF：上の端に ×
        const s = r + 1;
        const cy = pad.t + 2;
        dots.append(svgEl('path', { d: `M${cx - s},${cy - s}L${cx + s},${cy + s}M${cx - s},${cy + s}L${cx + s},${cy - s}`, class: 'stats-dnf' }));
        return;
      }
      const cls = 'stats-single' + (cases ? ' ' + (p.r.status === 'learned' ? 'learned' : 'learning') : '');
      if (p.t > hi) {
        // 縦軸の上より遅い：上の端に △
        const cy = pad.t + 1;
        dots.append(svgEl('path', { d: `M${cx},${cy - r}L${cx + r + 0.5},${cy + r + 1}L${cx - r - 0.5},${cy + r + 1}Z`, class: cls }));
        return;
      }
      dots.append(svgEl('circle', { cx: cx, cy: y(p.t), r: r, class: cls }));
    });
    svg.append(dots);
    // 通し：ao5・ao12（平均が出ない（DNF・足りない）ところは途切れる）
    if (!cases) {
      line('ao12', 'stats-avg-line ao12', true);
      line('ao5', 'stats-avg-line ao5', true);
    }
    // マウス・タッチで、いちばん近い記録の縦線と詳しい値を出す
    const cursor = svgEl('line', { y1: pad.t, y2: pad.t + ih, class: 'stats-cursor', visibility: 'hidden' });
    const hit = svgEl('rect', { x: pad.l - 6, y: 0, width: iw + 12, height: H, fill: 'transparent' });
    svg.append(cursor, hit);
    box.append(svg);

    const tip = el('div', 'stats-tip');
    tip.hidden = true;
    box.append(tip);
    const show = (ev) => {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
      const p = pts[i];
      cursor.setAttribute('x1', x(i));
      cursor.setAttribute('x2', x(i));
      cursor.setAttribute('visibility', 'visible');
      const head = el('div', 'stats-tip-head', `#${i + 1} · ${dateTime(p.r.at)}`);
      const rows = [head];
      if (cases) rows.push(el('div', 'stats-tip-case', `${view.set.toUpperCase()} ${p.r.name}`));
      const row = (label, value, cls) => {
        const d = el('div', 'stats-tip-row');
        d.append(el('span', 'stats-tip-label ' + (cls || ''), label), el('span', 'stats-tip-value', value));
        return d;
      };
      rows.push(row(I.t('stats.col.time'), cases && p.t === null ? I.t('stats.dnf') : showTime(p.r)));
      if (!cases) rows.push(row('ao5', showAvg(p.ao5), 'ao5'), row('ao12', showAvg(p.ao12), 'ao12'));
      tip.replaceChildren(...rows);
      tip.hidden = false;
      // 点の左右どちらかに寄せる（右半分なら左に出す）
      const left = (x(i) / W) * rect.width;
      const boxW = box.clientWidth;
      tip.style.top = '4px';
      if (left > boxW / 2) {
        tip.style.left = '';
        tip.style.right = Math.max(0, boxW - left + 12) + 'px';
      } else {
        tip.style.right = '';
        tip.style.left = left + 12 + 'px';
      }
    };
    const hide = () => {
      tip.hidden = true;
      cursor.setAttribute('visibility', 'hidden');
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);

    // 凡例
    const legend = el('div', 'stats-legend');
    const item = (cls, key, params, text) => {
      const s = el('span', 'stats-legend-item');
      const label = el('span');
      if (key) I.set(label, key, params);
      else label.textContent = text;
      s.append(el('span', 'stats-legend-mark ' + cls), label);
      return s;
    };
    if (cases) {
      legend.append(
        item('line time', 'stats.col.time'),
        item('dot learned', 'status.learned'),
        item('dot learning', 'status.learning'),
        item('dnf', 'stats.dnf')
      );
    } else {
      legend.append(
        item('dot', 'stats.legendSingle'),
        item('dnf', null, null, 'DNF'),
        item('line ao5', null, null, 'ao5'),
        item('line ao12', null, null, 'ao12')
      );
    }
    if (typeof target === 'number') legend.append(item('target', 'stats.legendTarget', { t: fmt(target) }));
    box.append(legend);
  }

  // ---- ケースごとの表 ----
  const COLUMNS = [
    { key: 'image', label: '', sortable: false },
    { key: 'name', label: 'stats.col.case' },
    { key: 'group', label: 'stats.col.group' },
    { key: 'status', label: 'stats.col.status' },
    { key: 'weak', label: 'stats.col.recent', title: 'stats.recentTitle', num: true },
    { key: 'count', label: 'stats.col.count', num: true },
    { key: 'best', label: 'stats.col.best', num: true },
    { key: 'avg', label: 'stats.col.avg', num: true },
    { key: 'last', label: 'stats.col.last', num: true },
  ];
  const STATUS_ORDER = { new: 0, learning: 1, learned: 2 };
  const RECENT = 10; // 苦手順で見る直近の回数
  const FEW = 3; // これより少ない回数の「最近」は参考値として薄く出す
  const PRIOR = 2; // 苦手順で、回数の少ないケースを全体の平均に寄せる強さ（全体の平均で PRIOR 回解いたものとして足す）
  const hasStages = () => window.CaseSections && window.CaseSections.hasStages(DATA[view.set]);
  // OLL（番号の名前）は「グループ順」の代わりに「番号順」
  const numbered = () => window.CaseSections && window.CaseSections.isNumbered(DATA[view.set]);

  function rows(log) {
    const per = P.perCase(log, { from: from() });
    // 苦手順：直近 RECENT 回の平均。解けなかった回は習得の目安の 2 倍のタイムとして数える
    const threshold = practice().threshold > 0 ? practice().threshold : 8;
    const recent = P.recentPerCase(log, { from: from(), n: RECENT, dnfAs: threshold * 2 });
    const index = {};
    const groupIndex = {}; // グループの並び（データに最初に出てくる順。3x3 のグループ名は A〜Z の順ではないので名前では並べない）
    DATA[view.set].forEach((c, i) => {
      index[c.name] = i;
      if (!(c.group in groupIndex)) groupIndex[c.group] = Object.keys(groupIndex).length;
    });
    // 回数の少ないケースがたまたまの1回で上に来ないよう、並べるときは全体の平均に寄せる
    // （そのケースの回数に、全体の平均のタイムで PRIOR 回を足した平均）。表に出すのは寄せる前の平均
    const all = Object.values(recent);
    const total = all.reduce((sum, x) => sum + x.attempts, 0);
    const overall = total ? all.reduce((sum, x) => sum + x.score * x.attempts, 0) / total : 0;
    const weakScore = (x) => (x ? (x.score * x.attempts + overall * PRIOR) / (x.attempts + PRIOR) : null);
    return casesInScope()
      .filter((c) => per[c.name])
      .map((c) =>
        Object.assign({ c: c, name: c.name, group: c.group, groupIndex: groupIndex[c.group], index: index[c.name], status: P.statusOf(view.set, c.name) }, per[c.name], {
          recent: recent[c.name],
          weak: weakScore(recent[c.name]),
        })
      );
  }

  function sortRows(list) {
    // 覚える順は覚える順のデータがあるときだけ（無ければ苦手順）。'group' は PLL ならグループ順、OLL なら番号順
    const k = view.sort === 'learn' && !hasStages() ? 'weak' : view.sort;
    const dir = view.desc ? -1 : 1;
    const byNumber = numbered();
    const val = (r) =>
      k === 'status' ? STATUS_ORDER[r.status] : k === 'learn' ? r.c.order : k === 'group' ? (byNumber ? Number(r.name) : r.groupIndex) : r[k];
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return a.index - b.index;
      if (x == null) return 1; // 値の無いもの（解けなかっただけ）は最後
      if (y == null) return -1;
      const d = typeof x === 'string' ? x.localeCompare(y, undefined, { numeric: true }) : x - y;
      return d ? dir * d : a.index - b.index; // 同じ値なら元のデータの順（グループの中はケースの順）
    });
  }

  // 表の上の並びの切り替え：苦手順 / グループ順（OLL は番号順）/ 覚える順（覚える順のデータがあるとき）
  function renderSortBar() {
    const box = $('statsSort');
    const show = view.set !== 'full' && view.tab !== 'solves';
    box.hidden = !show;
    if (!show) return;
    const items = [
      { value: 'weak', key: 'stats.sortWeak' },
      { value: 'group', key: numbered() ? 'list.orderNumber' : 'list.orderGroup' },
    ];
    if (hasStages()) items.push({ value: 'learn', key: 'list.orderLearn' });
    const current = view.sort === 'learn' && !hasStages() ? 'weak' : view.sort;
    const seg = segment(items, current, (v) => change({ sort: v, desc: v === 'weak' }));
    I.set(seg, 'list.orderAria', null, 'aria-label');
    box.replaceChildren(seg);
  }

  function renderTable(log) {
    const head = el('tr');
    COLUMNS.forEach((col) => {
      const th = el('th', col.num ? 'text-end' : '');
      if (col.sortable !== false) {
        const b = el('button', 'stats-sort');
        b.type = 'button';
        const label = el('span');
        I.set(label, col.label);
        if (col.title) I.set(b, col.title, { n: RECENT }, 'title');
        b.append(label);
        if (view.sort === col.key) b.append(el('span', 'stats-sort-mark', view.desc ? ' ▼' : ' ▲'));
        b.addEventListener('click', () => change(view.sort === col.key ? { desc: !view.desc } : { sort: col.key, desc: col.num }));
        th.append(b);
      }
      head.append(th);
    });
    $('statsHead').replaceChildren(head);

    const list = sortRows(rows(log));
    $('statsEmpty').hidden = list.length > 0;
    const display = P.displaySettings(view.set);
    $('statsBody').replaceChildren(
      ...list.map((r) => {
        const tr = el('tr');
        const imgTd = el('td', 'stats-img');
        const image = el('div', 'case-image');
        const colors = P.caseColors(r.c, display.scheme);
        D.draw(image, colors.ucolor, colors.scolor, { size: 40, border: display.border });
        imgTd.append(image);
        const nameTd = el('td');
        const link = el('a', 'stats-case');
        const q = new URLSearchParams({ set: view.set, case: r.name, filter: 'all' });
        link.href = '/practice?' + q.toString();
        link.textContent = r.name;
        I.set(link, 'stats.practiceThis', { name: r.name }, 'title');
        nameTd.append(link);
        const statusTd = el('td');
        const badge = el('span', 'stats-status ' + r.status);
        I.set(badge, 'status.' + r.status);
        statusTd.append(badge);
        const last = new Date(r.last);
        // 最近：直近の平均（解けなかった回があれば「DNF n」も）。回数が少ないときは薄く出す
        const recentTd = el('td', 'text-end stats-recent');
        const rc = r.recent;
        recentTd.append(el('span', 'fw-semibold', rc.avg == null ? 'DNF' : fmt(rc.avg)));
        if (rc.dnf && rc.avg != null) recentTd.append(el('span', 'stats-recent-dnf', `DNF ${rc.dnf}`));
        if (rc.attempts < FEW) {
          recentTd.classList.add('stats-few');
          I.set(recentTd, 'stats.fewTitle', { n: rc.attempts }, 'title');
        }
        const cells = [
          el('td', 'text-muted', r.group),
          statusTd,
          recentTd,
          el('td', 'text-end', r.dnf ? `${r.count} (${r.dnf} DNF)` : String(r.count)),
          el('td', 'text-end', fmt(r.best)),
          el('td', 'text-end', fmt(r.avg)),
          el('td', 'text-end text-muted', `${last.getMonth() + 1}/${last.getDate()}`),
        ];
        tr.append(imgTd, nameTd, ...cells);
        return tr;
      })
    );
  }

  // ---- 通し ----
  // 通しの記録（practice.full.log、新しい順）
  const fullLog = () => {
    const f = practice().full;
    return f && Array.isArray(f.log) ? f.log.filter((r) => r && typeof r.at === 'number') : [];
  };
  const showTime = (r) => {
    const t = P.effectiveTime(r);
    return t === null ? 'DNF' : fmt(t) + (r.penalty === '+2' ? '+' : '');
  };
  const showAvg = (a) => (a === undefined ? '–' : a === null ? 'DNF' : fmt(a));

  function renderFullCards(recs) {
    const card = (labelKey, value, sub) => {
      const c = el('div', 'stats-card');
      const label = el('div', 'stats-card-label');
      I.set(label, labelKey);
      c.append(label, el('div', 'stats-card-value', value));
      if (sub) c.append(el('div', 'stats-card-sub', sub));
      return c;
    };
    const best = P.bestSingle(recs);
    const dnf = recs.filter((r) => P.effectiveTime(r) === null).length;
    $('statsCards').replaceChildren(
      card('stats.count', String(recs.length), dnf ? I.t('stats.dnfCount', { n: dnf }) : ''),
      card('practice.bestSingle', best == null ? '–' : fmt(best)),
      card('practice.bestAo5', showAvg(P.bestAverage(recs, 5)), I.t('stats.current', { t: showAvg(P.average(recs, 5)) })),
      card('practice.bestAo12', showAvg(P.bestAverage(recs, 12)), I.t('stats.current', { t: showAvg(P.average(recs, 12)) }))
    );
  }

  // ---- 記録の一覧のページ分け（1ページ PAGE_SIZE 件。ページは保存しない） ----
  const PAGE_SIZE = 50;
  let page = 1;
  // 今のページの記録（削除などで件数が減ったら、最後のページに収める）
  function pageOf(recs) {
    const pages = Math.max(1, Math.ceil(recs.length / PAGE_SIZE));
    page = Math.min(Math.max(1, page), pages);
    return recs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }
  // 出すページ番号：7 ページまではすべて。それより多いときは最初・最後・今のページの前後 1 つで、あいだは「…」（null）
  function pageNumbers(pages) {
    const out = [];
    for (let i = 1; i <= pages; i++) {
      if (pages <= 7 || i === 1 || i === pages || Math.abs(i - page) <= 1) out.push(i);
      else if (out[out.length - 1] !== null) out.push(null);
    }
    return out;
  }
  function goPage(n) {
    page = n;
    render();
    // 下のページ送りで変えたときは、表の頭が見えるところまで戻す
    const panel = $('statsTableTitle').closest('.stats-panel');
    if (panel.getBoundingClientRect().top < 0) panel.scrollIntoView({ block: 'start' });
  }
  function renderPager(total) {
    const box = $('statsPager');
    const pages = Math.ceil(total / PAGE_SIZE);
    box.hidden = pages <= 1;
    box.replaceChildren();
    if (pages <= 1) return;
    const info = el('span', 'stats-pager-info');
    I.set(info, 'stats.pageRange', { n: total, from: (page - 1) * PAGE_SIZE + 1, to: Math.min(total, page * PAGE_SIZE) });
    const nav = el('nav', 'stats-pager-nav');
    I.set(nav, 'stats.pagerAria', null, 'aria-label');
    const button = (key, text, target, disabled, current) => {
      const b = el('button', 'stats-page' + (current ? ' active' : ''));
      b.type = 'button';
      if (key) I.set(b, key);
      else {
        b.textContent = text;
        I.set(b, 'stats.pageN', { n: target }, 'aria-label');
      }
      b.disabled = disabled;
      if (current) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => goPage(target));
      return b;
    };
    nav.append(button('common.prev', null, page - 1, page === 1));
    pageNumbers(pages).forEach((n) => nav.append(n === null ? el('span', 'stats-page-gap', '…') : button(null, String(n), n, false, n === page)));
    nav.append(button('common.next', null, page + 1, page === pages));
    box.append(info, nav);
  }

  // ---- 記録の削除（通しは practice.full.log、PLL・OLL は practice.log のその種類の記録） ----
  // 個別：各行の × で1件を削除。一括：行のチェックで選び（見出しのチェックで表示中をすべて）、「選択した記録を削除」→ 確認 → 削除。
  // どちらも削除のあとに「元に戻す」を出す（ブラウザの確認ダイアログは使わない）
  const selected = new Set(); // 選んだ記録の at（表示中の種類の中で）
  const openScrambles = new Set(); // スクランブルを開いている記録の at
  let confirmingDelete = false;
  let deleteMessage = null; // { text, undo }

  function saveFullLog(log) {
    const p = practice();
    const full = Object.assign({ inspection: true }, p.full, { log: log });
    S.set('practice', Object.assign({}, p, { full: full }));
  }

  // 種類ごとの記録の読み書き（PLL・OLL の記録は1つの配列 practice.log に混ざっている）
  const caseLog = () => (Array.isArray(practice().log) ? practice().log.filter(Boolean) : []);
  const saveCaseLog = (log) => S.set('practice', Object.assign({}, practice(), { log: log }));
  const logStore = (kind) =>
    kind === 'full'
      ? { read: fullLog, write: saveFullLog, mine: () => true, id: (r) => String(r.at) }
      : { read: caseLog, write: saveCaseLog, mine: (r) => r.set === kind, id: (r) => r.set + '|' + r.at };

  // 表示中の種類の ats の記録を削除し、元に戻す関数を返す
  function deleteRecords(ats) {
    const set = new Set(ats);
    const store = logStore(view.set); // 元に戻すときも同じ種類に戻す（そのあとに種類を切り替えても）
    const hit = (r) => store.mine(r) && set.has(r.at);
    const before = store.read();
    const removed = before.filter(hit);
    store.write(before.filter((r) => !hit(r)));
    ats.forEach((at) => selected.delete(at));
    return () => {
      // 削除したあとに増えた記録も残し、消したものを日時の順（新しい順）に戻す
      const now = store.read();
      const have = new Set(now.map(store.id));
      const merged = now.concat(removed.filter((r) => !have.has(store.id(r)))).sort((x, y) => y.at - x.at);
      store.write(merged);
      deleteMessage = { key: 'stats.restored', params: { n: removed.length } };
      render();
    };
  }

  function afterDelete(n, undo) {
    confirmingDelete = false;
    deleteMessage = { key: 'stats.deletedN', params: { n: n }, undo: undo };
    render();
  }

  // recs：期間内の記録すべて、shown：今のページに出している記録
  function renderDeleteBar(recs, shown) {
    const bar = $('statsDeleteBar');
    bar.hidden = false;
    bar.replaceChildren();
    // 期間を変えて見えなくなった記録は選択から外す
    const visible = new Set(recs.map((r) => r.at));
    [...selected].forEach((at) => {
      if (!visible.has(at)) selected.delete(at);
    });
    const n = selected.size;
    if (confirmingDelete && n) {
      const text = el('span', 'stats-delete-confirm');
      I.set(text, 'stats.deleteConfirm', { n: n });
      const yes = el('button', 'btn btn-danger btn-sm');
      yes.type = 'button';
      I.set(yes, 'stats.deleteYes');
      yes.addEventListener('click', () => afterDelete(n, deleteRecords([...selected])));
      const no = el('button', 'btn btn-outline-secondary btn-sm');
      no.type = 'button';
      I.set(no, 'stats.cancel');
      no.addEventListener('click', () => {
        confirmingDelete = false;
        render();
      });
      bar.append(text, yes, no);
      return;
    }
    // スマホでは通しの一覧の見出しを隠すので、「すべて選ぶ」をここに出す（PLL・OLL の一覧は見出しを出したまま）
    const allLabel = el('label', 'stats-select-all-mobile');
    const allBox = el('input', 'form-check-input');
    allBox.type = 'checkbox';
    allBox.checked = shown.length > 0 && shown.every((r) => selected.has(r.at));
    allBox.indeterminate = !allBox.checked && shown.some((r) => selected.has(r.at));
    allBox.addEventListener('change', () => {
      shown.forEach((r) => (allBox.checked ? selected.add(r.at) : selected.delete(r.at)));
      confirmingDelete = false;
      render();
    });
    const allText = el('span');
    I.set(allText, 'stats.selectAllShort');
    allLabel.append(allBox, allText);
    if (view.set === 'full') bar.append(allLabel);
    const del = el('button', 'btn btn-outline-danger btn-sm');
    del.type = 'button';
    I.set(del, 'stats.deleteSelected', { n: n });
    del.disabled = !n;
    del.addEventListener('click', () => {
      deleteMessage = null;
      confirmingDelete = true;
      render();
    });
    bar.append(del);
    if (deleteMessage) {
      const msg = el('span', 'stats-delete-message');
      I.set(msg, deleteMessage.key, deleteMessage.params);
      bar.append(msg);
      if (deleteMessage.undo) {
        const undo = el('button', 'btn btn-link btn-sm p-0 stats-undo');
        undo.type = 'button';
        I.set(undo, 'stats.undo');
        const fn = deleteMessage.undo;
        undo.addEventListener('click', () => {
          deleteMessage = null;
          fn();
        });
        bar.append(undo);
      }
    }
  }

  // スマホの表示で「ao5 1:07.27」のように前に付ける見出し（css/stats.css の data-label）
  const labeled = (td, label) => {
    td.dataset.label = label;
    return td;
  };

  // all：通しの記録すべて（新しい順）。recs はその中の期間内のもの（同じ配列の要素）
  function renderFullTable(recs, all) {
    const shown = pageOf(recs); // 今のページの記録
    const head = el('tr');
    // 見出しのチェック：表示中の記録をすべて選ぶ・外す
    const checkTh = el('th', 'stats-check');
    const all1 = el('input', 'form-check-input');
    all1.type = 'checkbox';
    all1.checked = shown.length > 0 && shown.every((r) => selected.has(r.at));
    all1.indeterminate = !all1.checked && shown.some((r) => selected.has(r.at));
    I.set(all1, 'stats.selectAll', null, 'aria-label');
    all1.addEventListener('change', () => {
      shown.forEach((r) => (all1.checked ? selected.add(r.at) : selected.delete(r.at)));
      confirmingDelete = false;
      render();
    });
    checkTh.append(all1);
    head.append(checkTh);
    // 列の幅：日時・タイム・ao5・ao12・削除は中身の幅だけにし（stats-shrink）、残りはスクランブルの列にまわす
    ['stats.col.date', 'stats.col.time', 'practice.ao5', 'practice.ao12', 'practice.scramble'].forEach((key, i) => {
      const th = el('th', (i >= 1 && i <= 3 ? 'text-end ' : '') + (i <= 3 ? 'stats-shrink' : ''));
      I.set(th, key);
      head.append(th);
    });
    head.append(el('th', 'stats-shrink'));
    $('statsHead').replaceChildren(head);
    $('statsEmpty').hidden = recs.length > 0;
    renderDeleteBar(recs, shown);
    renderPager(recs.length);
    // その時点の平均は期間に関係なく、それまでの記録から出す
    // スクランブルは「見る」で、その行のすぐ下に表の幅いっぱいの行として開く（表の列の幅を崩さないように）
    $('statsBody').replaceChildren(
      ...shown.flatMap((r) => {
        const i = all.indexOf(r);
        const d = new Date(r.at);
        const date = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        const tr = el('tr');
        tr.classList.toggle('table-active', selected.has(r.at));
        const checkTd = el('td', 'stats-check cell-check');
        const check = el('input', 'form-check-input');
        check.type = 'checkbox';
        check.checked = selected.has(r.at);
        I.set(check, 'stats.selectRow', { date: date }, 'aria-label');
        check.addEventListener('change', () => {
          if (check.checked) selected.add(r.at);
          else selected.delete(r.at);
          confirmingDelete = false;
          render();
        });
        checkTd.append(check);
        const open = openScrambles.has(r.at);
        const toggle = el('button', 'stats-scramble-toggle');
        toggle.type = 'button';
        toggle.setAttribute('aria-expanded', String(open));
        I.set(toggle, open ? 'stats.hide' : 'stats.show');
        toggle.addEventListener('click', () => {
          if (openScrambles.has(r.at)) openScrambles.delete(r.at);
          else openScrambles.add(r.at);
          render();
        });
        const scrambleTd = el('td', 'cell-toggle');
        scrambleTd.append(toggle);
        // 個別の削除（すぐに削除し、元に戻すを出す）
        const delTd = el('td', 'text-end stats-shrink cell-del');
        const del = el('button', 'stats-row-delete');
        del.type = 'button';
        del.textContent = '×';
        I.set(del, 'stats.deleteRow', { date: date }, 'aria-label');
        I.set(del, 'stats.deleteRow', { date: date }, 'title');
        del.addEventListener('click', () => afterDelete(1, deleteRecords([r.at])));
        delTd.append(del);
        tr.append(
          checkTd,
          el('td', 'text-muted stats-shrink cell-date', date),
          el('td', 'text-end fw-semibold stats-shrink cell-time', showTime(r)),
          labeled(el('td', 'text-end stats-shrink cell-avg', showAvg(P.average(all.slice(i), 5))), 'ao5'),
          labeled(el('td', 'text-end stats-shrink cell-avg', showAvg(P.average(all.slice(i), 12))), 'ao12'),
          scrambleTd,
          delTd
        );
        if (!open) return [tr];
        const detail = el('tr', 'stats-scramble-row');
        const cell = el('td');
        cell.colSpan = 7;
        // 包む要素の幅を 0（最小で行の幅）にして、スクランブルの長さが表の列の幅に影響しないようにする
        const wrap = el('div', 'stats-scramble-wrap');
        const scrambleText = el('div', 'stats-scramble-text');
        window.WcaScramble.render(scrambleText, window.WcaScramble.textOf(r));
        wrap.append(scrambleText);
        cell.append(wrap);
        detail.append(cell);
        return [tr, detail];
      })
    );
  }

  // PLL・OLL の記録の一覧（新しい順）：日時・ケース・タイム・判定・削除
  function renderCaseSolves(recs) {
    const shown = pageOf(recs); // 今のページの記録
    const head = el('tr');
    const checkTh = el('th', 'stats-check');
    const all1 = el('input', 'form-check-input');
    all1.type = 'checkbox';
    all1.checked = shown.length > 0 && shown.every((r) => selected.has(r.at));
    all1.indeterminate = !all1.checked && shown.some((r) => selected.has(r.at));
    I.set(all1, 'stats.selectAll', null, 'aria-label');
    all1.addEventListener('change', () => {
      shown.forEach((r) => (all1.checked ? selected.add(r.at) : selected.delete(r.at)));
      confirmingDelete = false;
      render();
    });
    checkTh.append(all1);
    head.append(checkTh);
    ['stats.col.date', 'stats.col.case', 'stats.col.time', 'stats.col.verdict'].forEach((key, i) => {
      const th = el('th', 'stats-shrink' + (i === 2 ? ' text-end' : ''));
      I.set(th, key);
      head.append(th);
    });
    head.append(el('th'));
    $('statsHead').replaceChildren(head);
    $('statsEmpty').hidden = recs.length > 0;
    renderDeleteBar(recs, shown);
    renderPager(recs.length);
    $('statsBody').replaceChildren(
      ...shown.map((r) => {
        const date = dateTime(r.at);
        const tr = el('tr');
        tr.classList.toggle('table-active', selected.has(r.at));
        const checkTd = el('td', 'stats-check');
        const check = el('input', 'form-check-input');
        check.type = 'checkbox';
        check.checked = selected.has(r.at);
        I.set(check, 'stats.selectRow', { date: date }, 'aria-label');
        check.addEventListener('change', () => {
          if (check.checked) selected.add(r.at);
          else selected.delete(r.at);
          confirmingDelete = false;
          render();
        });
        checkTd.append(check);
        const statusTd = el('td', 'stats-shrink');
        const badge = el('span', 'stats-status ' + (r.status === 'learned' ? 'learned' : 'learning'));
        I.set(badge, 'status.' + (r.status === 'learned' ? 'learned' : 'learning'));
        statusTd.append(badge);
        if (r.hint) {
          const hint = el('span', 'stats-hint');
          I.set(hint, 'stats.hintUsed');
          statusTd.append(hint);
        }
        const timeTd = el('td', 'text-end fw-semibold stats-shrink');
        if (typeof r.sec === 'number') timeTd.textContent = fmt(r.sec);
        else I.set(timeTd, 'stats.dnf');
        const delTd = el('td', 'text-end');
        const del = el('button', 'stats-row-delete');
        del.type = 'button';
        del.textContent = '×';
        I.set(del, 'stats.deleteRow', { date: date }, 'aria-label');
        I.set(del, 'stats.deleteRow', { date: date }, 'title');
        del.addEventListener('click', () => afterDelete(1, deleteRecords([r.at])));
        delTd.append(del);
        tr.append(checkTd, el('td', 'text-muted stats-shrink', date), el('td', 'stats-shrink fw-semibold', r.name), timeTd, statusTd, delTd);
        return tr;
      })
    );
  }

  // 表の見出しの右：PLL・OLL では「ケースごと / 記録の一覧」の切り替え
  function renderTableTabs() {
    const box = $('statsTableTabs');
    if (view.set === 'full') {
      box.replaceChildren();
      return;
    }
    box.replaceChildren(
      segment(
        [
          { value: 'cases', key: 'stats.byCase' },
          { value: 'solves', key: 'stats.solves' },
        ],
        view.tab,
        (v) => change({ tab: v })
      )
    );
  }

  function render() {
    renderControls();
    renderTableTabs();
    renderSortBar();
    const full = view.set === 'full';
    const solves = full || view.tab === 'solves';
    I.set($('statsTableTitle'), solves ? 'stats.solves' : 'stats.byCase');
    if (!solves) {
      $('statsDeleteBar').hidden = true;
      $('statsPager').hidden = true;
    }
    $('statsTable').classList.toggle('stats-full-table', full); // スマホでは通しの一覧を2段のカード風にする
    if (full) {
      const all = fullLog(); // 読むたびに別のオブジェクトになるので1回だけ読む
      const recs = all.filter((r) => r.at >= from());
      renderFullCards(recs);
      renderChart(all);
      renderFullTable(recs, all);
      return;
    }
    const log = logInScope();
    renderCards(log);
    renderChart(log.map((e) => ({ at: e.at, sec: e.sec, penalty: e.sec == null ? 'DNF' : '', name: e.name, status: e.status })));
    if (view.tab === 'solves') renderCaseSolves(log.filter((e) => e.at >= from()));
    else renderTable(log);
  }

  // 幅が変わったらグラフを描き直す（グラフは表示する幅で描くため）
  let lastWidth = 0;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = $('statsChart').clientWidth;
      if (w !== lastWidth) render();
    }, 150);
  });
  I.onChange(render);
  // ログインしてクラウドの記録が入ったとき（ページの読み直し）以外にも、別タブで練習したら反映する
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.indexOf(S.PREFIX) === 0) render();
  });
  render();
})();
