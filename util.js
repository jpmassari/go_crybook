let _ = require('lodash')
let tf = global.tf
const Binance = require('node-binance-api');

let fs = require('fs')
let fsp = require('fs-path')
let inputOpt = {}
const MessagePack = require('what-t\\he-pack');
const { WEMA } = require('technicalindicators');
const {
  encode,
  decode
} = MessagePack.initialize(2 ** 30); // 4MB
let loadJSON = global.loadJSON = function (path) {
  if (fs.existsSync(path)) {
    let rawData = fs.readFileSync(path)
    try {
      let data = JSON.parse(rawData)
      return data
    } catch (e) {
      console.log('erro na leitura ', path)
      return false
    }


  }
  return false
}

let tempOpt = loadJSON('./opt.json')
for (let x in process.argv) {
  let a = process.argv[x]
  if (a.includes('--')) {
    a = a.replace('--', '')
    if (a.includes('=')) {
      let k = a.split('=')[0]
      let v = a.split('=')[1]
      if (k.includes(':number')) {
        k = k.replace(':number', '')
        v = v / 1
      }
      if (k.includes(':bool')) {
        k = k.replace(':bool', '')
        v = v == 'true' ? true : false
      }

      _.set(inputOpt, k, v)
    } else {
      _.set(inputOpt, k, true)
    }

  }

}

function outerDif(a, b) {
  b = b || a
  let c = []

  for (let x = 0; x < a.length; x++) {
    for (let xa = x; xa < b.length; xa++) {
      let k = difa(a[x], b[xa])
      c.push(k)
    }
  }
  return c
}
function dotp(x, y) {
  function dotp_sum(a, b) {
    return a + b;
  }
  function dotp_times(a, i) {
    return x[i] * y[i];
  }
  return x.map(dotp_times).reduce(dotp_sum, 0);
}

function cosineSimilarity(A, B) {
  var similarity = dotp(A, B) / (Math.sqrt(dotp(A, A)) * Math.sqrt(dotp(B, B)));
  return similarity;
}

function outerSub(a, b) {
  b = b || a
  let c = []

  for (let x = 0; x < a.length; x++) {
    c[x] = []
    for (let xa = 0; xa < b.length; xa++) {
      let k = difa(a[x], b[xa])
      c[x][xa] = k / .01
    }
  }
  return c
}

function outerMask(a, b) {
  b = b || a
  let c = []

  for (let x = 0; x < a.length; x++) {
    for (let xa = x; xa < b.length; xa++) {
      let k = difa(a[x], b[xa]) > 0.005 ? 1 : 0
      c.push(k)
    }
  }
  return c
}

