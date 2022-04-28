const axios = require('axios')
const now = Date.now()
const t0 = process.env.T0 ? Date.parse(process.env.T0) : now - 3600 * 1000 * 24 * 3
const relayerAddress = process.env.relayerAddress || '0xc8cd0c9ca68b853f73917c36e9276770a8d8e4e0'
const rlp = require('rlp')
const ONEUtil = require('../lib/util')
const moment = require('moment-timezone')
const base = {
  'jsonrpc': '2.0',
  'method': 'hmyv2_getTransactionsHistory',
  'params': [{
    'address': 'one1erxse89x3wzn7uu30smwjfm8wz5d3e8quuvkgq',
    'fullTx': true,
    'txType': 'ALL',
    'pageSize': 100,
    'pageIndex': 0,
    'order': 'DESC'
  }],
  'id': 0
}

const makeRequest = ({ id, pageIndex }) => {
  const r = { ...base, id }
  r.params[0].pageIndex = pageIndex
  return r
}

const computeContractAddress = (nonce) => {
  const encoded = new Uint8Array(rlp.encode([relayerAddress, nonce]))
  const hashed = ONEUtil.keccak(encoded)
  const address = ONEUtil.hexString(hashed.slice(12))
  return address
}

const timeString = timestamp => {
  return moment(timestamp).tz('America/Los_Angeles').format('YYYY-MM-DDTHH:mm:ssZ')
}

async function f () {
  let id = 0
  let pageIndex = 0
  let tMin = now
  const addresses = []
  while (tMin > t0) {
    const { data } = await axios.post('https://api.s0.t.hmny.io', makeRequest({ id, pageIndex }))
    const { result: { transactions } } = data
    if (!transactions) {
      console.log(`Out of data at page ${pageIndex}; Exiting`)
      tMin = t0
      break
    }
    transactions.forEach(t => {
      const time = t.timestamp * 1000
      if (tMin > time) {
        tMin = time
      }
    })
    const creations = transactions.filter(e => e.input.startsWith('0x60806040'))
    console.log(`searched up to time = ${timeString(tMin)}; at page ${pageIndex} (100 per page); retrieved ${transactions.length} transactions from relayer; ${creations.length} creations of 1wallet`)

    creations.forEach((t) => {
      const { timestamp, nonce } = t
      const time = timestamp * 1000
      if (time < t0) {
        return
      }
      const address = computeContractAddress(nonce)
      addresses.push({ address, time })
    })
    id++
    pageIndex++
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  console.log(`Got ${addresses.length} addresses from ${timeString(t0)} to ${timeString(now)}`)
  addresses.forEach(a => {
    const { address, time } = a
    console.log(`${timeString(time)} ${address}`)
  })
}

f().catch(e => console.error(e))
