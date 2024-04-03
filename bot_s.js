let fs = require('fs')

let colors = require('colors')

let cp = require('compute.io')
let tf = require('@tensorflow/tfjs-node-gpu')
global.tf = tf
let td = require('tdsequential')
let _ = require('lodash')

let asciichart = require('asciichart')
const {
    binance,
    difa,
    normalize,
    MinMax,
    loadBin,
    loadJSON,
    getRank,
    getChart,
    opt,
    argMax,
    Norm,
    drawChartLine,
    drawChartRL
} = require('./src/util')




const fsPath = require('fs-path')
const {
    WEMA, RSI, StochasticRSI
} = require('technicalindicators')
const CoreOscillator = require('./src/coreOscillator')
const { TransformerLayer, idLayer, idPredict, corePredict, oneHotLayer, binarizer, Simplify, Expand } = require('./src/TFmod')
const tdsequential = require('tdsequential')
const { PositionEmbedding } = require('./src/mha')
let batchSize =8

let interval = "1m" //periodo
let intervalMS = 1 * 60 * 1000
let length =64//tamanho da sequencia e steps
let acSteps = 5//quantidade de steps que o ac da diferença é mantido
let predictSteps =8//quantidade de vezes que o predict é executado sequencialmente 
let coins =16  //numero de moedas por previsão
let norm = 100 // fator de divisão do normalizador (dif*norm)+5

let trainFile = './data/test/202201'
let stats = new Array(coins).fill(0).map(s => [0, 0, 0])
global.resetCount = 0

function colorString(vec = []) {

    let cvec = [
        colors.black,
        colors.bgRed,
        colors.bgRed,
        colors.bgYellow,
        colors.bgYellow,
        colors.bgWhite,
        colors.bgGreen,
        colors.bgGreen,
        colors.bgGreen,
        colors.bgCyan

    ]
    let str = vec.map(s => {
        s = Math.round(s)



        return cvec[s] ? cvec[s](' ') : colors.bgWhite(' ')
    }).join('')
    return str

}
class StateTicker {
    constructor(symbol, model2) {
        this.symbol = symbol
        this.val = 0
        this.countp = 0


        this.norm = new MinMax(30)
        this.mm= new MinMax(10)
        this.res = {}
        this.w = []
        for (let k = 0; k < 8; k++) {
            this.w.push(new RSI({
                values: [],
                period: 5 + (k * 5)
            }))
        }
        this.countn = 0
        this.state = []
        this.hist = []
        this.seq = []
        this.lastDif = 0
        this.lastFreq = 0
        this.ac = []
        this.tval = 0
        this.w1 = new WEMA({ period: 50, values: [] })
        this.w2 = new WEMA({ period: 20, values: [] })


        this.w3 = new WEMA({
            values: [],
            period: 15
        })

        this.w4 = new WEMA({
            values: [],
            period: 7
        })
        this.r4 = new RSI({ period: 34, values: [] })
        this.poolWema = []
        this.poolTD = []
        this.acc = {}
        this.target = 0
        this.lastId = 0
        this.stateCheck = new Array(128).fill(5555)
        this.stateLog = new Array(32).fill(5555)
        this.valarr = 0
        this.lastCandle = {}
        this.ticks = []
        this.lastRsi = 0
        this.counts = [0, 0, 0]

        this.rsiStatus = 0
        this.lastIw = 0
        this.arr = []
        this.pos = []
        this.ac2 = []
        this.lastAc = 0


        this.count = 0
        this.lastTick = {}

    }
    async getData() {
        let data = await getChart(this.symbol, 1000, interval)
        data.map(s => {
            this.tick(s)
            this.step(s)
        })
    }
    async load() {
        let data = await getChart(this.symbol, 1000, interval)

        let res = data.map(f => this.tick(f))

        this.lastState = _.last(res)
        this.lastCandle = _.last(data)

    }
    async start() {
        this.res = {}

    }
    tick(x) {

        this.lastCandle = x
    }
    minitick(o) {
        if (!this.lastTick.eventTime) {
            this.lastTick = o
        }
        let dif = (o.eventTime - this.lastTick.eventTime)
        this.ticks.push(o)
        if (dif > intervalMS) {
            let candle = {
                symbol: this.symbol,
                time: o.eventTime,
                close: o.close,
                open: this.lastTick.close,
                low: _.min(this.ticks),
                high: _.max(this.ticks)
            }
            this.ticks = []
            this.lastCandle = candle
            this.lastTick = o
        }

    }
    step(o) {
        if (!this.lastCandle.close) return false

        let dif = difa(this.lastCandle.close, this.lastCandle.open)

        let dw
        let w1 = this.w1.nextValue(this.lastCandle.close)
        let w2 = this.w2.nextValue(this.lastCandle.close)
        let w3 = this.w3.nextValue(this.lastCandle.close)
        let w4 = this.w4.nextValue(this.lastCandle.close)
        this.ac2.push(dif)

        if (w1) {
            let codev = [difa(this.lastCandle.close, w1), difa(this.lastCandle.close, w2), difa(this.lastCandle.close, w3), difa(this.lastCandle.close, w4)].map(s => normalize(s, 10, 100))
            let code = codev.join('') / 1
            this.stateLog.push(code)
            this.stateLog.shift()
            this.stateCheck.push(code)
            this.stateCheck.shift()
          dw=difa(w2,w1)
          
            
        }


        this.ac.push(difa(this.lastCandle.close, this.lastCandle.open))
        if (this.ac.length > predictSteps) this.ac.shift()

        this.lastDif = _.sum(this.ac)
        let g=_.sum(this.ac2)

        this.state.push(normalize(g,10,500))
     
        if (global.resetCount % predictSteps==0) {
            this.lastAc=_.sum(this.ac2)
            this.ac2 = []
            
        }


        if (this.state.length > (length*2)) {
            this.state.shift()
            return {

                val:-this.lastAc,
                stateCheck: this.stateCheck.slice(),
                stateLog: this.stateLog.slice(),
                n: this.norm.get('a', this.lastCandle.high),
                state: this.state.slice(),
                dif: _.sum(this.ac),
                symbol: this.symbol
            }
        }
    }
}

