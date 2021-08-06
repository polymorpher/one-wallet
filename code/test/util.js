const ONEWalletLib = require('../lib/onewallet')
const ONEWalletUtil = require('../lib/util')
const ONEWallet = artifacts.require('ONEWallet')
const config = require('../config')
const base32 = require('hi-base32')
const INTERVAL = 30000
const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}

const createWallet = async ({ effectiveTime, duration, maxOperationsPerInterval, lastResortAddress, dailyLimit, doubleOtp, randomness = 0, hasher = ONEWalletUtil.sha256b }) => {
  const otpSeed = base32.encode('0xdeadbeef1234567890')
  let otpSeed2
  if (doubleOtp) {
    otpSeed2 = base32.encode('0x1234567890deadbeef')
  }
  effectiveTime = Math.floor(effectiveTime / INTERVAL) * INTERVAL
  const { seed, seed2, hseed, root, leaves, layers, maxOperationsPerInterval: slotSize, randomnessResults, counter } = await ONEWalletLib.computeMerkleTree({
    otpSeed,
    otpSeed2,
    effectiveTime,
    maxOperationsPerInterval,
    duration,
    randomness,
    hasher,
    progressObserver: (i, n, s) => {
      Logger.debug(`${((i / n) * 100).toFixed(2)}% (${i}/${n}) (Stage ${s})`)
    }
  })
  const height = layers.length
  const t0 = effectiveTime / INTERVAL
  const lifespan = duration / INTERVAL
  const interval = INTERVAL / 1000
  // constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_, uint8 maxOperationsPerInterval_,
  //   address payable lastResortAddress_, uint256 dailyLimit_)
  Logger.debug('Creating ONEWallet contract with parameters', {
    root: ONEWalletUtil.hexString(root), height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit
  })
  const wallet = await ONEWallet.new(
    ONEWalletUtil.hexString(root), height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit
  )

  return {
    seed,
    seed2,
    hseed,
    randomnessResults,
    counter,
    wallet, // smart contract
    root, // uint8array
    client: {
      leaves, // uint8array packed altogether
      layers, // uint8array[] each layer is packed uint8array
    },
    contract: {
      slotSize, // maxOperationsPerInterval
      t0, // starting index
      lifespan, // number of indices before the contract expires
      interval // seconds
    }
  }
}

const getClient = () => {
  return new Promise((resolve, reject) => {
    web3.eth.getNodeInfo((err, res) => {
      if (err !== null) return reject(err)
      return resolve(res)
    })
  })
}

const increaseTime = async (seconds) => {
  const client = await getClient()
  if (client.indexOf('TestRPC') === -1) {
    console.warning('Client is not ganache-cli and cannot forward time')
    return
  }

  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [seconds],
    id: 0,
  })

  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    params: [],
    id: 0,
  })
}
module.exports = {
  increaseTime,
  createWallet,
  Logger,
}
