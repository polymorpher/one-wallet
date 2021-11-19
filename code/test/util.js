const ONEWalletLib = require('../lib/onewallet')
const ONEWalletUtil = require('../lib/util')
const ONEWallet = artifacts.require('ONEWallet')
const config = require('../config')
const base32 = require('hi-base32')
const BN = require('bn.js')
const INTERVAL = 30000
const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}

const createWallet = async ({ effectiveTime, duration, maxOperationsPerInterval, lastResortAddress, spendingLimit, doubleOtp, randomness = 0, hasher = ONEWalletUtil.sha256b,
  spendingInterval = 86400, backlinks = []
}) => {
  const otpSeed = base32.encode('0xdeadbeef1234567890123456789012')
  const identificationKeys = [ONEWalletUtil.getIdentificationKey(otpSeed, true)]
  let otpSeed2
  if (doubleOtp) {
    otpSeed2 = base32.encode('0x1234567890deadbeef')
  }
  effectiveTime = Math.floor(effectiveTime / INTERVAL) * INTERVAL
  const { seed, seed2, hseed, root, leaves, layers, maxOperationsPerInterval: slotSize, randomnessResults, counter, innerTrees } = await ONEWalletLib.computeMerkleTree({
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

  const innerCores = []
  for (let [index, innerTree] of innerTrees.entries()) {
    const { root: innerRoot, layers: innerLayers } = innerTree
    const innerInterval = INTERVAL * 6
    const innerLifespan = duration / innerInterval
    innerCores.push([innerRoot, innerLayers.height, innerInterval, t0 + index, innerLifespan, slotSize])
    if (!innerRoot) {
      throw new Error(`inner core has empty root: ${JSON.stringify(innerRoot)}`)
    }
  }

  const initArgs = [
    [root, height, interval, t0, lifespan, slotSize],
    [ new BN(spendingLimit), new BN(0), new BN(0), new BN(spendingInterval), new BN(0), new BN(spendingLimit) ],
    lastResortAddress,
    backlinks,
    [], // old cores - need not testing at the moment. To add later (TODO)
    innerCores,
    identificationKeys,
  ]
  Logger.debug('Creating ONEWallet contract with parameters', initArgs)
  const wallet = await ONEWallet.new()
  Logger.debug('Address', wallet.address)
  wallet.initialize(initArgs)

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
      innerTrees,
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
