const app = Vue.createApp({
  data: () => ({
    parameter: {},
    imageHeight: 128,
    algtype: 'alg',
    algorithm: '',
    algorithm3: false,
    algorithm4: false,
    algorithm5: false,
    algorithm6: false,
    algorithm7: false,
    algorithm8: false,
    faceletsU4: ['u','u','u','u','u','u','u','u','u','u','u','u','u','u','u','u'],
    faceletsR4: ['r','r','r','r','r','r','r','r','r','r','r','r','r','r','r','r'],
    faceletsF4: ['f','f','f','f','f','f','f','f','f','f','f','f','f','f','f','f'],
    faceletsD4: ['d','d','d','d','d','d','d','d','d','d','d','d','d','d','d','d'],
    faceletsL4: ['l','l','l','l','l','l','l','l','l','l','l','l','l','l','l','l'],
    faceletsB4: ['b','b','b','b','b','b','b','b','b','b','b','b','b','b','b','b'],
    faceletsU3: ['u','u','u','u','u','u','u','u','u'],
    faceletsR3: ['r','r','r','r','r','r','r','r','r'],
    faceletsF3: ['f','f','f','f','f','f','f','f','f'],
    faceletsD3: ['d','d','d','d','d','d','d','d','d'],
    faceletsL3: ['l','l','l','l','l','l','l','l','l'],
    faceletsB3: ['b','b','b','b','b','b','b','b','b'],
    faceletsU2: ['u','u','u','u'],
    faceletsR2: ['r','r','r','r'],
    faceletsF2: ['f','f','f','f'],
    faceletsD2: ['d','d','d','d'],
    faceletsL2: ['l','l','l','l'],
    faceletsB2: ['b','b','b','b'],
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
      u:'#fefe00', r:'#ee0000', f:'#0000f2', d:'#ffffff', l:'#ffa100', b:'#00d800', n:'#808080', o:'#c0c0c0', t:'#000000'
    },
    stageMaskList: {
      FL:'fl', F2L:'f2l' , LL:'ll', CLL:'cll', ELL:'ell', OLL:'oll', OCLL:'ocll', 
      OCELL:'ocell', WM:'wm', VH:'vh', ELS:'els', CLS:'cls', CMLL:'cmll', CROSS:'cross', 
      'F2L#1':'f2l_1', 'F2L#2':'f2l_2', 'F2L#3':'f2l_3', 'F2L SM':'f2l_sm', F2B:'f2b', LINE:'line'
    },
    maskAlgList: [
      'x', 'x\'', 'x2', 'y', 'y\'', 'y2', 'z', 'z\'', 'z2',
    ],
  }),
  methods: {
    drawCube: function() {
      this.imageHeight = this.imageSize
      if(this.algorithm) {
        this.algorithm = this.algorithm.replace(/’/g,'\'').trim()
        if(this.algtype === 'alg') {
          this.parameter.algorithm = this.algorithm.trim()
          delete this.parameter.case
        }else if(this.algtype === 'case') {
          this.parameter.case = this.algorithm.trim()
          delete this.parameter.algorithm
        }
      } else {
        delete this.parameter.algorithm
        delete this.parameter.case
      }
      if(this.showFacelets && (this.cubeSize === 4 || this.cubeSize === 3 || this.cubeSize === 2)) {
        delete this.parameter.algorithm
        delete this.parameter.case
        this.parameter.facelets = []
        if(this.cubeSize === 4) {
          for (let i = 0; i < this.faceletsU4.length; i++) { this.parameter.facelets.push(this.faceletsU4[i]) }
          for (let i = 0; i < this.faceletsR4.length; i++) { this.parameter.facelets.push(this.faceletsR4[i]) }
          for (let i = 0; i < this.faceletsF4.length; i++) { this.parameter.facelets.push(this.faceletsF4[i]) }
          for (let i = 0; i < this.faceletsD4.length; i++) { this.parameter.facelets.push(this.faceletsD4[i]) }
          for (let i = 0; i < this.faceletsL4.length; i++) { this.parameter.facelets.push(this.faceletsL4[i]) }
          for (let i = 0; i < this.faceletsB4.length; i++) { this.parameter.facelets.push(this.faceletsB4[i]) }
        } else if(this.cubeSize === 3) {
          for (let i = 0; i < this.faceletsU3.length; i++) { this.parameter.facelets.push(this.faceletsU3[i]) }
          for (let i = 0; i < this.faceletsR3.length; i++) { this.parameter.facelets.push(this.faceletsR3[i]) }
          for (let i = 0; i < this.faceletsF3.length; i++) { this.parameter.facelets.push(this.faceletsF3[i]) }
          for (let i = 0; i < this.faceletsD3.length; i++) { this.parameter.facelets.push(this.faceletsD3[i]) }
          for (let i = 0; i < this.faceletsL3.length; i++) { this.parameter.facelets.push(this.faceletsL3[i]) }
          for (let i = 0; i < this.faceletsB3.length; i++) { this.parameter.facelets.push(this.faceletsB3[i]) }
        } else if(this.cubeSize === 2) {
          for (let i = 0; i < this.faceletsU2.length; i++) { this.parameter.facelets.push(this.faceletsU2[i]) }
          for (let i = 0; i < this.faceletsR2.length; i++) { this.parameter.facelets.push(this.faceletsR2[i]) }
          for (let i = 0; i < this.faceletsF2.length; i++) { this.parameter.facelets.push(this.faceletsF2[i]) }
          for (let i = 0; i < this.faceletsD2.length; i++) { this.parameter.facelets.push(this.faceletsD2[i]) }
          for (let i = 0; i < this.faceletsL2.length; i++) { this.parameter.facelets.push(this.faceletsL2[i]) }
          for (let i = 0; i < this.faceletsB2.length; i++) { this.parameter.facelets.push(this.faceletsB2[i]) }
        }
      } else {
        delete this.parameter.facelets
      }
      this.arrows ? this.parameter.arrows = this.arrows.trim() : delete this.parameter.arrows
      this.cubeSize === 3 ? delete this.parameter.cubeSize : this.parameter.cubeSize = this.cubeSize
      if(this.imageSize === 128) {
        delete this.parameter.width
        delete this.parameter.height
      } else {  
        if(this.imageSize > window.innerWidth * 0.8) {
          this.imageSize = Math.floor(window.innerWidth * 0.8)
        }
        this.parameter.width = this.imageSize
        this.parameter.height = this.imageSize
      }
      this.cubeView === 'normal' ? delete this.parameter.view : this.parameter.view = this.cubeView
      this.stageMask === '' ? delete this.parameter.mask : this.parameter.mask = this.stageMask
      this.maskAlg === '' ? delete this.parameter.maskAlg : this.parameter.maskAlg = this.maskAlg
      if((this.faceU === '#fefe00' && this.faceR === '#ee0000' && this.faceF === '#0000f2'
       && this.faceD === '#ffffff' && this.faceL === '#ffa100' && this.faceB === '#00d800')) {
          delete this.parameter.colorScheme
      } else {
          this.parameter.colorScheme = {
            [this.faceEnum("faceU")]: this.faceU,
            [this.faceEnum("faceR")]: this.faceR,
            [this.faceEnum("faceF")]: this.faceF,
            [this.faceEnum("faceD")]: this.faceD,
            [this.faceEnum("faceL")]: this.faceL,
            [this.faceEnum("faceB")]: this.faceB,
          }
      }
      if((this.rotateAxis1 === 'y' && this.rotateAxis2 === 'x' && this.rotateAxis3 === 'z'
         && this.rotateAngle1 === 45 && this.rotateAngle2 === -34 && this.rotateAngle3 === 0)) {
          delete this.parameter.viewportRotations
      } else {
        this.parameter.viewportRotations = [
          [this.axisEnum(this.rotateAxis1), this.rotateAngle1],
          [this.axisEnum(this.rotateAxis2), this.rotateAngle2],
          [this.axisEnum(this.rotateAxis3), this.rotateAngle3],
        ]
      }
      this.backgroundColor === '#ffffff' ? delete this.parameter.backgroundColor : this.parameter.backgroundColor = this.backgroundColor
      this.cubeColor === '#000000' ? delete this.parameter.cubeColor : this.parameter.cubeColor = this.cubeColor
      this.maskColor === '#404040' ? delete this.parameter.maskColor : this.parameter.maskColor = this.maskColor
      this.cubeOpacity === 100 ? delete this.parameter.cubeOpacity : this.parameter.cubeOpacity = this.cubeOpacity
      this.stickerOpacity === 100 ? delete this.parameter.stickerOpacity : this.parameter.stickerOpacity = this.stickerOpacity
      this.dist === 5 ? delete this.parameter.dist : this.parameter.dist = this.dist

      const element = document.getElementById('visualcube')
      const SRVisualizer = window['sr-visualizer'];
      element.removeChild(element.lastElementChild)
      SRVisualizer.cubePNG(element, this.parameter)
    },
    addAlgorithm(text) {
      if(this.cubeSize >= 6 && !isNaN(text) && (this.algorithm.slice(-1) !== ' ' || this.algorithm === '')) {
        this.algorithm = this.algorithm + text
      } else if (text === '\'' || text === 'w' || !isNaN(text)) {
        this.algorithm = this.algorithm.trimEnd() + text + ' '
      } else {
        this.algorithm = this.algorithm + text + ' '
      }
    },
    resetState() {
      if(this.cubeSize === 4) {
        this.faceletsU4 = ['u','u','u','u','u','u','u','u','u','u','u','u','u','u','u','u']
        this.faceletsR4 = ['r','r','r','r','r','r','r','r','r','r','r','r','r','r','r','r']
        this.faceletsF4 = ['f','f','f','f','f','f','f','f','f','f','f','f','f','f','f','f']
        this.faceletsD4 = ['d','d','d','d','d','d','d','d','d','d','d','d','d','d','d','d']
        this.faceletsL4 = ['l','l','l','l','l','l','l','l','l','l','l','l','l','l','l','l']
        this.faceletsB4 = ['b','b','b','b','b','b','b','b','b','b','b','b','b','b','b','b']
      } else if(this.cubeSize === 3) {
        this.faceletsU3 = ['u','u','u','u','u','u','u','u','u']
        this.faceletsR3 = ['r','r','r','r','r','r','r','r','r']
        this.faceletsF3 = ['f','f','f','f','f','f','f','f','f']
        this.faceletsD3 = ['d','d','d','d','d','d','d','d','d']
        this.faceletsL3 = ['l','l','l','l','l','l','l','l','l']
        this.faceletsB3 = ['b','b','b','b','b','b','b','b','b']
      } else if(this.cubeSize === 2) {
        this.faceletsU2 = ['u','u','u','u']
        this.faceletsR2 = ['r','r','r','r']
        this.faceletsF2 = ['f','f','f','f']
        this.faceletsD2 = ['d','d','d','d']
        this.faceletsL2 = ['l','l','l','l']
        this.faceletsB2 = ['b','b','b','b']
      }
    },
    addArrow() {
      let addText
      if(this.arrowPass === '') {
        addText = this.arrowFace + this.arrowFrom + this.arrowFace + this.arrowTo
      } else {
        addText = this.arrowFace + this.arrowFrom + this.arrowFace + this.arrowTo + this.arrowFace + this.arrowPass
      }
      if(this.arrowScale !== '') addText = addText + '-s' + this.arrowScale
      if(this.arrowInfluence !== '') addText = addText + '-i' + this.arrowInfluence
      if(this.arrowColor !== '#808080') addText = addText + '-' + this.arrowColor.replace('#','')
      
      this.arrows === '' ? this.arrows = addText : this.arrows = this.arrows + ',' + addText
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
      [this.faceU, this.faceB, this.faceD, this.faceF] = [this.faceF, this.faceU, this.faceB, this.faceD]
    },
    rotateY() {
      [this.faceF, this.faceL, this.faceB, this.faceR] = [this.faceR, this.faceF, this.faceL, this.faceB]
    },
    rotateZ() {
      [this.faceU, this.faceR, this.faceD, this.faceL] = [this.faceL, this.faceU, this.faceR, this.faceD]
    },
    resetColor() {
      this.faceU = '#fefe00'
      this.faceR = '#ee0000'
      this.faceF = '#0000f2'
      this.faceD = '#ffffff'
      this.faceL = '#ffa100'
      this.faceB = '#00d800'
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
    axisEnum: function(axis) {
      switch(axis) {
        case 'x': return 0
        case 'y': return 1
        case 'z': return 2   
      }
    },
    faceEnum: function(face) {
      switch(face) {
        case 'faceU': return 0
        case 'faceR': return 1 
        case 'faceF': return 2
        case 'faceD': return 3
        case 'faceL': return 4
        case 'faceB': return 5
      }
    },
  },
  mounted() {
    let SRVisualizer = window['sr-visualizer'];
    let element = document.getElementById('visualcube')
    SRVisualizer.cubePNG(element)
  },
  watch: {
    cubeSize: function(newValue) {
      if(newValue === '') {
        this.cubeSize = 3
        return
      }
      if(newValue > 17) {
        this.cubeSize = 17
        return
      }
      if(newValue < 1) {
        this.cubeSize = 1
        return
      }
      this.arrowNumber = newValue * newValue
      
      if(newValue === 4 || newValue === 3 || newValue === 2) {
        this.algorithmDisabled = false
       } else {
        this.algorithmDisabled = true
        if(this.algtype === 'state') this.algtype = 'alg'
       }

      if(newValue >= 6) this.algorithm3 = true
      if(newValue >= 8) this.algorithm4 = true
      if(newValue >= 10) this.algorithm5 = true
      if(newValue >= 12) this.algorithm6 = true
      if(newValue >= 14) this.algorithm7 = true
      if(newValue >= 16) this.algorithm8 = true
      
      if(newValue < 6) this.algorithm3 = false
      if(newValue < 8) this.algorithm4 = false
      if(newValue < 10) this.algorithm5 = false
      if(newValue < 12) this.algorithm6 = false
      if(newValue < 14) this.algorithm7 = false
      if(newValue < 16) this.algorithm8 = false
      this.drawCube()
    },
    algorithm: function(newValue) {
      this.algorithm = newValue.replace(/[^URFDLBMESurfdlbwxyz2-8\'\s]/,'')
    },
    imageSize: function(newValue) {
      if(newValue > window.innerWidth * 0.8) this.imageSize = Math.floor(window.innerWidth * 0.8)
      if(newValue < 1) this.imageSize = 1
      if(newValue === '') this.imageSize = 128
    },
    rotateAngle1: function(newValue){
      if(newValue > 180) this.rotateAngle1 = 180
      if(newValue < -180) this.rotateAngle1 = -180
      if(newValue === '') this.rotateAngle1 = 45
    },
    rotateAngle2: function(newValue){
      if(newValue > 180) this.rotateAngle2 = 180
      if(newValue < -180) this.rotateAngle2 = -180
      if(newValue === '') this.rotateAngle2 = -34
    },
    rotateAngle3: function(newValue){
      if(newValue > 180) this.rotateAngle3 = 180
      if(newValue < -180) this.rotateAngle3 = -180
      if(newValue === '') this.rotateAngle3 = 0
    },
    cubeOpacity: function(newValue) {
      if(newValue > 100) this.cubeOpacity = 100 
      if(newValue < 0 || newValue === '') this.cubeOpacity = 0
      if(newValue === '') this.cubeOpacity = 100
    },
    stickerOpacity: function(newValue) {
      if(newValue > 100) this.stickerOpacity = 100 
      if(newValue < 0 || newValue === '') this.stickerOpacity = 0
      if(newValue === '') this.stickerOpacity = 100
    },
    dist: function(newValue) {
      if(newValue > 100) this.dist = 100 
      if(newValue < 1) this.dist = 1
      if(newValue === '') this.dist = 5
    },
    algtype: function(newValue) {
      if(newValue === 'state'){
        this.showFacelets = true
      } else {
        this.showFacelets = false
      }
    },
    faceU: function(newValue) {
      this.cubeStateList['u'] = newValue
    },
    faceR: function(newValue) {
      this.cubeStateList['r'] = newValue
    },
    faceF: function(newValue) {
      this.cubeStateList['f'] = newValue
    },
    faceD: function(newValue) {
      this.cubeStateList['d'] = newValue
    },
    faceL: function(newValue) {
      this.cubeStateList['l'] = newValue
    },
    faceB: function(newValue) {
      this.cubeStateList['b'] = newValue
    },
    cubeColor: function(newValue) {
      this.cubeStateList['t'] = newValue
    }
  }
})
const vm = app.mount('#app')
