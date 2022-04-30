const { promises: fs } = require('fs')
const { sortBy } = require('lodash')
const BN = require('bn.js')
const moment = require('moment-timezone')
const ADDRESSES_CACHE = process.env.ADDRESSES_CACHE || './data/addresses.csv'
const BIN_SIZE = parseInt(process.env.BIN_SIZE || 7) * 3600 * 1000 * 24
const ONEUtil = require('../lib/util')

const timeString = timestamp => {
  return moment(timestamp).tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ssZ')
}

async function exec () {
  const lines = (await fs.readFile(ADDRESSES_CACHE, { encoding: 'utf-8' })).split('\n')
  const bins = {}
  for (const line of lines) {
    const [, th, bh] = line.split(',')
    const time = new BN(th, 16)
    const balance = new BN(bh, 16)
    const bin = time.div(new BN(BIN_SIZE)).toNumber()
    bins[bin] = (bins[bin] || new BN(0)).add(balance)
  }
  const sortedBins = sortBy(Object.entries(bins), e => e[0])
  for (const b of sortedBins) {
    console.log(timeString(b[0] * BIN_SIZE), ONEUtil.toOne(b[1]))
  }
}

exec().catch(ex => console.error(ex))