function getPositionEncoding(seq_len, d, n = 10000) {
  let P = tf.zeros([seq_len, d]).arraySync()
  for (let k = 0; k < seq_len; k++) {
    for (let i = 0; i < Math.floor(d / 2); i++) {
      let denominator = Math.pow(n, (2 * i) / d);

      P[k][2 * i] = Math.sin(k / denominator);
      P[k][2 * (i + 1)] = Math.cos(k / denominator);





    }
  }
  console.log(P)
  return P;
}
let echarts = inputOpt.chart ? require('node-echarts-canvas') : ''
function createBinaryVec(nMask, n) {
  let a = Array(n - 32).fill(0)
  for (var nFlag = 0, nShifted = nMask, sMask = ""; nFlag < 32;
    nFlag++, sMask += String(nShifted >>> 31), nShifted <<= 1);
  return sMask.split('').map(s => s / 1).concat(a)
}
function drawChartRL(data1, coin = Date.now().toTimeString(), cfg = {
  axis: [],
  legend: [],
  limit: 5000,
  types: [],
  colors: [],
  area: [],
  width: []
}) {
  let cfg1 = cfg || {
    legend: [],
    limit: 5000,
    types: [],
    colors: [],
    area: [],
    axis: [],
    width: []
  }
  cfg = _.merge(cfg1, {
    legend: [],
    limit: 5000,
    types: [],
    colors: [],
    area: [],
    axis: [],
    width: []
  })

  let legend = cfg.legend
  let colors = cfg.colors || []
  let types = cfg.types || []
  let limit = cfg.limit || 1000
  let charts = data1.length > limit ? Math.round(data1.length / limit) : 1
  let dataCandle = data1.map(f => f.slice(0, 4))
  data1 = data1.map(s => {
    s.splice(0, 4)
    return s
  })
  for (let i = 0; i < charts; i++) {
    let dc = dataCandle.slice(i * limit, (i + 1) * limit)
    let series = []
    series.push({
      type: 'candlestick',
      name: 'candle',
      barWidth: '100%',
      data: dc,
      itemStyle: {
        color: '#ef232a',
        color0: '#14b143',
        borderColor: '#ef232a',
        borderColor0: '#14b143'
      },
      emphasis: {
        itemStyle: {
          color: 'black',
          color0: '#444',
          borderColor: 'black',
          borderColor0: '#444'
        }
      }
    })
    let yAxis = [{
      scale: true,

      type: 'value'
    }, {
      scale: true,

      type: 'value'
    }]
    let data = data1.slice(i * limit, (i + 1) * limit)


    let size = data[0].length
    for (let y = 0; y < size; y++) {
      let s = {
        smooth: false,
        showSymbol: false,



        name: legend ? legend[y] : 'serie-' + y,
        data: data.map(f => f[y]),
        type: types[y] || 'line',
        color: colors[y] || null,

        yAxisIndex: cfg.axis[y] || y + 1,
      }
      s.lineStyle = {
        width: cfg.width[y] ? cfg.width[y] : 2
      }

      if (cfg.area[y]) {
        s.areaStyle = {
          color: colors[y] || null,
          opacity: cfg.area[y]
        }
        s.lineStyle = {
          width: 0
        }
      }
      let a = {
        type: 'category',
        data: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        axisLine: {
          show: false
        },
        scale: true,
        type: 'value',
      }
      series.push(s)
      yAxis.push(a)
    }


    let option = {

      width: 10000,
      height: 1000,
      option: {
        legend: {},
        backgroundColor: 'white',
        background: 'white',
        backgroundcolor: 'white',
        xAxis: {
          type: 'category',
          data: data.map((f, c) => c)
        },
        dataZoom: {},
        yAxis,
        series
      },

      path: './charts/' + coin + ' ' + (i * 500) + '.png',
      enableAutoDispose: true
    };
    echarts(option)
  }
}

function drawChartLine(data1, coin = Date.now().toTimeString(), cfg = {
  axis: [],
  legend: [],
  limit: 50000,
  types: [],
  colors: [],
  area: [],
  width: []
}) {
  let cfg1 = cfg || {
    legend: [],
    limit: 58000,
    types: [],
    colors: [],
    area: [],
    axis: [],
    width: []
  }
  cfg = _.merge(cfg1, {
    legend: [],
    limit: 50000,
    types: [],
    colors: [],
    area: [],
    axis: [],
    width: []
  })

  let legend = cfg.legend
  let colors = cfg.colors || []
  let types = cfg.types || []
  let limit = cfg.limit || 50000
  let charts = data1.length > limit ? Math.round(data1.length / limit) : 1
  for (let i = 0; i < charts; i++) {
    let series = []
    let yAxis = [{
      scale: true,

      type: 'value'
    }]
    let data = data1.slice(i * limit, (i + 1) * limit)


    let size = data[0].length
    for (let y = 0; y < size; y++) {
      let s = {
        smooth: true,
        showSymbol: false,



        name: legend ? legend[y] : 'serie-' + y,
        data: data.map(f => f[y]),
        type: types[y] || 'line',
        color: colors[y] || null,

        yAxisIndex: cfg.axis[y] || y,
      }
      s.lineStyle = {
        width: cfg.width[y] ? cfg.width[y] : 2
      }

      if (cfg.area[y]) {
        s.areaStyle = {
          color: colors[y] || null,
          opacity: cfg.area[y]
        }
        s.lineStyle = {
          width: 0
        }
      }
      let a = {
        type: 'category',
        data: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        axisLine: {
          show: false
        },
        scale: true,
        type: 'value',
      }
      series.push(s)
      yAxis.push(a)
    }


    let option = {

      width: 10000,
      height: 1000,
      option: {
        legend: {},
        backgroundColor: 'white',
        background: 'white',
        backgroundcolor: 'white',
        xAxis: {
          type: 'category',
          data: data.map((f, c) => c)
        },
        dataZoom: {},
        yAxis,
        series
      },

      path: './charts/' + coin + ' ' + (i * 500) + '.png',
      enableAutoDispose: true
    };
    echarts(option)
  }
}

