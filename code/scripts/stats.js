require('dotenv').config()
const axios = require('axios')
const { min, chunk, uniqBy } = require('lodash')
const readline = require('readline')
const { promises: fs } = require('fs')
const BN = require('bn.js')
const rlp = require('rlp')
const ONEUtil = require('../lib/util')
const { setConfig } = require('../lib/config/provider')
const config = require('../lib/config/common')
const assert = require('assert')
setConfig(config)
const { api, initBlockchain } = require('../lib/api')
initBlockchain()
const moment = require('moment-timezone')
const T0 = process.env.T0 ? Date.parse(process.env.T0) : Date.now() - 3600 * 1000 * 24 * 3
const RELAYER_ADDRESSES = (process.env.RELAYER_ADDRESSES || '0xc8cd0c9ca68b853f73917c36e9276770a8d8e4e0').split(',').map(s => s.toLowerCase().trim())
const STATS_CACHE = process.env.STATS_CACHE || './data/stats.json'
const ARCHIVE_RPC_URL = process.env.ARCHIVE_RPC_URL || config.networks[config.defaults.network].url
const ADDRESSES_CACHE = process.env.ADDRESSES_CACHE || './data/addresses.csv'
const ADDRESSES_TEMP = process.env.ADDRESSES_TEMP || './data/addresses.temp.csv'
const MAX_BALANCE_AGE = parseInt(process.env.MAX_BALANCE_AGE || 3600 * 1000 * 24)
const SLEEP_BETWEEN_RPC = parseInt(process.env.SLEEP_BETWEEN_RPC || 150)
const RPC_BATCH_SIZE = parseInt(process.env.RPC_BATCH_SIZE || 50)
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE || 500)
const SAFE_MODE = process.env.SAFE_MODE === 'true'

const parseHexNumber = n => new BN(n.slice(2), 16).toNumber()

const codeCache = {}
const factoryAddresses = {}

const getCode = async (deployerAddress) => {
  if (codeCache[deployerAddress]) {
    return codeCache[deployerAddress]
  }
  const code = await api.factory.getCode({ deployer: deployerAddress })
  codeCache[deployerAddress] = ONEUtil.hexStringToBytes(code)
  return codeCache[deployerAddress]
}
const getFactoryAddress = async (deployerAddress) => {
  if (factoryAddresses[deployerAddress]) {
    return factoryAddresses[deployerAddress]
  }
  const factoryAddress = await api.factory.getFactoryAddress({ deployer: deployerAddress })
  factoryAddresses[deployerAddress] = factoryAddress
  return factoryAddress
}

const getPredictedAddress = async ({ input, deployerAddress }) => {
  const s = 'tuple(tuple(bytes32,uint8,uint8,uint32,uint32,uint8),tuple(uint256,uint256,uint32,uint32,uint32,uint256),address,address[],tuple(bytes32,uint8,uint8,uint32,uint32,uint8)[],tuple(bytes32,uint8,uint8,uint32,uint32,uint8)[],bytes[])'
  const args = ONEUtil.abi.decodeParameters([s], input.slice(10))
  const identificationKeys = args[0][args[0].length - 1]
  const key = identificationKeys[0]
  if (!key) {
    return null
  }
  const code = await getCode(deployerAddress)
  const factoryAddress = await getFactoryAddress(deployerAddress)
  const predicted = ONEUtil.predictAddress({ code, identificationKey: key, factoryAddress })
  if (SAFE_MODE) {
    const onChainPredicted = await api.factory.predictAddress({ identificationKey: key, deployer: deployerAddress })
    const verified = await api.factory.verify({ address: predicted, deployer: deployerAddress })
    assert(verified, 'must be 1wallet deployed by factory')
    assert(predicted === onChainPredicted, 'predicted address must equal to on-chain predicted address')
    console.log(`SAFE mode check succeeded: address=${predicted} key=${key}`)
  }
  return predicted
}

const computeDirectCreationContractAddress = (from, nonce) => {
  const encoded = new Uint8Array(rlp.encode([from, nonce]))
  const hashed = ONEUtil.keccak(encoded)
  return ONEUtil.hexString(hashed.slice(12))
}

const batchGetBalance = async (addresses) => {
  console.log(`Retrieving balances of ${addresses.length} addresses with batch size = ${RPC_BATCH_SIZE}`)
  const chunks = chunk(addresses.filter(e => e), RPC_BATCH_SIZE)
  const balances = []
  for (const c of chunks) {
    console.log(`Getting balance for ${c.length} addresses [${c.slice(0, 3).join(',')}, ...]`)
    const b = await Promise.all(c.map(a => api.blockchain.getBalance({ address: a })))
    balances.push(...b)
    await new Promise((resolve) => setTimeout(resolve, SLEEP_BETWEEN_RPC))
  }
  return balances
}

