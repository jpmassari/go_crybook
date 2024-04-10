const fs = require('fs');
const cp = require('child_process');
const _ = require('lodash');
const { loadJSON, saveBin } = require('./util.js');
const fspath = require('fs-path'); 
const csvsync=require('csvsync')
class DataBuilder {
  constructor(ativo, interval, dates) {
    let vm = this
    require('child_process').execSync(`curl https://api.binance.com/api/v3/ticker/24hr -o last.json`)
   let coins=_.orderBy(loadJSON('./last.json'), ['priceChangePercent'], ['desc']).filter(x => x.symbol.search(new RegExp('('+ativo+')$'),"g") != -1 && x.symbol.search(/(UP|DOWN|BEAR|BULL)/g) == -1).map(x => x.symbol)
    for(let x in coins){
      for(let y in dates){

          let data=dates[y]
       vm.getData(coins[x],data,interval)
    }
}
this.saveAndCleanUp(interval,dates)
  }

  getData(moeda, data, interval) {
    try{
        let periodo = data.split('-').length > 2 ? 'daily' : 'monthly'
        if (!fs.existsSync('./data')) fs.mkdirSync('./data')
        if (!fs.existsSync('./klines')) fs.mkdirSync('./klines')
        if (!fs.existsSync('./klines/' + interval)) fs.mkdirSync('./klines/' + interval)
        if (!fs.existsSync('./klines/' + interval + '/' + data)) fs.mkdirSync('./klines/' + interval + '/' + data)
        if (!fs.existsSync(`./${moeda}-${interval}-${data}.zip`)) {
            cp.execSync(`wget https://data.binance.vision/data/spot/${periodo}/klines/${moeda}/${interval}/${moeda}-${interval}-${data}.zip`)
        } else {

        }
        if (!fs.existsSync(`./${moeda}-${interval}-${data}.csv`)) {
            cp.execSync(`unzip ./${moeda}-${interval}-${data}.zip`)
            cp.execSync(`rm ./${moeda}-${interval}-${data}.zip`)
        } else {
            cp.execSync(`rm ./${moeda}-${interval}-${data}.zip`)
        }
        const csv = fs.readFileSync(`./${moeda}-${interval}-${data}.csv`)
        var dcsv = csvsync.parse(csv, {
            skipHeader: false,
            returnObject: false,
            delimiter: ',',
            trim: true
        }).map(h => {
            return {
                open: h[1] / 1,
                high: h[2] / 1,
                low: h[3] / 1,
                close: h[4] / 1,
                time: h[6] / 1,
                volume: h[7] / 1,
            }
        })
      
        cp.execSync( `rm ./${moeda}-${interval}-${data}.csv`)
        fs.writeFileSync('./klines/' + interval + '/' + data + '/' + `./${moeda}-${interval}-${data}.json`, JSON.stringify(dcsv))
        }catch(e){}
    
   
  }
    async saveAndCleanUp(interval,data) {
   let directory = `./klines/${interval}/${data}`;
    let rank = fspath.findSync(directory, x => x).files;
      
	console.log(rank)
        let c = {}
        for (let x = 0; x < rank.length; x++) {
console.log(rank[x])
            let data2 = loadJSON(rank[x])
            let s=_.last(rank[x].split('/')).split('-')[0]
            c[s] = data2
        }
     console.log(c)
        saveBin(`./data/${interval}_${data}`, c)
        console.log('./data/last', 'criado')

    }

}

module.exports = DataBuilder;
