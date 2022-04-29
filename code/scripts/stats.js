require('dotenv').config()
const { min, chunk, uniqBy } = require('lodash')
const readline = require('readline')
const { promises: fs, constants: fsConstants, createReadStream } = require('fs')
const unit = require('ethjs-unit')
const BN = require('bn.js')
const rlp = require('rlp')
const ONEUtil = require('../lib/util')
const { setConfig } = require('../lib/config/provider')
const config = require('../lib/config/common')
setConfig(config)
const { api, initBlockchain } = require('../lib/api')
initBlockchain()
const moment = require('moment-timezone')
const T0 = process.env.T0 ? Date.parse(process.env.T0) : Date.now() - 3600 * 1000 * 24 * 3
const RELAYER_ADDRESSES = (process.env.RELAYER_ADDRESSES || '0xc8cd0c9ca68b853f73917c36e9276770a8d8e4e0').split(',').map(s => s.toLowerCase().trim())
const STATS_CACHE = process.env.STATS_CACHE || './data/stats.json'
const ADDRESSES_CACHE = process.env.ADDRESSES_CACHE || './data/addresses.csv'
const ADDRESSES_TEMP = process.env.ADDRESSES_TEMP || './data/addresses.temp.csv'
const MAX_BALANCE_AGE = parseInt(process.env.MAX_BALANCE_AGE || 3600 * 1000 * 24)
const SLEEP_BETWEEN_RPC = parseInt(process.env.SLEEP_BETWEEN_RPC || 100)
const RPC_BATCH_SIZE = parseInt(process.env.RPC_BATCH_SIZE || 50)
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || 500)

const computeDirectCreationContractAddress = (from, nonce) => {
  const encoded = new Uint8Array(rlp.encode([from, nonce]))
  const hashed = ONEUtil.keccak(encoded)
  return ONEUtil.hexString(hashed.slice(12))
}

const batchGetBalance = async (addresses) => {
  console.log(`Retrieving balances of ${addresses.length} addresses with batch size = ${RPC_BATCH_SIZE}`)
  const chunks = chunk(addresses, RPC_BATCH_SIZE)
  const balances = []
  for (const c of chunks) {
    console.log(`c[0]: ${JSON.stringify(c[0])}`)
    // const b = await Promise.all(c.map(a => api.blockchain.getBalance({ address: a })))
    const b = await Promise.all(c.map(a => api.blockchain.getBalance({ address: '0xdc9d1024241e488848250340770c2b97452c720d' })))
    // console.log(`b:${JSON.stringify(b)}`)
    // const b2 = await c.map(a => api.blockchain.getBalance({ address: a }))
    // console.log(`b2:${JSON.stringify(b2)}`)
    // const walletBalance = new BN(await web3.eth.getBalance(c[0]))
    // console.log(`walletBalance:${JSON.stringify(walletBalance)}`)
    // const bS = await Promise.all(c.map(a => api.blockchain.getBalance({ address: '0xdc9d1024241e488848250340770c2b97452c720d' })))
    // console.log(`bS:${JSON.stringify(bS)}`)
    // const b2S = await c.map(a => api.blockchain.getBalance({ address: '0xdc9d1024241e488848250340770c2b97452c720d' }))
    // console.log(`b2S:${JSON.stringify(b2S)}`)
    // const walletBalanceS = new BN(await web3.eth.getBalance('0xdc9d1024241e488848250340770c2b97452c720d'))
    // console.log(`walletBalanceS:${JSON.stringify(walletBalanceS)}`)
    balances.push(...b)
    // console.log(`balances: ${JSON.stringify(balances)}`)
    await new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_RPC))
  }
  return balances
}

const timeString = timestamp => {
  return moment(timestamp).tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ssZ')
}

