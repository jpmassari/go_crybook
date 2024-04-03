
let _ = require('lodash')
class sortLogic {
    constructor() {

        this.w1 = new Array(1000 * 8 * 8).fill(0).map(s => _.random(0, 32))

        this.gw = new Array(32).fill(0).map(s => Math.random())
        this.sw1 = this.w1.slice()
        this.sgw = this.gw.slice()
        
        this.testData =_.chunk(_.shuffle(new Array(999).fill(0).map((a,o)=>o%10)),8).concat(_.chunk(_.shuffle(new Array(5000).fill(0).map((a,o)=>o%1000)),8)).concat(_.chunk(_.shuffle(new Array(999).fill(0).map((a,o)=>o)),8)).concat(_.chunk(_.shuffle(new Array(999).fill(0).map((a,o)=>o)),8)).concat(_.chunk(_.shuffle(new Array(999).fill(0).map((a,o)=>o)),8)).filter(s=>s.length==8) 
        this.check = this.testData.map(s => s.slice().sort((a, b) => b - a))
        this.record = 0
    }
    reorder(d) {
        let t = []
        d.map((g, i) => {
            let vl = 0
            for (let k = 0; k < 8; k++) {
                let a = (1 * 8 * 1000) + (k * 1000) + g
                vl += this.gw[this.w1[a]]

            }
            t[i] = [vl, i]
        })
        let h = t.sort((a, b) => a[0] - b[0]).map(f => d[f[1]])
        return h
    }
    step() {
        let score = 0
        this.testData.map((d, idx) => {
            let t = []
            d.map((g, i) => {
                let vl = 0
                for (let k = 0; k < 8; k++) {
                    let a = (1 * 8 * 1000) + (k * 1000) + g
                    vl += this.gw[this.w1[a]]

                }
                t[i] = [vl, i]
            })
            let h = t.sort((a, b) => a[0] - b[0]).map(f => d[f[1]])
         
            h.map((y, i) => {
                score += y == this.check[idx][i] ? 1 : 0
            })


        })
        if (score > this.record) {
            this.record = score
            this.sw1 = this.w1.slice()
            this.sgw = this.gw.slice()
            console.log(this.record, this.reorder([1,2,3,4,5,6,7,8]).join('-'))
        }
        this.w1 = this.sw1.map(s => Math.random() > .95 ? _.random(0, 32) : s)
        this.gw = this.sgw.map(s => Math.random() > .9 ?( Math.random()) : s)

    }

}

let sortL = new sortLogic()
while (true) {
    sortL.step()


}