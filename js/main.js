// 描き直しの管理：最後に描いたパラメータ（同じなら描き直さない）と、描画の通し番号（古い描画の結果を捨てる）
let lastDrawn = null
let drawToken = 0

const app = Vue.createApp({
  // PLL・OLL の選択、自分の手順、Color Preset、Background、Download、設定の保存、URL パラメータ（js/editor-cases.js）
  mixins: [window.EditorCases],
  data: () => ({
    parameter: {},
    imageHeight: 128,
    algtype: 'case', // 初期値は「この手順で揃う状態」（PLL・OLL のケースを選ぶとこれになり、ケースの画像もこの形。?alg= で開いたときは js/editor-cases.js が alg にする）
    algorithm: '',
    algorithm3: false,
    algorithm4: false,
    algorithm5: false,
    algorithm6: false,
    algorithm7: false,
    algorithm8: false,
    faceletsU6: ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u'],
    faceletsR6: ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    faceletsF6: ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f'],
    faceletsD6: ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'],
    faceletsL6: ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'],
    faceletsB6: ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'],
    faceletsU5: ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u'],
    faceletsR5: ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    faceletsF5: ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f'],
    faceletsD5: ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'],
    faceletsL5: ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'],
    faceletsB5: ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'],
    faceletsU4: ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u'],
    faceletsR4: ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    faceletsF4: ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f'],
    faceletsD4: ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'],
    faceletsL4: ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'],
    faceletsB4: ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'],
    faceletsU3: ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u'],
    faceletsR3: ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
    faceletsF3: ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f'],
    faceletsD3: ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd'],
    faceletsL3: ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l'],
    faceletsB3: ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b'],
    faceletsU2: ['u', 'u', 'u', 'u'],
    faceletsR2: ['r', 'r', 'r', 'r'],
    faceletsF2: ['f', 'f', 'f', 'f'],
    faceletsD2: ['d', 'd', 'd', 'd'],
    faceletsL2: ['l', 'l', 'l', 'l'],
    faceletsB2: ['b', 'b', 'b', 'b'],
    faceletsU1: ['u'],
    faceletsR1: ['r'],
    faceletsF1: ['f'],
    faceletsD1: ['d'],
    faceletsL1: ['l'],
    faceletsB1: ['b'],
    showFacelets: false,
    algorithmDisabled: false,
    arrowFace: 'U',
    arrowFrom: '0',
    arrowPass: '',
    arrowTo: '2',
    arrowScale: '',
    arrowInfluence: '',
    arrowColor: '#808080',
    arrowNumber: 9,
    arrows: '',
    cubeSize: 3,
    imageSize: 128,
    imageMin: 100, // Megaminx Image Editor と同じ最小
    imageMax: Math.min(Math.round((window.innerWidth * 0.8) / 100, 0) * 100, 1000),
    cubeView: 'normal',
    stageMask: '',
    maskAlg: '',
    faceU: '#fefe00',
    faceR: '#ee0000',
    faceF: '#0000f2',
    faceD: '#ffffff',
    faceL: '#ffa100',
    faceB: '#00d800',
    rotateAxis1: 'y',
    rotateAxis2: 'x',
    rotateAxis3: 'z',
    rotateAngle1: 45,
    rotateAngle2: -34,
    rotateAngle3: 0,
    backgroundColor: '#ffffff',
    cubeColor: '#000000',
    maskColor: '#404040',
    cubeOpacity: 100,
    stickerOpacity: 100,
    dist: 5,
    faceN: '#808080',
    faceO: '#c0c0c0',
    faceT: '#000000',
    cubeStateList: {
      u: '#fefe00',
      r: '#ee0000',
      f: '#0000f2',
      d: '#ffffff',
      l: '#ffa100',
      b: '#00d800',
      n: '#808080',
      o: '#c0c0c0',
      t: '#000000',
    },
    stageMaskList: {
      FL: 'fl',
      F2L: 'f2l',
      LL: 'll',
      CLL: 'cll',
      ELL: 'ell',
      OLL: 'oll',
      OCLL: 'ocll',
      OELL: 'oell',
      COLL: 'coll',
      OCELL: 'ocell',
      WV: 'wv',
      VH: 'vh',
      ELS: 'els',
      CLS: 'cls',
      CMLL: 'cmll',
      CROSS: 'cross',
      'F2L#1': 'f2l_1',
      'F2L#2': 'f2l_2',
      'F2L#3': 'f2l_3',
      'F2L SM': 'f2l_sm',
      F2B: 'f2b',
      LINE: 'line',
    },
    maskAlgList: ['x', "x'", 'x2', 'y', "y'", 'y2', 'z', "z'", 'z2'],
    drawFlag: true,
    lang: window.I18N.lang, // 今の言語（js/i18n.js）。切り替えると t() を使っている場所が描き直される
  }),
  created() {
    window.I18N.onChange((lang) => {
      this.lang = lang
    })
  },
  methods: {
    // 訳した文（js/i18n.js）。テンプレートでは {{ t('editor.algorithm') }} のように使う
    t: function (key, params) {
      return this.lang ? window.I18N.t(key, params) : key
    },
    drawCube: function () {
      const element = document.getElementById('visualcube')
      if (!element) return // まだ画面に無い（created の中から呼ばれたとき）。mounted で描く
      this.imageHeight = this.imageSize
      // 描画に渡す手順。3x3 では括弧と繰り返しを展開したもの（js/editor-cases.js の algForDraw）。
      // 読めない手順（null）のときは、欄の下にエラーを出したまま前の画像を残す。
      // まだ1枚も描いていない（?alg= に読めない手順を入れて開いた）ときは、手順なしで描く
      let algorithm = this.algorithm && this.algtype !== 'state' ? this.algForDraw() : ''
      if (algorithm === null) {
        if (lastDrawn !== null) return
        algorithm = ''
      }
      if (algorithm) {
        if (this.algtype === 'alg') {
          this.parameter.algorithm = algorithm
          delete this.parameter.case
        } else if (this.algtype === 'case') {
          this.parameter.case = algorithm
          delete this.parameter.algorithm
        }
      } else {
        delete this.parameter.algorithm
        delete this.parameter.case
      }
      if (this.showFacelets && this.cubeSize <= 6) {
        delete this.parameter.algorithm
        delete this.parameter.case
        this.parameter.facelets = []
        if (this.cubeSize === 6) {
          for (let i = 0; i < this.faceletsU6.length; i++) {
            this.parameter.facelets.push(this.faceletsU6[i])
          }
          for (let i = 0; i < this.faceletsR6.length; i++) {
            this.parameter.facelets.push(this.faceletsR6[i])
          }
          for (let i = 0; i < this.faceletsF6.length; i++) {
            this.parameter.facelets.push(this.faceletsF6[i])
          }
          for (let i = 0; i < this.faceletsD6.length; i++) {
            this.parameter.facelets.push(this.faceletsD6[i])
          }
          for (let i = 0; i < this.faceletsL6.length; i++) {
            this.parameter.facelets.push(this.faceletsL6[i])
          }
          for (let i = 0; i < this.faceletsB6.length; i++) {
            this.parameter.facelets.push(this.faceletsB6[i])
          }
        } else if (this.cubeSize === 5) {
          for (let i = 0; i < this.faceletsU5.length; i++) {
            this.parameter.facelets.push(this.faceletsU5[i])
          }
          for (let i = 0; i < this.faceletsR5.length; i++) {
            this.parameter.facelets.push(this.faceletsR5[i])
          }
          for (let i = 0; i < this.faceletsF5.length; i++) {
            this.parameter.facelets.push(this.faceletsF5[i])
          }
          for (let i = 0; i < this.faceletsD5.length; i++) {
            this.parameter.facelets.push(this.faceletsD5[i])
          }
          for (let i = 0; i < this.faceletsL5.length; i++) {
            this.parameter.facelets.push(this.faceletsL5[i])
          }
          for (let i = 0; i < this.faceletsB5.length; i++) {
            this.parameter.facelets.push(this.faceletsB5[i])
          }
        } else if (this.cubeSize === 4) {
          for (let i = 0; i < this.faceletsU4.length; i++) {
            this.parameter.facelets.push(this.faceletsU4[i])
          }
          for (let i = 0; i < this.faceletsR4.length; i++) {
            this.parameter.facelets.push(this.faceletsR4[i])
          }
          for (let i = 0; i < this.faceletsF4.length; i++) {
            this.parameter.facelets.push(this.faceletsF4[i])
          }
          for (let i = 0; i < this.faceletsD4.length; i++) {
            this.parameter.facelets.push(this.faceletsD4[i])
          }
          for (let i = 0; i < this.faceletsL4.length; i++) {
            this.parameter.facelets.push(this.faceletsL4[i])
          }
          for (let i = 0; i < this.faceletsB4.length; i++) {
            this.parameter.facelets.push(this.faceletsB4[i])
          }
        } else if (this.cubeSize === 3) {
          for (let i = 0; i < this.faceletsU3.length; i++) {
            this.parameter.facelets.push(this.faceletsU3[i])
          }
          for (let i = 0; i < this.faceletsR3.length; i++) {
            this.parameter.facelets.push(this.faceletsR3[i])
          }
          for (let i = 0; i < this.faceletsF3.length; i++) {
            this.parameter.facelets.push(this.faceletsF3[i])
          }
          for (let i = 0; i < this.faceletsD3.length; i++) {
            this.parameter.facelets.push(this.faceletsD3[i])
          }
          for (let i = 0; i < this.faceletsL3.length; i++) {
            this.parameter.facelets.push(this.faceletsL3[i])
          }
          for (let i = 0; i < this.faceletsB3.length; i++) {
            this.parameter.facelets.push(this.faceletsB3[i])
          }
        } else if (this.cubeSize === 2) {
          for (let i = 0; i < this.faceletsU2.length; i++) {
            this.parameter.facelets.push(this.faceletsU2[i])
          }
          for (let i = 0; i < this.faceletsR2.length; i++) {
            this.parameter.facelets.push(this.faceletsR2[i])
          }
          for (let i = 0; i < this.faceletsF2.length; i++) {
            this.parameter.facelets.push(this.faceletsF2[i])
          }
          for (let i = 0; i < this.faceletsD2.length; i++) {
            this.parameter.facelets.push(this.faceletsD2[i])
          }
          for (let i = 0; i < this.faceletsL2.length; i++) {
            this.parameter.facelets.push(this.faceletsL2[i])
          }
          for (let i = 0; i < this.faceletsB2.length; i++) {
            this.parameter.facelets.push(this.faceletsB2[i])
          }
        } else if (this.cubeSize === 1) {
          this.parameter.facelets.push(this.faceletsU1[0])
          this.parameter.facelets.push(this.faceletsR1[0])
          this.parameter.facelets.push(this.faceletsF1[0])
          this.parameter.facelets.push(this.faceletsD1[0])
          this.parameter.facelets.push(this.faceletsL1[0])
          this.parameter.facelets.push(this.faceletsB1[0])
        }
      } else {
        delete this.parameter.facelets
      }
      this.arrows ? (this.parameter.arrows = this.arrows.trim()) : delete this.parameter.arrows
      this.cubeSize === 3 ? delete this.parameter.cubeSize : (this.parameter.cubeSize = this.cubeSize)
      if (this.imageSize === 128) {
        delete this.parameter.width
        delete this.parameter.height
      } else {
        this.parameter.width = this.imageSize
        this.parameter.height = this.imageSize
      }
      this.cubeView === 'normal' ? delete this.parameter.view : (this.parameter.view = this.cubeView)
      this.stageMask === '' ? delete this.parameter.mask : (this.parameter.mask = this.stageMask)
      this.maskAlg === '' ? delete this.parameter.maskAlg : (this.parameter.maskAlg = this.maskAlg)
      if (this.faceU === '#fefe00' && this.faceR === '#ee0000' && this.faceF === '#0000f2' && this.faceD === '#ffffff' && this.faceL === '#ffa100' && this.faceB === '#00d800') {
        delete this.parameter.colorScheme
      } else {
        this.parameter.colorScheme = {
          [this.faceEnum('faceU')]: this.faceU,
          [this.faceEnum('faceR')]: this.faceR,
          [this.faceEnum('faceF')]: this.faceF,
          [this.faceEnum('faceD')]: this.faceD,
          [this.faceEnum('faceL')]: this.faceL,
          [this.faceEnum('faceB')]: this.faceB,
        }
      }
      if (this.rotateAxis1 === 'y' && this.rotateAxis2 === 'x' && this.rotateAxis3 === 'z' && this.rotateAngle1 === 45 && this.rotateAngle2 === -34 && this.rotateAngle3 === 0) {
        delete this.parameter.viewportRotations
      } else {
        this.parameter.viewportRotations = [
          [this.axisEnum(this.rotateAxis1), this.rotateAngle1],
          [this.axisEnum(this.rotateAxis2), this.rotateAngle2],
          [this.axisEnum(this.rotateAxis3), this.rotateAngle3],
        ]
      }
      // 背景：Transparent（既定）なら塗らない、Opaque なら Background Color で塗る
      this.background === 'n' ? (this.parameter.backgroundColor = this.backgroundColor) : delete this.parameter.backgroundColor
      this.cubeColor === '#000000' ? delete this.parameter.cubeColor : (this.parameter.cubeColor = this.cubeColor)
      this.maskColor === '#404040' ? delete this.parameter.maskColor : (this.parameter.maskColor = this.maskColor)
      this.cubeOpacity === 100 ? delete this.parameter.cubeOpacity : (this.parameter.cubeOpacity = this.cubeOpacity)
      this.stickerOpacity === 100 ? delete this.parameter.stickerOpacity : (this.parameter.stickerOpacity = this.stickerOpacity)
      this.dist === 5 ? delete this.parameter.dist : (this.parameter.dist = this.dist)

      // 同じ内容なら描き直さない。新しい画像は別の場所で作り、できあがってから差し替える
      // （続けて呼ばれても、古い画像が残ったり、画像が2枚並んだりしないように。最後に呼んだものだけを出す）
      const key = JSON.stringify(this.parameter)
      if (key === lastDrawn) return
      lastDrawn = key
      const token = ++drawToken
      const SRVisualizer = window['sr-visualizer']
      const holder = document.createElement('div')
      SRVisualizer.cubePNG(holder, this.parameter)
      // cubePNG は setTimeout の中で img を足し、そのあと画像を読み込む
      setTimeout(() => {
        const img = holder.querySelector('img')
        if (!img) return
        img.addEventListener('load', () => {
          if (token === drawToken) element.replaceChildren(img)
        })
      })
    },
    // 画像サイズの「リセット」：既定の 128 に戻す（上限が 128 より小さい画面では上限）
    resetSize() {
      this.imageSize = Math.max(this.imageMin, Math.min(128, this.imageMax))
    },
    // 画像サイズの入力欄を確定したとき：整数に丸めて imageMin〜imageMax に収める。空・数でないときは今の値に戻す
    onImageSizeChange(e) {
      const n = Math.round(Number(e.target.value))
      if (e.target.value !== '' && Number.isFinite(n)) {
        this.imageSize = Math.max(this.imageMin, Math.min(this.imageMax, n))
      }
      e.target.value = this.imageSize // 範囲外を入れたときも、欄の表示を実際の値にそろえる
    },
    addAlgorithm(text) {
      if (this.cubeSize >= 6 && !isNaN(text) && (this.algorithm.slice(-1) !== ' ' || this.algorithm === '')) {
        this.algorithm = this.algorithm + text
      } else if (text === "'" || text === 'w' || text === ')' || !isNaN(text)) {
        this.algorithm = this.algorithm.trimEnd() + text + ' '
      } else if (text === '(') {
        this.algorithm = this.algorithm + text
      } else {
        this.algorithm = this.algorithm + text + ' '
      }
    },
    resetState() {
      if (this.cubeSize === 6) {
        this.faceletsU6 = ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u']
        this.faceletsR6 = ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']
        this.faceletsF6 = ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f']
        this.faceletsD6 = ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd']
        this.faceletsL6 = ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l']
        this.faceletsB6 = ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b']
      } else if (this.cubeSize === 5) {
        this.faceletsU5 = ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u']
        this.faceletsR5 = ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']
        this.faceletsF5 = ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f']
        this.faceletsD5 = ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd']
        this.faceletsL5 = ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l']
        this.faceletsB5 = ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b']
      } else if (this.cubeSize === 4) {
        this.faceletsU4 = ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u']
        this.faceletsR4 = ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']
        this.faceletsF4 = ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f']
        this.faceletsD4 = ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd']
        this.faceletsL4 = ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l']
        this.faceletsB4 = ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b']
      } else if (this.cubeSize === 3) {
        this.faceletsU3 = ['u', 'u', 'u', 'u', 'u', 'u', 'u', 'u', 'u']
        this.faceletsR3 = ['r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']
        this.faceletsF3 = ['f', 'f', 'f', 'f', 'f', 'f', 'f', 'f', 'f']
        this.faceletsD3 = ['d', 'd', 'd', 'd', 'd', 'd', 'd', 'd', 'd']
        this.faceletsL3 = ['l', 'l', 'l', 'l', 'l', 'l', 'l', 'l', 'l']
        this.faceletsB3 = ['b', 'b', 'b', 'b', 'b', 'b', 'b', 'b', 'b']
      } else if (this.cubeSize === 2) {
        this.faceletsU2 = ['u', 'u', 'u', 'u']
        this.faceletsR2 = ['r', 'r', 'r', 'r']
        this.faceletsF2 = ['f', 'f', 'f', 'f']
        this.faceletsD2 = ['d', 'd', 'd', 'd']
        this.faceletsL2 = ['l', 'l', 'l', 'l']
        this.faceletsB2 = ['b', 'b', 'b', 'b']
      } else if (this.cubeSize === 1) {
        this.faceletsU2 = ['u']
        this.faceletsR2 = ['r']
        this.faceletsF2 = ['f']
        this.faceletsD2 = ['d']
        this.faceletsL2 = ['l']
        this.faceletsB2 = ['b']
      }
    },
    addArrow() {
      let addText
      if (this.arrowPass === '') {
        addText = this.arrowFace + this.arrowFrom + this.arrowFace + this.arrowTo
      } else {
        addText = this.arrowFace + this.arrowFrom + this.arrowFace + this.arrowTo + this.arrowFace + this.arrowPass
      }
      if (this.arrowScale !== '') addText = addText + '-s' + this.arrowScale
      if (this.arrowInfluence !== '') addText = addText + '-i' + this.arrowInfluence
      if (this.arrowColor !== '#808080') addText = addText + '-' + this.arrowColor.replace('#', '')

      this.arrows === '' ? (this.arrows = addText) : (this.arrows = this.arrows + ',' + addText)
    },
    resetArrow() {
      this.arrowFace = 'U'
      this.arrowFrom = '0'
      this.arrowPass = ''
      this.arrowTo = '2'
      this.arrowScale = ''
      this.arrowInfluence = ''
      this.arrowColor = '#808080'
    },
    rotateX() {
      ;[this.faceU, this.faceB, this.faceD, this.faceF] = [this.faceF, this.faceU, this.faceB, this.faceD]
      this.drawRotate = true
    },
    rotateY() {
      ;[this.faceF, this.faceL, this.faceB, this.faceR] = [this.faceR, this.faceF, this.faceL, this.faceB]
      this.drawRotate = true
    },
    rotateZ() {
      ;[this.faceU, this.faceR, this.faceD, this.faceL] = [this.faceL, this.faceU, this.faceR, this.faceD]
      this.drawRotate = true
    },
    resetColor() {
      this.faceU = '#fefe00'
      this.faceR = '#ee0000'
      this.faceF = '#0000f2'
      this.faceD = '#ffffff'
      this.faceL = '#ffa100'
      this.faceB = '#00d800'
    },
    restRotateAngle1() {
      this.rotateAngle1 = 45
    },
    restRotateAngle2() {
      this.rotateAngle2 = -34
    },
    restRotateAngle3() {
      this.rotateAngle3 = 0
    },
    incrementNumber(number, max, step) {
      return number < max && number + step <= max ? number + step : number
    },
    decrementNumber(number, min, step) {
      return number > min && number - step >= min ? number - step : number
    },
    clearAlgorithm() {
      this.algorithm = ''
    },
    clearArrows() {
      this.arrows = ''
    },
    resetBackground() {
      this.backgroundColor = '#ffffff'
    },
    resetCubecolor() {
      this.cubeColor = '#000000'
    },
    resetMaskcolor() {
      this.maskColor = '#404040'
    },
    restCubeOpacity() {
      this.cubeOpacity = 100
    },
    resetStickerOpacity() {
      this.stickerOpacity = 100
    },
    resetDist() {
      this.dist = 5
    },
    axisEnum: function (axis) {
      switch (axis) {
        case 'x':
          return 0
        case 'y':
          return 1
        case 'z':
          return 2
      }
    },
    faceEnum: function (face) {
      switch (face) {
        case 'faceU':
          return 0
        case 'faceR':
          return 1
        case 'faceF':
          return 2
        case 'faceD':
          return 3
        case 'faceL':
          return 4
        case 'faceB':
          return 5
      }
    },
  },
  watch: {
    cubeSize: function (newValue) {
      if (newValue === '') {
        this.cubeSize = 3
        return
      }
      if (newValue > 17) {
        this.cubeSize = 17
        return
      }
      if (newValue < 1) {
        this.cubeSize = 1
        return
      }
      this.arrowNumber = newValue * newValue

      if (newValue <= 6) {
        this.algorithmDisabled = false
      } else {
        this.algorithmDisabled = true
        if (this.algtype === 'state') this.algtype = 'alg'
        this.drawFlag = false
      }

      if (newValue >= 6) this.algorithm3 = true
      if (newValue >= 8) this.algorithm4 = true
      if (newValue >= 10) this.algorithm5 = true
      if (newValue >= 12) this.algorithm6 = true
      if (newValue >= 14) this.algorithm7 = true
      if (newValue >= 16) this.algorithm8 = true

      if (newValue < 6) this.algorithm3 = false
      if (newValue < 8) this.algorithm4 = false
      if (newValue < 10) this.algorithm5 = false
      if (newValue < 12) this.algorithm6 = false
      if (newValue < 14) this.algorithm7 = false
      if (newValue < 16) this.algorithm8 = false
      this.drawCube()
    },
    algtype: function (newValue) {
      if (newValue === 'state') {
        this.showFacelets = true
      } else {
        this.showFacelets = false
      }
      if (this.drawFlag) {
        this.drawCube()
      }
    },
    faceletsU6: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsR6: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsF6: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsD6: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsL6: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsB6: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsU5: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsR5: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsF5: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsD5: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsL5: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsB5: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsU4: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsR4: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsF4: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsD4: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsL4: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsB4: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsU3: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsR3: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsF3: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsD3: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsL3: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsB3: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsU2: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsR2: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsF2: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsD2: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsL2: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsB2: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsU1: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsR1: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsF1: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsD1: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsL1: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    faceletsB1: {
      handler: function () {
        if (this.drawFlag) {
          this.drawCube()
          this.drawFlag = false
        }
      },
      deep: true,
    },
    algorithm: _.debounce(function (newValue) {
      this.drawCube()
    }, 500),
    arrows: function () {
      this.drawCube()
    },
    imageSize: _.debounce(function () {
      this.drawCube()
    }, 100),
    cubeView: function () {
      this.drawCube()
    },
    stageMask: function () {
      this.drawCube()
    },
    maskAlg: function () {
      this.drawCube()
    },
    faceU: function (newValue) {
      this.cubeStateList['u'] = newValue
      if (this.drawFlag) {
        this.drawCube()
        this.drawFlag = false
      }
    },
    faceR: function (newValue) {
      this.cubeStateList['r'] = newValue
      if (this.drawFlag) {
        this.drawCube()
        this.drawFlag = false
      }
    },
    faceF: function (newValue) {
      this.cubeStateList['f'] = newValue
      if (this.drawFlag) {
        this.drawCube()
        this.drawFlag = false
      }
    },
    faceD: function (newValue) {
      this.cubeStateList['d'] = newValue
      if (this.drawFlag) {
        this.drawCube()
        this.drawFlag = false
      }
    },
    faceL: function (newValue) {
      this.cubeStateList['l'] = newValue
      if (this.drawFlag) {
        this.drawCube()
        this.drawFlag = false
      }
    },
    faceB: function (newValue) {
      this.cubeStateList['b'] = newValue
      if (this.drawFlag) {
        this.drawCube()
        this.drawFlag = false
      }
    },
    rotateAxis1: function () {
      this.drawCube()
    },
    rotateAxis2: function () {
      this.drawCube()
    },
    rotateAxis3: function () {
      this.drawCube()
    },
    rotateAngle1: _.debounce(function () {
      this.drawCube()
    }, 100),
    rotateAngle2: _.debounce(function () {
      this.drawCube()
    }, 100),
    rotateAngle3: _.debounce(function () {
      this.drawCube()
    }, 100),
    backgroundColor: function () {
      this.drawCube()
    },
    cubeColor: function (newValue) {
      this.cubeStateList['t'] = newValue
      this.drawCube()
    },
    maskColor: function () {
      this.drawCube()
    },
    cubeOpacity: _.debounce(function () {
      this.drawCube()
    }, 100),
    stickerOpacity: _.debounce(function () {
      this.drawCube()
    }, 100),
    dist: _.debounce(function () {
      this.drawCube()
    }, 100),
  },
  mounted() {
    // 保存してある設定・URL パラメータ（js/editor-cases.js の created で反映済み）で描く
    this.drawCube()
    // 上に残した画像の高さを CSS に渡す（入力欄までスクロールしたときに画像の下に隠れないように。css/common.css の scroll-padding-top）
    const preview = document.getElementById('editorPreview')
    if (preview && typeof ResizeObserver === 'function') {
      new ResizeObserver(() => {
        document.documentElement.style.setProperty('--editor-preview-height', Math.ceil(preview.getBoundingClientRect().height) + 'px')
      }).observe(preview)
    }
  },
  updated() {
    this.drawFlag = true
  },
})
app.mount('#app')
