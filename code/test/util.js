const { loadContracts } = require('../extensions/loader')
const OW = require('../lib/onewallet')
const OWUtil = require('../lib/util')
const config = require('../config')
const base32 = require('hi-base32')
const BN = require('bn.js')
const unit = require('ethjs-unit')
const INTERVAL = 30000
const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}
let Factories
// eslint-disable-next-line no-unused-vars
let Libraries
let Wallet
const init = async () => {
  const { factories, libraries, ONEWalletAbs } = await loadContracts()
  Factories = factories
  Libraries = libraries
  Wallet = ONEWalletAbs
  console.log('Initialized')
}

const deploy = async (initArgs) => {
  if (!Factories) {
    await init()
  }
  return Factories['ONEWalletFactoryHelper'].deploy(initArgs)
}

const ONE_ETH = unit.toWei('1', 'ether')

const makeCores = async ({
  seed = '0xdeadbeef1234567890123456789012',
  seed2 = '0x1234567890deadbeef',
  maxOperationsPerInterval = 1,
  doubleOtp = false,
  effectiveTime,
  duration,
  randomness = 0,
  hasher = OWUtil.sha256b }) => {
  let byteSeed = seed
  if (typeof seed === 'string') {
    byteSeed = OWUtil.stringToBytes('0xdeadbeef1234567890123456789012')
  }
  const otpSeed = OWUtil.base32Encode(byteSeed)
  const identificationKeys = [OWUtil.getIdentificationKey(byteSeed, true)]
  let otpSeed2
  let byteSeed2 = seed2
  if (doubleOtp) {
    if (typeof seed2 === 'string') {
      byteSeed2 = OWUtil.stringToBytes('0x1234567890deadbeef')
    }
    otpSeed2 = base32.encode(byteSeed2)
  }
  effectiveTime = Math.floor(effectiveTime / INTERVAL) * INTERVAL
  const { seed: computedSeed, seed2: computedSeed2, hseed, root, leaves, layers, maxOperationsPerInterval: slotSize, randomnessResults, counter, innerTrees } = await OW.computeMerkleTree({
    otpSeed,
    otpSeed2,
    effectiveTime,
    maxOperationsPerInterval,
    duration,
    randomness,
    hasher,
    reportInterval: config.verbose ? 1 : null,
    progressObserver: (i, n, s) => {
      Logger.debug(`${((i + 1 / n) * 100).toFixed(2)}% (${i}/${n}) (Stage ${s})`)
    }
  })
  const height = layers.length
  const t0 = effectiveTime / INTERVAL
  const lifespan = duration / INTERVAL
  const interval = INTERVAL / 1000

  const innerCores = []
  for (let innerTree of innerTrees) {
    const { root: innerRoot, layers: innerLayers } = innerTree
    const innerInterval = INTERVAL * 6
    const innerLifespan = Math.floor(duration / innerInterval)
    const innerT0 = Math.floor(effectiveTime / innerInterval)
    innerCores.push([innerRoot, innerLayers.length, innerInterval / 1000, innerT0, innerLifespan, slotSize])

    if (!innerRoot) {
      throw new Error(`inner core has empty root: ${JSON.stringify(innerTree)}`)
    }
  }
  Logger.debug('Inner Cores:', innerCores)

  const core = [root, height, interval, t0, lifespan, slotSize]

  const vars = {
    otpSeed,
    otpSeed2,
    byteSeed,
    byteSeed2,
    seed: computedSeed,
    seed2: computedSeed2,
    hseed,
    randomness,
    randomnessResults,
    counter,
    root, // uint8array
    client: {
      leaves, // uint8array packed altogether
      layers, // uint8array[] each layer is packed uint8array
      root,
      innerTrees
    },
    contract: {
      slotSize, // maxOperationsPerInterval
      t0, // starting index
      lifespan, // number of indices before the contract expires
      interval // seconds
    } }

  return { core, innerCores, identificationKeys, vars }
}

const createWallet = async ({
  effectiveTime,
  duration,
  lastResortAddress,
  maxOperationsPerInterval = 1,
  spendingLimit = ONE_ETH,
  doubleOtp = false,
  randomness = 0,
  hasher = OWUtil.sha256b,
  spendingInterval = 86400,
  backlinks = []
}) => {
  const { core, innerCores, identificationKeys, vars } = makeCores({ maxOperationsPerInterval, doubleOtp, effectiveTime, duration, randomness, hasher })
  const initArgs = [
    core,
    [ new BN(spendingLimit), new BN(0), new BN(0), new BN(spendingInterval), new BN(0), new BN(spendingLimit) ],
    lastResortAddress,
    backlinks,
    [], // old cores - need not testing at the moment. To add later (TODO)
    innerCores,
    identificationKeys,
  ]
  Logger.debug('Creating ONEWallet contract with parameters', initArgs)
  const tx = await deploy(initArgs)
  Logger.debug(tx)
  const successLog = tx.logs.find(log => log.event === 'ONEWalletDeploySuccess')
  if (!successLog) {
    throw new Error('Wallet deploy unsuccessful')
  }
  Logger.debug(successLog)
  const address = successLog.args.addr
  Logger.debug('Address', address)

  return {
    identificationKeys,
    address,
    wallet: new Wallet(address),
    ...vars
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
  makeCores,
  Logger,
  getFactory: (factory) => Factories[factory]
}