function drawIndicator(data1, coin = Date.now().toTimeString()) {
  let limit = 600

  let charts = data1.length > limit ? Math.round(data1.length / limit) : 1
  for (let i = 0; i < charts; i++) {
    let series = []
    let yAxis = [{
      scale: true,

      type: 'value'
    }]
    let data = data1.slice(i * limit, (i + 1) * limit)


    let size = data[0].length



    let option = {

      width: 3000,
      height: 600,
      option: {
        legend: {},
        backgroundColor: 'white',
        background: 'white',
        backgroundcolor: 'white',
        animation: false,
        title: {
          left: 'center',
          text: 'Candlestick ' + coin
        },
        legend: {
          top: 50
        },


        xAxis: [{

          type: 'category',
          gridIndex: 0
        }, {
          type: 'category',
          gridIndex: 1,
          show: false
        }, {
          type: 'category',
          gridIndex: 2,
          show: false
        }, {
          type: 'category',
          gridIndex: 3,
          show: false
        }, {
          type: 'category',
          gridIndex: 4,
          show: false
        }, {
          type: 'category',
          gridIndex: 1,
          show: false
        }, {
          type: 'category',
          gridIndex: 2
          , show: false
        }, {
          type: 'category',
          gridIndex: 3, show: false
        }, {
          type: 'category',
          gridIndex: 4, show: false
        }],
        yAxis: [{
          scale: true,
          splitNumber: 2,
          axisLine: {
            lineStyle: {
              color: '#777'
            }
          },
          splitLine: {
            show: true
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            inside: true,
            formatter: '{value}\n'
          }
        },
        {
          scale: true,
          max: 5, min: -5,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 2,
          max: 5, min: -5,
          splitNumber: 2,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 3,
          max: 5, min: -5,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 4,
          max: 5, min: -5,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 1,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 2,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 3,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 4,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }
        ],
        grid: [{
          left: 20,
          right: 20,
          top: 50,
          height: 200
        },
        {
          left: 20,
          right: 20,
          height: 80,
          top: 300
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 400
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 500
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 600
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 300
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 400
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 500
        }
        ],
        graphic: [

        ],
        series: [{
          name: 'real 5p',
          type: 'line',
          xAxisIndex: 1,
          smooth: true,
          color: 'green',
          yAxisIndex: 1,
          lineStyle: { width: 0 },
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => (s[4] - 5))
        },
        {
          name: 'previsto 5o',
          type: 'line',
          xAxisIndex: 1,
          smooth: true,
          color: '#00bfa5',
          yAxisIndex: 1,
          lineStyle: { width: 0 },
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => (s[7] - 5))
        },
        {
          name: 'real 10p',
          type: 'line',
          xAxisIndex: 2,
          lineStyle: { width: 0 },
          smooth: true,
          yAxisIndex: 2,
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => (s[5] - 5))
        }, {
          name: 'previsão 10p',
          type: 'line',
          xAxisIndex: 2,
          lineStyle: { width: 0 },
          smooth: true,
          yAxisIndex: 2,
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => (s[8] - 5))
        },
        {
          name: 'previsão 15 periodos',
          type: 'line',
          xAxisIndex: 3,
          smooth: true,
          lineStyle: { width: 0 },
          yAxisIndex: 3,
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => s[6] > 5 - 5)
        },
        {
          type: 'candlestick',

          xAxisIndex: 0,
          yAxisIndex: 0,
          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        }, {
          type: 'candlestick',
          xAxisIndex: 5,
          yAxisIndex: 5,

          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        }, {
          type: 'candlestick',
          xAxisIndex: 6,
          yAxisIndex: 6,

          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        }, {
          type: 'candlestick',
          xAxisIndex: 7,
          yAxisIndex: 7,

          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        }

        ]
      },

      path: './charts/' + coin + ' ' + (i * 500) + '.png',
      enableAutoDispose: true
    };
    echarts(option)
  }
}
function addler(data, mod) {

  let MOD_ADLER = mod

  data = data.map(s => s)

  let len = data.length
  let a = 1,
    b = 0;
  let index;


  for (index = 0; index < len; index++) {
    a = (a + data[index]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;


  }
  return b
}
class baseToken {
  constructor() {
    this.w1 = new WEMA({ period: 50, values: [] })
    this.w2 = new WEMA({ period: 25, values: [] })
    this.w3 = new WEMA({ period: 15, values: [] })
    this.w4 = new WEMA({ period: 5, values: [] })
    this.w = [this.w1, this.w2, this.w3, this.w4]
    this.pool = [[], [], [], []]
    this.i = [50, 25, 15, 5]
  }
  step(data) {
    let r = this.w.map(s => s.nextValue(data.close))
    if (r.length == this.w.length) {
      let vec = []
      r.map((s, i) => {
        this.pool[i].push(s)
        if (this.pool[i].length > this.i[i]) {
          let o = this.pool[i].shift()

          vec[i] = normalize(difa(s, o), 10, 100)
        }
      })
      vec = vec.filter(s => s)
      if (vec.length == this.w.length) {
        let code = vec.join('') / 1
        return code
      }
    }
  }
}
function recode(t) {

  let res = []


  let arr = t.sigmoid().mul(t.tanh()).mul(1000).arraySync()

  let f = 1
  b = 1;
  for (let a = 0; a < arr.length; a++) {
    res[a] = []

    let MOD_ADLER = 16


    for (let x = 0; x < arr[a].length; x++) {
      res[a][x] = []
      for (let y = 0; y < arr[a][x].length; y++) {

        f = (f + arr[a][x][y]) % MOD_ADLER;
        b = (b + f) % MOD_ADLER;


        res[a][x][y] = Math.round(b)


      }
    }
  }
  return tf.tensor(res)
}

function addlerResidual(data, mod, res) {

  let MOD_ADLER = mod



  let len = data.length
  let a = 1 + res,
    b = 0;
  let index;


  for (index = 0; index < len; index++) {
    a = (a + data[index]) % MOD_ADLER;
    b = (b + a) % MOD_ADLER;


  }
  return b
}

function drawCosine(data1, coin = Date.now().toTimeString()) {
  let limit = 600

  let charts = data1.length > limit ? Math.round(data1.length / limit) : 1
  for (let i = 0; i < charts; i++) {
    let series = []
    let yAxis = [{
      scale: true,

      type: 'value'
    }]
    let data = data1.slice(i * limit, (i + 1) * limit)


    let size = data[0].length



    let option = {

      width: 3000,
      height: 600,
      option: {
        legend: {},
        backgroundColor: 'white',
        background: 'white',
        backgroundcolor: 'white',
        animation: false,
        title: {
          left: 'center',
          text: 'Candlestick ' + coin
        },
        legend: {
          top: 50
        },


        xAxis: [{
          type: 'category',
          gridIndex: 0
        }, {
          type: 'category',
          gridIndex: 1,
          show: false
        }, {
          type: 'category',
          gridIndex: 2,
          show: false
        }, {
          type: 'category',
          gridIndex: 3,
          show: false
        }, {
          type: 'category',
          gridIndex: 1,
          show: false
        }, {
          type: 'category',
          gridIndex: 2
          , show: false
        }, {
          type: 'category',
          gridIndex: 3, show: false
        }],
        yAxis: [{
          scale: true,
          splitNumber: 2,
          axisLine: {
            lineStyle: {
              color: '#777'
            }
          },
          splitLine: {
            show: true
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            inside: true,
            formatter: '{value}\n'
          }
        },
        {
          scale: true,
          max: 5, min: -5,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 2,
          max: 5, min: -5,
          splitNumber: 2,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 3,
          max: 10, min: 0,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 1,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 2,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }, {
          scale: true,
          gridIndex: 3,
          splitNumber: 3,
          axisLabel: {
            show: false
          },
          axisLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          splitLine: {
            show: false
          }
        }
        ],
        grid: [{
          left: 20,
          right: 20,
          top: 100,
          height: 180
        },
        {
          left: 20,
          right: 20,
          height: 80,
          top: 100 + 180 + 50
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 100 + 50 + 20 + 180 + 50
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 100 + 80 + 20 + 180 + 20 + 80 + 20
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 100 + 180 + 50
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 100 + 50 + 20 + 180 + 50
        }, {
          left: 20,
          right: 20,
          height: 80,
          top: 100 + 80 + 20 + 180 + 20 + 80 + 20
        }
        ],
        graphic: [

        ],
        series: [{
          name: 'Tendencia',
          type: 'line',
          xAxisIndex: 1,
          smooth: true,
          yAxisIndex: 1,
          lineStyle: { width: 0 },
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => (s[4] - 5))
        },
        {
          name: 'Previsão de inversão',
          type: 'line',
          xAxisIndex: 2,
          lineStyle: { width: 0 },
          smooth: true,
          yAxisIndex: 2,
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => (s[5] - 5))
        },
        {
          name: 'estimativa do tempo restantede trade',
          type: 'line',
          xAxisIndex: 3,
          smooth: true,
          lineStyle: { width: 0 },
          yAxisIndex: 3,
          areaStyle: {
            opacity: .3
          },
          data: data.map(s => s[6] - 5)
        },
        {
          type: 'candlestick',

          xAxisIndex: 0,
          yAxisIndex: 0,
          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        }, {
          type: 'candlestick',
          xAxisIndex: 4,
          yAxisIndex: 4,

          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        }, {
          type: 'candlestick',
          xAxisIndex: 5,
          yAxisIndex: 5,

          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        }, {
          type: 'candlestick',
          xAxisIndex: 6,
          yAxisIndex: 6,

          data: data.map(s => s.slice(0, 4)),
          itemStyle: {
            color: '#ef232a',
            color0: '#14b143',
            borderColor: '#ef232a',
            borderColor0: '#14b143'
          },
          emphasis: {
            itemStyle: {
              color: 'black',
              color0: '#444',
              borderColor: 'black',
              borderColor0: '#444'
            }
          }
        },

        ]
      },

      path: './charts/' + coin + ' ' + (i * 500) + '.png',
      enableAutoDispose: true
    };
    echarts(option)
  }
}

