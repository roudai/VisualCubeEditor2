// 練習ページ（practice.html）：スクランブルを出し、手元のパズルで解くタイムを測って習得状況を自動で変える。
// 仕様: reference/PRACTICE_SPEC.md
//   - 出題：選んだ種類（PLL / OLL / COLL）・グループ（選んでいなければすべて）・対象（習得状況）に当てはまるケースから選ぶ
//     （直前と同じケースは避ける。設定の出題が「苦手優先」なら苦手なケースほど出やすく、「ランダム」なら同じ確率）、そのケースのスクランブル（js/<pll|oll>-scrambles.js。各 20 本。ランダムな AUF 込みで
//     作ってあるので、そのまま出す）からランダムに選ぶ。ケースの名前と画像は解き終わるまで出さない
//   - グループを選ぶ欄で「グループ順 / 覚える順」（OLL は「番号順 / 覚える順」）を切り替えられる（覚える順は data/<set>/learn_order.json。
//     Cube Voyage の順。並びは 'list-filter' の <set>Order、選んだ段階は prefs.groups['<set>-stage']）。
//     OLL の番号順ではグループを選ばない（すべてのケースから出題。前に選んだ OLL のグループは使わない）
//   - タイマー：スペースを押す（画面ではタイマーをタップする）とスタート。何かのキー（タップ）でストップ。
//     計測中もスクランブルは出したまま。止めたあとはタイムを 0.00 に戻さず、タイマーの上に解いたケース（PLL Aa など）を出す。
//     計測中の Esc は中止（記録しない）。計測中に「スキップ」「解けなかった」を押してもタイムは記録しない。
//     押しっぱなしの繰り返しは無視する。止めてから 2 秒はスタートしない（その間はタイマーの数字を赤にする。通しも同じ）
//   - ヒント：ケースの名前と解く手順の最初の3手を出す（もう一度押すと消す）。ヒントを見た問題は目安以内でも練習中にし、タイムを最近の記録に入れない
//   - 判定（progress.js の judge）：しきい値以内 → 習得済み、超えた・「解けなかった」→ 練習中。「スキップ」は記録しない。
//     結果の「取り消す」で直前の判定とタイムを戻す
//   - 設定（種類・グループ・対象・しきい値）と各ケースの最近のタイム（最大10件）は store.js の 'practice' に保存
//     （ログイン中はクラウドにも）。判定ごとに日時付きの記録 log（最大2000件）も足す（記録のページ stats.html で使う）。
//     URL ?set=oll&filter=new で初期値を指定できる。一覧ページの「練習する」からは
//     &groups=Dot,Square（空ならすべて）で、一覧で選んだグループも引き継ぐ。?case=Aa なら最初の1問はそのケース
//   - 通し（set: 'full'）：WCA 形式（random-state）のスクランブル（wca-scramble.js）で通しで解く。スクランブルは次の1本を
//     先に作っておく（最初の1本はソルバの準備に 0.5 秒ほどかかるので、その間は「作成中」と出す）。15秒のインスペクション（オン・オフ）、
//     +2 / DNF（インスペクションの超過で自動、結果からも変えられる）、ao5・ao12・ベスト（progress.js の average など）。
//     記録は practice.full = { inspection, log: [{ at, sec, penalty, s }] }（s はスクランブルの短い形。1手1文字）。習得状況は変えない。
//     通しのタイマーは長押し（0.3 秒で準備完了）して離したときにスタートする
(function () {
  'use strict';
  const S = window.Store;
  const I = window.I18N;
  const P = window.Progress;
  const D = window.CubeDraw;
  const W = window.WcaScramble;
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
    zbll: window.ZBLL_DATA || [], // ZBLL はエディタで自分の手順を保存しないので、そのまま
  };
  const SCRAMBLES = { pll: window.PLL_SCRAMBLES || {}, oll: window.OLL_SCRAMBLES || {}, coll: window.COLL_SCRAMBLES || {}, zbll: window.ZBLL_SCRAMBLES || {} };
  const FILTERS = ['new', 'learning', 'learned', 'all'];
  const MAX_TIMES = 10;
  const HISTORY = 12;

  // ---- 設定 ----
  const saved = S.get('practice');
  const prefs = Object.assign({ set: 'pll', filter: 'new', times: {} }, saved && typeof saved === 'object' ? saved : {});
  const params = new URLSearchParams(location.search);
  const SETS = ['pll', 'oll', 'coll', 'zbll', 'full'];
  if (SETS.includes(params.get('set'))) prefs.set = params.get('set');
  if (FILTERS.includes(params.get('filter'))) prefs.filter = params.get('filter');
  if (!SETS.includes(prefs.set)) prefs.set = 'pll';
  const isFull = () => prefs.set === 'full';
  // 通しの練習の設定と記録
  const fullPrefs = () => {
    const f = (S.get('practice') || {}).full;
    return Object.assign({ inspection: true, log: [] }, f && typeof f === 'object' ? f : {});
  };
  const saveFull = (change) => savePrefs({ full: Object.assign(fullPrefs(), change) });
  if (!FILTERS.includes(prefs.filter)) prefs.filter = 'new';
  // 習得の目安は種類ごと（prefs.thresholds = { pll, oll, coll, zbll }。既定は OLL 2 秒・ほかは 3 秒（P.thresholdOf）。以前の共通の threshold は P.thresholdOf が引き継ぐ）
  const threshold = (set) => P.thresholdOf(prefs, set || prefs.set);
  const setThreshold = (v) => changeSettings({ thresholds: Object.assign({}, prefs.thresholds, { [prefs.set]: v }) }, false);

  // 練習の設定・タイムは保存し直す前に読み直す（一覧など別のページでの変更を消さないように）
  function savePrefs(change) {
    const current = S.get('practice');
    const next = Object.assign({}, current && typeof current === 'object' ? current : {}, change);
    S.set('practice', next);
    Object.assign(prefs, next);
  }

  const inScope = (set) => DATA[set];
  // グループの絞り込み：prefs.groups[set] に選んだグループ（1つも選んでいなければすべて）
  const NOTES = window.CASE_GROUP_NOTES || {};
  // 覚える順（段階で選ぶ）か。並びは一覧ページと共通（'list-filter' の <set>Order）
  const CS = window.CaseSections;
  const byStage = (set) => CS.hasStages(DATA[set]) && ((S.get('list-filter') || {})[set + 'Order'] === 'learn');
  function setOrder(set, learn) {
    const f = S.get('list-filter');
    S.set('list-filter', Object.assign({}, f && typeof f === 'object' ? f : {}, { [set + 'Order']: learn ? 'learn' : 'group' }));
    renderSettings();
    next();
  }
  // 選んでいるグループ（覚える順なら段階の key "s9" など）。保存は prefs.groups[set]（段階は prefs.groups[set + '-stage'] に番号で）
  const groupsKey = (set) => (byStage(set) ? set + '-stage' : set);
  const chosenGroups = (set) => {
    if (CS.isNumbered(DATA[set]) && !byStage(set)) return null; // OLL の番号順：グループで選ばない
    const list = prefs.groups && Array.isArray(prefs.groups[groupsKey(set)]) ? prefs.groups[groupsKey(set)] : [];
    if (!list.length) return null;
    if (byStage(set)) return new Set(list.map((n) => 's' + n));
    // 2段（ZBLL の OCLL → 小グループ）：親をまたいでいたら（前の保存など）最初の親の分だけ
    const sections = CS.list(DATA[set], false);
    if (CS.isTwoLevel(sections)) {
      const one = CS.normalizeTwoLevel(sections, new Set(list));
      return one.size ? one : null;
    }
    return new Set(list);
  };
  const inSelection = (set) => {
    const chosen = chosenGroups(set);
    const stage = byStage(set);
    return inScope(set).filter((c) => !chosen || chosen.has(CS.keyOf(c, stage)));
  };
  // URL で指定した種類・絞り込みは保存する（以降の savePrefs が保存済みの前回の値で prefs を上書きしないように）
  if (['set', 'filter'].some((k) => params.has(k))) savePrefs({ set: prefs.set, filter: prefs.filter });
  // 一覧ページから開いたとき（?order=…&groups=…）：並びと選んだグループを引き継いで保存する
  if (params.has('order') && CS.hasStages(DATA[prefs.set]) && ['learn', 'group'].includes(params.get('order'))) {
    const f = S.get('list-filter');
    S.set('list-filter', Object.assign({}, f && typeof f === 'object' ? f : {}, { [prefs.set + 'Order']: params.get('order') }));
  }
  if (params.has('groups')) {
    const stage = byStage(prefs.set);
    const valid = new Set(CS.list(DATA[prefs.set], stage).map((s) => (stage ? String(s.stage) : s.key)));
    const list = params
      .get('groups')
      .split(',')
      .filter((g) => valid.has(g))
      .map((g) => (stage ? Number(g) : g));
    savePrefs({ groups: Object.assign({}, prefs.groups, { [groupsKey(prefs.set)]: list }) });
  }
  const pool = () => inSelection(prefs.set).filter((c) => prefs.filter === 'all' || P.statusOf(prefs.set, c.name) === prefs.filter);
  let groupsOpen = false; // グループを選ぶ欄を開いているか

  // ---- 設定の表示 ----
  function segment(items, current, onPick) {
    const box = el('div', 'practice-segment');
    box.setAttribute('role', 'group');
    items.forEach((item) => {
      const b = el('button');
      b.type = 'button';
      const label = el('span');
      if (item.key) I.set(label, item.key, item.params);
      else label.textContent = item.text;
      b.append(label);
      if (item.title) I.set(b, item.title, item.titleParams, 'title'); // マウスを乗せたときの説明
      if (item.count != null) b.append(el('span', 'count', String(item.count)));
      b.classList.toggle('active', item.value === current);
      b.setAttribute('aria-pressed', String(item.value === current));
      b.addEventListener('click', () => onPick(item.value));
      box.append(b);
    });
    return box;
  }

  function field(labelKey, control) {
    const f = el('div', 'practice-field');
    const label = el('span', 'practice-field-label');
    I.set(label, labelKey);
    f.append(label, control);
    return f;
  }

  // マウスが無く、指で操作する画面か（操作の説明をタップの文にする）
  const TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)');
  TOUCH.addEventListener('change', () => renderSettings());

  function renderSettings() {
    // 種類は見出しの横に置く（設定の行を1行に収めるため）
    const setBox = $('practiceSetBox');
    setBox.replaceChildren();
    setBox.append(
      segment(
        [
          { value: 'pll', text: 'PLL' },
          { value: 'oll', text: 'OLL' },
          { value: 'coll', text: 'COLL' },
          { value: 'zbll', text: 'ZBLL' },
          { value: 'full', key: 'practice.full' },
        ],
        prefs.set,
        (v) => changeSettings({ set: v })
      )
    );
    // 「すべての記録を見る」は今の種類の記録を開く
    const statsQuery = new URLSearchParams({ set: prefs.set });
    $('allStatsLink').href = '/stats?' + statsQuery;
    const box = $('practiceSettings');
    box.replaceChildren();
    // スマホ（狭い画面）では、設定を今の選択を並べた 1 行にたたむ（押すと開く。開いているかは prefs.settingsOpen）。
    // 広い画面では 1 行の要約は出さず、いつも開いている（css/practice.css）
    box.classList.toggle('open', prefs.settingsOpen === true);
    box.append(settingsSummary());
    document.body.classList.toggle('practice-full', isFull());
    // 操作の説明：通しでインスペクションがオンのときはその手順
    // タッチの画面（マウスが無い）ではタップの説明にする
    const touch = TOUCH.matches ? 'Touch' : '';
    I.set($('timerHint'), (isFull() ? (fullPrefs().inspection ? 'practice.hintInspection' : 'practice.hintFull') : 'practice.hint') + touch);
    if (isFull()) {
      // 通し：インスペクションのオン・オフだけ
      box.append(
        field(
          'practice.inspection',
          segment(
            [
              { value: true, key: 'practice.on' },
              { value: false, key: 'practice.off' },
            ],
            fullPrefs().inspection,
            (v) => {
              saveFull({ inspection: v });
              renderSettings();
              resetTimer();
            }
          )
        )
      );
      return;
    }
    box.append(field(byStage(prefs.set) ? 'practice.stages' : 'practice.groups', groupSummary()));
    const cases = inSelection(prefs.set);
    const count = (f) => (f === 'all' ? cases.length : cases.filter((c) => P.statusOf(prefs.set, c.name) === f).length);
    box.append(
      field(
        'practice.target',
        segment(
          FILTERS.map((f) => ({ value: f, key: f === 'all' ? 'list.filterAll' : 'status.' + f, count: count(f) })),
          prefs.filter,
          (v) => changeSettings({ filter: v })
        )
      )
    );
    box.append(field('practice.threshold', thresholdSlider()));
    // 出題：苦手優先（既定）/ ランダム（PLL・OLL・COLL 共通）。変えても今の問題はそのまま
    box.append(
      field(
        'practice.pick',
        segment(
          [
            { value: true, key: 'practice.pickWeak' },
            { value: false, key: 'practice.pickRandom' },
          ],
          weighted(),
          (v) => changeSettings({ weighted: v }, false)
        )
      )
    );
    if (groupsOpen) box.append(groupPicker());
  }

  // スマホでたたんだときの 1 行：アイコン 対象 · 習得の目安 8.0秒 · 出題（グループを絞っていればそれも）。ソルブはインスペクション
  function settingsSummary() {
    const button = el('button', 'practice-settings-summary');
    button.type = 'button';
    const open = prefs.settingsOpen === true;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-controls', 'practiceSettings');
    const parts = [];
    if (isFull()) {
      parts.push(I.t('practice.inspection') + ' ' + I.t(fullPrefs().inspection ? 'practice.on' : 'practice.off'));
    } else {
      const chosen = chosenGroups(prefs.set);
      if (chosen) parts.push(I.t('practice.groupsCount', { n: chosen.size }));
      parts.push(I.t('practice.target') + ' ' + I.t(prefs.filter === 'all' ? 'list.filterAll' : 'status.' + prefs.filter));
      parts.push(I.t('practice.threshold') + ' ' + I.t('practice.seconds', { n: threshold().toFixed(1) }));
      parts.push(I.t(weighted() ? 'practice.pickWeak' : 'practice.pickRandom'));
    }
    const icon = el('span', 'practice-settings-icon');
    // 設定のアイコン（3 本のつまみ）
    icon.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
      '<path d="M2 4h12M2 8h12M2 12h12"/><circle cx="5" cy="4" r="1.7" fill="#fbfbfc"/><circle cx="10.5" cy="8" r="1.7" fill="#fbfbfc"/><circle cx="6.5" cy="12" r="1.7" fill="#fbfbfc"/></svg>';
    button.append(icon, el('span', 'practice-settings-text', parts.join(' · ')), el('span', 'practice-settings-caret', open ? '▴' : '▾'));
    button.addEventListener('click', () => {
      savePrefs({ settingsOpen: !open });
      renderSettings();
    });
    return button;
  }

  // 習得の目安（今の種類の分）：スライドバー（1〜10 秒・0.5 秒刻み）と「−」「＋」（0.5 秒ずつ）、右に今の秒数。
  // 動かしている間は秒数の表示だけを変え、離したとき（change）に保存する（途中の値を次々に保存しないように）
  function thresholdSlider() {
    const secs = threshold();
    const wrap = el('div', 'practice-threshold');
    const range = el('input', 'practice-threshold-range');
    range.type = 'range';
    range.min = String(P.THRESHOLD_MIN);
    range.max = String(P.THRESHOLD_MAX);
    range.step = '0.5';
    range.value = String(secs);
    I.set(range, 'practice.customSeconds', null, 'aria-label');
    // 秒数：数字はいつも小数 1 桁（8.0・8.5・10.0）・等幅の数字にする（動かすたびに文字の幅が変わって「秒」がずれないように）
    const value = el('span', 'practice-threshold-value');
    const num = el('span', 'practice-threshold-num');
    const unit = el('span', 'practice-threshold-unit');
    I.set(unit, 'practice.secondsUnit');
    value.append(num, unit);
    const show = (v) => {
      num.textContent = v.toFixed(1);
      range.setAttribute('aria-valuetext', I.t('practice.seconds', { n: v }));
      range.style.setProperty('--fill', ((v - P.THRESHOLD_MIN) / (P.THRESHOLD_MAX - P.THRESHOLD_MIN)) * 100 + '%');
    };
    show(secs);
    range.addEventListener('input', () => show(Number(range.value)));
    range.addEventListener('change', () => setThreshold(P.clampThreshold(Number(range.value))));
    const step = (delta, key) => {
      const b = el('button', 'practice-threshold-step');
      b.type = 'button';
      // 文字の「−」「＋」はフォントによって上下にずれるので、線で描いて円の真ん中に置く
      b.innerHTML =
        '<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true"><path d="' +
        (delta < 0 ? 'M1.5 5h7' : 'M1.5 5h7M5 1.5v7') +
        '" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/></svg>';
      I.set(b, key, null, 'aria-label');
      const next = P.clampThreshold(secs + delta);
      b.disabled = next === secs;
      b.addEventListener('click', () => setThreshold(next));
      return b;
    };
    // 目盛り（1・3・5・8・10 秒の位置）
    const scale = el('div', 'practice-threshold-scale');
    scale.setAttribute('aria-hidden', 'true');
    [P.THRESHOLD_MIN, 3, 5, 8, P.THRESHOLD_MAX].forEach((t) => {
      const tick = el('span', 'practice-threshold-tick');
      tick.textContent = String(t);
      tick.style.left = ((t - P.THRESHOLD_MIN) / (P.THRESHOLD_MAX - P.THRESHOLD_MIN)) * 100 + '%';
      scale.append(tick);
    });
    const track = el('div', 'practice-threshold-track');
    track.append(range, scale);
    wrap.append(step(-0.5, 'practice.thresholdDown'), track, step(0.5, 'practice.thresholdUp'), value);
    return wrap;
  }

  // 選んでいるグループの要約（押すとグループを選ぶ欄を開く・閉じる）
  function groupSummary() {
    const chosen = chosenGroups(prefs.set);
    const button = el('button', 'practice-groups-toggle');
    button.type = 'button';
    button.setAttribute('aria-expanded', String(groupsOpen));
    const label = el('span');
    const sections = CS.list(DATA[prefs.set], byStage(prefs.set));
    const two = chosen && !byStage(prefs.set) && CS.isTwoLevel(sections) ? CS.twoLevel(sections, chosen) : null;
    if (!chosen) I.set(label, byStage(prefs.set) ? 'practice.stagesAll' : 'practice.groupsAll');
    else if (two) {
      // 2段：親だけなら「U-ZBLL」、子で絞っていれば「U: 2GLL, Diag」
      const picked = two.children.filter((c) => c.active).map((c) => c.label);
      const name = I.t(`stage.${prefs.set}.${two.active}`);
      label.textContent = two.refine ? `${two.active}: ${picked.join(', ')}` : name.startsWith('stage.') ? two.active : name;
      button.title = label.textContent; // 要約が「…」で切れても、マウスを乗せると選んだものが全部見えるように
    } else {
      const labels = {};
      CS.list(DATA[prefs.set], byStage(prefs.set)).forEach((s) => {
        labels[s.key] = s.label;
      });
      const names = [...chosen].map((k) => labels[k] || k);
      label.textContent = names.length <= 4 ? names.join(', ') : `${names.slice(0, 4).join(', ')} … (${names.length})`;
      button.title = names.join(', '); // 要約が「…」で切れても、マウスを乗せると選んだものが全部見えるように
    }
    button.append(label, el('span', 'practice-groups-caret', groupsOpen ? '▴' : '▾'));
    button.addEventListener('click', () => {
      groupsOpen = !groupsOpen;
      renderSettings();
    });
    return button;
  }

  // グループを選ぶ欄：押したグループだけを出題する（1つも選んでいなければすべて）
  function groupPicker() {
    const set = prefs.set;
    const stage = byStage(set);
    const chosen = chosenGroups(set) || new Set();
    const sections = CS.list(inScope(set), stage);
    const box = el('div', 'practice-groups');
    // 覚える順のデータがあるときだけ：グループ順 / 覚える順（一覧ページと共通）
    if (CS.hasStages(DATA[set])) {
      const order = segment(
        [
          Object.assign({ value: false }, CS.orderKeys(set, DATA[set]).group),
          Object.assign({ value: true }, CS.orderKeys(set, DATA[set]).learn),
        ],
        stage,
        (v) => setOrder(set, v)
      );
      order.classList.add('mb-2');
      box.append(order);
    }
    // 2段（ZBLL の小グループ順）：上の段で OCLL を1つ選び、下の段でその中の小グループを選ぶ（一覧ページと同じ決まり）
    if (!stage && CS.isTwoLevel(sections)) {
      box.append(twoLevelPicker(set, sections, chosen));
      return box;
    }
    const chips = el('div', 'practice-group-chips');
    sections.forEach((s) => {
      const b = el('button', 'practice-group-chip' + (chosen.has(s.key) ? ' active' : ''));
      b.type = 'button';
      b.textContent = s.label;
      const n = s.cases.length;
      if (stage) {
        // 段階：一覧の見出しと同じ文（OLL「A. 十字完成」、PLL「1. U-perm（エッジ3つ）」。名前は i18n の stage.<set>.<記号>）
        const name = I.t(`stage.${set}.${s.label}`);
        const heading = CS.orderKeys(set, DATA[set]).heading;
        b.title = heading === 'name' ? `${name} · ${n}` : `${heading === 'label' ? s.label : s.stage}. ${name} · ${n}`;
      } else {
        const note = (NOTES[set] || {})[s.key];
        b.title = note ? `${s.label} (${note}) · ${n}` : `${s.label} · ${n}`;
      }
      b.setAttribute('aria-pressed', String(chosen.has(s.key)));
      b.addEventListener('click', () => {
        const next = new Set(chosen);
        if (next.has(s.key)) next.delete(s.key);
        else next.add(s.key);
        // 並びの順で保存する（段階は番号で）
        const picked = sections.filter((x) => next.has(x.key));
        setGroups(set, stage ? picked.map((x) => x.stage) : picked.map((x) => x.key));
      });
      chips.append(b);
    });
    const clear = el('button', 'btn btn-link btn-sm practice-groups-clear');
    clear.type = 'button';
    I.set(clear, 'practice.groupsClear');
    clear.disabled = !chosen.size;
    clear.addEventListener('click', () => setGroups(set, []));
    const foot = el('div', 'd-flex align-items-center gap-2 mt-1');
    foot.append(clear);
    // OLL の番号順（区切りが 'all' の1つだけ）は、選ぶグループが無いので並びの切り替えだけを出す
    if (!(sections.length === 1 && sections[0].key === 'all')) box.append(chips, foot);
    return box;
  }

  // 2段のグループを選ぶ欄（CaseSections.twoLevel・pickParent・pickChild）
  function twoLevelPicker(set, sections, chosen) {
    const t = CS.twoLevel(sections, chosen);
    const byKey = {};
    sections.forEach((s) => (byKey[s.key] = s));
    const save = (next) => setGroups(set, sections.map((s) => s.key).filter((k) => next.has(k)));
    const chip = (label, on, title, onClick) => {
      const b = el('button', 'practice-group-chip' + (on ? ' active' : ''));
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', onClick);
      return b;
    };
    const wrap = el('div');
    const parents = el('div', 'practice-group-chips');
    t.parents.forEach((p) => {
      const n = p.groups.reduce((sum, k) => sum + byKey[k].cases.length, 0);
      const name = I.t(`stage.${set}.${p.key}`);
      const b = chip(p.key, p.active, `${name.startsWith('stage.') ? p.key : name} · ${n}`, () => save(CS.pickParent(sections, chosen, p.key)));
      b.dataset.parent = p.key;
      parents.append(b);
    });
    wrap.append(parents);
    if (t.active) {
      const children = el('div', 'practice-group-chips practice-group-children');
      t.children.forEach((c) => {
        const b = chip(c.label, c.active, `${c.key} · ${byKey[c.key].cases.length}`, () => save(CS.pickChild(sections, chosen, c.key)));
        b.dataset.group = c.key;
        children.append(b);
      });
      wrap.append(children);
    }
    const clear = el('button', 'btn btn-link btn-sm practice-groups-clear');
    clear.type = 'button';
    I.set(clear, 'practice.groupsClear');
    clear.disabled = !chosen.size;
    clear.addEventListener('click', () => setGroups(set, []));
    const foot = el('div', 'd-flex align-items-center gap-2 mt-1');
    foot.append(clear);
    wrap.append(foot);
    return wrap;
  }

  function setGroups(set, list) {
    const groups = Object.assign({}, prefs.groups, { [groupsKey(set)]: list });
    changeSettings({ groups: groups });
  }

  // 設定を変えたら保存し、（しきい値以外なら）次の問題を出し直す
  function changeSettings(change, renew) {
    savePrefs(change);
    if (change.set) $('practiceResult').hidden = true; // 種類を変えたら前の結果は消す
    renderSettings();
    if (renew !== false) next();
    // 目安だけを変えたとき（問題は出し直さない）も、出したままのタイムとケースの名前は消す（計測中は触らない）
    else if (state === 'idle' && shownRecAt !== null) resetTimer();
    renderHistory();
  }

  // ---- 出題 ----
  let current = null; // { set, c, scramble }
  let hintUsed = false; // この問題でヒントを見たか（見たら習得済みにはしない）
  let lastName = null;

  // ?case=Aa で開いたときは、最初の1問だけそのケースを出す（記録のページから「このケースを練習」）
  let forcedName = params.get('case');

  // 出題の重み：出題が「苦手優先」（既定）なら、どの対象でも苦手なケースほど出やすくする（順番ではなく確率に差をつける）。
  // 苦手の度合いは記録のページの苦手順と同じ（直近 10 回の平均。解けなかった回は目安の 2 倍。回数の少ないケースは全体の平均に寄せる）。
  // 重み＝（度合い ÷ 目安）を 0.5〜3 に収めて 2 乗（0.25〜9）。まだ解いていないケースは解けなかったのと同じ扱い
  // （度合い＝目安の 2 倍 → 重み 4）にして、苦手なケースと同じくらい出るようにする。記録が無ければすべて同じ
  const weighted = () => prefs.weighted !== false; // 出題が「苦手優先」か（保存していなければそう。false ならランダム）
  function weightFor(set) {
    if (!weighted()) return () => 1;
    const limit = threshold(set);
    const weak = P.weakScores((S.get('practice') || {}).log, { set: set, n: 10, dnfAs: limit * 2 });
    if (!(weak.overall > 0)) return () => 1;
    return (c) => {
      const score = c.name in weak.scores ? weak.scores[c.name] : limit * 2; // まだ解いていない：解けなかったのと同じ
      const ratio = Math.min(3, Math.max(0.5, score / limit));
      return ratio * ratio;
    };
  }

  // keepTime: 解き終わったとき（PLL / OLL / 通し）。タイムを 0.00 に戻さず、次のインスペクション・計測が始まるまで出したままにする
  function next(keepTime) {
    if (keepTime) {
      cancelAnimationFrame(frame);
      clearHold();
      setState('idle');
    } else resetTimer();
    if (isFull()) {
      // 通し：毎回 WCA 形式のスクランブルを作る
      $('practiceEmpty').hidden = true;
      hintUsed = false;
      showHint(false);
      $('scramble').classList.add('full');
      nextFull();
      return;
    }
    $('scramble').classList.remove('full');
    const forced = forcedName ? DATA[prefs.set].find((x) => x.name === forcedName) : null;
    forcedName = null;
    const list = forced ? [forced] : pool();
    $('practiceEmpty').hidden = list.length > 0;
    $('timer').disabled = !list.length;
    $('dnfButton').disabled = !list.length;
    $('skipButton').disabled = !list.length;
    $('hintButton').disabled = !list.length;
    hintUsed = false;
    showHint(false);
    if (!list.length) {
      current = null;
      $('scramble').textContent = '';
      return;
    }
    const candidates = list.length > 1 ? list.filter((c) => c.name !== lastName) : list;
    const c = forced ? forced : P.pickWeighted(candidates, weightFor(prefs.set));
    // スクランブルはランダムな AUF 込みで作ってある（tools/gen-scrambles.js）ので、そのまま出す
    const scrambles = SCRAMBLES[prefs.set][c.name] || [];
    const scramble = scrambles[Math.floor(Math.random() * scrambles.length)] || '';
    current = { set: prefs.set, c: c, scramble: scramble };
    lastName = c.name;
    $('scramble').textContent = scramble;
  }

  // 通しのスクランブル：先に作っておいた1本（WcaScramble.prepare）を使い、すぐ次の1本を作りはじめる。
  // まだ無いとき（ページを開いた直後。ソルバの準備に 0.5 秒ほどかかる）は「作成中」と出し、できたら出す
  function nextFull() {
    const enable = (on) => {
      ['timer', 'dnfButton', 'skipButton'].forEach((id) => {
        $(id).disabled = !on;
      });
    };
    const show = () => {
      current = { set: 'full', scramble: W.cube3() };
      W.render($('scramble'), current.scramble);
      enable(true);
      W.prepare();
    };
    if (W.hasNext()) {
      show();
      return;
    }
    current = null;
    enable(false);
    const waiting = el('div', 'scramble-line text-muted');
    I.set(waiting, 'practice.generating');
    $('scramble').replaceChildren(waiting);
    W.prepare(() => {
      if (isFull() && !current) show(); // 待っている間に種類を変えていたら出さない
    });
  }

  // ---- タイマー ----
  // idle → running（スペースを押した瞬間・タイマーをタップした瞬間にスタート）→ idle
  // 通しでインスペクションがオンのとき：idle → inspecting（15 秒のカウントダウン）→ running → idle
  let state = 'idle';
  let inspectAt = 0;
  let penalty = ''; // インスペクションの超過によるペナルティ（'' / '+2' / 'DNF'）
  let startAt = 0;
  let frame = null;
  // タイマーに出したままにしている記録（通しはペナルティを変えたら表示も直す。消したり取り消したりしたら 0.00 に戻す）
  let shownRecAt = null;
  const timerEl = $('timer');

  // 出したままのタイムをやめる（PLL / OLL のケースの名前も消す）
  function clearShown() {
    shownRecAt = null;
    $('solvedCase').textContent = '';
  }
  const format = (sec) => P.formatTime(sec); // 60 秒以上は分表記（1:05.23）

  function setState(next) {
    state = next;
    $('practiceStage').classList.toggle('running', next === 'running');
    $('practiceStage').classList.toggle('inspecting', next === 'inspecting');
    if (next !== 'inspecting') timerEl.classList.remove('warn8', 'warn12', 'over');
  }

  function resetTimer() {
    cancelAnimationFrame(frame);
    clearHold();
    setState('idle');
    timerEl.textContent = format(0);
    clearShown();
  }

  // 止めた直後に続けて押して、次の計測を始めてしまわないように、止めてから COOLDOWN_MS の間はスタートしない
  // （その間はタイマーの数字を赤にする。ストップ・ボタンには関係しない）
  const COOLDOWN_MS = 2000;
  let cooldownUntil = 0;
  let cooldownTimer = null;
  const coolingDown = () => performance.now() < cooldownUntil;
  function startCooldown() {
    cooldownUntil = performance.now() + COOLDOWN_MS;
    timerEl.classList.add('cooldown');
    clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => timerEl.classList.remove('cooldown'), COOLDOWN_MS);
  }

  // スペース・タップ：止まっていればスタート、計測中ならストップ
  function press() {
    if (!current) return;
    if (state === 'running') stop();
    else if (coolingDown()) return;
    else if (state === 'idle' && isFull() && fullPrefs().inspection) inspect();
    else start();
  }

  // ---- 通し：長押しして離すとスタート ----
  // スペース（タイマーの長押し）を 0.3 秒押すと準備完了（緑。押しはじめは赤）、離すとスタート。短く押しただけでは始まらない。
  // インスペクションありのときは、最初の1回はインスペクションを始めるだけ（その押した指を離してもスタートしない）
  const HOLD_MS = 300;
  let holding = false;
  let ready = false;
  let holdTimer = null;
  let ignoreRelease = false;

  function clearHold() {
    clearTimeout(holdTimer);
    holding = false;
    ready = false;
    timerEl.classList.remove('holding', 'ready');
  }

  function fullDown() {
    if (!current) return;
    if (state === 'running') {
      stop();
      return;
    }
    if (state === 'idle' && coolingDown()) return;
    if (state === 'idle' && fullPrefs().inspection) {
      inspect();
      ignoreRelease = true;
      return;
    }
    if (holding) return;
    holding = true;
    timerEl.classList.add('holding');
    holdTimer = setTimeout(() => {
      ready = true;
      timerEl.classList.remove('holding');
      timerEl.classList.add('ready');
    }, HOLD_MS);
  }

  function fullUp() {
    if (ignoreRelease) {
      ignoreRelease = false;
      return;
    }
    if (!holding) return;
    const go = ready;
    clearHold();
    if (go) start();
  }

  // インスペクション：15 秒のカウントダウン（WCA：8 秒・12 秒で知らせる。15 秒を超えて 17 秒までに始めたら +2、超えたら DNF）
  function inspect() {
    setState('inspecting');
    clearShown();
    inspectAt = performance.now();
    const tick = () => {
      const t = (performance.now() - inspectAt) / 1000;
      timerEl.classList.toggle('warn8', t >= 8 && t < 12);
      timerEl.classList.toggle('warn12', t >= 12 && t < 15);
      timerEl.classList.toggle('over', t >= 15);
      timerEl.textContent = t < 15 ? String(Math.ceil(15 - t)) : t < 17 ? '+2' : 'DNF';
      frame = requestAnimationFrame(tick);
    };
    tick();
  }

  function start() {
    if (state === 'inspecting') {
      cancelAnimationFrame(frame);
      const t = (performance.now() - inspectAt) / 1000;
      penalty = t < 15 ? '' : t < 17 ? '+2' : 'DNF';
    } else {
      penalty = '';
    }
    setState('running');
    clearShown();
    startAt = performance.now();
    const tick = () => {
      timerEl.textContent = format((performance.now() - startAt) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  }

  // 止めたタップ（クリック）で、そのままボタンまで押してしまわないように少しの間ボタンを無視する
  let ignoreClicksUntil = 0;

  // スタートした直後に続けて押して止めてしまわないように、スタートから MIN_RUN_MS の間は止めない
  // （キー・タップとも。Esc の中止・「解けなかった」「スキップ」はこれまでどおり）
  const MIN_RUN_MS = 500;
  function stop() {
    if (performance.now() - startAt < MIN_RUN_MS) return;
    ignoreClicksUntil = performance.now() + 400;
    startCooldown();
    cancelAnimationFrame(frame);
    const sec = Math.round((performance.now() - startAt) / 10) / 100; // 0.01 秒単位
    timerEl.textContent = format(sec);
    setState('idle');
    if (isFull()) recordFull(sec, penalty);
    else record(sec);
  }

  // ---- 記録と判定 ----
  const sessionHistory = [];

  function record(sec) {
    const { set, c } = current;
    const hinted = hintUsed;
    // ヒントを見たときは、目安以内でも習得済みにはしない（練習中）。タイムも最近の記録に入れない
    const status = hinted ? 'learning' : P.judge(sec, threshold(set));
    const beforeStatus = P.statusOf(set, c.name);
    const times = (prefs.times && prefs.times[set]) || {};
    const beforeTimes = times[c.name];
    P.setStatus(set, c.name, status);
    if (sec !== null && !hinted) {
      const allTimes = Object.assign({}, prefs.times);
      allTimes[set] = Object.assign({}, allTimes[set], { [c.name]: P.addTime(beforeTimes, sec, MAX_TIMES) });
      savePrefs({ times: allTimes });
    }
    // 日時付きの記録（記録のページ stats.html で使う）。ヒントを見たものも残す（hint: true）
    const logEntry = { at: Date.now(), set: set, name: c.name, sec: sec, status: status, hint: hinted };
    savePrefs({ log: P.addLog((S.get('practice') || {}).log, logEntry) });
    const entry = { set, c, sec, status, threshold: threshold(set), hinted };
    sessionHistory.unshift(entry);
    sessionHistory.length = Math.min(sessionHistory.length, HISTORY);
    showResult(entry, () => {
      if (state === 'idle' && shownRecAt === logEntry.at) resetTimer();
      P.setStatus(set, c.name, beforeStatus);
      const allTimes = Object.assign({}, S.get('practice') && S.get('practice').times);
      allTimes[set] = Object.assign({}, allTimes[set]);
      if (beforeTimes) allTimes[set][c.name] = beforeTimes;
      else delete allTimes[set][c.name];
      const log = ((S.get('practice') || {}).log || []).filter((e) => e.at !== logEntry.at || e.name !== logEntry.name);
      savePrefs({ times: allTimes, log: log });
      sessionHistory.splice(sessionHistory.indexOf(entry), 1);
      renderHistory();
      renderSettings();
      const result = $('practiceResult');
      result.replaceChildren(note('practice.undone'));
    });
    renderHistory();
    renderSettings(); // 対象の件数を更新
    next(true);
    // 解き終わったタイム（「解けなかった」なら DNF）と解いたケースを、次の計測が始まるまでタイマーに出しておく
    timerEl.textContent = sec === null ? 'DNF' : format(sec);
    $('solvedCase').textContent = `${set.toUpperCase()} ${c.name}`;
    shownRecAt = logEntry.at;
  }

  // 結果の欄の短い知らせ（言語を切り替えたら訳し直す）
  function note(key, params) {
    const d = el('div', 'text-muted small');
    I.set(d, key, params);
    return d;
  }

  function showResult(entry, undo) {
    const { set, c, sec, status, threshold, hinted } = entry;
    const result = $('practiceResult');
    result.hidden = false;
    result.replaceChildren();

    const display = P.displaySettings(set);
    const image = el('div', 'case-image');
    const colors = P.caseColors(c, display.scheme, set);
    D.draw(image, colors.ucolor, colors.scolor, { size: 96, border: display.border });

    const body = el('div', 'practice-result-body');
    const head = el('div', 'd-flex flex-wrap align-items-baseline gap-2');
    head.append(el('span', 'practice-result-time', sec === null ? 'DNF' : `${format(sec)}`));
    const verdict = el('span', 'practice-verdict ' + status);
    if (sec === null) I.set(verdict, 'practice.verdict.dnf');
    else if (hinted) I.set(verdict, 'practice.verdict.hint');
    else I.set(verdict, 'practice.verdict.' + status, { t: threshold });
    const undoButton = el('button', 'btn btn-link practice-undo');
    undoButton.type = 'button';
    I.set(undoButton, 'practice.undo');
    undoButton.addEventListener('click', undo);
    head.append(verdict, undoButton);

    const name = el('div', 'practice-case-name mt-1', `${set.toUpperCase()} ${c.name}`);
    const alg = el('div', 'practice-case-alg', c.alg);
    const times = (prefs.times && prefs.times[set] && prefs.times[set][c.name]) || [];
    const stats = el('div', 'practice-case-stats mt-1');
    if (times.length) {
      const best = Math.min(...times);
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      I.set(stats, 'practice.caseStats', { best: format(best), avg: format(avg), n: times.length });
    }
    body.append(head, name, alg, stats);
    result.append(image, body);
  }

  // ---- 通しの記録 ----
  const fullLog = () => (Array.isArray(fullPrefs().log) ? fullPrefs().log : []);
  const showTime = (rec) => {
    const t = P.effectiveTime(rec);
    return t === null ? 'DNF' : format(t) + (rec.penalty === '+2' ? '+' : '');
  };
  const showAvg = (a) => (a === undefined ? '–' : a === null ? 'DNF' : format(a));

  function recordFull(sec, pen) {
    // スクランブルは短い形（wca-scramble.js の encode。1手1文字）で記録する。形式が違うときだけ全文
    const code = W.encode(current.scramble);
    const rec = code
      ? { at: Date.now(), sec: sec, penalty: pen || '', s: code }
      : { at: Date.now(), sec: sec, penalty: pen || '', scramble: current.scramble };
    saveFull({ log: P.addLog(fullLog(), rec) });
    showFullResult(rec);
    renderHistory();
    next(true);
    showFullTime(rec);
  }

  // 解き終わったタイム（+2 は「+」付き、DNF）を、次のインスペクション・計測が始まるまでタイマーに出しておく
  function showFullTime(rec) {
    timerEl.textContent = showTime(rec);
    shownRecAt = rec.at;
  }

  function updateFull(rec, change) {
    const log = fullLog().map((r) => (r.at === rec.at ? Object.assign({}, r, change) : r));
    saveFull({ log: log });
    return log.find((r) => r.at === rec.at);
  }

  function showFullResult(rec) {
    const result = $('practiceResult');
    result.hidden = false;
    result.replaceChildren();
    const body = el('div', 'practice-result-body w-100');
    const head = el('div', 'd-flex flex-wrap align-items-center gap-2');
    head.append(el('span', 'practice-result-time', showTime(rec)));
    // ペナルティの切り替え（OK / +2 / DNF）。あとから変えられる
    const seg = el('div', 'practice-segment');
    [
      ['', 'practice.penaltyOk'],
      ['+2', null],
      ['DNF', null],
    ].forEach(([value, key]) => {
      const b = el('button');
      b.type = 'button';
      if (key) I.set(b, key);
      else b.textContent = value;
      b.classList.toggle('active', rec.penalty === value);
      b.addEventListener('click', () => {
        const updated = updateFull(rec, { penalty: value });
        if (updated) showFullResult(updated);
        if (updated && state === 'idle' && shownRecAt === rec.at) showFullTime(updated);
        renderHistory();
      });
      seg.append(b);
    });
    const del = el('button', 'btn btn-link practice-undo');
    del.type = 'button';
    I.set(del, 'practice.delete');
    del.addEventListener('click', () => {
      saveFull({ log: fullLog().filter((r) => r.at !== rec.at) });
      if (state === 'idle' && shownRecAt === rec.at) resetTimer();
      result.replaceChildren(note('practice.deleted'));
      renderHistory();
    });
    head.append(seg, del);
    const scramble = el('div', 'practice-case-alg practice-full-scramble mt-1');
    W.render(scramble, W.textOf(rec));
    body.append(head, scramble);
    result.append(body);
  }

  // 通しの ao5・ao12・ao100・平均（DNF を除く）・ベスト（直近の記録の上）
  function renderFullStats() {
    const box = $('practiceFullStats');
    if (!isFull()) {
      box.hidden = true;
      return;
    }
    const log = fullLog();
    box.hidden = false;
    // 値は 1 回だけ計算して、チップ（広い画面）と表（スマホ）の両方で使う
    const SIZES = [5, 12, 100];
    const now = SIZES.map((n) => showAvg(P.average(log, n)));
    const best = SIZES.map((n) => showAvg(P.bestAverage(log, n)));
    const mean = P.meanTime(log) == null ? '–' : format(P.meanTime(log));
    const single = P.bestSingle(log) == null ? '–' : format(P.bestSingle(log));

    // 広い画面：「今」（ao5・ao12・ao100・平均）と「ベスト」（ao5・ao12・ao100・単発）の 2 行。
    // ao の列は上下でそろえる（css/practice.css の grid・subgrid）。まだ出ていない「–」は欄の真ん中に置く（empty）
    const item = (key, value) => {
      const d = el('div', 'practice-stat');
      const label = el('span', 'practice-stat-label');
      I.set(label, key);
      d.append(label, el('span', 'practice-stat-value' + (value === '–' ? ' empty' : ''), value));
      return d;
    };
    const statRow = (headKey, items) => {
      const r = el('div', 'practice-stat-row');
      const head = el('span', 'practice-stat-row-head');
      I.set(head, headKey);
      r.append(head, ...items);
      return r;
    };
    const chips = el('div', 'practice-stat-chips');
    chips.append(
      statRow('practice.statNow', [
        item('practice.ao5', now[0]),
        item('practice.ao12', now[1]),
        item('practice.ao100', now[2]),
        item('practice.mean', mean),
      ]),
      statRow('practice.statBest', [
        item('practice.ao5', best[0]),
        item('practice.ao12', best[1]),
        item('practice.ao100', best[2]),
        item('practice.single', single),
      ])
    );

    // スマホ：チップだと幅がばらばらに折り返すので、1 枚の表（列 ao5・ao12・ao100、行 今・ベスト）と、その下に平均・単発ベスト
    const th = (key, scope) => {
      const c = el('th');
      c.scope = scope;
      if (key) I.set(c, key);
      return c;
    };
    const headRow = el('tr');
    headRow.append(th(null, 'col'), th('practice.ao5', 'col'), th('practice.ao12', 'col'), th('practice.ao100', 'col'));
    const row = (key, values) => {
      const tr = el('tr');
      tr.append(th(key, 'row'), ...values.map((v) => el('td', '', v)));
      return tr;
    };
    const thead = el('thead');
    thead.append(headRow);
    const tbody = el('tbody');
    tbody.append(row('practice.statNow', now), row('practice.statBest', best));
    const table = el('table', 'practice-full-table');
    table.append(thead, tbody);
    const pair = (key, value) => {
      const s = el('span', 'practice-full-pair');
      const label = el('span', 'practice-stat-label');
      I.set(label, key);
      s.append(label, el('span', 'practice-stat-value', value));
      return s;
    };
    const summary = el('div', 'practice-full-summary');
    summary.append(pair('practice.mean', mean), el('span', 'practice-full-dot', '·'), pair('practice.bestSingleShort', single));
    const card = el('div', 'practice-full-card');
    card.append(table, summary);

    box.replaceChildren(chips, card);
  }

  function renderHistory() {
    renderFullStats();
    if (isFull()) {
      // 通し：保存してある直近の記録（ページを開き直しても出る）
      $('practiceHistory').replaceChildren(...fullLog().slice(0, HISTORY).map((r) => el('li', P.effectiveTime(r) === null ? 'learning' : '', showTime(r))));
      return;
    }
    const list = $('practiceHistory');
    list.replaceChildren(
      ...sessionHistory.map((h) => {
        const li = el('li', h.status, `${h.c.name} ${h.sec === null ? 'DNF' : format(h.sec)}`);
        return li;
      })
    );
  }

  // ---- 操作 ----
  const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '');

  // ボタンのショートカット：S＝スキップ、H＝ヒント、D＝解けなかった（中止は Esc）。そのボタンが出ているときだけ
  // ボタンを押したのと同じにする（出し分けは css/practice.css）。計測中の H・D は止める操作にしない。
  // 日本語入力がオンでも効くよう、文字（e.key）ではなくキーの位置（e.code）で見る
  const SHORTCUTS = { KeyS: 'skipButton', KeyH: 'hintButton', KeyD: 'dnfButton' };
  function shortcut(e) {
    const id = SHORTCUTS[e.code];
    if (!id) return false;
    const b = $(id);
    if (b.disabled || getComputedStyle(b).display === 'none') return false;
    e.preventDefault();
    b.click();
    return true;
  }

  document.addEventListener('keydown', (e) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.repeat) {
      // 押しっぱなしの繰り返し（スタートしたスペースを押し続けているときなど）で止めたり始めたりしない
      if (e.code === 'Space' || state === 'running') e.preventDefault();
      return;
    }
    if (shortcut(e)) return;
    if (state === 'running') {
      e.preventDefault();
      if (e.key === 'Escape') resetTimer();
      else stop();
      return;
    }
    if (state === 'inspecting' && e.key === 'Escape') {
      e.preventDefault();
      resetTimer();
      return;
    }
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      if (isFull()) fullDown();
      else press();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (!typing(e) && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      if (isFull()) fullUp();
    }
  });
  // 画面ではタイマーのカード（スクランブル〜ボタンの上）のどこを押してもスタート（ソルブは長押しして離すとスタート）。
  // 計測中はどこをタップしても止まる。カードの中のボタン・リンクは、それぞれのボタンとして押す
  const stageEl = $('practiceStage');
  const onTimerArea = (e) => stageEl.contains(e.target) && !e.target.closest('button:not(#timer), a, input, select, textarea');
  stageEl.addEventListener('pointerdown', (e) => {
    if (!onTimerArea(e) || e.button !== 0) return;
    e.preventDefault();
    // 指がカードの外にずれても、離したとき（pointerup）をここで受け取る（ソルブの長押しを離したところで始めるため）
    try {
      stageEl.setPointerCapture(e.pointerId);
    } catch (err) {
      // 取れなくても動作は続ける
    }
    if (isFull()) fullDown();
    else press();
  });
  stageEl.addEventListener('pointerup', () => {
    if (isFull()) fullUp();
  });
  stageEl.addEventListener('pointercancel', () => {
    if (isFull()) clearHold();
  });
  timerEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.preventDefault(); // ボタンの Enter で押した扱いにしない
  });
  document.addEventListener('pointerdown', (e) => {
    if (state !== 'running' || (onTimerArea(e) && e.button === 0)) return; // カードの中は上（stageEl）で止める
    // 計測中に「スキップ」「解けなかった」を押したときは、タイムを記録せずに止める
    // （そのあとのクリックで、スキップ＝記録せず次へ、解けなかった＝練習中、になる）
    if (e.target.closest('#skipButton')) {
      resetTimer();
      return;
    }
    // 「ヒント」は計測中も見られる（止めずに出す。見たら目安以内でも練習中）
    if (e.target.closest('#hintButton')) return;
    // 「中止」：Esc と同じく記録せず、同じスクランブルのまま 0.00 に戻す
    if (e.target.closest('#cancelButton')) {
      resetTimer();
      return;
    }
    // 「解けなかった」：押した瞬間に DNF にする。ボタンは計測中だけ出すので、止めるとすぐ隠れて、
    // 離したときのクリックは届かない（クリックを待つと DNF にならない）。直後のクリックは無視する
    if (e.target.closest('#dnfButton')) {
      ignoreClicksUntil = performance.now() + 400;
      giveUp();
      return;
    }
    stop();
  });

  // マウス・タップで押したボタンからはフォーカスを外す。残したままだと、そのあと Esc などのキーを押したときに
  // ブラウザがキーボードの操作とみなしてフォーカスの見た目（Bootstrap では塗りつぶし）を出すため。
  // キーボードで押したとき（e.detail が 0）はフォーカスを残す
  ['practiceStage', 'practiceResult'].forEach((id) =>
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && e.detail > 0) b.blur();
    })
  );

  // 解けなかった：記録して DNF を出す（0.00 に戻してすぐ DNF を書くので、間に 0.00 は見えない）
  function giveUp() {
    if (!current) return;
    resetTimer();
    if (isFull()) recordFull(0, 'DNF');
    else record(null);
  }
  // キーボード（Tab と Enter）で押したとき。マウス・タップは上の pointerdown で処理する
  $('dnfButton').addEventListener('click', () => {
    if (performance.now() < ignoreClicksUntil) return;
    giveUp();
  });
  // ヒント：ケースの名前と、解く手順の最初の3手（前の AUF は出題の向きで変わるので出さない）
  function firstMoves(alg, n) {
    return alg
      .replace(/^(\s*\(U[0-9']*\))+\s*/, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, n)
      .join(' ');
  }
  $('hintButton').addEventListener('click', () => {
    if (!current || state === 'inspecting' || performance.now() < ignoreClicksUntil) return;
    const box = $('practiceHintText');
    // もう一度押すと消す（一度見たので、この問題は練習中の扱いのまま）
    if (box.childElementCount) {
      showHint(false);
      return;
    }
    hintUsed = true;
    box.replaceChildren(el('span', 'practice-hint-name', current.c.name), el('span', 'practice-hint-moves', firstMoves(current.c.alg, 3) + ' …'));
    showHint(true);
  });
  // ヒントのボタンの文：出しているときは「ヒントを隠す」
  function showHint(shown) {
    if (!shown) $('practiceHintText').replaceChildren();
    I.set($('hintButton'), shown ? 'practice.hintHide' : 'practice.hintButton');
    $('hintButton').setAttribute('aria-pressed', String(shown));
  }
  // 「中止」：計測中は押した瞬間（上の pointerdown）に止める。インスペクション中はここで止める
  $('cancelButton').addEventListener('click', () => {
    if (state !== 'idle') resetTimer();
  });
  $('skipButton').addEventListener('click', () => {
    if (performance.now() < ignoreClicksUntil) return;
    next();
  });

  I.onChange(() => {
    renderSettings();
  });

  savePrefs({ set: prefs.set, filter: prefs.filter, thresholds: { pll: threshold('pll'), oll: threshold('oll'), coll: threshold('coll') } });

  renderSettings();
  next();
  renderHistory();
})();