const timeString = timestamp => {
  return moment(timestamp).tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ssZ')
}

const base = axios.create({ baseURL: ARCHIVE_RPC_URL, timeout: 10000 })

const search = async ({ address, target }) => {
  let left = 0; let mid = 1; let right = -1
  while (right < 0 || (left + 1 < right && left !== mid)) {
    console.log(`Binary searching pageIndex`, { left, mid, right })
    const transactions = await api.rpc.getTransactionHistory({ base, address, pageIndex: mid, pageSize: PAGE_SIZE, fullTx: false })
    const h = transactions[transactions.length - 1]
    if (!h) {
      right = mid
      mid = Math.floor((left + right) / 2)
      continue
    }
    const { timestamp } = await api.rpc.getTransaction(h)
    const t = parseHexNumber(timestamp) * 1000
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
  const wallets = []
  while (tMin > from) {
    const transactions = await api.rpc.getTransactionHistory({ base, address, pageIndex, pageSize: PAGE_SIZE, fullTx: true })
    if (!transactions || transactions.length === 0) {
      console.log(`Out of data at page ${pageIndex}; Exiting transaction history query loop`)
      tMin = from
      break
    }
    // console.log(transactions)
    tMin = Math.min(tMin, min(transactions.map(t => parseHexNumber(t.timestamp) * 1000)))
    const directCreations = transactions.filter(e => e.input.startsWith('0x60806040'))
    for (const t of directCreations) {
      const { timestamp, nonce } = t
      const time = parseHexNumber(timestamp) * 1000
      if (time < from) {
        return
      }
      const a = computeDirectCreationContractAddress(address, parseHexNumber(nonce))
      wallets.push({ address: a, creationTime: time })
    }
    const factoryCreations = transactions.filter(e => e.input.startsWith('0xf31e87d9'))
    for (const t of factoryCreations) {
      const { timestamp, input, to: deployerAddress } = t
      const time = parseHexNumber(timestamp) * 1000
      if (time < from) {
        continue
      }
      const address = await getPredictedAddress({ input, deployerAddress })
      if (!address) {
        console.warn(`Empty address prediction from transaction ${t.hash}; possibly failed transactions with incorrect parameters`)
      }
      wallets.push({ address, creationTime: time })
    }

    console.log(`Searched transaction history down to time = ${timeString(tMin)}`)
    console.log(`at page ${pageIndex}; retrieved ${transactions.length} transactions from relayer;`)
    console.log(`${directCreations.length} direct creations of 1wallet`)
    console.log(`${factoryCreations.length} factory creations of 1wallet`)

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
  const rs = fp.createReadStream()
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
  await fs.cp(ADDRESSES_TEMP, ADDRESSES_CACHE, { force: true })
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
  let totalBalance = new BN(stats.totalBalance)
  let totalAddresses = stats.totalAddresses || 0
  for (const address of RELAYER_ADDRESSES) {
    const { balances, wallets } = await scan({ address, from })
    totalAddresses += wallets.length
    if (balances) {
      totalBalance = totalBalance.add(balances.reduce((r, b) => r.add(new BN(b)), new BN(0)))
      const s = wallets.map((w, i) => {
        const hexTime = ONEUtil.hexView(new BN(w.creationTime).toArrayLike(Uint8Array, 'be', 8))
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

// For testing
// async function g () {
//   const a = await getPredictedAddress({
//     input: '0xf31e87d90000000000000000000000000000000000000000000000000000000000000020c4ddca2ddeeb18241d4b6538f30b2b04ec177e6ed17cd552d72c711a2802306a0000000000000000000000000000000000000000000000000000000000000015000000000000000000000000000000000000000000000000000000000000001e000000000000000000000000000000000000000000000000000000000346006000000000000000000000000000000000000000000000000000000000000fff00000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000010f0cf064dd59200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000015180000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010f0cf064dd592000000000000000000000000000007534978f9fa903150ed429c486d1f42b7fdb7a6100000000000000000000000000000000000000000000000000000000000002200000000000000000000000000000000000000000000000000000000000000240000000000000000000000000000000000000000000000000000000000000026000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000401b8c25008d2b2cd43d4939ea0e6bbca0bffabd4d2a3e7ea8d166036953765fd4953b6973bd909f4b9ba508dd4de7e1761be478c20761859988eca001f91b9122',
//     deployerAddress: '0xc4a963ec3615842007a2cbdafdef8eeb66992e5e'
//   })
//   console.log(a)
// }
// g().catch(e => console.error(e))