class coreFreq {

  constructor(f = [0]) {
    this.pool = []
    this.f = f
    this.idx = loadJSON('./data/idx.json')

    this.norm = new Norm(30)
  }
  step(o) {
    this.pool.push(normalize(difa(o.close, o.low), 10, 500))
    if (this.pool.length > 4) {
      this.pool.shift()
      let code = this.pool.join('') / 1
      let res = []
      for (let x = 0; x < this.f.length; x++) {
        res.push(this.norm.get(x, this.idx[code][this.f[x]]))
      }

      return res
    }

  }
}
let loadBin = global.loadJSON = function (path) {
  if (fs.existsSync(path)) {
    let rawData = fs.readFileSync(path)
    try {
      let data = decode(rawData)
      return data
    } catch (e) {
      console.log('erro na leitura ', path)
      return false
    }
  }
  return false
}
let saveJSON = global.saveJSON = function (path, data) {

  try {
    let rawData = JSON.stringify(data)
    fsp.writeFileSync(path, rawData)
  } catch (e) {
    console.log('erro na gravação ', path)
    return false
  }



  return false
}
let saveBin = global.saveBin = function (path, data) {

  try {


    let y = encode(data)
    fs.writeFileSync(path, y)
  } catch (e) {
    (e)
    console.log(e)
    console.log('erro na gravação ', path)
    return false
  }



  return false
}

