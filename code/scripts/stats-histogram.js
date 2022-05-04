const { promises: fs } = require('fs')
const { sortBy } = require('lodash')
const BN = require('bn.js')
const moment = require('moment-timezone')
const ADDRESSES_CACHE = process.env.ADDRESSES_CACHE || './data/addresses.csv'
const BIN_SIZE = parseInt(process.env.BIN_SIZE || 7) * 3600 * 1000 * 24
const ONEUtil = require('../lib/util')
const { setConfig } = require('../lib/config/provider')
const config = require('../lib/config/common')
const json2csv = require('json2csv')
const OUT = process.env.OUT || './data/stats-histogram.csv'

setConfig(config)
const { api, initBlockchain } = require('../lib/api')
initBlockchain()

const timeString = timestamp => {
  return moment(timestamp).tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ssZ')
}

const parseHexNumber = n => n && new BN(n.slice(2), 16).toNumber()

const THRESHOLD100 = ONEUtil.toFraction(100)
const freshBin = () => ({
  originalBalance: new BN(0),
  upgradedBalance: new BN(0),
  numOriginalWallets: 0,
  numUpgradedWallets: 0,
  numTimeless: 0,
  numTimeless100: 0,
  timelessBalance: new BN(0),
  numWeb: 0,
  numWeb100: 0,
  numEmptyAccount: 0,
  webBalance: new BN(0),
  webStakedBalance: new BN(0),
  num7dayActiveWeb: 0,
  num7dayActiveTimeless: 0,
  num7dayActive: 0,
  num30dayActive: 0,
  num30dayActiveWeb: 0,
  num30dayActiveTimeless: 0,
})

