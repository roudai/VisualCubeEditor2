// 一覧ページ（pll.html / oll.html）：全ケースの画像と手順をグループごとに並べる。
// <body data-set="pll|oll"> の種類のデータ（pll-data.js / oll-data.js）とグループ名（pll-groups.js / oll-groups.js）を使い、
// 画像は cube-draw.js で描く（上面図）。仕様: reference/PLL_SPEC.md・reference/OLL_SPEC.md「一覧ページ」
//   - 画像は solve case（alg の逆手順を適用し、手順中の持ち替えを打ち消す）の状態
//   - Cube Color はエディタで保存した設定（localStorage）を使う。配色は
//       PLL: 保存した配色。OLL 配色のときは OLL を選ぶ前の配色、それも無いときは Standard
//       OLL: 保存した U の色だけを残した OLL 配色（他の面はグレー #404040）
//   - ケースをクリックすると、そのケースを選んだ状態でエディタ（/?pll=… / /?oll=…）を開く
//   - 習得状況：各カード右上のバッジをタップで 未着手 → 練習中 → 覚えた と切り替え、localStorage に保存する。
//     上部に進み具合（積み上げバー・件数）と絞り込みチップ、グループ見出しに「覚えた数 / 全体」を出す
//   - 絞り込みチップの右の「すべて未習得に戻す」：確認を出してから、その種類の習得状況をまとめて消す（「元に戻す」で戻せる）
//   - 並びは「グループ順 / 覚える順」（OLL は「番号順 / 覚える順」）。覚える順は data/<set>/learn_order.json（Cube Voyage 準拠）。
//     区切りは case-sections.js。選んだ並びは 'list-filter' の <set>Order。OLL の番号順は見出し・グループのボタンなし
//   - 上のグループ（覚える順なら段階）のボタンは、押すとそのグループだけを表示する（複数選べる。もう一度押すと外す。
//     1つも選んでいなければすべて。「選択を解除」で戻す）。選んだものは 'list-filter' の <set>Groups（覚える順は <set>Stages）に保存
//   - エディタで保存した自分の手順があれば、そのケースはその手順（と画像）で表示し、名前の横に「custom」を付ける
//   - ZIP でダウンロード（Download ZIP）：全ケースを一覧と同じ配色で PNG にし、zip（visualcube-<pll|oll>.zip）にまとめる。
//     押してすぐにはダウンロードせず、件数・画像の大きさ・背景を書いた確認の行を出し、「ダウンロード」で始める。
//     画像サイズ・Cube Color・背景はエディタで保存した設定（zip-store.js で無圧縮の zip を作る）
(function () {
  'use strict';
  const D = window.CubeDraw;
  const $ = (id) => document.getElementById(id);
  const I = window.I18N; // 日本語・英語の切り替え（i18n.js）

  const SET = document.body.dataset.set;
  const BASE = { pll: window.PLL_DATA, oll: window.OLL_DATA, coll: window.COLL_DATA, zbll: window.ZBLL_DATA }[SET] || [];
  // 自分の手順（エディタの My algorithm で保存したもの）を重ねる。手順・画像・一括ダウンロードはこちらを使う
  const DATA = window.CustomAlgs ? window.CustomAlgs.merged(SET, BASE) : BASE;
  const NOTES = (window.CASE_GROUP_NOTES || {})[SET] || {};
  const IMAGE_SIZE = 120; // 表示サイズ（px）

  const P = window.Progress; // 習得状況・画像の色（progress.js。練習ページと共通）
  // エディタで保存した設定から、画像の配色・線の色・背景・サイズを決める
  const savedSettings = () => P.displaySettings(SET);
  let zipConfirming = false; // ZIP でダウンロードの確認を出しているか（renderZipConfirm）

  const groupLabel = (g) => (NOTES[g] ? `${g} (${NOTES[g]})` : g);
  const el = (tag, className, text) => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  };

  // solve case（alg の逆手順を適用、持ち替えは打ち消す）の状態の画像の色
  const caseColors = (c, settings) => P.caseColors(c, settings.scheme, SET);

  // ---- 習得状況 ----
  // { pll: { 'Aa': 'learning', ... }, oll: { ... } }。未着手（new）は保存しない
  // 保存は store.js 経由（ログイン中はクラウドにも）
  const FILTER_KEY = 'list-filter';
  const STATUSES = P.STATUSES;
  // 表示名（保存する値は new / learning / learned のまま）
  const statusLabel = (status) => I.t('status.' + status);

  const readJSON = (name) => {
    const value = window.Store.get(name);
    return value && typeof value === 'object' ? value : {};
  };
  const writeJSON = (name, value) => window.Store.set(name, value);

  // 表示中は習得状況を手元に持っておき（件数を数えるたびに読み直さないように）、変えるときは progress.js で保存する
  let progress = P.statuses(SET);
  const statusOf = (c) => (STATUSES.includes(progress[c.name]) ? progress[c.name] : 'new');
  function setStatus(c, status) {
    P.setStatus(SET, c.name, status);
    progress = P.statuses(SET);
  }

  const ICONS =
    // 練習中：進捗リング（薄い円の上に 3/4 の弧）
    '<svg class="icon-learning" viewBox="0 0 16 16" aria-hidden="true">' +
    '<circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="2" opacity=".28"/>' +
    '<path d="M8 3a5 5 0 1 1-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    // 覚えた：チェック
    '<svg class="icon-learned" viewBox="0 0 16 16" aria-hidden="true" style="position:absolute">' +
    '<path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function caseCard(c, settings) {
    const col = el('div', 'col');
    col.dataset.name = c.name;
    const card = el('div', 'card h-100 case-card');
    const link = el('a', 'case-link d-block h-100');
    // ZBLL はエディタにケースを選ぶ行が無いので、手順をそのまま「この手順で揃う状態」で開く
    // ZBLL はエディタに選ぶ行が無いので、名前（表示と保存のファイル名）と手順を渡す
    link.href = SET === 'zbll' ? `/?zbll=${encodeURIComponent(c.name)}&case=${encodeURIComponent(c.alg)}` : `/?${SET}=${encodeURIComponent(c.name)}`;
    I.set(link, 'list.openTitle', { name: c.name }, 'title');

    // 表示の大きさは CSS（.case-image：カードの幅に合わせて縮み、最大 IMAGE_SIZE）
    const image = el('div', 'case-image mx-auto mt-2');
    const colors = caseColors(c, settings);
    D.draw(image, colors.ucolor, colors.scolor, { size: IMAGE_SIZE, border: settings.border });

    const body = el('div', 'card-body p-2 text-center');
    // 名前の行：ケース名をカードの左右の真ん中に置き、カスタムの札は左、逆手順は右に寄せる（3 列のグリッド。css/cases.css）
    const name = el('div', 'fw-bold case-name');
    const left = el('span', 'case-name-side left');
    const right = el('span', 'case-name-side right');
    name.append(left, el('span', 'case-name-text', c.name), right);
    if (c.custom) {
      const tag = el('span', 'custom-tag');
      I.set(tag, 'list.customTag');
      I.set(tag, 'list.customTitle', null, 'title');
      left.append(tag);
    }
    // 逆手順のケース（PLL。pll-data.js の inverse。自分の手順にしても組は変わらない）：名前の右に小さく「⇄ Ub」。
    // 自分自身が逆手順のケースは出さない
    if (c.inverse && c.inverse !== c.name) {
      const inv = el('span', 'case-inverse');
      const shown = el('span');
      shown.setAttribute('aria-hidden', 'true');
      I.set(shown, 'list.inverse', { name: c.inverse });
      const spoken = el('span', 'visually-hidden'); // 読み上げは「逆手順：Ub」（⇄ を読ませない）
      I.set(spoken, 'list.inverseTitle', { name: c.inverse });
      I.set(inv, 'list.inverseTitle', { name: c.inverse }, 'title');
      inv.append(shown, spoken);
      right.append(inv);
    }
    body.append(name, el('div', 'small font-monospace text-break', c.alg));
    link.append(image, body);

    const badge = el('button', 'status-badge');
    badge.type = 'button';
    badge.innerHTML = ICONS;
    const show = (status) => {
      card.dataset.status = status;
      badge.dataset.status = status;
      col.dataset.status = status;
      badge.title = I.t('status.badgeTitle', { status: statusLabel(status) });
      badge.setAttribute('aria-label', I.t('status.badgeAria', { name: c.name, status: statusLabel(status) }));
    };
    show(statusOf(c));
    badge.addEventListener('relabel', () => show(statusOf(c)));
    badge.addEventListener('click', () => {
      const next = STATUSES[(STATUSES.indexOf(statusOf(c)) + 1) % STATUSES.length];
      setStatus(c, next);
      show(next);
      badge.classList.remove('pop');
      void badge.offsetWidth; // アニメーションをやり直す
      badge.classList.add('pop');
      if (resetState && !resetState.confirming) resetState = null; // 1枚変えたら「元に戻す」は消す
      updateSummary();
      renderReset();
    });

    card.append(link, badge);
    col.append(card);
    return col;
  }

  // ---- 並び（グループ順 / 覚える順。OLL は番号順 / 覚える順）----
  const CS = window.CaseSections;
  const HAS_STAGES = CS.hasStages(DATA);
  const NUMBERED = CS.isNumbered(DATA); // OLL：覚える順でないときは 1〜57 を見出しなしで並べる
  const ORDER = CS.orderKeys(SET, DATA); // 並びの切り替えの文言と段階の見出しの形（ZBLL は「小グループ順 / OCLL ごと」）
  let byStage = false;
  let sections = []; // 今の並びの区切り（CaseSections.list）
  let twoLevel = false; // グループのボタンを2段（親 → 子。ZBLL の OCLL → 小グループ）にするか（CaseSections.isTwoLevel）

  // ---- 表示するグループ（覚える順なら段階）の選択 ----
  let chosen = new Set(); // 区切りの key。空ならすべて
  const chosenKey = () => SET + (byStage ? 'Stages' : 'Groups');
  const loadChosen = () => {
    const list = readJSON(FILTER_KEY)[chosenKey()];
    const keys = new Set(sections.map((s) => s.key));
    chosen = new Set(Array.isArray(list) ? list.filter((k) => keys.has(k)) : []);
    if (twoLevel) chosen = CS.normalizeTwoLevel(sections, chosen); // 親は1つだけ
  };
  function setChosen(next) {
    chosen = next;
    // 並びの順で保存する
    writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [chosenKey()]: sections.map((s) => s.key).filter((k) => chosen.has(k)) }));
    applyFilter();
  }

  // ---- 進み具合・絞り込み ----
  let filter = 'all';
  const counts = (list) => {
    const n = { all: list.length, new: 0, learning: 0, learned: 0 };
    list.forEach((c) => n[statusOf(c)]++);
    return n;
  };

  function buildSummary() {
    const box = $('progressBox');
    box.className = 'progress-summary mb-3';
    box.innerHTML = '';
    if (HAS_STAGES) {
      const sw = el('div', 'scope-switch mb-2');
      sw.setAttribute('role', 'group');
      I.set(sw, 'list.orderAria', null, 'aria-label');
      [
        { value: false, label: ORDER.group.key, title: ORDER.group.title },
        { value: true, label: ORDER.learn.key, title: ORDER.learn.title, params: ORDER.learn.titleParams },
      ].forEach((o) => {
        const b = el('button', 'scope-option');
        b.type = 'button';
        b.dataset.order = String(o.value);
        I.set(b, o.label);
        I.set(b, o.title, o.params, 'title');
        b.addEventListener('click', () => {
          if (byStage === o.value) return;
          byStage = o.value;
          writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [SET + 'Order']: byStage ? 'learn' : 'group' }));
          buildSections();
          loadChosen();
          updateSummary();
          applyFilter();
        });
        sw.append(b);
      });
      box.append(' ', sw);
    }
    const bar = el('div', 'progress-stacked mb-2');
    I.set(bar, 'list.progressAria', null, 'aria-label');
    ['learned', 'learning'].forEach((s) => {
      const seg = el('div', 'progress');
      seg.setAttribute('role', 'progressbar');
      seg.dataset.segment = s;
      seg.append(el('div', `progress-bar bar-${s}`));
      bar.append(seg);
    });
    // バーの色の凡例は、下の絞り込みのボタン（未習得・練習中・習得済み）の色の点で兼ねる
    // （件数もボタンに出ているので、バーの下に同じ数を並べない）
    const chips = el('div', 'filter-chips d-flex flex-wrap gap-1');
    chips.setAttribute('role', 'group');
    I.set(chips, 'list.filterAria', null, 'aria-label');
    // 並びはバーの色と同じ順（左から習得済み・練習中・未習得）
    ['all', 'learned', 'learning', 'new'].forEach((f) => {
      const b = el('button', 'btn btn-sm btn-outline-secondary');
      b.type = 'button';
      b.dataset.filter = f;
      const label = el('span');
      I.set(label, f === 'all' ? 'list.filterAll' : 'status.' + f);
      if (f !== 'all') b.append(el('span', `legend-dot ${f}`));
      b.append(label, el('span', 'chip-count'));
      b.addEventListener('click', () => {
        filter = f;
        writeJSON(FILTER_KEY, Object.assign(readJSON(FILTER_KEY), { [SET]: f }));
        applyFilter();
      });
      chips.append(b);
    });
    // 絞り込みチップの右に「すべて未習得に戻す」。押すと確認を出し、戻したあとは「元に戻す」を出す
    const row = el('div', 'd-flex flex-wrap align-items-center gap-2');
    const reset = el('button', 'btn btn-link btn-sm p-0 ms-auto reset-progress');
    reset.type = 'button';
    reset.id = 'resetProgress';
    I.set(reset, 'list.resetAll');
    I.set(reset, 'list.resetAllTitle', { set: SET.toUpperCase() }, 'title');
    reset.addEventListener('click', () => {
      resetState = { confirming: true };
      renderReset();
    });
    row.append(chips, reset);
    const resetBar = el('div', 'reset-bar');
    resetBar.id = 'resetBar';
    resetBar.setAttribute('role', 'status');
    box.append(bar, row, resetBar);
  }

  // ---- すべて未習得に戻す ----
  // グループの選択・絞り込みに関係なく、この種類（PLL / OLL）のケースすべての習得状況を消す（練習の記録は消さない）。
  // 間違って押しても困らないよう、押したらまず確認を出し、戻したあとも「元に戻す」で戻せるようにする（ブラウザの確認ダイアログは使わない）
  let resetState = null; // null / { confirming: true } / { done: n, undo: 関数 } / { restored: n }

  function resetAll() {
    // まとめて1回で保存する（ケースごとに保存すると、ログイン中はそのたびにクラウドへ送るので）
    const writeSet = (mine) => {
      const all = window.Store.get('progress');
      window.Store.set('progress', Object.assign({}, all && typeof all === 'object' ? all : {}, { [SET]: mine }));
      progress = P.statuses(SET);
    };
    const before = Object.assign({}, P.statuses(SET));
    const n = Object.keys(before).length;
    writeSet({});
    const undo = () => {
      // 戻したあとに付けた習得状況は残し、消したものだけを戻す
      writeSet(Object.assign({}, before, P.statuses(SET)));
      resetState = { restored: n };
      refreshStatuses();
    };
    resetState = { done: n, undo: undo };
    refreshStatuses();
  }

  // 全カードのバッジ・件数・絞り込みを今の習得状況に合わせる
  function refreshStatuses() {
    document.querySelectorAll('#caseList .status-badge').forEach((b) => b.dispatchEvent(new CustomEvent('relabel')));
    updateSummary();
    applyFilter();
    renderReset();
  }

  function renderReset() {
    const bar = $('resetBar');
    const button = $('resetProgress');
    const n = counts(DATA);
    const marked = n.learned + n.learning;
    button.disabled = !marked;
    bar.replaceChildren();
    bar.hidden = !resetState;
    if (!resetState) return;
    if (resetState.confirming) {
      if (!marked) {
        resetState = null;
        bar.hidden = true;
        return;
      }
      const text = el('span', 'reset-confirm');
      I.set(text, 'list.resetConfirm', { set: SET.toUpperCase(), learned: n.learned, learning: n.learning });
      const yes = el('button', 'btn btn-danger btn-sm');
      yes.type = 'button';
      I.set(yes, 'list.resetYes');
      yes.addEventListener('click', resetAll);
      const no = el('button', 'btn btn-outline-secondary btn-sm');
      no.type = 'button';
      I.set(no, 'stats.cancel');
      no.addEventListener('click', () => {
        resetState = null;
        renderReset();
      });
      bar.append(text, yes, no);
      no.focus();
      return;
    }
    const msg = el('span', 'text-muted');
    if (resetState.undo) {
      I.set(msg, 'list.resetDone', { n: resetState.done });
      const undo = el('button', 'btn btn-link btn-sm p-0');
      undo.type = 'button';
      I.set(undo, 'stats.undo');
      undo.addEventListener('click', resetState.undo);
      bar.append(msg, undo);
    } else {
      I.set(msg, 'list.resetRestored', { n: resetState.restored });
      bar.append(msg);
    }
  }

  // 件数・バー・グループの「覚えた数 / 全体」を今の状態に合わせる（絞り込みはやり直さない。
  // 絞り込み中に状態を変えたカードがすぐ消えると落ち着かないので、チップを押したときに反映する）
  function updateSummary() {
    const n = counts(DATA);
    ['learned', 'learning'].forEach((s) => {
      const seg = document.querySelector(`#progressBox [data-segment="${s}"]`);
      const pct = n.all ? (n[s] / n.all) * 100 : 0;
      seg.style.width = pct + '%';
      seg.setAttribute('aria-valuenow', String(n[s]));
      seg.setAttribute('aria-valuemin', '0');
      seg.setAttribute('aria-valuemax', String(n.all));
      seg.setAttribute('aria-label', `${statusLabel(s)}: ${n[s]}`);
    });
    document.querySelectorAll('#progressBox [data-filter]').forEach((b) => {
      b.querySelector('.chip-count').textContent = n[b.dataset.filter];
    });
    sections.forEach((s) => {
      const list = s.cases;
      const learned = list.filter((c) => statusOf(c) === 'learned').length;
      const label = document.querySelector(`#group-${CSS.escape(s.key)} .group-count`);
      label.textContent = `${learned}/${list.length}`;
      label.classList.toggle('complete', learned === list.length);
      const nb = document.querySelector(`#groupNav [data-group="${CSS.escape(s.key)}"]`);
      if (nb) nb.classList.toggle('group-nav-complete', learned === list.length);
    });
  }

  // 選んだ状態のカードだけを表示し、1枚も無いグループは見出しごと隠す
  function applyFilter() {
    document.querySelectorAll('#progressBox [data-order]').forEach((b) => {
      const on = b.dataset.order === String(byStage);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#groupNav [data-group]').forEach((b) => {
      if (twoLevel) return; // 2段のときは renderTwoLevelNav が付ける
      const on = chosen.has(b.dataset.group);
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('groupClear').disabled = !chosen.size;
    const total = DATA.length;
    I.set($('caseCount'), 'list.count', { n: total });
    // 今の絞り込みのまま練習ページを開くボタン
    const practice = $('practiceLink');
    if (practice) {
      const q = new URLSearchParams({ set: SET, filter: filter });
      // 選んだグループ（覚える順なら段階の番号）も渡す。空ならすべて
      if (HAS_STAGES) q.set('order', byStage ? 'learn' : 'group');
      const picked = sections.filter((s) => chosen.has(s.key) && s.key !== 'all');
      q.set('groups', picked.map((s) => (byStage ? s.stage : s.key)).join(','));
      practice.href = '/practice?' + q.toString();
    }
    const zip = $('downloadZip');
    if (!zip.disabled) {
      I.set(zip, 'list.download');
    }
    if (zipConfirming) renderZipConfirm(); // 言語を変えたら文を直す
    zip.title = I.t('list.downloadTitle', { n: total });
    document.querySelectorAll('#progressBox [data-filter]').forEach((b) => {
      const on = b.dataset.filter === filter;
      b.classList.toggle('btn-secondary', on);
      b.classList.toggle('btn-outline-secondary', !on);
      b.setAttribute('aria-pressed', String(on));
    });
    const visibleOf = {}; // 区切りごとの表示しているカードの数（2段のボタンの出し入れに使う）
    document.querySelectorAll('#caseList section').forEach((section) => {
      let visible = 0;
      section.querySelectorAll('.col[data-name]').forEach((col) => {
        const show = filter === 'all' || col.dataset.status === filter;
        col.hidden = !show;
        if (show) visible++;
      });
      const g = section.dataset.group;
      visibleOf[g] = visible;
      section.hidden = visible === 0 || (chosen.size > 0 && !chosen.has(g));
      // ボタンは選んでいれば（外せるように）カードが無くても出す
      const nb = document.querySelector(`#groupNav [data-group="${CSS.escape(g)}"]`);
      if (nb && !twoLevel) nb.hidden = visible === 0 && !chosen.has(g);
    });
    if (twoLevel) renderTwoLevelNav(visibleOf);
    $('emptyMessage').hidden = !!document.querySelector('#caseList section:not([hidden])');
  }

  // カードは1回だけ作り、並びを変えたら見出しの下に入れ直す（画像を描き直さない）
  const CARDS = {};

  // 見出し（グループ：「Edges only (EPLL)」、段階：「2. …」）
  // 覚える順の段階の見出し（名前は i18n の stage.<set>.<記号>）
  //   OLL（番号のデータ）：記号 A〜M が順番を表すので番号は付けない（「A. 十字完成」）
  //   PLL：記号（U・T…）は順番を表さないので番号を付ける（「1. U-perm（エッジ3つ）」）
  const sectionTitle = (s) => {
    if (!s.stage) return groupLabel(s.key);
    const name = I.t(`stage.${SET}.${s.label}`);
    if (ORDER.heading === 'name') return name; // ZBLL：「T-ZBLL」
    return ORDER.heading === 'label' ? `${s.label}. ${name}` : `${s.stage}. ${name}`;
  };
  // 言語を切り替えたら、見出しとボタンの説明を作り直す（段階の名前は訳がある）
  function relabelSections() {
    sections.forEach((s) => {
      const title = document.querySelector(`#group-${CSS.escape(s.key)} .section-title`);
      if (title) title.textContent = sectionTitle(s);
      const b = document.querySelector(`#groupNav [data-group="${CSS.escape(s.key)}"]`);
      if (b) b.title = sectionTitle(s);
    });
  }

  // 2段のグループのボタン（ZBLL の小グループ順）：上の段は親（OCLL。1つだけ選ぶ）、下の段は選んだ親の子（小グループ。いくつでも）。
  // 親だけを選ぶとその親の子すべて、子を押すとその中で絞る（CaseSections.twoLevel・pickParent・pickChild）。
  // 選んでいない・表示しているカードが無いボタンは隠す。全部覚えたら group-nav-complete
  function renderTwoLevelNav(visibleOf) {
    const t = CS.twoLevel(sections, chosen);
    const byKey = {};
    sections.forEach((s) => (byKey[s.key] = s));
    const allLearned = (keys) => keys.every((k) => byKey[k].cases.every((c) => statusOf(c) === 'learned'));
    const button = (label, on, onClick) => {
      const b = el('button', 'btn btn-outline-secondary btn-sm group-nav-btn', label);
      b.type = 'button';
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
      b.addEventListener('click', onClick);
      return b;
    };
    const parents = el('div', 'group-nav-parents');
    t.parents.forEach((p) => {
      const b = button(p.key, p.active, () => setChosen(CS.pickParent(sections, chosen, p.key)));
      b.dataset.parent = p.key;
      const n = p.groups.reduce((sum, k) => sum + byKey[k].cases.length, 0);
      const titleKey = `stage.${SET}.${p.key}`;
      const name = I.t(titleKey);
      b.title = `${name === titleKey ? p.key : name} · ${n}`;
      b.classList.toggle('group-nav-complete', allLearned(p.groups));
      b.hidden = !p.active && p.groups.every((k) => !visibleOf[k]);
      parents.append(b);
    });
    const nav = $('groupNav');
    nav.replaceChildren(parents);
    if (!t.active) return;
    const children = el('div', 'group-nav-children');
    t.children.forEach((c) => {
      const b = button(c.label, c.active, () => setChosen(CS.pickChild(sections, chosen, c.key)));
      b.dataset.group = c.key;
      b.title = `${sectionTitle(byKey[c.key])} · ${byKey[c.key].cases.length}`;
      b.classList.toggle('group-nav-complete', allLearned([c.key]));
      b.hidden = !c.active && !visibleOf[c.key];
      children.append(b);
    });
    nav.append(children);
  }

  // 今の並びで、ジャンプのボタンと見出しごとのカードを作り直す
  function buildSections() {
    sections = CS.list(DATA, byStage);
    twoLevel = CS.isTwoLevel(sections);
    // 番号順（区切りが 'all' の1つだけ）のときは、見出し・グループのボタン・「選択を解除」を出さない
    const flat = sections.length === 1 && sections[0].key === 'all';
    const nav = $('groupNav');
    nav.replaceChildren();
    nav.hidden = flat;
    // 2 文字の名前（COLL・ZBLL の Pi など）があるか。スマホではそれに合わせてそろえる幅を決める（css/cases.css）
    nav.classList.toggle('two-char', sections.some((s) => s.label.length === 2));
    const foot = $('groupClear') && $('groupClear').parentElement;
    if (foot) foot.hidden = flat;
    // 2段のときのボタンは applyFilter → renderTwoLevelNav で作る
    (twoLevel ? [] : sections).forEach((s) => {
      const b = el('button', 'btn btn-outline-secondary btn-sm group-nav-btn', s.label);
      b.type = 'button';
      b.dataset.group = s.key;
      b.title = sectionTitle(s);
      b.addEventListener('click', () => {
        const next = new Set(chosen);
        if (next.has(s.key)) next.delete(s.key);
        else next.add(s.key);
        setChosen(next);
      });
      nav.append(b);
    });

    const list = $('caseList');
    list.querySelectorAll('section').forEach((section) => section.remove());
    const empty = $('emptyMessage');
    sections.forEach((s) => {
      const section = el('section', 'mb-4');
      section.id = 'group-' + s.key;
      section.dataset.group = s.key;
      const heading = el('h2', 'h5 border-bottom pb-1 d-flex justify-content-between align-items-baseline');
      heading.append(el('span', 'section-title', sectionTitle(s)));
      heading.append(el('span', 'group-count'));
      heading.hidden = flat;
      section.append(heading);
      const row = el('div', 'row row-cols-3 row-cols-md-4 row-cols-lg-6 g-2'); // スマホでも 1 行 3 枚
      s.cases.forEach((c) => row.append(CARDS[c.name]));
      section.append(row);
      list.insertBefore(section, empty);
    });
  }

  function render() {
    const settings = savedSettings();
    DATA.forEach((c) => {
      CARDS[c.name] = caseCard(c, settings);
    });
    // グループのボタンの下：「選択を解除」
    const foot = el('div', 'group-nav-foot d-flex align-items-center gap-2 mb-3');
    const clear = el('button', 'btn btn-link btn-sm p-0');
    clear.type = 'button';
    clear.id = 'groupClear';
    I.set(clear, 'practice.groupsClear');
    clear.addEventListener('click', () => setChosen(new Set()));
    foot.append(clear);
    $('groupNav').after(foot);

    const list = $('caseList');
    const empty = el('p', 'text-muted text-center py-5');
    I.set(empty, 'list.empty');
    empty.id = 'emptyMessage';
    empty.hidden = true;
    list.append(empty);

    const savedFilter = readJSON(FILTER_KEY);
    filter = ['all'].concat(STATUSES).includes(savedFilter[SET]) ? savedFilter[SET] : 'all';
    byStage = HAS_STAGES && savedFilter[SET + 'Order'] === 'learn';
    buildSections();
    loadChosen();
    buildSummary();
    updateSummary();
    applyFilter();
    renderReset();
  }

  // 全ケースを PNG にして zip にまとめ、ダウンロードする。ファイル名は <pll|oll>-<名前>.png
  async function downloadAll(button) {
    button.disabled = true;
    try {
      const settings = savedSettings(); // ダウンロードの時点の設定を読み直す
      const list = DATA;
      const files = [];
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        button.textContent = I.t('list.creating', { i: i + 1, n: list.length });
        const colors = caseColors(c, settings);
        const blob = await D.pngBlob(colors.ucolor, colors.scolor, { size: settings.size, border: settings.border, background: settings.background });
        files.push({ name: `${SET}-${c.name}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
      const zip = new Blob([window.ZipStore.create(files)], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(zip);
      link.download = `visualcube-${SET}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10000);
    } finally {
      button.disabled = false;
      applyFilter(); // ボタンの文を（今の言語で）戻す
    }
  }

  render();
  // 言語を切り替えたら、その場で作る文（件数・バッジの説明など）を作り直す
  I.onChange(() => {
    document.querySelectorAll('.status-badge').forEach((b) => b.dispatchEvent(new CustomEvent('relabel')));
    relabelSections();
    updateSummary();
    applyFilter();
  });
  // ZIP でダウンロード：押したら確認の行を出す（もう一度押すと閉じる）
  function renderZipConfirm() {
    const box = $('zipConfirm');
    const button = $('downloadZip');
    box.replaceChildren();
    box.hidden = !zipConfirming;
    button.setAttribute('aria-expanded', String(zipConfirming));
    if (!zipConfirming) return;
    const settings = savedSettings(); // 今の設定（ダウンロードのときにも読み直す）
    const text = el('span', 'zip-confirm-text');
    I.set(text, settings.background ? 'list.downloadConfirmBg' : 'list.downloadConfirm', {
      set: SET.toUpperCase(),
      n: DATA.length,
      size: settings.size,
      bg: settings.background || '',
    });
    const yes = el('button', 'btn btn-primary btn-sm');
    yes.type = 'button';
    I.set(yes, 'list.downloadYes');
    yes.addEventListener('click', () => {
      zipConfirming = false;
      renderZipConfirm();
      downloadAll(button);
    });
    const no = el('button', 'btn btn-outline-secondary btn-sm');
    no.type = 'button';
    I.set(no, 'stats.cancel');
    no.addEventListener('click', () => {
      zipConfirming = false;
      renderZipConfirm();
      button.focus();
    });
    const note = el('span', 'zip-confirm-note');
    I.set(note, 'list.downloadNote');
    box.append(text, yes, no, note);
    yes.focus();
  }
  $('downloadZip').addEventListener('click', () => {
    zipConfirming = !zipConfirming;
    renderZipConfirm();
  });
})();