let opt = global.opt ? global.opt : tempOpt
global.opt = _.merge(opt, inputOpt)
if (inputOpt.id && !global.loaded) {
  global.loaded = true
  let json = loadJSON('./cfg/' + inputOpt.id + '.json')
  console.log('loading', inputOpt.id)
  if (!json) {


  } else {
    global.opt = opt = _.merge(opt, json)


  }
}



async function getCSV(csv) {
  let dt1 = await tf.data.csv(path, {
    columnConfigs: {
      open: {
        dtype: 'float32'
      },
      close: {
        dtype: 'float32'
      },
      high: {
        dtype: 'float32'
      },
      low: {
        dtype: 'float32'
      },
      volume: {
        dtype: 'float32'
      }
    }
  }).map(s => s).toArray(x => x)

  return dt1
}
let difa = function (a, b) {
  return ((a - b) / b) || 0
}

function normalize(p, n = 10, m = 50) {
  let v = p
  let nm1 = (n - 1)
  v = Math.round(v * m) + Math.round((n - 1) / 2)
  return v > nm1 ? nm1 : v < 0 ? 0 : v

}
if (!global.binance) {
  var binance

  try {
    let keys = fs.readFileSync('./key.txt')
    keys = JSON.parse(keys)
    keys.family = 4
    keys.reconnect = true
    binance = new Binance().options(keys);
  } catch (e) {
    console.log('erro na leitura da chave, verifique sua chave na binance corretamente')
    process.exit()
  }
  if (!global.filters) {
    binance.exchangeInfo(function (error, data) {
      let minimums = {};
      if (error) {
        global.filters = loadJSON('./minimums.json')
        return false
      }
      for (let obj of data.symbols) {

        let filters = {
          status: obj.status
        };
        for (let filter of obj.filters) {
          if (filter.filterType == "MIN_NOTIONAL") {
            filters.minNotional = filter.minNotional;
          } else if (filter.filterType == "PRICE_FILTER") {
            filters.minPrice = filter.minPrice;
            filters.maxPrice = filter.maxPrice;
            filters.tickSize = filter.tickSize;
          } else if (filter.filterType == "LOT_SIZE") {
            filters.stepSize = filter.stepSize;
            filters.minQty = filter.minQty;
            filters.maxQty = filter.maxQty;
          }
        }
        //filters.baseAssetPrecision = obj.baseAssetPrecision;

        //filters.quoteAssetPrecision = obj.quoteAssetPrecision;
        filters.orderTypes = obj.orderTypes;
        filters.icebergAllowed = obj.icebergAllowed;
        minimums[obj.symbol] = filters;
      }

      global.filters = minimums;

      fs.writeFile("minimums.json", JSON.stringify(minimums, null, 4), function (err) { });
    });
  }
  global.binance = binance
}
let chartCount = 0

