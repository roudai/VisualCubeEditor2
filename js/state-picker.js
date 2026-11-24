// エディタ（index.html）の「色を直接指定」で、上の画像のステッカーを押して色を選ぶ。js/main.js の Vue アプリに mixin として組み込む（window.StatePicker）。
// MegaminxImageEditor 1b532b5（state-editor.js の画像のクリック）に当たる。仕様: reference/PLL_SPEC.md「色を直接指定」
//
// - 反応するのは、色を直接指定・3x3・Plan 表示のときだけ（ほかの大きさ・表示は当たり判定を作っていない）。そのときだけカーソルを指にする（.pickable）
// - 押したステッカー（js/plan-hit.js の hitTest。U 面の 9 枚と側面の上の段の縁）の色のパレットを、押した位置の下に出す。
//   パレットは下のプルダウンと同じ選択肢（u r f d l b n o t）。u〜b は画像と同じ今の配色の色で出す
// - 同じステッカーをもう一度押す・パレットの外を押す・Esc・スクロール・画面の大きさの変更で閉じる
//   （画像は画面の上に残るが、パレットはその場に置いているので、スクロールしたら閉じる）
// - 選ぶと下のプルダウンと同じ facelets（faceletsU3 など）を書き換える（描き直しは main.js の watch）
(function () {
  'use strict';
  const H = window.PlanHit;
  const PALETTE_WIDTH = 5 * 32 + 4 * 6 + 2 * 8; // 5 列（32px・間 6px・内側 8px）。左右がはみ出さないように置くのに使う

  window.StatePicker = {
    data: () => ({
      picker: null, // 開いているパレット { face, index, left, top }。閉じていれば null
    }),
    computed: {
      // 画像のステッカーを押して色を選べるか
      canPickSticker() {
        return this.algtype === 'state' && this.cubeSize === 3 && this.cubeView === 'plan';
      },
      // パレットの選択肢（下のプルダウンと同じ並び）。u〜b は今の配色（画像と同じ色）
      pickerColors() {
        const scheme = { u: this.faceU, r: this.faceR, f: this.faceF, d: this.faceD, l: this.faceL, b: this.faceB };
        return Object.keys(this.cubeStateList).map((key) => ({ key: key, color: scheme[key] || this.cubeStateList[key] }));
      },
      // 開いているステッカーの今の色（選ばれている印を付ける）
      pickerValue() {
        if (!this.picker) return null;
        return this['facelets' + this.picker.face + '3'][this.picker.index];
      },
    },
    watch: {
      // 押せなくなったら閉じる（種類・大きさ・表示を変えたとき）
      canPickSticker(on) {
        if (!on) this.closePicker();
      },
    },
    methods: {
      onPreviewClick(e) {
        if (!this.canPickSticker || !e.target || e.target.tagName !== 'IMG') return;
        const rect = e.target.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        // 表示は CSS で縮む（画面の高さの 35% まで）ので、表示の座標を srVisualizer の座標（-0.9〜0.9）に直す
        const x = -0.9 + ((e.clientX - rect.left) / rect.width) * 1.8;
        const y = -0.9 + ((e.clientY - rect.top) / rect.height) * 1.8;
        const hit = H.hitTest(x, y, this.dist);
        if (!hit) return; // 背景：document の click で閉じる
        e.stopPropagation();
        if (this.picker && this.picker.face === hit.face && this.picker.index === hit.index) {
          this.closePicker();
          return;
        }
        const width = document.documentElement.clientWidth;
        const left = Math.max(8, Math.min(e.clientX - PALETTE_WIDTH / 2, width - PALETTE_WIDTH - 8));
        this.picker = { face: hit.face, index: hit.index, left: left, top: e.clientY + 8 };
        // 今の色（無ければ先頭）にフォーカス。画面が動かないように preventScroll
        this.$nextTick(() => {
          const box = document.getElementById('stickerPicker');
          const target = box && (box.querySelector('.selected') || box.querySelector('button'));
          if (target) target.focus({ preventScroll: true });
        });
      },
      choosePickerColor(key) {
        if (!this.picker) return;
        this['facelets' + this.picker.face + '3'][this.picker.index] = key;
        this.closePicker();
      },
      closePicker() {
        this.picker = null;
      },
    },
    mounted() {
      const close = () => {
        if (this.picker) this.closePicker();
      };
      document.addEventListener('click', (e) => {
        const box = document.getElementById('stickerPicker');
        if (box && box.contains(e.target)) return;
        close();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
      });
      window.addEventListener('resize', close);
      window.addEventListener('scroll', close, { passive: true });
    },
  };
})();
