// 記録のページ（stats.html）：練習の記録（store.js の practice.log）を、期間の集計・日ごとのグラフ・ケースごとの表で見る。
// 通し（practice.full.log）は、回数・ベスト・ベスト ao5/ao12（今の ao5/ao12）、日ごとのグラフ、記録の一覧で見る。
// 通しの記録は、行ごとの × で1件、チェックで選んで「選択した記録を削除」でまとめて削除できる（どちらも元に戻せる）。
// 仕様: reference/PRACTICE_SPEC.md「記録」
//   - 種類（PLL / OLL / 通し）・期間（7日 / 30日 / すべて）で絞る（選んだものは practice.stats に保存）
//   - 集計（回数・平均・解けなかった・習得済みの数）、日ごとの回数（棒）と平均タイム（線）の SVG、
//     ケースごとの表（既定は平均の遅い順。見出しで並べ替え。ケースを押すとそのケースを練習ページで出題）
//   - 期間内の記録を CSV で書き出す
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
    sort: saved.sort || 'avg',
    desc: saved.desc !== false,
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

  // ---- 日ごとのグラフ（棒＝回数、線＝平均タイム） ----
  const SVG = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  };

  function renderChart(log) {
    const days = PERIODS[view.period] || 90;
    const data = P.daily(log, { days: days });
    const box = $('statsChart');
    box.replaceChildren();
    const W = 720;
    const H = 180;
    const pad = { l: 34, r: 40, t: 12, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const maxCount = Math.max(1, ...data.map((d) => d.count));
    const avgs = data.map((d) => d.avg).filter((a) => a != null);
    const maxAvg = avgs.length ? Math.max(...avgs) * 1.1 : 10;
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stats-svg', role: 'img' });
    svg.setAttribute('aria-label', I.t('stats.daily'));
    const step = iw / data.length;
    // 目盛り（回数）
    [0, 0.5, 1].forEach((f) => {
      const y = pad.t + ih * (1 - f);
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, class: 'stats-grid' }));
      // 回数の目盛りは整数のときだけ出す（最大 3 の真ん中 1.5 などは出さない）
      if (Number.isInteger(maxCount * f)) {
        const t = svgEl('text', { x: pad.l - 6, y: y + 4, class: 'stats-axis', 'text-anchor': 'end' });
        t.textContent = String(maxCount * f);
        svg.append(t);
      }
      const t2 = svgEl('text', { x: W - pad.r + 6, y: y + 4, class: 'stats-axis stats-axis-avg' });
      const v = maxAvg * f;
      t2.textContent = v >= 60 ? P.formatTime(v, 0) : v.toFixed(f ? 1 : 0) + 's';
      svg.append(t2);
    });
    // 棒
    data.forEach((d, i) => {
      if (!d.count) return;
      const h = (ih * d.count) / maxCount;
      const bar = svgEl('rect', {
        x: pad.l + i * step + step * 0.15,
        y: pad.t + ih - h,
        width: Math.max(1, step * 0.7),
        height: h,
        rx: Math.min(3, step * 0.2),
        class: 'stats-bar',
      });
      const title = svgEl('title');
      title.textContent = `${d.day}  ${I.t('stats.tooltip', { n: d.count, avg: fmt(d.avg) })}`;
      bar.append(title);
      svg.append(bar);
    });
    // 線（平均タイム。練習した日だけを結ぶ）
    const points = data
      .map((d, i) => (d.avg == null ? null : [pad.l + i * step + step / 2, pad.t + ih - (ih * d.avg) / maxAvg]))
      .filter(Boolean);
    if (points.length > 1) svg.append(svgEl('polyline', { points: points.map((p) => p.join(',')).join(' '), class: 'stats-line' }));
    points.forEach((p) => svg.append(svgEl('circle', { cx: p[0], cy: p[1], r: 2.5, class: 'stats-dot' })));
    // 日付（最初・真ん中・最後）
    [0, Math.floor((data.length - 1) / 2), data.length - 1].forEach((i) => {
      const t = svgEl('text', { x: pad.l + i * step + step / 2, y: H - 6, class: 'stats-axis', 'text-anchor': 'middle' });
      t.textContent = data[i].day.slice(5).replace('-', '/');
      svg.append(t);
    });
    box.append(svg);
    const legend = el('div', 'stats-legend');
    const item = (cls, key) => {
      const s = el('span', 'stats-legend-item');
      const label = el('span');
      I.set(label, key);
      s.append(el('span', 'stats-legend-mark ' + cls), label);
      return s;
    };
    legend.append(item('bar', 'stats.legendCount'), item('line', 'stats.legendAvg'));
    box.append(legend);
  }

  // ---- ケースごとの表 ----
  const COLUMNS = [
    { key: 'image', label: '', sortable: false },
    { key: 'name', label: 'stats.col.case' },
    { key: 'group', label: 'stats.col.group' },
    { key: 'status', label: 'stats.col.status' },
    { key: 'count', label: 'stats.col.count', num: true },
    { key: 'best', label: 'stats.col.best', num: true },
    { key: 'avg', label: 'stats.col.avg', num: true },
    { key: 'last', label: 'stats.col.last', num: true },
  ];
  const STATUS_ORDER = { new: 0, learning: 1, learned: 2 };

  function rows(log) {
    const per = P.perCase(log, { from: from() });
    return casesInScope()
      .filter((c) => per[c.name])
      .map((c) => Object.assign({ c: c, name: c.name, group: c.group, status: P.statusOf(view.set, c.name) }, per[c.name]));
  }

  function sortRows(list) {
    const k = view.sort;
    const dir = view.desc ? -1 : 1;
    const val = (r) => (k === 'status' ? STATUS_ORDER[r.status] : r[k]);
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1; // 値の無いもの（解けなかっただけ）は最後
      if (y == null) return -1;
      if (typeof x === 'string') return dir * x.localeCompare(y, undefined, { numeric: true });
      return dir * (x - y);
    });
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
        const cells = [
          el('td', 'text-muted', r.group),
          statusTd,
          el('td', 'text-end', r.dnf ? `${r.count} (${r.dnf} DNF)` : String(r.count)),
          el('td', 'text-end', fmt(r.best)),
          el('td', 'text-end fw-semibold', fmt(r.avg)),
          el('td', 'text-end text-muted', `${last.getMonth() + 1}/${last.getDate()}`),
        ];
        tr.append(imgTd, nameTd, ...cells);
        return tr;
      })
    );
  }

  // ---- CSV の書き出し ----
  function exportCsv() {
    const f = from();
    if (view.set === 'full') {
      const recs = fullLog().filter((r) => r.at >= f);
      const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
      const out = [['date', 'time', 'penalty', 'result', 'scramble'].join(',')].concat(
        recs.map((r) => [new Date(r.at).toISOString(), r.sec.toFixed(2), r.penalty || 'OK', showTime(r), q(window.WcaScramble.textOf(r))].join(','))
      );
      download(out, 'visualcube-full-solves.csv');
      return;
    }
    const names = new Set(casesInScope().map((c) => c.name));
    const list = (practice().log || []).filter((e) => e && e.set === view.set && names.has(e.name) && e.at >= f);
    const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [['date', 'set', 'case', 'time', 'status', 'hint'].join(',')].concat(
      list.map((e) =>
        [new Date(e.at).toISOString(), e.set, quote(e.name), e.sec == null ? 'DNF' : e.sec.toFixed(2), e.status, e.hint ? 1 : 0].join(',')
      )
    );
    download(lines, `visualcube-${view.set}-practice.csv`);
  }

  function download(lines, name) {
    const blob = new Blob(['\ufeff' + lines.join('\n') + '\n'], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10000);
  }

  // ---- 通し ----
  // 通しの記録（practice.full.log、新しい順）。グラフは記録をタイム（+2 込み、DNF は null）に直して使う
  const fullLog = () => {
    const f = practice().full;
    return f && Array.isArray(f.log) ? f.log.filter((r) => r && typeof r.at === 'number') : [];
  };
  const asTimes = (recs) => recs.map((r) => ({ at: r.at, set: 'full', name: 'full', sec: P.effectiveTime(r) }));
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

  // 記録の一覧（新しい順）：日時・タイム・その時点の ao5・ao12・スクランブル（押すと開く）
  // ---- 通しの記録の削除 ----
  // 個別：各行の × で1件を削除。一括：行のチェックで選び（見出しのチェックで表示中をすべて）、「選択した記録を削除」→ 確認 → 削除。
  // どちらも削除のあとに「元に戻す」を出す（ブラウザの確認ダイアログは使わない）
  const selected = new Set(); // 選んだ記録の at
  const openScrambles = new Set(); // スクランブルを開いている記録の at
  let confirmingDelete = false;
  let deleteMessage = null; // { text, undo }

  function saveFullLog(log) {
    const p = practice();
    const full = Object.assign({ inspection: true }, p.full, { log: log });
    S.set('practice', Object.assign({}, p, { full: full }));
  }

  // ats の記録を削除し、元に戻す関数を返す
  function deleteRecords(ats) {
    const set = new Set(ats);
    const before = fullLog();
    const removed = before.filter((r) => set.has(r.at));
    saveFullLog(before.filter((r) => !set.has(r.at)));
    ats.forEach((at) => selected.delete(at));
    return () => {
      // 削除したあとに増えた記録も残し、消したものを日時の順（新しい順）に戻す
      const now = fullLog();
      const have = new Set(now.map((r) => r.at));
      const merged = now.concat(removed.filter((r) => !have.has(r.at))).sort((x, y) => y.at - x.at);
      saveFullLog(merged);
      deleteMessage = { key: 'stats.restored', params: { n: removed.length } };
      render();
    };
  }

  function afterDelete(n, undo) {
    confirmingDelete = false;
    deleteMessage = { key: 'stats.deletedN', params: { n: n }, undo: undo };
    render();
  }

  function renderDeleteBar(recs) {
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
    // スマホでは表の見出しを隠すので、「すべて選ぶ」をここに出す
    const allLabel = el('label', 'stats-select-all-mobile');
    const allBox = el('input', 'form-check-input');
    allBox.type = 'checkbox';
    allBox.checked = recs.length > 0 && recs.every((r) => selected.has(r.at));
    allBox.indeterminate = !allBox.checked && recs.some((r) => selected.has(r.at));
    allBox.addEventListener('change', () => {
      recs.forEach((r) => (allBox.checked ? selected.add(r.at) : selected.delete(r.at)));
      confirmingDelete = false;
      render();
    });
    const allText = el('span');
    I.set(allText, 'stats.selectAllShort');
    allLabel.append(allBox, allText);
    bar.append(allLabel);
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
    const head = el('tr');
    // 見出しのチェック：表示中の記録をすべて選ぶ・外す
    const checkTh = el('th', 'stats-check');
    const all1 = el('input', 'form-check-input');
    all1.type = 'checkbox';
    all1.checked = recs.length > 0 && recs.every((r) => selected.has(r.at));
    all1.indeterminate = !all1.checked && recs.some((r) => selected.has(r.at));
    I.set(all1, 'stats.selectAll', null, 'aria-label');
    all1.addEventListener('change', () => {
      recs.forEach((r) => (all1.checked ? selected.add(r.at) : selected.delete(r.at)));
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
    renderDeleteBar(recs);
    // その時点の平均は期間に関係なく、それまでの記録から出す
    // スクランブルは「見る」で、その行のすぐ下に表の幅いっぱいの行として開く（表の列の幅を崩さないように）
    $('statsBody').replaceChildren(
      ...recs.flatMap((r) => {
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

  function render() {
    renderControls();
    const full = view.set === 'full';
    I.set($('statsTableTitle'), full ? 'stats.solves' : 'stats.byCase');
    if (!full) $('statsDeleteBar').hidden = true;
    $('statsTable').classList.toggle('stats-full-table', full); // スマホでは通しの一覧を2段のカード風にする
    if (full) {
      const all = fullLog(); // 読むたびに別のオブジェクトになるので1回だけ読む
      const recs = all.filter((r) => r.at >= from());
      renderFullCards(recs);
      renderChart(asTimes(all));
      renderFullTable(recs, all);
      return;
    }
    const log = logInScope();
    renderCards(log);
    renderChart(log);
    renderTable(log);
  }

  $('statsCsv').addEventListener('click', exportCsv);
  I.onChange(render);
  // ログインしてクラウドの記録が入ったとき（ページの読み直し）以外にも、別タブで練習したら反映する
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.indexOf(S.PREFIX) === 0) render();
  });
  render();
})();