function getChart(symbol, totalCandles = 4000, period = '1m') {
  let vm = this;
  console.log(symbol, totalCandles)
  let allCandles = [];
  let fetchCount = 0; // Contador para manter o controle de quantos candles foram buscados
  let n = 0
  let last = 0
  function fetchCandles(resolve, endTime) {
    binance.candlesticks(symbol, period, (error, ticks, symbol) => {
      console.log("Fetching candles for: ", symbol);

      if (error) {
        console.error("Error fetching candlesticks:", error);
        return resolve(allCandles);
      }

      let res = [];
      for (let x in ticks) {
        let [time, open, high, low, close, volume, closeTime, assetVolume, trades, buyBaseVolume, buyAssetVolume, ignored] = ticks[x];
        res.push({
          low: low / 1,
          close: close / 1,
          high: high / 1,
          symbol,
          open: open / 1,
          trades: trades / 1,
          volume: volume / 1,
          time: closeTime / 1
        });
      }

      if (res.length > 0) {
        allCandles = res.concat(allCandles);
        if (allCandles.length == last) return []
        last = allCandles

        fetchCount += res.length;
        n++

        if (fetchCount < totalCandles) {
          // Define o endTime para o tempo do primeiro candle da resposta atual
          fetchCandles(resolve, res[0].time);
        } else {
          resolve(allCandles.slice(0, totalCandles)); // Garante que apenas o número desejado de candles seja retornado
        }
      } else {
        resolve(allCandles); // Resolve com o que já foi buscado caso não haja mais candles
      }
    }, {
      limit: 1000,
      endTime: endTime
    });
  }

  return new Promise(resolve => {
    fetchCandles(resolve);
  });
}