class BooktickerTrader {
    constructor() {
        this.coins = {}
        this.state = {}
        this.t = []
        this.total = 100
        this.maxTrades = 1
        this.t = []
        this.lastTick = {}
        this.freq=[]
        this.pending = 0
        this.skip = {}
        this.lastPos=new Array(coins).fill(0)
        this.trades = {}
        this.count = 0
        this.cban = {}
        this.ban = []
        this.loss = []


        this.log = []
        this.norm = new MinMax(50)
        this.mm = new MinMax(50)
        this.xs = []
        this.ys = []

    }

    addLog(o) {

        this.log.push(JSON.parse(JSON.stringify(o)))
        if (this.log.length > 10) this.log.shift()
    }

    async createModel() {
        let input = tf.layers.input({
            shape: [coins, length]
        })

        let x = input
        
        let u=[]
   let last
   let n=64
        x=tf.layers.embedding({inputDim:10,outputDim:n}).apply(x)
        let a=tf.layers.reshape({targetShape:[coins*n,length]}).apply(x)
let v=tf.layers.dense({units:n*coins,activation:"swish"   })
for(let k=0;k<predictSteps;k++){
    a=tf.layers.batchNormalization().apply(a)

        let y=tf.layers.permute({dims:[2,1]}).apply(a)
        y=v.apply(y)
        
        y=tf.layers.permute({dims:[2,1]}).apply(y)
        

        y=tf.layers.reshape({targetShape:[coins,length,n]}).apply(y)
       
        last=y
        y=tf.layers.reshape({targetShape:[1,coins,length,n]}).apply(y) 
    
        u.push(y)
}

  
        x=tf.layers.concatenate({axis:1}).apply(u)
x=tf.layers.conv3d({filters:512,kernelSize:1,padding:'same',strides:1,activation:"swish"}).apply(x)
x=tf.layers.dense({units:10,activation:'softmax'}).apply(x)
        let model = tf.model({
            inputs: input,
            outputs: x
        })
        model.summary()
        this.op = tf.train.adam(.001)

        this.model = model
        if (!opt.reset) {

            this.model = await tf.loadLayersModel('file://./models/mt' + [coins, length, '5m', coins].join('-') + '/model.json')

        }

        this.model.compile({
            optimizer: this.op,
            loss: 'sparseCategoricalCrossentropy',
            metrics: ['acc']
        })
        this.model.summary()

    }
    updateScreen(v) {
        if (!v) v = this.lastScreen
        this.lastScreen = v
        if (opt.skip) return true
        if (!opt.debug) console.clear()
        console.log('CORE-AGT', 'TOTAL:' + (this.total + this.pending).toFixed(2), 'STEPS', this.count,'global',global.v)
        let title1 = 'SYMBOL'.padEnd(10, ' ')
        let title2 = ' OSCILLATOR'
        let title3 = 'PREDICT'

        let txt = ''
        txt += title1.padEnd(10, ' ')
        txt += ' '
        txt += title2.padEnd(64, ' ')
        txt += ' '
        txt += title3.padEnd(20, ' ')

        console.log(txt)
        for (let x = 0; x < coins; x++) {

            if (v[x]) {
                let symbol = (v[x].symbol + '      ').substring(0, 10)
                let status = v[x].statusStr
                let pred = v[x].predStr
                let trade = v[x].pos

                console.log(symbol + ' ' + status + ' ' + pred + ' ' + trade)
            }
        }


        console.log('TRADES')
        title1 = 'SYMBOL'.padEnd(10, ' ')
        title2 = ' %'
        title3 = 'PREDICT'
        let title4='REAL'
       txt = ''
       txt += title1.padEnd(10, ' ')
       txt += '| '
       txt += title2.padEnd(5, ' ')
       txt += '| '
       txt += title3.padEnd(predictSteps, ' ')
       txt += '| '
       txt += title4.padEnd(predictSteps, ' ')
       console.log(txt)
       for (let x in this.trades) {
           if (this.trades[x]) {
               let symbol = (this.trades[x].symbol).padStart(10, ' ').substring(0, 10)
               console.log(symbol + '|' + (this.trades[x].profit > 0 ? '+' : '') + (this.trades[x].profit * 100).toFixed(2) + '%' + '| ' + colorString(this.trades[x].predict.map(s => s),1)+ '| ' + colorString(this.trades[x].hist.map(s => normalize(s, 10, 100)),1) + this.trades[x].totalCount )
           }
           if (this.trades[x] && opt.chart) console.log(tf.oneHot(this.coins[x].state, 10).transpose([1, 0]).arraySync().map(s => s.slice(0, 144).join('').replace(/0/g, ' ')).join('\n'))



       }
       if (_.keys(this.trades).length == 0) {
           if (opt.chart) console.log('\n'.repeat(32))
       }

       console.log('_'.repeat(140))
       console.log('LOG')

       for (let k = 0; k < 15; k++) {
           if (this.log[k]) {
               let symbol = (this.log[k].symbol).padStart(10, ' ').substring(0, 10)
               console.log(symbol + '|' + (this.log[k].profit > 0 ? '+' : '') + (this.log[k].profit * 100).toFixed(2) + '%' + '| ' + colorString(this.log[k].predict.map(s => s),1)+ '| ' + colorString(this.log[k].hist.map(s => normalize(s, 10, 100)),1) + (this.log[k].totalCount))
           } else {
               console.log(' ')
           }

       }




    }
    learn(vo) {
        this.pool = this.pool ? this.pool : []
        this.pool.push(JSON.parse(JSON.stringify(vo)))
        let xs, ys
        let v
        xs=vo.map(s=>s.state).sort((a,b)=>b.val-a.val)

        let x = []
        let y = []
        let model = this.model
        let vm = this
        for (let k = 0; k < 8; k++) {
            let idx = _.shuffle(new Array(xs.length).fill(0).map((s, i) => i)).slice(0,coins)
            let xr = idx.map(s => xs[s])
         

          


            if (opt.rec) {
                fs.appendFileSync('./data/data1m.jsonl', JSON.stringify({ xs: xr, ys: yr }) + '\n')

            } else {
             
                vm.xs.push(xr)
            }


        }
        if (false && this.xs.length > batchSize) {
            this.op.minimize(() => {
                return tf.tidy(() => {

                    let idx = _.shuffle(new Array(this.xs.length - batchSize).fill(0).map((s, i) => i)).slice(0, batchSize)

                    let xt = tf.tensor(idx.map(s => this.xs[s]))
                    let yt = tf.oneHot(idx.map(s => this.ys[s]), coins + 1)

                    let res = model.apply(xt, {
                        training: true
                    })
                    let val = tf.metrics.categoricalCrossentropy(yt, res).mean().mean()

                    vm.loss.push(val.arraySync())
                    if (vm.loss.length > 100) vm.loss.shift()
                    return val
                })
            })
        }
    }
    async buy(o, val,v) {

        o.val = val
        o.alert = 0
        let row = o
        if (!opt.test && opt.real) {
            try {
                let res
                if (opt.real) res = await binance.marketBuy(o.symbol, binance.roundStep(val / row.close, global.filters[o.symbol].stepSize))
                o.val = res.cummulativeQuoteQty / 1

                o.qtd = res.executedQty / 1
                o.close = row.close
                o.predict=v.predict
                o.count = 0
                o.hist = [0]
                o.totalCount = 0
                this.total -= o.val

                this.pending += o.val
                this.trades[o.symbol] = JSON.parse(JSON.stringify(o))
            } catch (e) {



            }


        } else {
            this.pending += val
            this.total -= val
            o.profit = 0


            o.sellTarget = o.target
            o.count = 0
            o.hist = []
            o.predict=v.predict
            o.totalCount = 0
            o.qtd = (val / row.close) * .999
            o.time = new Date(row.eventTime || row.time).toLocaleTimeString()
            o.close = row.close
            o.action = 'BUY'
            this.trades[o.symbol] = JSON.parse(JSON.stringify(o))

        }


    }

