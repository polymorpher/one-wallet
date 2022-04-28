/*
Sample Data
Relayer 0: one1erxse89x3wzn7uu30smwjfm8wz5d3e8quuvkgq = 0xc8cd0c9ca68b853f73917c36e9276770a8d8e4e0
Relayer1: one1uzcqcc930jmes7khnuzwl4lz2uky5cgq78az79 = 0xe0b00c60b17cb7987ad79f04efd7e2572c4a6100
OneWallet Deployed: one1ryky5n7uvps9n9aw7a3wfw65psz6480smh9nrd = 0x192c4a4fdc60605997aef762e4bb540c05aa9df0
Deployed bytecode starts with : 0x60806040
Event ONEWalletDeploySuccess: 0xbbfe2306f6111c06403cdf36cf7df46751a594b54d6da11bcca906ad8c9a711f

Sample Command
Running specifying date: `T0=2022/01/01 node 1wallets.js`
*/
const axios = require('axios')
const { promises: fs, constants: fsConstants } = require('fs')
const Web3 = require('web3')
const web3 = new Web3(Web3.givenProvider || 'https://api.s0.t.hmny.io')
const BN = require('bn.js')
const unit = require('ethjs-unit')
const now = Date.now()
const nowDateISOString = new Date().toISOString()
const relayerAddress = process.env.relayerAddress || '0xc8cd0c9ca68b853f73917c36e9276770a8d8e4e0'
const rlp = require('rlp')
const ONEUtil = require('../lib/util')
const totalsControlFile = './data/totalsControl.json'
const totalsFile = './data/totals.json'
const moment = require('moment-timezone')
const base = {
  'jsonrpc': '2.0',
  'method': 'hmyv2_getTransactionsHistory',
  'params': [{
    'address': relayerAddress,
    'fullTx': true,
    'txType': 'ALL',
    'pageSize': 100,
    'pageIndex': 0,
    'order': 'DESC'
  }],
  'id': 0
}

// Get Control Data
const readJsonFile = async ({ file }) => {
  let jsonObject = {}
  console.log(`file: ${file}`)
  try {
    await fs.access(file, fsConstants.F_OK)
  } catch (ex) {
    console.log(`File ${file} did not exist and has been created`)
    await fs.writeFile(file, JSON.stringify(jsonObject), { encoding: 'utf-8' })
    return { jsonObject }
  }
  try {
    const json = await fs.readFile(file, { encoding: 'utf-8' })
    let jsonObject = JSON.parse(json)
    return { jsonObject }
  } catch (ex) {
    console.log(`Error reading ${file}`)
    return { jsonObject }
  }
}

const writeJsonFile = async ({ file, jsonObject }) => {
  await fs.writeFile(file, JSON.stringify(jsonObject), { encoding: 'utf-8' })
  return { file, jsonObject }
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

const updateRelayerInfo = async ({ relayerControl }) => {
  let relayerFile = './data/relayer_' + relayerControl.relayerAddress + '.json'
  let totalBalance = new BN(0)
  let { jsonObject: relayerInfo } = await readJsonFile({ file: relayerFile })
  if (!relayerInfo.wallets) { relayerInfo.wallets = [] }
  let id = 0
  let pageIndex = 0
  let tMin = now
  const lastExtractTime = nowDateISOString
  const addresses = []
  const t0 = relayerControl.lastExtractTime ? Date.parse(relayerControl.lastExtractTime) : now - 3600 * 1000 * 24 * 3
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
    // console.log(`searched up to time = ${timeString(tMin)}; at page ${pageIndex} (100 per page); retrieved ${transactions.length} transactions from relayer; ${creations.length} creations of 1wallet`)

    creations.forEach((t) => {
      const { timestamp, nonce } = t
      const time = timestamp * 1000
      if (time < t0) {
        return
      }
      const address = computeContractAddress(nonce)
      const thisWallet = { walletAddress: address, creationTime: time, lastExtractTime, balance: 0 }
      addresses.push(thisWallet)
      relayerInfo.wallets.push(thisWallet)
    })
    id++
    pageIndex++
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  // Loop appending each address to relayerInfo
  // DeDup relayerInfo and order by CreationDate
  relayerInfo.wallets.filter((v, i, a) => a.findIndex(v2 => (v2.walletAddress === v.walletAddress)) === i)
  // const relayerInfo.wallets = [...new Map(arr.map(v => [v.walletAddress, v])).values()] // if order doesn't matter
  // Loop through relayerInfo  getting Balances
  for (let i = 0; i < relayerInfo.wallets.length; i++) {
    const walletBalance = new BN(await web3.eth.getBalance(relayerInfo.wallets[i].walletAddress))
    totalBalance = totalBalance.add(walletBalance)
    relayerInfo.wallets[i].balance = unit.fromWei(walletBalance, 'ether')
  }
  let relayerControlNew = {
    relayerAddress: relayerControl.relayerAddress,
    refreshWallets: relayerControl.refreshWallets,
    refreshBalances: relayerControl.refreshBalances,
    lastExtractTime,
    walletCount: relayerInfo.wallets.length,
    totalBalance
  }
  // Update Relayer Info
  await writeJsonFile({ file: relayerFile, jsonObject: relayerInfo })
  console.log(`relayerControlNew: ${JSON.stringify(relayerControlNew)}`)
  return { relayerControlNew }
}

async function f () {
  // read controlData [relayerAddress, lastExtractTime, walletCount, totalBalance]
  let { jsonObject: initialTotals } = await readJsonFile({ file: totalsFile })
  console.log(`totals: ${JSON.stringify(initialTotals)}`)
  let { jsonObject: totalsControl } = await readJsonFile({ file: totalsControlFile })

  let walletCount = 0
  let totalBalance = new BN(0)
  for (let i = 0; i < totalsControl.controlInformation.length; i++) {
    let relayerControl = totalsControl.controlInformation[i]
    let { relayerControlNew } = await updateRelayerInfo({ relayerControl })
    // Update Totals
    walletCount += relayerControlNew.walletCount
    totalBalance = totalBalance.add(relayerControlNew.totalBalance)
    // format the relayer totalBalance
    totalsControl.controlInformation[i] = relayerControlNew
    totalsControl.controlInformation[i].totalBalance = unit.fromWei(relayerControlNew.totalBalance, 'ether')
    console.log(`totalBalance: ${walletCount}`)
    console.log(`totalBalance: ${totalBalance}`)
  }
  // Update totals ControlInfo
  await writeJsonFile({ file: totalsControlFile, jsonObject: totalsControl })
  console.log(`totalsControl: ${JSON.stringify(totalsControl)}`)
  // Update Totals
  let totals = { walletCount, totalBalance: unit.fromWei(totalBalance, 'ether') }
  await writeJsonFile({ file: totalsFile, jsonObject: totals })
  console.log(`totals: ${JSON.stringify(totals)}`)
}

f().catch(e => console.error(e))