async function getRank(coin, token = false, top = 150, order = 'priceChangePercent', direction = 'desc') {
  let rgxString = `(${coin}$)`

  let rgx = new RegExp(rgxString, 'g')
  let data = await binance.prevDay()
  data = _.values(data)
  data = data.filter(g => g.symbol.search(rgx) != -1)
  data = data.filter(g => g.symbol.search(/BULL|BEAR/) == -1 && g.count > 0)
  if (token) {
    data = data.filter(g => g.symbol.search(/(UPUSDT)|(DOWNUSDT)/) != -1)
  } else {

  }

  data = data.map(g => {
    g.priceChangePercent = g.priceChangePercent ? g.priceChangePercent / 1 : 0
    g.closeLow = (g.close - g.low) / (g.high - g.low)

    return g

  }).filter(f => Math.abs(f.priceChangePercent) > 0.1 && f.count > 0 && (f.quoteVolume > coin == 'BTC' ? 50 : 5e6))

  return _.orderBy(data, [order], [direction]).map(j => j.symbol).slice(0, top)

}
class Norm {
  constructor(length = 20, size = 10) {
    this.length = length
    this.size = size
    this.limit = size - 1
    this.drange = 0
    this.half = Math.round((this.size - 1) / 2)
    this.mul = (this.size / 10)
    this.pools = {

    }

  }
  calculate(array, val) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    let val2 = val - mean
    let dp = Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)

    this.drange = ((dp / mean))

    let r = val2 / dp
    let res = Math.round(r * this.mul) + this.half
    res = res > this.limit ? this.limit : res < 0 ? 0 : res
    return res > this.limit ? this.limit : res < 0 ? 0 : res
  }
  reverse(id, val) {
    let array = this.pools[id]
    const n = array.length
    val = (val - this.half) / this.mul
    const mean = array.reduce((a, b) => a + b) / n
    let val2 = val * Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)
    return difa(val2 + mean, _.last(this.pools[id]))

  }
  get(id, val) {
    if (!this.pools[id]) {
      this.pools[id] = [val, val, val]
    }
    this.pools[id].push(val)
    if (this.pools[id].length > this.length) this.pools[id].shift()
    let res = this.calculate(this.pools[id], val) || this.half

    return res
  }
}

class MinMax {
  constructor(length, size = 10) {
    this.length = length || 20
    this.size = size - 1
    this.pools = {

    }

  }
  calculate(array, val) {
    const n = array.length
    let ar = array

    let min = _.min(array)
    let max = _.max(array)
    let val2 = val - min
    let val3 = max - min
    let r = val2 / val3

    return r
  }
  reverse(id, val) {
    let array = this.pools[id]
    val = val / this.size
    let min = _.min(array)
    let max = _.max(array)

    let val3 = max - min
    let val2 = (val * (val3)) + min
    return difa(val2, _.last(this.pools[id]))
  }
  get(id, val) {
    if (!this.pools[id]) {
      this.pools[id] = [val * 1.01, val, val * .99]
    }
    this.pools[id].push(val)

    if (this.pools[id].length > this.length) this.pools[id].shift()
    let res = this.calculate(this.pools[id], val) || 0
    res = Math.round(res * this.size)

    return res
  }
}
class Scale {
  constructor(size, mul) {
    this.maxSize = mul
    this.mul = size
    this.pools = {

    }

  }

