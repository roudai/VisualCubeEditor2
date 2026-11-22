// 記録のページ（stats.html）：練習の記録（store.js の practice.log）を、期間の集計・タイムの推移・ケースごとの表で見る。
// 通し（practice.full.log）・LL（practice.ll.log）は、回数・ベスト・ベスト ao5/ao12（今の ao5/ao12）、タイムの推移、記録の一覧で見る
// （LL の一覧はスクランブルの代わりにケース「OLL → PLL」）。
// PLL・OLL・COLL は「ケースごと」の表と「記録の一覧」を切り替えられる（記録の一覧は日時・ケース・タイム・判定）。
// 記録の一覧（通し・PLL・OLL・COLL）は、行ごとの × で1件、チェックで選んで「選択した記録を削除」でまとめて、
// 「すべての記録を削除」でその種類の記録を期間に関係なくすべて削除できる（どれも元に戻せる）。
// 仕様: reference/PRACTICE_SPEC.md「記録」
//   - 種類（PLL / OLL / COLL / 通し）・期間（7日 / 30日 / すべて）で絞る（選んだものは practice.stats に保存）
//   - 集計（回数・平均・解けなかった・習得済みの数）、タイムの推移（横軸＝1回ごと、点＝タイム、線＝ao5・ao12）の SVG、
//     グラフは「推移 / 分布」で切り替え（分布＝期間内のタイムを区間ごとに数えた棒グラフ。選んだものは practice.stats.chart に保存）、
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
    coll: CA ? CA.merged('coll', window.COLL_DATA || []) : window.COLL_DATA || [],
    zbll: window.ZBLL_DATA || [],
  };
  const SETS = ['pll', 'oll', 'coll', 'zbll', 'll', 'full'];
  // 自分の記録の配列を持つ種類（タイムだけを見る。ケースごとの表は無い）
  const own = () => view.set === 'full' || view.set === 'll';
  const PERIODS = { 7: 7, 30: 30, all: null };
  const DAY = 24 * 60 * 60 * 1000;

  const practice = () => {
    const p = S.get('practice');
    return p && typeof p === 'object' ? p : {};
  };
  const saved = practice().stats || {};
  // 種類（PLL / OLL / COLL / ZBLL / LL / 通し）は練習ページと共通（practice.set）。
  // 練習と記録を行き来しても、選んでいた種類のまま開く（無ければ以前の記録のページだけの値）
  const shared = practice();
  const view = {
    set: SETS.includes(shared.set) ? shared.set : SETS.includes(saved.set) ? saved.set : 'pll',
    period: Object.prototype.hasOwnProperty.call(PERIODS, saved.period) ? saved.period : '30',
    // 並びの既定は苦手順。苦手順を足す前（sortV が無い）に保存した並び（平均の遅い順）は使わず、苦手順にする
    sort: saved.sortV === 2 && saved.sort ? saved.sort : 'weak',
    desc: saved.sortV === 2 ? saved.desc !== false : true,
    sortV: 2,
    tab: saved.tab === 'solves' ? 'solves' : 'cases', // PLL・OLL の表：ケースごと / 記録の一覧
    chart: saved.chart === 'dist' ? 'dist' : 'trend', // グラフ：推移（折れ線） / 分布（棒グラフ）
  };
  // 練習ページの見出しの「記録」から開いたとき（?set=oll など）は、その種類を出す（表示の設定として保存する）
  const params = new URLSearchParams(location.search);
  if (SETS.includes(params.get('set'))) view.set = params.get('set');
  if (params.has('set')) saveView();
  function saveView() {
    S.set('practice', Object.assign({}, practice(), { set: view.set, stats: Object.assign({}, view) }));
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
      if (item.shortKey) {
        // 狭い画面では短い名前に替える（英語の「Full solve」→「Solve」。css/common.css の .label-wide・.label-narrow）
        const wide = el('span', 'label-wide');
        I.set(wide, item.key, item.params);
        const short = el('span', 'label-narrow');
        I.set(short, item.shortKey);
        b.append(wide, short);
      } else if (item.key) I.set(b, item.key, item.params);
      else b.textContent = item.text;
      if (item.title) I.set(b, item.title, item.titleParams, 'title'); // マウスを乗せたときの説明
      b.classList.toggle('active', item.value === current);
      b.setAttribute('aria-pressed', String(item.value === current));
      b.addEventListener('click', () => onPick(item.value));
      box.append(b);
    });
    return box;
  }

  function renderControls() {
    // 見出しの「練習」は今の種類の練習を開く
    $('pageSwitchLink').href = '/practice?' + new URLSearchParams({ set: view.set });
    const box = $('statsControls');
    box.replaceChildren(
      segment(
        [
          { value: 'pll', text: 'PLL' },
          { value: 'oll', text: 'OLL' },
          { value: 'coll', text: 'COLL' },
          { value: 'zbll', text: 'ZBLL' },
          { value: 'll', text: 'LL', title: 'practice.llTitle' },
          { value: 'full', key: 'practice.full', shortKey: 'practice.fullShort' },
        ],
        view.set,
        (v) => change({ set: v })
      )
    );
    // 種類は見出しの横（練習ページの種類と同じ場所）、期間はその下（ここから下のカード・グラフ・表だけを絞るので）
    const periodSeg = segment(
      [
        { value: '7', key: 'stats.days', params: { n: 7 } },
        { value: '30', key: 'stats.days', params: { n: 30 } },
        { value: 'all', key: 'stats.allTime' },
      ],
      view.period,
      (v) => change({ period: v })
    );
    I.set(periodSeg, 'stats.period', null, 'aria-label');
    $('statsPeriod').replaceChildren(periodSeg);
  }

  function change(next) {
    // 種類・表を変えたら、記録の選択と削除のメッセージを消す
    if ((next.set && next.set !== view.set) || (next.tab && next.tab !== view.tab)) {
      selected.clear();
      confirmingDelete = false;
      confirmingAll = false;
      deleteMessage = null;
    }
    // 種類・範囲・期間・表を変えたら 1 ページ目に戻す
    if (['set', 'scope', 'period', 'tab'].some((k) => k in next && next[k] !== view[k])) page = 1;
    if (['set', 'period'].some((k) => k in next && next[k] !== view[k])) trendEnd = 0; // 推移のグラフは最新に戻す
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

  // 詳しい値の箱を、指している位置（グラフの左からの px）の左右どちらかに寄せる（右半分なら左に出す）
  function placeTip(tip, box, left) {
    const boxW = box.clientWidth;
    tip.style.top = '4px';
    if (left > boxW / 2) {
      tip.style.left = '';
      tip.style.right = Math.max(0, boxW - left + 12) + 'px';
    } else {
      tip.style.right = '';
      tip.style.left = left + 12 + 'px';
    }
  }
  const legendItem = (cls, key, params, text) => {
    const s = el('span', 'stats-legend-item');
    const label = el('span');
    if (key) I.set(label, key, params);
    else label.textContent = text;
    s.append(el('span', 'stats-legend-mark ' + cls), label);
    return s;
  };

  // グラフの見出しの右：推移 / 分布 の切り替え
  function renderChartTabs() {
    I.set($('statsChartTitle'), view.chart === 'dist' ? 'stats.dist' : 'stats.trend');
    $('statsChartTabs').replaceChildren(
      segment(
        [
          { value: 'trend', key: 'stats.chartTrend' },
          { value: 'dist', key: 'stats.chartDist' },
        ],
        view.chart,
        (v) => change({ chart: v })
      )
    );
  }

  // 推移のグラフに一度に描く回数（これより多いときは直近から描き、左右に動かす）と、今の右端が最新から何回前か
  // （種類・期間を変えたら最新に戻す。保存しない）
  const TREND_WIN = { wide: 300, phone: 150 };
  let trendEnd = 0;
  function renderChart(recs) {
    const box = $('statsChart');
    box.replaceChildren();
    lastWidth = box.clientWidth;
    if (view.chart === 'dist') {
      renderDist(recs);
      return;
    }
    const f = from();
    const cases = !own();
    const ao5All = cases ? [] : P.rollingAverages(recs, 5);
    const ao12All = cases ? [] : P.rollingAverages(recs, 12);
    // 期間内を古い順に
    const pts = [];
    for (let i = recs.length - 1; i >= 0; i--) {
      if (recs[i].at < f) continue;
      pts.push({ r: recs[i], t: P.effectiveTime(recs[i]), ao5: ao5All[i], ao12: ao12All[i] });
    }
    const total = pts.length;
    if (!total) {
      const empty = el('p', 'stats-chart-empty text-muted small');
      I.set(empty, 'stats.empty');
      box.append(empty);
      return;
    }
    const target = cases ? P.thresholdOf(practice(), view.set) : null; // その種類の習得の目安

    // 表示する幅そのままの大きさで描く（スマホでも目盛りの文字が小さくならないように）
    const W = Math.round(Math.min(1200, Math.max(280, box.clientWidth || 720)));
    const H = W < 500 ? 210 : 260;
    const pad = { l: 40, r: 10, t: 12, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    // 縦軸：1回のタイムの外れ値で平均の線がつぶれないよう、上は平均の最大と 1 回のタイムの 95% 点の大きい方まで
    // （それより遅い点は上の端に △ で出す）。期間全体から決める（窓を動かしても目盛りが変わらないように）
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
    // 窓：多いときは一度に TREND_WIN 回だけ描き、ドラッグ・スワイプ・ボタンで前の記録へ動かす
    const n = Math.min(total, W < 500 ? TREND_WIN.phone : TREND_WIN.wide);
    const paged = total > n;
    trendEnd = Math.max(0, Math.min(trendEnd, total - n));
    let start = total - n - trendEnd; // 窓の左端（期間内の何番目か。0 から）
    const x = (j) => pad.l + (n === 1 ? iw / 2 : (iw * j) / (n - 1));
    const y = (v) => pad.t + ih * (1 - (Math.min(v, hi) - lo) / (hi - lo));

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stats-svg' + (paged ? ' paged' : ''), role: 'img' });
    svg.setAttribute('aria-label', I.t('stats.trend'));
    // 横の目盛り（タイム）
    for (let v = lo; v <= hi + step / 1000; v += step) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'stats-grid' }));
      const t = svgEl('text', { x: pad.l - 6, y: y(v) + 3.5, class: 'stats-axis', 'text-anchor': 'end' });
      t.textContent = axisTime(v, step);
      svg.append(t);
    }
    // 習得の目安（PLL・OLL）
    if (typeof target === 'number' && target >= lo && target <= hi) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(target), y2: y(target), class: 'stats-target' }));
    }
    // 窓の中身（縦の目盛りの数字・線・点）。動かすたびにこの <g> だけ作り直す
    let plot = svgEl('g');
    const cursor = svgEl('line', { y1: pad.t, y2: pad.t + ih, class: 'stats-cursor', visibility: 'hidden' });
    const hit = svgEl('rect', { x: pad.l - 6, y: 0, width: iw + 12, height: H, fill: 'transparent' });
    svg.append(plot, cursor, hit);
    box.append(svg);
    const tip = el('div', 'stats-tip');
    tip.hidden = true;
    box.append(tip);

    // 窓の位置の行（多いときだけ）：‹ 1701–2000 回目 / 2000 › 最新、と全体のうち今の位置を示す細い帯
    let nav = null;
    if (paged) {
      nav = { row: el('div', 'stats-trend-nav') };
      const btn = (cls, text, key) => {
        const b = el('button', 'stats-trend-btn ' + cls, text);
        b.type = 'button';
        I.set(b, key, null, 'aria-label');
        b.title = I.t(key);
        return b;
      };
      nav.older = btn('older', '‹', 'stats.trendOlder');
      nav.newer = btn('newer', '›', 'stats.trendNewer');
      nav.label = el('span', 'stats-trend-range');
      nav.latest = el('button', 'stats-trend-latest', I.t('stats.trendLatest'));
      nav.latest.type = 'button';
      nav.track = el('div', 'stats-trend-track');
      nav.thumb = el('div', 'stats-trend-thumb');
      nav.track.append(nav.thumb);
      nav.row.append(nav.older, nav.label, nav.newer, nav.track, nav.latest);
      const half = Math.round(n / 2);
      nav.older.addEventListener('click', () => moveTo(trendEnd + half));
      nav.newer.addEventListener('click', () => moveTo(trendEnd - half));
      nav.latest.addEventListener('click', () => moveTo(0));
      // 帯はスクロールバーのように掴んで動かす。つまみを掴めば掴んだ点を保ち、帯の他を押せばそこへ飛んでそのまま動かせる
      nav.track.tabIndex = 0;
      nav.track.setAttribute('role', 'slider');
      nav.track.setAttribute('aria-valuemin', String(n));
      nav.track.setAttribute('aria-valuemax', String(total));
      I.set(nav.track, 'stats.trendSlider', null, 'aria-label');
      // grab：{ id, left・width：押したときの帯の位置（動かしている間に「最新」や回目の文の幅で帯が動いても、押したときの位置で数える）、
      //         thumb：つまみの幅（px）、offset：掴んだ点とつまみの左端の差（px） }
      let grab = null;
      const startFrom = (ev) => {
        const room = grab.width - grab.thumb; // つまみの左端が動ける幅
        const p = room > 0 ? (ev.clientX - grab.left - grab.offset) / room : 0;
        moveTo(total - n - Math.round(p * (total - n)));
      };
      nav.track.addEventListener('pointerdown', (ev) => {
        if (ev.button > 0) return;
        ev.preventDefault(); // 押しただけでは枠（キーボードで選んだ印）を出さない。キーボードは Tab で帯を選んで動かす
        const rect = nav.track.getBoundingClientRect();
        const th = nav.thumb.getBoundingClientRect();
        const at = ev.clientX - th.left;
        // つまみの上なら掴んだ点のまま、外ならつまみの真ん中をそこへ
        grab = { id: ev.pointerId, left: rect.left, width: rect.width, thumb: th.width, offset: at >= 0 && at <= th.width ? at : th.width / 2 };
        nav.track.setPointerCapture(ev.pointerId);
        nav.track.classList.add('dragging');
        startFrom(ev);
      });
      nav.track.addEventListener('pointermove', (ev) => {
        if (!grab || grab.id !== ev.pointerId) return;
        startFrom(ev);
      });
      const release = (ev) => {
        if (!grab || grab.id !== ev.pointerId) return;
        grab = null;
        nav.track.classList.remove('dragging');
      };
      nav.track.addEventListener('pointerup', release);
      nav.track.addEventListener('pointercancel', release);
      nav.track.addEventListener('keydown', (ev) => {
        const to = { ArrowLeft: trendEnd + half, ArrowRight: trendEnd - half, PageUp: trendEnd + n, PageDown: trendEnd - n, Home: total, End: 0 }[ev.key];
        if (to === undefined) return;
        ev.preventDefault();
        moveTo(to);
      });
      box.append(nav.row);
    }

    function drawWindow() {
      start = total - n - trendEnd;
      const vis = pts.slice(start, start + n);
      const g = svgEl('g');
      // 縦の目盛り（何回目か。期間内で 1 から数える）
      const maxTicks = W < 500 ? 5 : 8;
      const xStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((st) => n / st <= maxTicks) || 1000;
      for (let k = Math.ceil((start + 1) / xStep) * xStep; k <= start + n; k += xStep) {
        const t = svgEl('text', { x: x(k - 1 - start), y: H - 6, class: 'stats-axis', 'text-anchor': 'middle' });
        t.textContent = String(k);
        g.append(t);
      }
      if (!paged && (xStep > 1 || n === 1)) {
        const first = svgEl('text', { x: x(0), y: H - 6, class: 'stats-axis', 'text-anchor': n === 1 ? 'middle' : 'start' });
        first.textContent = '1';
        g.append(first);
      }
      // 線。gaps：値が無い（DNF・平均が出ない）ところで途切れさせるか（false なら前後の値を結ぶ）
      const line = (key, cls, gaps) => {
        let d = '';
        let pen = false;
        vis.forEach((p, j) => {
          const v = p[key];
          if (typeof v !== 'number') {
            if (gaps) pen = false;
            return;
          }
          d += (pen ? 'L' : 'M') + x(j).toFixed(1) + ',' + y(v).toFixed(1);
          pen = true;
        });
        if (d) g.append(svgEl('path', { d: d, class: cls }));
      };
      // PLL・OLL：1回ごとのタイムを結ぶ線（解けなかったところは飛ばして結ぶ）。点はその上に描く
      if (cases) line('t', 'stats-time-line', false);
      // 1回のタイム（点）。多いときは小さく
      const r = n > 600 ? 1.4 : n > 200 ? 1.9 : n > 60 ? 2.4 : 3;
      const dots = svgEl('g');
      vis.forEach((p, j) => {
        const cx = x(j);
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
      g.append(dots);
      // 通し：ao5・ao12（平均が出ない（DNF・足りない）ところは途切れる）
      if (!cases) {
        line('ao12', 'stats-avg-line ao12', true);
        line('ao5', 'stats-avg-line ao5', true);
      }
      plot.replaceWith(g);
      plot = g;
      if (nav) {
        nav.label.textContent = I.t('stats.trendRange', { from: start + 1, to: start + n, n: total });
        nav.older.disabled = start === 0;
        nav.newer.disabled = trendEnd === 0;
        nav.latest.hidden = trendEnd === 0;
        // つまみ：幅は全体のうちの窓の割合（細すぎるときは 8px）。左端は動ける幅（帯 − つまみ）のうちの位置
        const tw = `max(8px, ${(n / total) * 100}%)`;
        nav.thumb.style.width = tw;
        nav.thumb.style.left = `calc((100% - ${tw}) * ${total > n ? start / (total - n) : 0})`;
        nav.track.setAttribute('aria-valuenow', String(start + n));
        nav.track.setAttribute('aria-valuetext', nav.label.textContent);
      }
    }
    function moveTo(end) {
      const next = Math.max(0, Math.min(total - n, end));
      if (next === trendEnd) return;
      trendEnd = next;
      hide();
      drawWindow();
    }
    drawWindow();

    // マウス・タッチで、いちばん近い記録の縦線と詳しい値を出す
    const indexAt = (ev) => {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      return n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((px - pad.l) / iw) * (n - 1))));
    };
    const show = (ev) => {
      const j = indexAt(ev);
      const p = pts[start + j];
      const rect = svg.getBoundingClientRect();
      cursor.setAttribute('x1', x(j));
      cursor.setAttribute('x2', x(j));
      cursor.setAttribute('visibility', 'visible');
      const head = el('div', 'stats-tip-head', `#${start + j + 1} · ${dateTime(p.r.at)}`);
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
      placeTip(tip, box, (x(j) / W) * rect.width);
    };
    function hide() {
      tip.hidden = true;
      cursor.setAttribute('visibility', 'hidden');
    }
    // 多いとき：横にドラッグ・スワイプで動かす（数 px 動くまでは詳しい値を出すだけ）。縦のスクロールはそのまま（touch-action: pan-y）
    let drag = null;
    hit.addEventListener('pointerdown', (ev) => {
      show(ev);
      if (!paged) return;
      drag = { x: ev.clientX, end: trendEnd, moving: false, id: ev.pointerId };
      hit.setPointerCapture(ev.pointerId);
    });
    hit.addEventListener('pointermove', (ev) => {
      if (!drag || drag.id !== ev.pointerId) {
        if (ev.pointerType === 'mouse' || !drag) show(ev);
        return;
      }
      const dx = ev.clientX - drag.x;
      if (!drag.moving && Math.abs(dx) < 6) return;
      if (!drag.moving) {
        drag.moving = true;
        svg.classList.add('dragging');
      }
      const perRecord = (svg.getBoundingClientRect().width * (iw / W)) / Math.max(1, n - 1); // 1 回分の画面の px
      moveTo(drag.end + Math.round(dx / perRecord)); // 右へ動かす＝前の記録が見える
    });
    const endDrag = (ev) => {
      if (!drag || drag.id !== ev.pointerId) return;
      const moved = drag.moving;
      drag = null;
      svg.classList.remove('dragging');
      if (moved) hide();
    };
    hit.addEventListener('pointerup', endDrag);
    hit.addEventListener('pointercancel', (ev) => {
      endDrag(ev);
      hide();
    });
    // マウスが外に出たら消す（タッチは指を離すと pointerleave が来るので、タップで出した詳しい値は残す）
    hit.addEventListener('pointerleave', (ev) => {
      if (!drag && ev.pointerType === 'mouse') hide();
    });
    // トラックパッドの横スクロール・Shift + ホイールでも動かす（縦のホイールはページのスクロールのまま）
    if (paged) {
      let wheelAcc = 0;
      svg.addEventListener(
        'wheel',
        (ev) => {
          const d = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.shiftKey ? ev.deltaY : 0;
          if (!d) return;
          ev.preventDefault();
          const perRecord = (svg.getBoundingClientRect().width * (iw / W)) / Math.max(1, n - 1);
          wheelAcc += d;
          const steps = Math.trunc(wheelAcc / perRecord);
          if (!steps) return;
          wheelAcc -= steps * perRecord;
          moveTo(trendEnd - steps); // 右へスクロール＝新しい記録へ
        },
        { passive: false }
      );
    }

    // 凡例
    const legend = el('div', 'stats-legend');
    const item = legendItem;
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

  // ---- タイムの分布（横軸＝タイムの区間、縦軸＝その区間に入った回数） ----
  // 期間内の解けた記録だけを数える（通しは +2 を足したタイム。DNF・解けなかった回は凡例に回数だけ出す）。
  // 区間の幅はきりのよい秒数。外れ値で棒がつぶれないよう、右の端は 95% 点まで（全部が近ければいちばん遅いタイムまで）にし、
  // それより遅い記録は右の端の「〜以上」の棒にまとめる。PLL・OLL は今の習得の目安を縦の破線で出し、
  // 目安以内の回を緑で棒の下に積む（凡例に目安以内の割合）
  const BIN_STEPS = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 15, 20, 30, 60, 120, 300, 600];
  function renderDist(recs) {
    const box = $('statsChart');
    const f = from();
    const cases = !own();
    const inPeriod = recs.filter((r) => r.at >= f);
    const times = inPeriod
      .map((r) => P.effectiveTime(r))
      .filter((t) => typeof t === 'number')
      .sort((a, b) => a - b);
    const n = times.length;
    const dnf = inPeriod.length - n;
    if (!n) {
      const empty = el('p', 'stats-chart-empty text-muted small');
      I.set(empty, 'stats.empty');
      box.append(empty);
      return;
    }
    const target = cases ? P.thresholdOf(practice(), view.set) : null;

    const W = Math.round(Math.min(1200, Math.max(280, box.clientWidth || 720)));
    const H = W < 500 ? 210 : 260;
    const pad = { l: 40, r: 10, t: 12, b: 24 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    // 区間
    const min = times[0];
    const max = times[n - 1];
    const p95 = times[Math.min(n - 1, Math.floor(n * 0.95))];
    const top = max <= p95 * 1.25 ? max : p95;
    const want = Math.max(4, Math.min(W < 500 ? 12 : 24, Math.ceil(Math.sqrt(n) * 2)));
    const w = BIN_STEPS.find((st) => st >= (top - min) / want) || Math.ceil((top - min) / want / 600) * 600;
    const start = Math.floor(min / w + 1e-9) * w;
    const count = Math.max(1, Math.floor((top - start) / w + 1e-9) + 1);
    const bins = [];
    for (let i = 0; i < count; i++) bins.push({ lo: start + i * w, hi: start + (i + 1) * w, n: 0, fast: 0 });
    let over = null;
    // 目安以内（習得の判定と同じく、目安ちょうども含む。Progress の judge）
    const isFast = (t) => typeof target === 'number' && t <= target;
    times.forEach((t) => {
      const i = Math.floor((t - start) / w + 1e-9);
      let b = bins[i];
      if (i >= count) {
        if (!over) over = { lo: start + count * w, hi: null, n: 0, fast: 0, over: true };
        b = over;
      }
      b.n++;
      if (isFast(t)) b.fast++;
    });
    const fastAll = times.filter(isFast).length;
    if (over) bins.push(over);
    const nb = bins.length;
    const digits = w < 0.1 ? 2 : w < 1 ? 1 : 0;
    const edge = (v) => (v >= 60 ? P.formatTime(v, digits) : v.toFixed(digits) + 's'); // 60 秒以上は分表記（推移の目盛りと同じく s をつけない）

    // 縦軸（回数）
    const maxN = Math.max(...bins.map((b) => b.n));
    const yStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((st) => maxN / st <= 4) || 1000;
    const yHi = Math.max(yStep, Math.ceil(maxN / yStep) * yStep);
    const bw = iw / nb;
    const bx = (i) => pad.l + bw * i;
    const y = (v) => pad.t + ih * (1 - v / yHi);

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'stats-svg', role: 'img' });
    svg.setAttribute('aria-label', I.t('stats.dist'));
    for (let v = 0; v <= yHi; v += yStep) {
      svg.append(svgEl('line', { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: 'stats-grid' }));
      const t = svgEl('text', { x: pad.l - 6, y: y(v) + 3.5, class: 'stats-axis', 'text-anchor': 'end' });
      t.textContent = String(v);
      svg.append(t);
    }
    // 横の目盛り：区間の境目（多いときは間引く）。「〜以上」の棒は左の端に「≥」をつける
    const maxTicks = W < 500 ? 5 : 9;
    const every = Math.max(1, Math.ceil((nb + 1) / maxTicks));
    for (let i = 0; i <= count; i += every) {
      // 左右の端の文字ははみ出さないよう、端に揃える
      const anchor = i === 0 ? 'start' : bx(i) > W - pad.r - 16 ? 'end' : 'middle';
      const t = svgEl('text', { x: bx(i), y: H - 6, class: 'stats-axis', 'text-anchor': anchor });
      t.textContent = (over && i === count ? '≥' : '') + edge(start + i * w);
      svg.append(t);
    }
    const gap = bw > 8 ? 2 : bw > 4 ? 1 : 0;
    // 棒：PLL・OLL は目安以内（緑）を下に、残り（青）を上に積む。区間ごとの rect の組
    const bars = bins.map((b, i) => {
      const segs = [];
      const seg = (from, to, cls) => {
        if (to <= from) return;
        const r = svgEl('rect', {
          x: bx(i) + gap / 2,
          y: y(to),
          width: Math.max(0.5, bw - gap),
          height: Math.max(0, y(from) - y(to)),
          // 積み上げの境目が角丸で欠けないよう、角を丸めるのは棒のいちばん上の段だけ
          rx: to === b.n ? Math.min(2, (bw - gap) / 4) : 0,
          class: 'stats-bar' + (cls ? ' ' + cls : '') + (b.over ? ' over' : ''),
        });
        svg.append(r);
        segs.push(r);
      };
      seg(0, b.fast, 'fast');
      seg(b.fast, b.n, '');
      return segs;
    });
    // 習得の目安（PLL・OLL）
    if (typeof target === 'number' && target >= start && target <= start + count * w) {
      const tx = pad.l + ((target - start) / w) * bw;
      svg.append(svgEl('line', { x1: tx, x2: tx, y1: pad.t, y2: pad.t + ih, class: 'stats-target' }));
    }
    const hit = svgEl('rect', { x: pad.l, y: 0, width: iw, height: H, fill: 'transparent' });
    svg.append(hit);
    box.append(svg);

    // マウス・タッチで、その棒の区間と回数を出す
    const tip = el('div', 'stats-tip');
    tip.hidden = true;
    box.append(tip);
    const show = (ev) => {
      const rect = svg.getBoundingClientRect();
      const px = ((ev.clientX - rect.left) / rect.width) * W;
      const i = Math.max(0, Math.min(nb - 1, Math.floor((px - pad.l) / bw)));
      const b = bins[i];
      bars.forEach((segs, k) => segs.forEach((r) => r.classList.toggle('active', k === i)));
      const head = el('div', 'stats-tip-head', b.over ? I.t('stats.distOver', { t: edge(b.lo) }) : `${edge(b.lo)} – ${edge(b.hi)}`);
      const row = el('div', 'stats-tip-row');
      row.append(
        el('span', 'stats-tip-value', I.t('stats.distSolves', { n: b.n })),
        el('span', 'stats-tip-label', I.t('stats.distShare', { p: Math.round((b.n / n) * 100) }))
      );
      tip.replaceChildren(head, row);
      tip.hidden = false;
      placeTip(tip, box, ((bx(i) + bw / 2) / W) * rect.width);
    };
    const hide = () => {
      tip.hidden = true;
      bars.forEach((segs) => segs.forEach((r) => r.classList.remove('active')));
    };
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', (ev) => {
      if (ev.pointerType === 'mouse') hide(); // タッチは指を離すと来るので、タップで出した値は残す
    });

    // 凡例：棒の色（PLL・OLL は目安以内・目安より遅い。通しは青＝DNF を除いた回数）、PLL・OLL は「解けた n 回」、DNF・解けなかった回数、目安（と目安以内の割合）
    const legend = el('div', 'stats-legend');
    if (typeof target === 'number') {
      // 青は目安より遅い回だけなので、全体の回数は色の印をつけずに別に出す
      legend.append(legendItem('bar fast', 'stats.distFast'), legendItem('bar', 'stats.distSlow'), el('span', 'stats-legend-item', I.t('stats.distTotal', { n: n })));
    } else {
      legend.append(legendItem('bar', 'stats.distFullTotal', { n: n })); // 通しは「解けた」ではなく、DNF を除いた回数
    }
    if (dnf) legend.append(legendItem('dnf', cases ? 'stats.distDnf' : 'stats.dnfCount', { n: dnf }));
    if (typeof target === 'number') {
      legend.append(legendItem('target', 'stats.legendTargetShare', { t: fmt(target), p: Math.round((fastAll / n) * 100) }));
    }
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
    const threshold = P.thresholdOf(practice(), view.set);
    const opts = { from: from(), n: RECENT, dnfAs: threshold * 2 };
    const recent = P.recentPerCase(log, opts);
    const index = {};
    const groupIndex = {}; // グループの並び（データに最初に出てくる順。3x3 のグループ名は A〜Z の順ではないので名前では並べない）
    DATA[view.set].forEach((c, i) => {
      index[c.name] = i;
      if (!(c.group in groupIndex)) groupIndex[c.group] = Object.keys(groupIndex).length;
    });
    // 回数の少ないケースがたまたまの1回で上に来ないよう、並べるときは全体の平均に寄せる
    // （そのケースの回数に、全体の平均のタイムで PRIOR 回を足した平均。P.weakScores。練習の出題の重みと共通）。表に出すのは寄せる前の平均
    const weak = P.weakScores(log, Object.assign({ prior: PRIOR }, opts)).scores;
    return casesInScope()
      .filter((c) => per[c.name])
      .map((c) =>
        Object.assign({ c: c, name: c.name, group: c.group, groupIndex: groupIndex[c.group], index: index[c.name], status: P.statusOf(view.set, c.name) }, per[c.name], {
          recent: recent[c.name],
          weak: c.name in weak ? weak[c.name] : null,
        })
      );
  }

  function sortRows(list) {
    // 覚える順は覚える順のデータがあるときだけ（無ければ苦手順）。'group' は PLL ならグループ順、OLL なら番号順
    const k = view.sort === 'learn' && (!hasStages() || view.set === 'zbll') ? 'weak' : view.sort;
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
    const show = !own() && view.tab !== 'solves';
    box.hidden = !show;
    if (!show) return;
    const items = [
      { value: 'weak', key: 'stats.sortWeak', title: 'stats.sortWeakTitle' },
      Object.assign({ value: 'group' }, window.CaseSections.orderKeys(view.set, DATA[view.set]).group),
    ];
    // 覚える順（ZBLL は OCLL ごと。小グループ順と同じ並びになるので出さない）
    if (hasStages() && view.set !== 'zbll') items.push(Object.assign({ value: 'learn' }, window.CaseSections.orderKeys(view.set, DATA[view.set]).learn));
    const current = view.sort === 'learn' && (!hasStages() || view.set === 'zbll') ? 'weak' : view.sort;
    const pick = (v) => change({ sort: v, desc: v === 'weak' });
    const seg = segment(items, current, pick);
    I.set(seg, 'list.orderAria', null, 'aria-label');
    // スマホ（幅 576px 未満）は同じ項目のプルダウン（css/stats.css で出し分け）。
    // 表の列の見出しで並べ替えたとき（どれにも当たらない）は「並び」を出す
    const select = el('select', 'form-select form-select-sm stats-sort-select');
    I.set(select, 'list.orderAria', null, 'aria-label');
    if (!items.some((item) => item.value === current)) {
      const option = el('option');
      option.value = '';
      option.disabled = true;
      option.selected = true;
      I.set(option, 'list.orderAria');
      select.append(option);
    }
    items.forEach((item) => {
      const option = el('option');
      option.value = item.value;
      I.set(option, item.key);
      option.selected = item.value === current;
      select.append(option);
    });
    select.addEventListener('change', () => pick(select.value));
    box.replaceChildren(seg, select);
  }

  function renderTable(log) {
    const head = el('tr');
    COLUMNS.forEach((col) => {
      const th = el('th', (col.num ? 'text-end ' : '') + 'stats-col-' + col.key); // stats-col-group はスマホで隠す
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
    // 期間内に記録が無ければ表のパネルごと隠す（「まだ記録がありません。」はグラフの側だけに出す）
    $('statsTablePanel').hidden = !list.length;
    const display = P.displaySettings(view.set);
    $('statsBody').replaceChildren(
      ...list.map((r) => {
        const tr = el('tr');
        const imgTd = el('td', 'stats-img');
        const image = el('div', 'case-image');
        const colors = P.caseColors(r.c, display.scheme, view.set);
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
        // 回数は解けなかった回も含めた数だけ（DNF は「最近」の列に出すので、ここでくり返さない）
        const count = String(r.count);
        const date = `${last.getMonth() + 1}/${last.getDate()}`;
        const cells = [
          el('td', 'text-muted stats-col-group', r.group),
          statusTd,
          recentTd,
          el('td', 'text-end stats-col-count cell-wide', count),
          el('td', 'text-end cell-wide', fmt(r.best)),
          el('td', 'text-end cell-wide', fmt(r.avg)),
          el('td', 'text-end text-muted cell-wide', date),
        ];
        // スマホ：回数・ベスト・平均は 2 段目に 1 行の小さい字でまとめ、最後に練習した日はその右端に置く
        // （上の 4 つの列は隠す。css/stats.css）。解けなかった回数は 1 段目の「最近」の DNF に任せる（1 行に収めるため）
        const meta = el('td', 'cell-meta');
        const countItem = el('span', 'stats-meta-item');
        I.set(countItem, 'stats.countShort', { n: r.count });
        meta.append(countItem);
        [
          ['stats.col.best', fmt(r.best)],
          ['stats.avgShort', fmt(r.avg)],
        ].forEach(([key, value]) => {
          const item = el('span', 'stats-meta-item');
          const label = el('span', 'stats-meta-label');
          I.set(label, key);
          item.append(label, document.createTextNode(' ' + value));
          meta.append(item);
        });
        meta.append(el('span', 'stats-meta-date', date));
        cells.push(meta);
        nameTd.className = 'cell-name';
        statusTd.className = 'cell-status';
        recentTd.classList.add('cell-recent');
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
  // LL の記録（practice.ll.log、新しい順）
  const llLog = () => {
    const f = practice().ll;
    return f && Array.isArray(f.log) ? f.log.filter((r) => r && typeof r.at === 'number') : [];
  };
  const ownLog = () => (view.set === 'll' ? llLog() : fullLog());
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
    const mean = P.meanTime(recs);
    const dnf = recs.filter((r) => P.effectiveTime(r) === null).length;
    // キーは文字列のまま書く（test/pages.test.js の訳のキーの確認で拾えるように）
    const ao = (key, n) => card(key, showAvg(P.bestAverage(recs, n)), I.t('stats.current', { t: showAvg(P.average(recs, n)) }));
    // 6 枚（広い画面は 3 列 × 2 段。css の .stats-cards.full）
    $('statsCards').replaceChildren(
      card('stats.count', String(recs.length), dnf ? I.t('stats.dnfCount', { n: dnf }) : ''),
      card('practice.mean', mean == null ? '–' : fmt(mean), I.t('stats.excludingDnf')),
      card('practice.bestSingle', best == null ? '–' : fmt(best)),
      ao('practice.bestAo5', 5),
      ao('practice.bestAo12', 12),
      ao('practice.bestAo100', 100)
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
  // ページ数がこれより多いときは、番号のボタンの代わりにページを選ぶプルダウンにする（番号が多いとスマホで 1 行に入らず、途中へも飛べないため）。
  // 5 は、幅 320px のスマホでも前へ・次へ（矢印）と番号が 1 行に収まる数
  const PAGE_BUTTONS_MAX = 5;
  // プルダウンの日付：今年なら「11/21」、ほかの年なら「2025/11/21」
  const pageDay = (ms) => {
    const d = new Date(ms);
    const md = `${d.getMonth() + 1}/${d.getDate()}`;
    return d.getFullYear() === new Date().getFullYear() ? md : `${d.getFullYear()}/${md}`;
  };
  // n ページ目の記録の日付の範囲（古い日〜新しい日。記録は新しい順）。1 日だけなら日付 1 つ。
  // 終わりの日は、始まりと同じ年なら年を省く（「2025/10/21〜10/23」）
  function pageDates(recs, n) {
    const newer = recs[(n - 1) * PAGE_SIZE].at;
    const older = recs[Math.min(recs.length, n * PAGE_SIZE) - 1].at;
    const from = pageDay(older);
    const to = pageDay(newer);
    if (from === to) return { key: 'stats.pageOptionDay', params: { n: n, d: from } };
    const sameYear = new Date(older).getFullYear() === new Date(newer).getFullYear();
    const toShort = sameYear ? `${new Date(newer).getMonth() + 1}/${new Date(newer).getDate()}` : to;
    return { key: 'stats.pageOption', params: { n: n, from: from, to: toShort } };
  }
  // ページを移っても、ページ送り（表の頭）は画面の同じ位置に残す（削除のバーの出入りなどでずれないように。
  // 移ったページは、ページ送りのすぐ下から 1 件目が続く）。直すときはアニメーションさせない
  // （Bootstrap がページのスクロールをなめらかにしているので、そのままだと下へ行って戻るように動いて見える）。
  // ブラウザが表の行を目印にスクロールを合わせる動き（scroll anchoring）は、表のパネルでは止めている（css/stats.css）
  function goPage(n) {
    const before = $('statsPager').getBoundingClientRect().top;
    page = n;
    render();
    const pager = $('statsPager');
    const diff = pager.hidden ? 0 : pager.getBoundingClientRect().top - before;
    if (Math.abs(diff) >= 1) window.scrollTo({ top: window.scrollY + diff, behavior: 'instant' });
  }
  // recs：一覧の記録すべて（新しい順）。PAGE_BUTTONS_MAX ページまでは番号のボタン、それより多いときはページを選ぶプルダウン（各ページの日付付き）
  function renderPager(recs) {
    const box = $('statsPager');
    const total = recs.length;
    const pages = Math.ceil(total / PAGE_SIZE);
    box.hidden = pages <= 1;
    box.replaceChildren();
    if (pages <= 1) return;
    const info = el('span', 'stats-pager-info');
    I.set(info, 'stats.pageRange', { n: total, from: (page - 1) * PAGE_SIZE + 1, to: Math.min(total, page * PAGE_SIZE) });
    const nav = el('nav', 'stats-pager-nav');
    I.set(nav, 'stats.pagerAria', null, 'aria-label');
    // 前へ・次へ：スマホ（幅 576px 未満）は矢印だけ（文字は読み上げ用の aria-label に残す。css/stats.css）
    const step = (key, arrow, target, disabled) => {
      const b = el('button', 'stats-page stats-page-step');
      b.type = 'button';
      const label = el('span', 'stats-page-step-label');
      I.set(label, key);
      I.set(b, key, null, 'aria-label');
      const mark = el('span', null, arrow);
      mark.setAttribute('aria-hidden', 'true');
      if (arrow === '‹') b.append(mark, label);
      else b.append(label, mark);
      b.disabled = disabled;
      b.addEventListener('click', () => goPage(target));
      return b;
    };
    nav.append(step('stats.pagePrev', '‹', page - 1, page === 1));
    if (pages <= PAGE_BUTTONS_MAX) {
      for (let n = 1; n <= pages; n++) {
        const b = el('button', 'stats-page' + (n === page ? ' active' : ''), String(n));
        b.type = 'button';
        I.set(b, 'stats.pageN', { n: n }, 'aria-label');
        if (n === page) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', () => goPage(n));
        nav.append(b);
      }
    } else {
      const select = el('select', 'form-select form-select-sm stats-page-select');
      I.set(select, 'stats.pageSelectAria', null, 'aria-label');
      for (let n = 1; n <= pages; n++) {
        const option = el('option');
        option.value = String(n);
        const label = pageDates(recs, n);
        I.set(option, label.key, label.params);
        option.selected = n === page;
        select.append(option);
      }
      select.addEventListener('change', () => goPage(Number(select.value)));
      nav.append(select);
    }
    nav.append(step('stats.pageNext', '›', page + 1, page === pages));
    box.append(info, nav);
  }

  // ---- 記録の削除（通しは practice.full.log、PLL・OLL は practice.log のその種類の記録） ----
  // 個別：各行の × で1件を削除。一括：行のチェックで選び（見出しのチェックで表示中をすべて）、「選択した記録を削除」→ 確認 → 削除。
  // どちらも削除のあとに「元に戻す」を出す（ブラウザの確認ダイアログは使わない）
  const selected = new Set(); // 選んだ記録の at（表示中の種類の中で）
  const openScrambles = new Set(); // スクランブルを開いている記録の at
  let confirmingDelete = false;
  let confirmingAll = false; // 「すべての記録を削除」の確認中
  let deleteMessage = null; // { text, undo }

  function saveFullLog(log) {
    const p = practice();
    const full = Object.assign({ inspection: true }, p.full, { log: log });
    S.set('practice', Object.assign({}, p, { full: full }));
  }
  function saveLlLog(log) {
    const p = practice();
    S.set('practice', Object.assign({}, p, { ll: Object.assign({}, p.ll, { log: log }) }));
  }

  // 種類ごとの記録の読み書き（PLL・OLL の記録は1つの配列 practice.log に混ざっている）
  const caseLog = () => (Array.isArray(practice().log) ? practice().log.filter(Boolean) : []);
  const saveCaseLog = (log) => S.set('practice', Object.assign({}, practice(), { log: log }));
  const logStore = (kind) =>
    kind === 'full'
      ? { read: fullLog, write: saveFullLog, mine: () => true, id: (r) => String(r.at) }
      : kind === 'll'
      ? { read: llLog, write: saveLlLog, mine: () => true, id: (r) => String(r.at) }
      : { read: caseLog, write: saveCaseLog, mine: (r) => r.set === kind, id: (r) => r.set + '|' + r.at };

  // 「すべての記録を削除」の文：通しは「通しの…」（「PLL の…」と空白の入れ方が違うので別の文）
  const allKey = (key) => key + (view.set === 'full' ? 'Full' : '');
  const setName = (kind) => kind.toUpperCase();

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
    confirmingAll = false;
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
    // すべて削除：表示中の種類の記録すべて（期間・範囲に関係なく）
    const store = logStore(view.set);
    const everything = store.read().filter(store.mine);
    if (confirmingAll && everything.length) {
      const text = el('span', 'stats-delete-confirm');
      I.set(text, allKey('stats.deleteAllConfirm'), { n: everything.length, set: setName(view.set) });
      const yes = el('button', 'btn btn-danger btn-sm');
      yes.type = 'button';
      I.set(yes, 'stats.deleteAllYes');
      yes.addEventListener('click', () => afterDelete(everything.length, deleteRecords(everything.map((r) => r.at))));
      const no = el('button', 'btn btn-outline-secondary btn-sm');
      no.type = 'button';
      I.set(no, 'stats.cancel');
      no.addEventListener('click', () => {
        confirmingAll = false;
        render();
      });
      bar.append(text, yes, no);
      setTimeout(() => no.focus()); // 間違って消さないよう、最初のフォーカスはキャンセル
      return;
    }
    confirmingAll = false;
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
    // スマホでは記録の一覧（ソルブ・PLL・OLL・COLL・ZBLL）の見出しを隠すので、「すべて選ぶ」をここに出す
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
    bar.append(allLabel); // 広い画面では CSS で隠す（見出しのチェックを使う）
    const del = el('button', 'btn btn-outline-secondary btn-sm');
    del.type = 'button';
    I.set(del, 'stats.deleteSelected', { n: n });
    del.disabled = !n;
    del.addEventListener('click', () => {
      deleteMessage = null;
      confirmingDelete = true;
      render();
    });
    bar.append(del);
    // すべての記録を削除（目立たない小さなリンク。右端に置く）
    if (everything.length) {
      const all = el('button', 'btn btn-link btn-sm stats-delete-all');
      all.type = 'button';
      I.set(all, 'stats.deleteAll');
      I.set(all, allKey('stats.deleteAllTitle'), { set: setName(view.set) }, 'title');
      all.addEventListener('click', () => {
        deleteMessage = null;
        confirmingDelete = false;
        confirmingAll = true;
        render();
      });
      bar.append(all);
    }
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
    const ll = view.set === 'll';
    ['stats.col.date', 'stats.col.time', 'practice.ao5', 'practice.ao12', ll ? 'stats.col.case' : 'practice.scramble'].forEach((key, i) => {
      const th = el('th', (i >= 1 && i <= 3 ? 'text-end ' : '') + (i <= 3 ? 'stats-shrink' : ''));
      I.set(th, key);
      head.append(th);
    });
    head.append(el('th', 'stats-shrink'));
    $('statsHead').replaceChildren(head);
    $('statsTablePanel').hidden = !recs.length; // 期間内に記録が無ければ表のパネルごと隠す（削除のバーも出さない）
    renderDeleteBar(recs, shown);
    renderPager(recs);
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
        // LL はスクランブルの代わりにケース（OLL → PLL）
        const scrambleTd = ll ? el('td', 'cell-toggle text-nowrap', r.p ? `${r.o || '?'} → ${r.p}` : r.o || '?') : el('td', 'cell-toggle');
        if (!ll) scrambleTd.append(toggle);
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
        if (!open || ll) return [tr];
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
    $('statsTablePanel').hidden = !recs.length; // 期間内に記録が無ければ表のパネルごと隠す（削除のバーも出さない）
    renderDeleteBar(recs, shown);
    renderPager(recs);
    $('statsBody').replaceChildren(
      ...shown.map((r) => {
        const date = dateTime(r.at);
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
        const statusTd = el('td', 'stats-shrink cell-verdict');
        const badge = el('span', 'stats-status ' + (r.status === 'learned' ? 'learned' : 'learning'));
        I.set(badge, 'status.' + (r.status === 'learned' ? 'learned' : 'learning'));
        statusTd.append(badge);
        if (r.hint) {
          const hint = el('span', 'stats-hint');
          I.set(hint, 'stats.hintUsed');
          statusTd.append(hint);
        }
        const timeTd = el('td', 'text-end fw-semibold stats-shrink cell-time');
        if (typeof r.sec === 'number') timeTd.textContent = fmt(r.sec);
        else I.set(timeTd, 'stats.dnf');
        const delTd = el('td', 'text-end cell-del');
        const del = el('button', 'stats-row-delete');
        del.type = 'button';
        del.textContent = '×';
        I.set(del, 'stats.deleteRow', { date: date }, 'aria-label');
        I.set(del, 'stats.deleteRow', { date: date }, 'title');
        del.addEventListener('click', () => afterDelete(1, deleteRecords([r.at])));
        delTd.append(del);
        tr.append(checkTd, el('td', 'text-muted stats-shrink cell-date', date), el('td', 'stats-shrink fw-semibold cell-case', r.name), timeTd, statusTd, delTd);
        return tr;
      })
    );
  }

  // 表の見出しの右：PLL・OLL では「ケースごと / 記録の一覧」の切り替え
  function renderTableTabs() {
    const box = $('statsTableTabs');
    if (own()) {
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
    renderChartTabs();
    renderTableTabs();
    renderSortBar();
    const full = own(); // 通し・LL（タイムだけ）
    const solves = full || view.tab === 'solves';
    I.set($('statsTableTitle'), solves ? 'stats.solves' : 'stats.byCase');
    // PLL・OLL・COLL・ZBLL は「ケースごと / 記録の一覧」の切り替えが見出しを兼ねるので、見出しの文字は読み上げ用に見えない形にする
    $('statsTableTitle').classList.toggle('visually-hidden', !full);
    if (!solves) {
      $('statsDeleteBar').hidden = true;
      $('statsPager').hidden = true;
    }
    $('statsTable').classList.toggle('stats-full-table', full); // スマホでは通しの一覧を2段のカード風にする
    $('statsTable').classList.toggle('stats-caselog-table', !full && solves); // PLL・OLL の記録の一覧も同じく 2 段にする
    $('statsTable').classList.toggle('stats-case-table', !solves); // ケースごとの表もスマホでは 2 段にする（横にスクロールしない）
    $('statsCards').classList.toggle('full', full); // 通しはカードが 6 枚なので広い画面で 3 列
    if (full) {
      const all = ownLog(); // 読むたびに別のオブジェクトになるので1回だけ読む
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