const search = async ({ address, target }) => {
  let left = 0; let mid = 1; let right = -1
  while (right < 0 || (left + 1 < right && left !== mid)) {
    console.log(`Binary searching pageIndex`, { left, mid, right })
    const transactions = await api.rpc.getTransactionHistory({ address, pageIndex: mid, pageSize: PAGE_SIZE, fullTx: false })
    console.log(`transactions[0]: ${JSON.stringify(transactions[0])}`)
    const h = transactions[transactions.length - 1]
    if (!h) {
      right = mid
      mid = Math.floor((left + right) / 2)
      continue
    }
    const { timestamp } = await api.rpc.getTransaction(h)
    const t = new BN(timestamp.slice(2), 16).toNumber() * 1000
    if (t <= target) {
      right = mid
      mid = Math.floor((left + right) / 2)
    } else {
      left = mid
      if (right < 0) {
        mid *= 2
      } else {
        mid = Math.floor((left + right) / 2)
      }
    }
  }
  return left
}
// TODO: add a binary search function to jump pageIndex to <to>
const scan = async ({ address, from = T0, to = Date.now(), retrieveBalance = true }) => {
  let pageIndex = await search({ address, target: to })
  let tMin = to
  console.log({ from, to })
  const wallets = []
  while (tMin > from) {
    const transactions = await api.rpc.getTransactionHistory({ address, pageIndex, pageSize: PAGE_SIZE, fullTx: true })
    if (!transactions || transactions.length === 0) {
      console.log(`Out of data at page ${pageIndex}; Exiting transaction history query loop`)
      tMin = from
      break
    }
    // console.log(`transactions:${JSON.stringify(transactions)}`)
    // console.log(`transactions[0]: ${JSON.stringify(transactions[0])}`)
    console.log(`transactions.length: ${transactions.length}`)
    tMin = Math.min(tMin, min(transactions.map(t => new BN(t.timestamp.slice(2), 16).toNumber() * 1000)))
    const creations = transactions.filter(e => e.input.startsWith('0x60806040'))
    // console.log(`creations:${JSON.stringify(creations)}`)
    console.log(`creations.length: ${creations.length}`)
    console.log(`Searched transaction history down to time = ${timeString(tMin)}; at page ${pageIndex}; retrieved ${transactions.length} transactions from relayer; ${creations.length} creations of 1wallet`)

    creations.forEach((t) => {
      // console.log(`In creations`)
      const { timestamp, nonce } = t
      const time = timestamp * 1000
      if (time < from) {
        return
      }
      wallets.push({ address: computeDirectCreationContractAddress(nonce), creationTime: time })
    })
    pageIndex++
    await new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_RPC))
  }
  const uniqueWallets = uniqBy(wallets, w => w.address)
  const balances = retrieveBalance && await batchGetBalance(uniqueWallets.map(w => w.address))
  return { balances, wallets: uniqueWallets }
}

async function refreshAllBalance () {
  const now = Date.now()
  const fp = await fs.open(ADDRESSES_CACHE, 'r')
  const fp2 = await fs.open(ADDRESSES_TEMP, 'w+')
  // const rs = fp.createReadStream()
  const rs = createReadStream(ADDRESSES_CACHE)
  const rl = readline.createInterface({ input: rs, crlfDelay: Infinity })
  const buf = []
  let totalBalance = new BN(0)
  const flush = async () => {
    const balances = await batchGetBalance(buf.map(e => e[0]))
    totalBalance = totalBalance.add(balances.reduce((r, b) => r.add(new BN(b)), new BN(0)))
    console.log(`Flushing balance update of size ${RPC_BATCH_SIZE}. Total balance = ${totalBalance.toString()}`)
    const hexBalances = balances.map(b => ONEUtil.hexView(new BN(b).toArrayLike(Uint8Array, 'be', 32)))
    const out = buf.map((e, i) => [...e, hexBalances[i]])
    await fp2.write(out.map(e => e.join(',')).join('\n') + '\n')
    buf.splice(0, buf.length)
  }
  for await (const line of rl) {
    const [address, hexTime] = line.split(',')
    buf.push([address, hexTime])
    if (buf.length >= RPC_BATCH_SIZE) {
      await flush()
    }
  }
  await flush()
  await fp.close()
  // await fs.cp(ADDRESSES_TEMP, ADDRESSES_CACHE, { force: true })
  // await fs.rm(ADDRESSES_TEMP)
  // await fs.copyFile(ADDRESSES_TEMP, ADDRESSES_CACHE, fsConstants.COPYFILE_FICLONE_FORCE)
  await fs.copyFile(ADDRESSES_TEMP, ADDRESSES_CACHE)
  await fs.rm(ADDRESSES_TEMP)
  console.log(`Balance refresh complete. Total balance: ${ONEUtil.toOne(totalBalance.toString())}; Time elapsed: ${Math.floor(Date.now() - now)}ms`)
  return {
    totalBalance: totalBalance.toString(),
    lastBalanceRefresh: now
  }
}

