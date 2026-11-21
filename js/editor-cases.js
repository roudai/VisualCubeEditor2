// エディタ（index.html）に足す機能。js/main.js の Vue アプリに mixin として組み込む（window.EditorCases）。
// MegaminxImageEditor の js/alg-input.js に当たる。仕様: reference/PLL_SPEC.md、reference/OLL_SPEC.md
//
// PLL・OLL・COLL の選択（pll-data.js / oll-data.js / coll-data.js）。同時に選べるのはどれか1つ。
//   PLL の行：Group → Case。Prev / Next はデータの並び（PLL 一覧のグループ順と同じ）
//   OLL の行（COLL もここで選ぶ）：1つ目で種類（OLL / COLL H (OLL 21) … COLL Sune (OLL 27)）、2つ目でケース。
//     OLL は番号（1〜57、番号順。OLL 一覧の番号順と同じ）、COLL はそのグループのケース（21-1 …）。
//     Prev / Next は、OLL なら番号順、COLL なら COLL 全体をデータの順に送る（21-4 の次は 22-1。1つ目も切り替わる）
//   選ぶと 3x3・Plan 表示に切り替え（保存しない）、種類に応じて手順の欄を差し替える
//     alg（手順を回した状態）→ setup（そのケースになる手順） / case（この手順で揃う状態）→ alg（解く手順）
//   OLL を選ぶと Color Preset を OLL にし、OLL 配色のまま PLL・COLL を選ぶと OLL を選ぶ前の配色に戻す（覚えていなければ Standard）
//   COLL を選ぶと Stage Mask を COLL（側面のエッジのステッカーをグレー）にする。COLL 以外を選ぶ・選択を外すと、COLL で付けたマスクを外す
//   （COLL を選んでいる間に手で Stage Mask を変えたら、それ以降は触らない）
//   選んでいる間は手順の欄を書き換えても選択を外さず、その手順を自分の手順として保存できる（custom-algs.js。確認は case-check.js）
//   パズルの種類を 3x3 以外に変えると選択を外す
// 手順の確認（3x3 のときだけ）: js/cube-state.js で読めない記号・括弧の対応をその場で調べ、欄の下にエラーを出す。
//   描画に渡す手順（main.js の drawCube が呼ぶ algForDraw）は括弧と繰り返しを展開したもの。
//   case は手順中の持ち替え（x y z・2層回し・中層回し）で完成後の向きが変わっても揃ったとみなす（センターを元の位置に戻す）
// Color Preset（standard / oll / custom）、Background（Transparent / Opaque）、Download と File Name
// 設定の保存: 配色（Color Preset・面の色・OLL を選ぶ前の配色・最後のカスタム配色）・画像サイズ・Cube Color・背景色・背景を
//   store.js の 'settings' に保存し、次に開いたときに戻す（ログイン中はクラウドにも）。
//   手順・種類・PLL/OLL の選択・ファイル名・パズルの種類・表示・マスク・回転・矢印は保存しない
// URL パラメータ: ?alg=R U R' U' / ?case=R U R' U' / ?pll=Aa / ?oll=27 / ?coll=21-1（?pll → ?oll → ?coll → ?case → ?alg の順に優先）
(function () {
  'use strict';
  const M = window.CubeState;
  const CA = window.CustomAlgs;
  const I = window.I18N;
  const S = window.Store;

  const SET_KEYS = ['pll', 'oll', 'coll'];
  const BASE = { pll: window.PLL_DATA || [], oll: window.OLL_DATA || [], coll: window.COLL_DATA || [] };
  const NOTES = window.CASE_GROUP_NOTES || {};
  const PRESETS = ['standard', 'oll', 'custom'];
  const DEFAULT_FILE = 'visualcube.png';
  const HEX = /^#[0-9a-f]{6}$/i;
  const squash = (text) => String(text).replace(/\s+/g, ' ').trim();
  const validScheme = (scheme) => !!scheme && typeof scheme === 'object' && M.FACES.every((face) => HEX.test(scheme[face]));
  const sameScheme = (a, b) => M.FACES.every((face) => a[face] === b[face]);

  window.EditorCases = {
    data: () => ({
      caseSets: [{ key: 'pll', label: 'PLL' }], // グループ → ケースで選ぶ行（OLL・COLL は別の行：ollKinds）
      // 選んでいるケース（group が空なら未選択）。ケースそのものは selectedCase で引く
      caseSel: { pll: { group: '', name: '' }, oll: { group: '', name: '' }, coll: { group: '', name: '' } },
      collMaskSet: false, // COLL を選んで Stage Mask を COLL にしたか（外すときに戻すため）
      customVersion: 0, // 自分の手順を保存・消したら増やす（caseData を作り直す）
      myAlgMessage: { make: null, kind: '', undo: null, forAlg: null }, // make：文を作る関数（言語を切り替えたら作り直す。myAlgText）
      colorPreset: 'standard',
      schemeBeforeOll: null, // OLL を選ぶ前の配色 { preset, scheme }。手で配色を変えたら忘れる
      customScheme: null, // 最後のカスタム配色。Color Preset で Custom を選ぶとこの配色に戻す
      background: 'y', // 'y' = 透明 / 'n' = 不透明（Background Color で塗る）
      fileName: DEFAULT_FILE,
      settingsReady: false,
    }),

    computed: {
      // 自分の手順のメッセージ（今の言語で作る。出している間に言語を切り替えても訳し直す）
      myAlgText() {
        void this.lang;
        return this.myAlgMessage.make ? this.myAlgMessage.make() : '';
      },
      // 自分の手順を既定データに重ねたもの
      caseData() {
        void this.customVersion;
        const out = {};
        SET_KEYS.forEach((key) => {
          out[key] = CA ? CA.merged(key, BASE[key]) : BASE[key];
        });
        return out;
      },
      // 選択中のケース { key, c }（どれも選んでいなければ null）
      selectedCase() {
        for (const key of SET_KEYS) {
          const sel = this.caseSel[key];
          if (!sel.group) continue;
          const c = this.caseData[key].find((x) => x.name === sel.name);
          if (c) return { key: key, c: c };
        }
        return null;
      },
      // ---- OLL の行（OLL と COLL） ----
      // 1つ目の選択肢：OLL と、COLL のグループ（「COLL H (OLL 21)」）
      ollKinds() {
        const notes = NOTES.coll || {};
        const groups = this.caseData.coll.map((c) => c.group).filter((g, i, all) => all.indexOf(g) === i);
        return [{ value: 'oll', label: 'OLL' }].concat(
          groups.map((g) => ({ value: 'coll:' + g, label: notes[g] ? `COLL ${g} (${notes[g]})` : `COLL ${g}` }))
        );
      },
      // 今の種類：'oll' / 'coll:<グループ>' / ''（OLL・COLL のどちらも選んでいない）
      ollKind() {
        if (this.caseSel.coll.group) return 'coll:' + this.caseSel.coll.group;
        return this.caseSel.oll.group ? 'oll' : '';
      },
      // OLL を番号順に並べたもの（OLL 一覧の番号順と同じ。データの並びはグループ順）
      ollByNumber() {
        return this.caseData.oll.slice().sort((a, b) => Number(a.name) - Number(b.name));
      },
      // 2つ目の選択肢：OLL なら 1〜57、COLL ならそのグループのケース
      ollKindCases() {
        const kind = this.ollKind;
        if (kind === 'oll') return this.ollByNumber;
        if (kind) return this.caseData.coll.filter((c) => c.group === kind.slice('coll:'.length));
        return [];
      },
      ollKindCase() {
        return this.ollKind === 'oll' ? this.caseSel.oll.name : this.caseSel.coll.name;
      },
      caseIsCustom() {
        return !!(this.selectedCase && this.selectedCase.c.custom);
      },
      caseEdited() {
        return !!this.selectedCase && this.algtype === 'case' && squash(this.algorithm) !== squash(this.selectedCase.c.alg);
      },
      // 3x3 の手順の解析エラー（訳した文。無ければ ''）
      algError() {
        void this.lang;
        if (this.cubeSize !== 3 || this.algtype === 'state' || !this.algorithm.trim()) return '';
        try {
          M.parseAlg(this.algorithm);
          return '';
        } catch (e) {
          return I.error(e.message);
        }
      },
      settingsSnapshot() {
        return {
          preset: this.colorPreset,
          faceColors: this.currentScheme(),
          beforeOll: this.schemeBeforeOll,
          customScheme: this.customScheme,
          imageSize: String(this.imageSize),
          border: this.cubeColor,
          bgColor: this.backgroundColor,
          bg: this.background,
        };
      },
    },

    watch: {
      // 手で書き換えたら、前のメッセージ（保存のエラーなど）は消す
      algorithm(value) {
        if (this.myAlgMessage.make && value !== this.myAlgMessage.forAlg) this.setMyAlgMessage('');
      },
      // 種類を切り替えたら、選択中のケースの手順を入れ直す（編集中の内容は捨てる）
      algtype() {
        this.fillCaseAlg();
        this.setMyAlgMessage('');
      },
      // COLL で付けた Stage Mask を手で変えたら、それ以降は（選択を外しても）マスクに触らない（main.js の同名の監視とは別に動く）
      stageMask(value) {
        if (value !== 'coll') this.collMaskSet = false;
      },
      // PLL・OLL・COLL は 3x3 のケースなので、他の大きさにしたら選択を外す
      cubeSize(value) {
        if (value !== 3 && this.selectedCase) this.clearCaseSelection();
      },
      background() {
        this.drawCube();
      },
      settingsSnapshot: {
        deep: true,
        handler(value) {
          if (this.settingsReady) S.set('settings', value); // store.js（前と同じ内容なら何もしない）
        },
      },
    },

    created() {
      this.loadSettings();
      const params = new URLSearchParams(location.search);
      const urlPll = params.has('pll') ? this.findCaseByName('pll', params.get('pll')) : null;
      const urlOll = params.has('oll') ? this.findCaseByName('oll', params.get('oll')) : null;
      const urlColl = params.has('coll') ? this.findCaseByName('coll', params.get('coll')) : null;
      if (urlPll) this.selectCase('pll', urlPll);
      else if (urlOll) this.selectCase('oll', urlOll);
      else if (urlColl) this.selectCase('coll', urlColl);
      else if (params.has('case')) {
        this.algorithm = params.get('case');
        this.algtype = 'case';
        // ZBLL 一覧から（?zbll=名前&case=手順）：ほかの一覧から開いたときと同じく 3x3・Plan・PLL と同じ配色（OLL の配色・COLL のマスクは外す）
        if (params.has('zbll')) {
          const name = String(params.get('zbll')).replace(/[^\w\-+=/ ]/g, '').replace(/[/ ]/g, '_');
          this.cubeSize = 3;
          this.cubeView = 'plan';
          this.applySetScheme('zbll');
          this.applySetMask(null);
          if (name) this.fileName = `zbll-${name}.png`;
        }
      } else if (params.has('alg')) {
        this.algorithm = params.get('alg');
        this.algtype = 'alg';
      }
      // 上で戻した設定をそのまま保存し直さない（スマホで画像サイズを画面に合わせて小さくしたときなど）
      this.$nextTick(() => {
        this.settingsReady = true;
      });
    },

    methods: {
      // ---- PLL・OLL の選択 ----
      caseGroups(key) {
        const notes = NOTES[key] || {};
        return this.caseData[key]
          .map((c) => c.group)
          .filter((g, i, all) => all.indexOf(g) === i)
          .map((g) => ({ value: g, label: notes[g] ? `${g} (${notes[g]})` : g }));
      },
      casesInGroup(key) {
        const group = this.caseSel[key].group;
        return group ? this.caseData[key].filter((c) => c.group === group) : [];
      },
      // URL では + が空白になるので、見つからなければ空白を + に戻して探す
      findCaseByName(key, name) {
        const list = this.caseData[key];
        return list.find((c) => c.name === name) || list.find((c) => c.name === String(name).replace(/ /g, '+')) || null;
      },
      // 未選択から選んだときは case にする。選んだまま別のケースに変えたときは種類をそのままにする
      selectCase(key, c) {
        const keepType = this.selectedCase !== null && this.algtype !== 'state';
        SET_KEYS.forEach((other) => {
          this.caseSel[other] = other === key ? { group: c.group, name: c.name } : { group: '', name: '' };
        });
        this.fileName = `${key}-${c.name}.png`;
        this.cubeSize = 3;
        this.cubeView = 'plan';
        this.applySetScheme(key);
        this.applySetMask(key);
        if (!keepType) this.algtype = 'case';
        this.fillCaseAlg();
        this.setMyAlgMessage('');
        this.drawCube(); // 手順の欄の遅延（500ms）を待たずに描く
      },
      onCaseGroupChange(key, group) {
        const first = this.caseData[key].find((c) => c.group === group);
        if (first) this.selectCase(key, first);
        else {
          this.caseSel[key] = { group: '', name: '' };
          this.applySetMask(null);
        }
      },
      onCaseChange(key, name) {
        const c = this.caseData[key].find((x) => x.name === name);
        if (c) this.selectCase(key, c);
      },
      // 前後のケースへ（list の並び。既定はその種類のデータの並び。端では反対の端に回る。未選択なら Next は先頭、Prev は末尾）
      stepCase(key, delta, list) {
        const order = list || this.caseData[key];
        if (!order.length) return;
        const sel = this.caseSel[key];
        const i = sel.group ? order.findIndex((c) => c.name === sel.name) : -1;
        const next = i < 0 ? (delta > 0 ? 0 : order.length - 1) : (i + delta + order.length) % order.length;
        this.selectCase(key, order[next]);
      },
      // ---- OLL の行（OLL と COLL） ----
      // 1つ目を変えた：OLL なら OLL 1、COLL のグループならその最初のケースを選ぶ。未選択に戻したら OLL・COLL の選択を外す
      onOllKindChange(value) {
        if (value === 'oll') {
          this.selectCase('oll', this.ollByNumber[0]);
        } else if (value.indexOf('coll:') === 0) {
          this.onCaseGroupChange('coll', value.slice('coll:'.length));
        } else {
          this.caseSel.oll = { group: '', name: '' };
          this.caseSel.coll = { group: '', name: '' };
          this.applySetMask(null);
          this.setMyAlgMessage('');
        }
      },
      onOllCaseChange(name) {
        this.onCaseChange(this.ollKind === 'oll' ? 'oll' : 'coll', name);
      },
      // Prev / Next：COLL を選んでいれば COLL 全体（データの順）、それ以外は OLL の番号順
      stepOll(delta) {
        if (this.caseSel.coll.group) this.stepCase('coll', delta);
        else this.stepCase('oll', delta, this.ollByNumber);
      },
      clearCaseSelection() {
        SET_KEYS.forEach((key) => {
          this.caseSel[key] = { group: '', name: '' };
        });
        this.applySetMask(null);
        this.setMyAlgMessage('');
      },
      // Clear ボタン：手順を消し、選択も外す
      clearAlgorithmAndCase() {
        this.clearAlgorithm();
        this.clearCaseSelection();
        this.$nextTick(() => this.drawCube());
      },
      // 選択中のケースの手順を、種類に合わせて手順の欄に入れる（state のときは変更しない）
      fillCaseAlg() {
        const sel = this.selectedCase;
        if (!sel || this.algtype === 'state') return;
        this.algorithm = this.algtype === 'alg' ? sel.c.setup : sel.c.alg;
      },

      // ---- 自分の手順 ----
      // undo を渡すと、メッセージの右に「元に戻す」を出す（押すと保存・既定に戻す前の状態に戻す）
      // message：文を作る関数（言語を切り替えたら、出ている間も訳し直す。myAlgText）。消すときは '' か無し
      setMyAlgMessage(message, kind, undo) {
        const make = typeof message === 'function' ? message : message ? () => message : null;
        this.myAlgMessage = { make: make, kind: kind || '', undo: undo || null, forAlg: this.algorithm };
      },
      // 保存・既定に戻すのあと：データを作り直し、選択中のケースの手順で欄と画像を描き直す
      afterMyAlgChange(message, undo) {
        this.customVersion++;
        this.fillCaseAlg();
        this.setMyAlgMessage(message, '', undo);
        this.drawCube();
      },
      // 変える前の自分の手順を覚えておき、「元に戻す」で戻す関数を作る（前が既定なら自分の手順を消す）
      undoFor(key, name) {
        const before = CA.get(key, name);
        return () => {
          if (before) CA.save(key, name, before);
          else CA.reset(key, name);
          this.afterMyAlgChange(() => I.t('myAlg.undone'));
        };
      },
      saveMyAlg() {
        const sel = this.selectedCase;
        if (!sel || !CA || this.algtype !== 'case' || !this.caseEdited) return;
        const result = CA.validate(sel.key, sel.c, this.algorithm, BASE[sel.key]);
        if (!result.ok) {
          const text = () => (result.code === 'parse' ? I.error(result.error) : I.t('myAlg.err.' + result.code, result.params));
          this.setMyAlgMessage(() => '✗ ' + text(), 'error');
          return;
        }
        const undo = this.undoFor(sel.key, sel.c.name);
        if (result.isDefault) {
          // 既定の手順と同じなら自分の手順としては保存しない。
          // 自分の手順があったときは消して既定に戻し（元に戻せる）、無かったときは「既定の手順と同じです」
          const hadCustom = !!sel.c.custom;
          CA.reset(sel.key, sel.c.name);
          this.afterMyAlgChange(() => I.t(hadCustom ? 'myAlg.resetDone' : 'myAlg.sameAsDefault'), hadCustom ? undo : null);
          return;
        }
        CA.save(sel.key, sel.c.name, result);
        const message = () =>
          [I.t('myAlg.saved')].concat(result.notes.map((n) => I.t('myAlg.' + n)), [I.t('myAlg.setup', { setup: result.setup })]).join(' ');
        this.afterMyAlgChange(message, undo);
      },
      resetMyAlg() {
        const sel = this.selectedCase;
        if (!sel || !CA) return;
        const undo = this.undoFor(sel.key, sel.c.name);
        CA.reset(sel.key, sel.c.name);
        this.afterMyAlgChange(() => I.t('myAlg.resetDone'), undo);
      },

      // ---- 描画に渡す手順（main.js の drawCube が呼ぶ）----
      // 3x3 のときは括弧と繰り返しを展開する（srVisualizer は括弧を読めない）。読めない手順なら null（描き直さない）。
      // case のときは、センターを元の位置に戻す持ち替えを足す（srVisualizer が逆手順にするので、最後に足せば最初に回る）
      algForDraw() {
        const text = this.algorithm.trim();
        if (this.cubeSize !== 3) return text;
        try {
          return M.flatten(text, { cancelRotation: this.algtype === 'case' });
        } catch (e) {
          return null;
        }
      },

      // ---- 配色 ----
      currentScheme() {
        return { U: this.faceU, R: this.faceR, F: this.faceF, D: this.faceD, L: this.faceL, B: this.faceB };
      },
      setScheme(scheme) {
        M.FACES.forEach((face) => {
          this['face' + face] = String(scheme[face]).toLowerCase();
        });
      },
      applyPreset() {
        if (this.colorPreset === 'standard') this.setScheme(M.DEFAULT_SCHEME);
        else if (this.colorPreset === 'oll') this.setScheme(M.ollMask({ U: this.faceU }));
        else if (this.colorPreset === 'custom' && this.customScheme) this.setScheme(this.customScheme);
      },
      onPresetChange() {
        this.schemeBeforeOll = null;
        this.applyPreset();
        this.redrawSoon();
      },
      // 面の色を手で変えた：Custom にして、その配色を覚える
      onFaceColorInput() {
        this.$nextTick(() => {
          this.colorPreset = 'custom';
          this.schemeBeforeOll = null;
          this.customScheme = this.currentScheme();
        });
      },
      // 配色を x / y / z で持ち替える（main.js の rotateX・rotateY・rotateZ）。色が変わったら Custom にする
      rotateScheme(axis) {
        const before = this.currentScheme();
        this['rotate' + axis.toUpperCase()]();
        const after = this.currentScheme();
        if (!sameScheme(before, after)) {
          this.colorPreset = 'custom';
          this.customScheme = after;
        }
        this.redrawSoon();
      },
      resetScheme() {
        this.colorPreset = 'standard';
        this.applyPreset();
        this.redrawSoon();
      },
      // OLL を選んだら OLL 配色にする（もともと OLL 配色でなければ、その前の配色を覚えておく）。
      // PLL を選んだとき OLL 配色なら、OLL を選ぶ前の配色に戻す。覚えた配色が無ければ Standard にする（PLL 一覧の表示と同じ）
      applySetScheme(key) {
        if (key === 'oll') {
          if (this.colorPreset !== 'oll') {
            this.schemeBeforeOll = { preset: this.colorPreset, scheme: this.currentScheme() };
            this.colorPreset = 'oll';
            this.applyPreset();
          }
        } else if (this.colorPreset === 'oll') {
          if (this.schemeBeforeOll) {
            this.colorPreset = this.schemeBeforeOll.preset;
            this.setScheme(this.schemeBeforeOll.scheme);
          } else {
            this.colorPreset = 'standard';
            this.applyPreset();
          }
          this.schemeBeforeOll = null;
        }
      },
      // COLL を選んだら Stage Mask を COLL にする。COLL 以外を選んだ・選択を外した（key が null）ときは、COLL で付けたマスクだけを外す
      applySetMask(key) {
        if (key === 'coll') {
          if (this.stageMask !== 'coll') {
            this.stageMask = 'coll';
            this.collMaskSet = true;
          }
        } else if (this.collMaskSet) {
          if (this.stageMask === 'coll') this.stageMask = '';
          this.collMaskSet = false;
        }
      },
      // 面の色をまとめて変えたあとに描き直す（main.js の面の色の監視は、続けて変えると描かないことがある）
      redrawSoon() {
        this.$nextTick(() => this.drawCube());
      },

      // ---- 背景 ----
      // 背景色を選んだら不透明にする
      onBackgroundColorInput() {
        this.background = 'n';
      },

      // ---- ダウンロード ----
      // 表示中の画像（PNG）を保存する。ファイル名が .png で終わらなければ付け足す（空欄なら visualcube.png）
      downloadImage() {
        const img = document.querySelector('#visualcube img');
        if (!img || !img.src) return;
        const name = this.fileName.trim() || DEFAULT_FILE;
        const link = document.createElement('a');
        link.href = img.src;
        link.download = /\.png$/i.test(name) ? name : name + '.png';
        link.click();
      },

      // ---- 設定の保存 ----
      // 保存された値のうち、正しい形のものだけを戻す
      loadSettings() {
        const settings = S.get('settings');
        if (!settings || typeof settings !== 'object') return;
        const faceColors = settings.faceColors || {};
        M.FACES.forEach((face) => {
          if (HEX.test(faceColors[face])) this['face' + face] = faceColors[face].toLowerCase();
        });
        if (PRESETS.includes(settings.preset)) this.colorPreset = settings.preset;
        if (/^\d+$/.test(settings.imageSize)) this.imageSize = Math.max(this.imageMin, Math.min(this.imageMax, Number(settings.imageSize)));
        if (HEX.test(settings.border)) this.cubeColor = settings.border.toLowerCase();
        if (HEX.test(settings.bgColor)) this.backgroundColor = settings.bgColor.toLowerCase();
        if (settings.bg === 'y' || settings.bg === 'n') this.background = settings.bg;
        const before = settings.beforeOll;
        if (before && typeof before === 'object' && validScheme(before.scheme) && PRESETS.includes(before.preset)) {
          this.schemeBeforeOll = { preset: before.preset, scheme: before.scheme };
        }
        if (validScheme(settings.customScheme)) this.customScheme = settings.customScheme;
        else if (this.colorPreset === 'custom') this.customScheme = this.currentScheme();
      },
    },
  };
})();