  reverse(id, val) {
    // console.log(val)
    let v = (val - Math.round((this.maxSize - 1) / 2)) / this.mul

    return v
  }
  get(id, val) {

    return normalize(val, this.maxSize, this.mul)
  }
}
class Position {
  constructor(size) {
    this.maxSize = size || 20
    this.pools = {

    }

  }
  calculate(array, val) {
    const n = array.length
    let arr = array.slice()

    let cp = 0
    let idx = arr.map((s, i) => [s, i]).sort((a, b) => a[0] - b[0]).map((s, i) => {
      s.push(i)
      if (val > s[0]) cp++

      return s
    }).sort((a, b) => a[1] - b[1])
    cp = cp / n
    let f1 = idx[idx.length - 1][2] / n
    let f2 = idx[0][2] / n

    return [f1, f2, cp].map(s => Math.round(s * 9))
  }

  get(id, val) {
    if (!this.pools[id]) {
      this.pools[id] = [val * 1.01, val, val * .99]
    }
    this.pools[id].push(val)
    if (this.pools[id].length > this.maxSize) this.pools[id].shift()
    let res = this.calculate(this.pools[id], val) || [0, 0, 0]


    return res
  }
}

class CosineId {
  constructor(size) {
    this.maxSize = size || 20
    this.norm1 = new MinMax(10)
    this.norm2 = new MinMax(25)
    this.norm3 = new MinMax(50)
    this.pools = {

    }

  }
  calculate(array) {
    const n = array.length
    let arr = array.slice()
    let seq1 = _.takeRight(arr, this.maxSize - 2)
    let seq2 = _.take(arr, this.maxSize - 2)

    let v = cosineSimilarity(seq1, seq2)
    let v1 = this.norm1.get('a', v)
    let v2 = this.norm2.get('a', v)
    let v3 = this.norm3.get('a', v)
    return [v1, v2, v3]
  }

  get(id, val) {
    if (!this.pools[id]) {
      this.pools[id] = [val, val, val, val]
    }
    this.pools[id].push(val)
    if (this.pools[id].length > this.maxSize) this.pools[id].shift()
    let res = this.calculate(this.pools[id], val) || [0, 0, 0]


    return res
  }
}
class Token {
  constructor(n = [25, 50]) {
    this.norms = n.map(s => new Norm(s))
  }
  getKey(a, v) {
    let res = this.norms.map(s => s.get(a, v)).join('') / 1
    return res

  }
  getVal(id, key) {
    let k = [key].map((s, i) => this.norms[i].reverse(id, s / 1))
    return _.mean(k)
  }

}

function argMax(list) {
  list = list.slice()

  const len = list.length;
  let maxIndex = -1;
  let maxValue = null;
  for (let i = 0; i < len; i++) {
    const value = list[i];
    if (i === 0) {
      maxIndex = 0;
      maxValue = value;
    } else if (value > maxValue) {
      maxValue = value;
      maxIndex = i;
    }
  }
  if (maxIndex === -1) {

  }
  return maxIndex;
}
function nlnorm(val) {
 
  if (val > .02) {
    return 5
  }
  if (val < -.05) {
    return 1
  }
  if (val < -.02) {
    return 2
  }

 

  if (val < -.005) {
    return 3
  }

  return 4


}
module.exports = {
  opt,
  saveJSON,
  Position,
  loadJSON,
  nlnorm,
  Token,
  normalize,
  createBinaryVec,
  outerMask,
  Norm,
  saveBin,
  cosineSimilarity,
  getRank,
  CosineId,
  addler,
  drawIndicator,
  drawCosine,
  outerDif,
  difa,
  baseToken,
  recode,
  coreFreq,
  getPositionEncoding,
  binance,
  drawChartLine,
  echarts,
  Scale,
  getChart,
  drawChartRL,
  argMax,
  outerSub,
  MinMax,
  loadBin
}