async function exec () {
  const fp = await fs.open(STATS_CACHE, 'a+')
  const fp2 = await fs.open(ADDRESSES_CACHE, 'a+')
  const stats = JSON.parse((await fp.readFile({ encoding: 'utf-8' }) || '{}'))
  const now = Date.now()
  const from = stats.lastScanTime || 0
  console.log(`from: ${new Date(from).toISOString()}`)
  let totalBalance = new BN(stats.totalBalance)
  let totalAddresses = stats.totalAddresses
  for (const address of RELAYER_ADDRESSES) {
    console.log(`relayerAddress: ${address}`)
    const { balances, wallets } = await scan({ address, from })
    totalAddresses += wallets.length
    if (balances) {
      totalBalance = totalBalance.add(balances.reduce((r, b) => r.add(new BN(b)), new BN(0)))
      // console.log(`wallets.length: ${wallets.length}`)
      // console.log(`wallets[0]: ${JSON.stringify(wallets[0])}`)
      // console.log(`balances.length: ${balances.length}`)
      // console.log(`totalBalance: ${totalBalance}`)
      // console.log(`totalBalanceFormatted: ${unit.fromWei(totalBalance, 'ether')}`)
      // const hexTime0 = ONEUtil.hexView(new BN(wallets[0].creationTime).toArrayLike(Uint8Array, 'be', 32))
      // const hexBalance0 = ONEUtil.hexView(new BN(balances[0]).toArrayLike(Uint8Array, 'be', 32))
      // console.log(`hexTime0: ${hexTime0}`)
      // console.log(`hexBalance0: ${hexBalance0}`)
      const s = wallets.map((w, i) => {
        const hexTime = ONEUtil.hexView(new BN(w.creationTime).toArrayLike(Uint8Array, 'be', 32))
        const hexBalance = ONEUtil.hexView(new BN(balances[i]).toArrayLike(Uint8Array, 'be', 32))
        return `${w.address},${hexTime},${hexBalance}`
      }).join('\n')
      await fp2.write(s + '\n')
    }
  }
  const newStats = {
    totalBalance: totalBalance.toString(),
    totalAddresses,
    lastBalanceRefresh: stats.lastBalanceRefresh || 0,
    lastScanTime: now
  }
  console.log(`writing new stats`, newStats)
  await fp.truncate()
  await fp.write(JSON.stringify(newStats), 0, 'utf-8')

  const updateBalance = now - (stats.lastBalanceRefresh || 0) >= MAX_BALANCE_AGE
  if (!updateBalance) {
    return
  }
  await fp2.close()
  const s = await refreshAllBalance()
  const refreshedStats = { ...newStats, ...s }
  console.log(`writing refreshed stats`, refreshedStats)
  await fp.truncate()
  await fp.write(JSON.stringify(refreshedStats), 0, 'utf-8')
  await fp.close()
}

exec().catch(e => console.error(e))
