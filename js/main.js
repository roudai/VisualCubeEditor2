const app = Vue.createApp({
  data: () => ({
    algtype: 'alg',
    algorithm: '',
    arrowFace: 'U',
    arrowFrom: '0',
    arrowPass: '',
    arrowTo: '2',
    arrowScale: '',
    arrowInfluence: '',
    arrowColor: '#808080',
    arrows: '',
    cubeSize: 3,
    imageSize: 128,
    cubeView: 'normal',
    stageMask: '-',
    maskAlg: '-',
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
  }),
  methods: {
    drawCube: function() {
      const SRVisualizer = window['sr-visualizer'];
      const element = document.getElementById('visualcube')
      element.removeChild(element.lastElementChild)

      let algorithmData, caseData
      if(this.algtype === 'alg') {
        algorithmData = this.algorithm
      }else if(this.algtype === 'case') {
        caseData = this.algorithm
      }
      if(this.stageMask === '-') this.stageMask = ''
      if(this.maskAlg === '-') this.maskAlg = ''

      if(this.imageSize > window.innerWidth * 0.8) {
        this.imageSize = window.innerWidth * 0.8
      }

      SRVisualizer.cubePNG(element, {
        algorithm: algorithmData,
        case: caseData,
        arrows: this.arrows,
        cubeSize: this.cubeSize,
        width: this.imageSize,
        height: this.imageSize,
        view: this.cubeView,
        mask: this.stageMask,
        maskAlg: this.maskAlg,
        colorScheme: {
          [this.faceEnum("faceU")]: this.faceU,
          [this.faceEnum("faceR")]: this.faceR,
          [this.faceEnum("faceF")]: this.faceF,
          [this.faceEnum("faceD")]: this.faceD,
          [this.faceEnum("faceL")]: this.faceL,
          [this.faceEnum("faceB")]: this.faceB,
        },
        viewportRotations: [
          [this.axisEnum(this.rotateAxis1), this.rotateAngle1],
          [this.axisEnum(this.rotateAxis2), this.rotateAngle2],
          [this.axisEnum(this.rotateAxis3), this.rotateAngle3],
        ],
        backgroundColor: this.backgroundColor,
        cubeColor: this.cubeColor,
        maskColor: this.maskColor,
        cubeOpacity: this.cubeOpacity,
        stickerOpacity: this.stickerOpacity,
        dist: this.dist,
      })
    },
    addAlgorithm(text) {
      if(text === '\'' || text === 'w' || text === '2') {
        this.algorithm = this.algorithm.trimEnd() + text + ' '
      } else {
        this.algorithm = this.algorithm + text + ' '
      }
    },
    addArrow() {
      let addText
      if(this.arrowPass === '') {
        addText = this.arrowFace + this.arrowFrom + this.arrowFace + this.arrowTo
      } else {
        addText = this.arrowFace + this.arrowFrom + this.arrowFace + this.arrowPass + this.arrowFace + this.arrowTo
      }
      if(this.arrowScale !== '') addText = addText + '-s' + this.arrowScale
      if(this.arrowInfluence !== '') addText = addText + '-i' + this.arrowInfluence
      if(this.arrowColor !== '#808080') addText = addText + '-' + this.arrowColor.replace('#','')
      
      this.arrows === '' ? this.arrows = addText : this.arrows = this.arrows + ',' + addText
    },
    clearArrow() {
      this.arrowFace = 'U'
      this.arrowFrom = '0'
      this.arrowPass = ''
      this.arrowTo = '2'
      this.arrowScale = ''
      this.arrowInfluence = ''
      this.arrowColor = '#808080'
    },
    incrementNumber(number, max, step) {
      return number < max && number + step <= max ? number + step : number
    },
    decrementNumber(number, min, step) {
      return number > min && number - step >= min ? number - step : number
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
})
const vm = app.mount('#app')