    async sell(o) {


        let row = o.row
        let lastCandle = row
        let trade = this.trades[o.symbol]
        let tradeVal = 0
        tradeVal += trade.val
        
        if (!opt.test && opt.real) {

            try {
                let res
                if (opt.real) res = await binance.marketSell(o.symbol, binance.roundStep(trade.qtd, global.filters[o.symbol].stepSize))
                this.pending -= tradeVal

                let val = res.cummulativeQuoteQty / 1
                o.val = val
                o.qtd = res.executedQty / 1

                this.total += val

                trade.profit = difa(val, tradeVal)

                trade.time = (new Date()).toLocaleTimeString()
                trade.action = 'SELL'
                trade.close = row.close
                this.addLog(trade)
                delete this.trades[o.symbol]
            } catch (e) {
                console.log(e)
                process.exit()
                this.addLog({
                    error: 'erro sell'
                })
            }


        } else {
            let val = trade.qtd * row.close * .999
            this.total += val
            this.pending -= trade.val
            trade.profit = difa(val, trade.val)
            trade.time = new Date(row.eventTime || row.time).toLocaleTimeString()
            trade.action = 'SELL'
            trade.close = row.close
            delete this.trades[o.symbol]
            this.addLog(trade)
            console.log('endsell')

        }
        if (opt.trade) this.model = await tf.loadLayersModel('file://./models/mt' + [coins, length, '5m', coins].join('-') + '/model.json')


    }
    async checkTrade(v1) {
        this.count++
        let v = v1.slice()


        for (let k = 0; k < v.length; k++) {
            v[k].v = v[k].v

            v[k].target = v[k].v
            this.coins[v[k].symbol].target = v[k].target
            this.coins[v[k].symbol].v = v[k].v
        }

        v = v.sort((a, b) => b.pos - a.pos).filter(s => !this.cban[s.symbol])

        for (let x in this.trades) {

            this.trades[x].totalCount++
            this.trades[x].profit = difa(this.trades[x].qtd * this.coins[x].lastCandle.close * .999, this.trades[x].val)

            let val = this.coins[x].v
            this.trades[x].hist.push(this.trades[x].profit)
            if (this.trades[x].totalCount >= predictSteps) {
                this.trades[x].row = this.coins[x].lastCandle
                await this.sell(this.trades[x])
            }
        }


        for (let k = 0; k < coins; k++) {
            let val = .98 * (this.total + this.pending) / this.maxTrades
            if (this.trades[v[k].symbol]) {
                if (true) {
                    this.trades[v[k].symbol].count = this.coins[v[k].symbol].target > 0 ? 0 : this.trades[v[k].symbol].count + 1
                }
            } else {
                if (val < this.total) {
                    let vs = difa(this.coins[v[k].symbol].lastCandle.close, this.coins[v[k].symbol].lastCandle.open)

                    if (v[k].v == 1&&(global.resetCount%predictSteps)==0) {
                        let r = [9, 9, 9, 9]
                        tf.tidy(() => {
//                            r = this.modelCheck.predict(tf.tensor([v[k].stateCheck])).map(s => _.last(s.argMax(-1).arraySync()[0]))

  //                          v[k].pos = r
                        })
                       
                       /*  if (r[0] < 5)  */await this.buy(this.coins[v[k].symbol].lastCandle, val,v[k])
                    }

                }
            }

        }
        this.updateScreen(v1)

    }
    async checkCoins() {
        let ok = 0
        global.resetCount++

        this.t.push(this.total + this.pending)
        let coinsCheck = {}
        for (let coin in this.coins) {

            let s = this.coins[coin].step()
            if (s) {
                ok++
                this.state[coin] = s



            }

        }

        if (ok >= coins) {

            let vo = _.values(this.state)
            let a=new Array(10).fill(0)
            let r=0
           /*  vo.map(s=>{
                r++
                a[normalize(s.dif)]++
            })
            let u=a.map(s=>s/r)
            let s=vo[0].symbol
            let c=this.coins[s].lastCandle
             global.v=argMax(u)
            vo=vo.map(s=>{
                s.state=s.state.map(f=>{
                    f=[global.v,f].join('')/1
                    return f
                
                })
                return s
            }) */
            let v1 = vo.sort((a, b) => b.val - a.val).filter((a, i) => i < coins)

            let v = v1
     
            let stateAndPred = v.map(s => s.state)


            let stateReal = stateAndPred.map(s => _.takeRight(s, length))

            this.learn(vo)
            if (opt.skip) return true
            tf.tidy(() => {



                let val = tf.tensor([stateReal])


                let temp = this.model.predict(val).argMax(-1)
                val.dispose()
                val = temp


                let predict = _.last(val.round().arraySync()[0]).map(s=>s.map(d=>d%10))
                let predict2 = (val.round().arraySync()[0])
            
                for (let k = 0; k < coins; k++) {
                    v[k].pred = _.takeRight(predict[k], predictSteps)
                    v[k].predStr = predict2.map((s,i)=>colorString(_.takeRight(s[k].map(f => ((f%10))),predictSteps*4))).join(' ')
                    v[k].v = _.last(predict[k])>5?1:0
                    v[k].predict=_.takeRight(predict[k],predictSteps)
                    v[k].pos = _.last(v[k].pred)
                  //     if (this.trades[v[k].symbol] && v[k].v == 1) this.trades[v[k].symbol].totalCount = 0
                    v[k].statusStr = colorString(_.takeRight(stateReal[k], 64).map(s => s%10))

                }

                val.dispose()
            })
            this.checkTrade(v)

        } else {
            //     if (!opt.debug) console.clear()
            this.count++
        }

    }
    async start() {
        await this.createModel()
        if (opt.train) {
            this.startTrain()
        }
        if (opt.trade) {
            await this.startTicker()

        }

    }
    async dataBinance() {

        let rank = await getRank('USDT', false, 100)

        let randomRank =(rank).slice(0,1000)
        let c = {}
        for (let x = 0; x < randomRank.length; x++) {

            let data = await getChart(randomRank[x],1000, interval)
            console.log(data)
            c[randomRank[x]] = data
        }
        let date = new Date()
        let day = date.getDay()
        let hour = date.getHours()
        let minute = date.getMinutes()
        let month = date.getMonth() + 1
        let year = date.getFullYear()
        trainFile = 'tb_' + year + '_' + [month, day, hour, minute, 'p' + interval].join('_')
        saveBin('./data/last', c)
        console.log('./data/last', 'criado')
        return c
    }
    async tick(market) {

        for (let coin in market) {
            if (!this.coins[coin]) {
                if (coin.search(/USDT$/g) != -1 && !coin.includes('PEPE') && !coin.includes('BTT') && market[coin].quoteVolume > 5 * (10 ** 6)) {

                    if (!this.lastTick[coin]) this.lastTick[coin] = market[coin]
                    let dif = difa(market[coin].close, this.lastTick[coin].close)
                    this.lastTick[coin] = market[coin]
                    if (dif > .003 || _.keys(this.coins).length < coins) {
                        console.log(coin)
                        this.coins[coin] = new StateTicker(coin)
                        await this.coins[coin].getData()
                    }
                } else {

                }
            } else {
                if (market[coin].quoteVolume < 5 * (10 ** 6)) {
                    if (this.coins[coin]) delete this.coins[coin]
                } else {
                    if (this.trades[coin]) this.trades[coin].profit = difa(this.trades[coin].qtd * this.coins[coin].lastCandle.close * .999, this.trades[coin].val)
                    this.coins[coin].minitick(market[coin])
                }
            }
        }
        if (this.lastScreen) this.updateScreen()
    }
    async startCandles() {

        let lastCheck = 0
        let pool = []
        let vm = this
        binance.websockets.miniTicker(markets => {

            pool.push(markets)


        });
        let intervalMinutes = intervalMS / (60000)
        let intervald2 = (intervalMinutes / 2) * 60000
        let difmin = new Date().getMinutes()
        let lastInterval = Date.now()
        let running = 0
        setInterval(async () => {

            if ((new Date()).getMinutes() % intervalMinutes == 0) {
                let m = new Date().getMinutes()
                if ((Date.now() - lastInterval) > intervald2 && difmin != m) {
                    await vm.checkCoins()
                    difmin = m
                    lastInterval = Date.now()

                }
            }
            if (running == 0) {
                if (pool.length > 0) {
                    running = 1
                    await vm.tick(pool.shift())
                    running = 0
                }
            }
        }, 50);
    }
    async startTrain() {
        let data
        let max = 100
        let top=[]
        if (opt.binance) {
            opt.binance = false
            max = 1000
            data = (loadBin('./data/last'))
          for(let coin in data){
            console.log(data[coin].length,'length')
          }
            if (opt.online) data = await this.dataBinance()

            for (let k in data) {
                top.push({score:difa(data[k][data[k].length-1].close,data[k][0].open),coin:k})
            }
console.table(top)
        } else {
            data = {}
            let end = opt.load ? 0 : 2
           
            for (let x = 1; x < end; x++) {

                let d = (loadBin(opt.test ? ('./../T/data/202301') : './data/train/202105'))

                for (let k in d) {
                    let x = k.split('-')[0]
                    if (!data[x]) data[x] = []
                    data[x] = data[x].concat(d[k])
                    if (data[x].length > max) {
                        max = data[x].length
                    
                    }
                }
            }
            
            let n = 0
            for (let k in data) {

                if (data[k].length < (max * .9) || k.includes('BTT')) {
                    delete data[k]
                } else {
                    n++
                }

            }
            for (let k in data) {
                top.push({score:difa(data[k][data[k].length-1].close,data[k][0].open),coin:k})
            }




        }

        this.rank =_.keys(data)
   max=opt.max||max
        for (let k = 0; k < max; k++) {



            for (let i in this.rank) {
                let x=this.rank[i]
                if (x && data[x]) {
                    if (data[x][k]) {

                        let response = data[x][k]
                        response.symbol = x



                        if (!this.coins[response.symbol]) this.coins[response.symbol] = new StateTicker(response.symbol, this.model2)
                        this.coins[response.symbol].tick(response)


                    }
                }
            }


            await this.checkCoins()

            //if(k%100==0)  await this.model.save('file://./models/mt' + [coins, length, interval, predictSteps].join('-') + '/')
            if (k % 1000 == 0) console.log(k)
        }
//drawChartRL(this.freq,'dad',{area:new Array(10).fill(1),axis:new Array(10).fill(1).concat(2),legend:new Array(10).fill(0).map((s,i)=>'normalise'+i).concat(['argmax'])})

        if (opt.chart) drawChartLine(this.t.map(s => [s]), 'total' + Date.now(), {})

        this.trades = {}
        this.total = 40
        this.coins = {}
        this.trained = false
        this.pending = 0
        let vm = this
        let index = 0
        if (opt.load) {
            let dat = _.split(fs.readFileSync('./data/h.jsonl').toString(), '\n').filter(s => s).map(s => JSON.parse(s))
            dat = _.split(fs.readFileSync('./data/i.jsonl').toString(), '\n').filter(s => s).map(s => JSON.parse(s)).concat(dat)
            vm.xs = dat.map(s => s.xs)
            vm.ys = dat.map(s => s.ys)
        }
        function makeIterator() {
            let idx = _.shuffle(new Array(vm.xs.length-batchSize).fill(0).map((a, b) => b))


            const iterator = {
                next: () => {
                    return tf.tidy(()=>{
                    let result;

                    let x = []
                    let y = []
                  
                    for (let k = 0; k < batchSize; k++) {
                        let data = idx.shift()     
                  
                        if (idx.length < 1) idx = _.shuffle(new Array(vm.xs.length-batchSize).fill(0).map((a, b) => b))
                       
                        let xs1 = vm.xs[data].map(h=>h.slice())
                        let idx2 = _.shuffle(new Array(coins).fill(0).map((s, i) => i))
                        let xs = idx2.map(s => xs1[s])
                        let r=[]
                        for(let k1=1;k1<(predictSteps+1);k1++){
                            r.push(xs.map(h=>h.slice(k1,(k1)+length)))
                        }
                       
                        let xr = xs.map(s=>_.take(s,length))

                        let yr = r
                        x.push(xr)
                        y.push(yr)

                    }

                    let xs = tf.tensor(x)
                    let ys = tf.tensor(y).expandDims(-1)

                    result = {
                        value: {
                            xs,
                            ys
                        },
                        done: false
                    };

                    return result;
                })}
            };
            return iterator;
        }
        const ds = tf.data.generator(makeIterator);
        let start = Date.now()

        let first = undefined
        await this.model.fitDataset(ds, {

            batchesPerEpoch:Math.round(vm.xs.length/predictSteps),
            epochs: 9999,
            callbacks: {
                async onEpochEnd(a, b) {
                    if (first == undefined) first = b.acc
                    else {
                        let dif = b.acc - first
                        let d = (Date.now() - start) / 60000
                        let speed = dif / d
                        let remain = 1 - b.acc
                        console.log(Math.round(remain / speed) + ' minutes')
                    }
                    await vm.model.save('file://./models/mt' + [coins, length, '5m', coins].join('-') + '/')
                }
            }
        })

        this.xs = []
        this.ys = []
        // this.trained=true

        await this.startTrain()


    }

    async startTicker() {
        let vm = this

        await vm.createModel()
        vm.rank = await getRank(opt.coin, false, coins + 10)

        vm.lastDifs = {}


        await vm.startCandles()

    }
}

let b = new BooktickerTrader()
b.start()