const makeBinJson = ({ originalBalance,
  upgradedBalance,
  numOriginalWallets,
  numUpgradedWallets,
  numTimeless,
  timelessBalance,
  numTimeless100,
  numWeb,
  numWeb100,
  webBalance,
  webStakedBalance,
  numEmptyAccount,
  num7dayActiveWeb,
  num7dayActiveTimeless,
  num7dayActive,
  num30dayActive,
  num30dayActiveWeb,
  num30dayActiveTimeless,
}) => ({
  originalBalance: ONEUtil.toOne(originalBalance),
  upgradedBalance: ONEUtil.toOne(upgradedBalance),
  timelessBalance: ONEUtil.toOne(timelessBalance),
  numOriginalWallets,
  numUpgradedWallets,
  numTimeless,
  numTimeless100,
  numWeb,
  numWeb100,
  webBalance: ONEUtil.toOne(webBalance),
  webStakedBalance: ONEUtil.toOne(webStakedBalance),
  numEmptyAccount,
  num7dayActiveWeb,
  num7dayActiveTimeless,
  num7dayActive,
  num30dayActive,
  num30dayActiveWeb,
  num30dayActiveTimeless,
})
async function exec () {
  const lines = (await fs.readFile(ADDRESSES_CACHE, { encoding: 'utf-8' })).split('\n')
  const bins = {}
  for (const [index, line] of lines.entries()) {
    const [a, th, bh] = line.split(',')
    const time = new BN(th, 16)
    const balance = new BN(bh, 16)
    if (index % 50 === 0) {
      console.log(`Processed ${index}`)
    }
    const bin = time.div(new BN(BIN_SIZE)).toNumber()
    if (!bins[bin]) {
      bins[bin] = freshBin()
    }
    if (balance.eqn(0)) {
      bins[bin].numEmptyAccount += 1
      continue
    }
    try {
      const { majorVersion } = await api.blockchain.getVersion({ address: a })
      // const { lastResortAddress } = await api.blockchain.getWallet({ address: a })
      const innerCores = majorVersion >= 15 ? (await api.blockchain.getInnerCores({ address: a })) : []
      const backlinks = majorVersion >= 9 ? (await api.blockchain.getBacklinks({ address: a })) : []
      const [{ timestamp } = {}] = await api.rpc.getTransactionHistory({ address: a, pageSize: 1, fullTx: true })
      const delegations = await api.staking.getDelegations({ address: a })
      const totalStaked = delegations.reduce((r, e) => {
        const amount = r.add(ONEUtil.toBN(e.amount))
        const undelegated = e.undelegations.map(e => ONEUtil.toBN(e.Amount)).reduce((rr, ee) => rr.add(ee), new BN(0))
        return amount.add(undelegated)
      }, new BN(0))
      const timestampParsed = parseHexNumber(timestamp) || 0
      const is7dayActive = timestampParsed * 1000 >= Date.now() - 3600 * 1000 * 24 * 7
      const is30dayActive = timestampParsed * 1000 >= Date.now() - 3600 * 1000 * 24 * 30
      const isUpgrade = backlinks.length > 0
      const isTimeless = !isUpgrade && (majorVersion >= 15 && innerCores.length === 0
      // || (majorVersion === 14 && lastResortAddress.toLowerCase() === '0x02f2cf45dd4bacba091d78502dba3b2f431a54d3')
      )

      if (isUpgrade) {
        bins[bin].upgradedBalance = bins[bin].upgradedBalance.add(balance)
        bins[bin].numUpgradedWallets += 1
      } else {
        bins[bin].originalBalance = bins[bin].originalBalance.add(balance)
        bins[bin].numOriginalWallets += 1
      }
      if (isTimeless) {
        bins[bin].numTimeless += 1
        bins[bin].timelessBalance = bins[bin].timelessBalance.add(balance)
      } else {
        bins[bin].numWeb += 1
        bins[bin].webBalance = bins[bin].webBalance.add(balance).add(totalStaked)
        bins[bin].webStakedBalance = bins[bin].webStakedBalance.add(totalStaked)
      }
      if (balance.gte(THRESHOLD100)) {
        if (isTimeless) {
          bins[bin].numTimeless100 += 1
        } else {
          bins[bin].numWeb100 += 1
        }
      }
      if (is7dayActive) {
        bins[bin].num7dayActive += 1
        if (isTimeless) {
          bins[bin].num7dayActiveTimeless += 1
        } else {
          bins[bin].num7dayActiveWeb += 1
        }
      }
      if (is30dayActive) {
        bins[bin].num30dayActive += 1
        if (isTimeless) {
          bins[bin].num30dayActiveTimeless += 1
        } else {
          bins[bin].num30dayActiveWeb += 1
        }
      }
    } catch (ex) {
      console.error(ex)
      console.error('[ERROR]', line)
    } finally {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  const sortedBins = sortBy(Object.entries(bins), e => e[0])
  const aggBin = freshBin()
  for (const [time, bin] of sortedBins) {
    const {
      originalBalance,
      upgradedBalance,
      numOriginalWallets,
      numUpgradedWallets,
      numTimeless,
      timelessBalance,
      numTimeless100,
      numWeb,
      numWeb100,
      webBalance,
      webStakedBalance,
      numEmptyAccount,
      num7dayActiveWeb,
      num7dayActiveTimeless,
      num7dayActive,
      num30dayActive,
      num30dayActiveWeb,
      num30dayActiveTimeless,
    } = bin
    aggBin.originalBalance = aggBin.originalBalance.add(originalBalance)
    aggBin.upgradedBalance = aggBin.upgradedBalance.add(upgradedBalance)
    aggBin.timelessBalance = aggBin.timelessBalance.add(timelessBalance)
    aggBin.webBalance = aggBin.webBalance.add(webBalance)
    aggBin.webStakedBalance = aggBin.webStakedBalance.add(webStakedBalance)
    aggBin.numOriginalWallets += numOriginalWallets
    aggBin.numUpgradedWallets += numUpgradedWallets
    aggBin.numTimeless += numTimeless
    aggBin.numWeb += numWeb
    aggBin.numTimeless100 += numTimeless100
    aggBin.numWeb100 += numWeb100
    aggBin.numEmptyAccount += numEmptyAccount
    aggBin.num7dayActiveWeb += num7dayActiveWeb
    aggBin.num7dayActiveTimeless += num7dayActiveTimeless
    aggBin.num7dayActive += num7dayActive
    aggBin.num30dayActive += num30dayActive
    aggBin.num30dayActiveWeb += num30dayActiveWeb
    aggBin.num30dayActiveTimeless += num30dayActiveTimeless
    console.log(timeString(time * BIN_SIZE), makeBinJson(bin))
  }
  console.log('agg', makeBinJson(aggBin))
  const parsed = json2csv.parse(sortedBins.map(e => ({ createdInBin: timeString(e[0] * BIN_SIZE), ...makeBinJson(e[1]) })))
  await fs.writeFile(OUT, parsed)
  console.log(`Wrote to ${OUT}`)
}

exec().catch(ex => console.error(ex))
