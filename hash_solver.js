const {
    WEMA
} = require("technicalindicators")
const {
    loadJSON,
    difa,
    saveJSON,
    normalize,
    loadBin,
    MinMax,
    argMax,
    baseToken
} = require("./src/util")
let _ = require('lodash')
const fsPath = require("fs-path")

let consecutiveRecord = false;
let consecutiveProfit = false;
let predictStep = 7;

function start() {
    //let dataTrain = fsPath.findSync('/home/samira/Documentos/Projetos/data/archive5m').files
    let dataTest
    let data = {}
    let max = 0
    for (let j1 = 1; j1 < 12; j1++) {
        let d = (loadBin('./data/test/2021/2021' + j1.toString().padStart(2, '0')))

        console.log("------ MES: ", j1, "------")
        for (let k in d) {
            //k = 12 meses de cada moeda
            let x = k.split('-')[0]
            if (!data[x]) data[x] = []
            data[x] = data[x].concat(d[k])
            //console.log(x, "length: ", data[x].length, "max:", max)
            if (data[x].length > max) {
                max = data[x].length
            }
        }

        let n = 0
        for (let k in data) {
            if (data[k].length < (max) || k.includes('BTT')) {
                //console.log("DATA TO BE DELETED: ", data[k])
                delete data[k]
            } else {
                n++
            }
        }
    }
    test(data, max * .85)
}

function test(data, max) {
    let f = loadJSON('./data/freq2')
    let n = 0;
    let bestActual = 1000;
    let actual = 67990 //1000 >> 34120
    let record = 0
    let actualRecord = 0
    let lastTotal = 100
    let mod = 10000 //10000
    //let sfreq = new Array(mod + 1).fill(0).map((s => Math.random() - .5))
    let sfreq = f.freq
    let freq = sfreq.slice()
    let cp = 0;
    let ncp = 0;
    let save = false
    let experimental = false
    let experimentalCounter = 100
    let calibrate = true
    let bestFreq = sfreq.slice()
    while (n < 10000) {
        n++
        let total = 100
        let sts = 0
        let close
        let coinTrade
        let pools = {}
        let count = 0
        let wemas = {}

        for (let k = 0; k < actual; k++) {
            let arrFreq = []
            for (let coin in data) {
                //só vai rodar na primeira vez
                if (!wemas[coin]) {
                    wemas[coin] = {
                        bt: new baseToken()
                    }
                }

                //  let v1 = wemas[coin].w1.nextValue(data[coin][k].close)
                //  let v2 = wemas[coin].w2.nextValue(data[coin][k].close)

                let ac = 0
                let code = wemas[coin].bt.step(data[coin][k]) || -1

                arrFreq.push({
                    res: freq[code] || 0,
                    coin
                })
            }
            let ref = arrFreq.sort((a, b) => b.res - a.res)
            //console.log("ref: ", ref)
            if (ref[0]) {
                if (sts == 0) {
                    if (true) {
                        sts = 1
                        coinTrade = ref[0].coin
                        count = 0
                        close = data[ref[0].coin][k].close
                    }
                } else {
                    count++
                    if (count > predictStep) {
                        total *= (1 - .002 + difa(data[coinTrade][k].close, close))
                        //   console.log(total)
                        sts = 0
                    }
                }
            }
        }

        if(total > actualRecord && total != 100) {
            actualRecord = total
        } 

        if(total > 100) {
            consecutiveProfit = true
            cp += 1
        } else {
            consecutiveProfit = false
            cp = 0
            ncp = 0
        }

        let keep = false
        if(total < record && total != 100) { //total < record && total != 100
            consecutiveRecord = false 
        }
        if(actual < 2000) {
            if (total > record && total != 100) { //total > record && total != 100
                sfreq = freq.slice()
                record = total
                if(!consecutiveRecord && save) {
                    console.log("SAVED!")
                    save = false
                }
            }
        } else {
            //if (ncp >= 7 && total != 100 && total > lastTotal) { //total > record && total != 100
            if (ncp >= 7 && total != 100 && total > lastTotal && !experimental || experimental && total > record) { //total > record && total != 100
                sfreq = freq.slice()
                if(total > record) {
                    record = total
                    save = true   
                }
                if(save) {
                    console.log("SAVED!")
                    save = false
                    saveJSON('./data/freq2', {
                        freq: sfreq,
                        mod
                    })
                    if(experimental) {
                        bestFreq = sfreq.slice()
                        lastTotal = record
                    }
                }
            }
        }
        if (actual < max && consecutiveProfit == true && !experimental) { // ... && record > 500
            cp = 0
            ncp += 1
            keep = true
            actual += 10
            actual = actual > max ? max : actual
            //record = -Infinity
        }
        console.log(total, record, actual, 'CP: ', consecutiveProfit, 'CR: ', consecutiveRecord, 'NCP: ', ncp, experimentalCounter)
        if(total == record && consecutiveRecord == false) {
            consecutiveRecord = true
        }

        if(ncp < 1 && !experimental || experimental && total <= record) { //total <= record
            //freq = sfreq.slice().map(s => Math.random() > .95 ? Math.random() - .5 : s)
            freq = sfreq.map(s => Math.random() > .95 ? Math.random() - .5 : s)
            save = true
        }
        lastTotal = total
        if(actual % 1000 === 0 && !experimental) {
            experimental = true
            experimentalCounter = 300
            record = 0
        }
        if(experimental) {
            experimentalCounter -= 1
            if(experimentalCounter === 0) {
                experimental = false
                freq = bestFreq.slice()
                actual += 10
            }
        }
        //freq = keep ? freq : sfreq.slice().map(s => Math.random() > .95 ? Math.random() - .5 : s)
    }
}

start()