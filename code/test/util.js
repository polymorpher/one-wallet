const { loadContracts } = require('../extensions/loader')
const { range } = require('lodash')
const config = require('../config')
const base32 = require('hi-base32')
const BN = require('bn.js')
const unit = require('ethjs-unit')
const ONE = require('../lib/onewallet')
const ONEParser = require('../lib/parser')
const ONEDebugger = require('../lib/debug')

const { backoff } = require('exponential-backoff')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')
const TestERC1155 = artifacts.require('TestERC1155')
const VALID_SIGNATURE_VALUE = '0x1626ba7e'
const INVALID_SIGNATURE_VALUE = '0xffffffff'

const HALF_ETH = unit.toWei('0.5', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const INTERVAL = 30000
const DURATION = INTERVAL * 12
const SLOT_SIZE = 1
const MAX_UINT32 = new BN(2).pow(new BN(32)).subn(1)
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

// ==== DEPLOYMENT FUNCTIONS ====
const init = async () => {
  const { factories, libraries, ONEWalletAbs } = await loadContracts(Logger)
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

// ==== INFRASTRUCTURE FUNCTIONS ====
const getClient = async () => {
  return web3.eth.getNodeInfo()
}

const increaseTime = async (seconds) => {
  const client = await getClient()
  if (client.indexOf('TestRPC') === -1) {
    throw new Error('Client is not ganache-cli and cannot forward time')
  }

  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_increaseTime',
    params: [seconds],
    id: 0,
  }, (err) => err && console.error(err))

  await web3.currentProvider.send({
    jsonrpc: '2.0',
    method: 'evm_mine',
    params: [],
    id: 0,
  }, (err) => err && console.error(err))

  console.log('EVM increased time by', seconds)
}

const snapshot = async () => {
  console.log('Taking EVM Snapshot')
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_snapshot' },
      (err, { result } = {}) => {
        if (err) {
          reject(err)
        }
        resolve(result)
      })
  })
}

const revert = async (id) => {
  console.log(`EVM reverting to ${id}`)
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_revert', params: [id] }, (err, { result } = {}) => {
      if (err) {
        reject(err)
      }
      resolve(result)
    })
  })
}

const sleep = async (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
const wait = async (seconds) => {
  Logger.debug(`wait: ${seconds}`)
  await sleep(seconds * 1000)
}
const waitForReceipt = async (transactionHash) => backoff(async () => web3.eth.getTransactionReceipt(transactionHash), {
  retry: (ex, n) => Logger.debug(`[${n}] waiting for receipt...`) || true })

const bumpTestTime = async (testEffectiveTime, bumpSeconds) => {
  Logger.debug(`Simulated Timestamp       : ${testEffectiveTime}`)
  Logger.debug(`Simulated increase (secs) : ${bumpSeconds}`)
  testEffectiveTime = testEffectiveTime + (bumpSeconds * 1000)
  const blockNumber = await web3.eth.getBlockNumber()
  const chainTime = await ((await web3.eth.getBlock(blockNumber)).timestamp) * 1000
  const chainBumpSeconds = Math.floor((testEffectiveTime - chainTime) / 1000)
  Logger.debug(`Current System Time       : ${Date.now()}`)
  Logger.debug(`Block Number              : ${JSON.stringify(blockNumber)}`)
  Logger.debug(`Blockchain Clock Time     : ${JSON.stringify(chainTime)}`)
  Logger.debug(`New Simulated Timestamp   : ${testEffectiveTime}`)
  Logger.debug(`Increased Blockchain Time : ${chainBumpSeconds}`)
  await increaseTime(chainBumpSeconds)
  const newBlockNumber = await web3.eth.getBlockNumber()
  const newChainTime = (await web3.eth.getBlock(newBlockNumber)).timestamp * 1000
  Logger.debug(`New Block Number          : ${JSON.stringify(newBlockNumber)}`)
  Logger.debug(`New Blockchain Clock      : ${JSON.stringify(newChainTime)}`)
  Logger.debug(`====================================`)
  return testEffectiveTime
}

// ==== HELPER FUNCTIONS ====

const printInnerTrees = ({ Debugger, innerTrees }) => {
  for (let [index, innerTree] of innerTrees.entries()) {
    const { layers: innerLayers, root: innerRoot } = innerTree
    Logger.debug(`Inner tree ${index}, root=${ONEUtil.hexString(innerRoot)}`)
    Debugger.printLayers({ layers: innerLayers })
  }
}

const makeCores = async ({
  salt = new BN(0),
  seed = '0x' + (new BN(ONEUtil.hexStringToBytes('0xdeadbeef1234567890123456789012')).add(salt).toString('hex')),
  seed2 = '0x' + (new BN(ONEUtil.hexStringToBytes('0x1234567890deadbeef123456789012')).add(salt).toString('hex')),
  maxOperationsPerInterval = 1,
  doubleOtp = false,
  effectiveTime,
  duration,
  randomness = 0,
  hasher = ONEUtil.sha256b }) => {
  let byteSeed = seed
  if (typeof seed === 'string') {
    byteSeed = ONEUtil.stringToBytes(seed)
  }
  const otpSeed = ONEUtil.base32Encode(byteSeed)
  const identificationKeys = [ONEUtil.getIdentificationKey(byteSeed, true)]
  let otpSeed2
  let byteSeed2 = seed2
  if (doubleOtp) {
    if (typeof seed2 === 'string') {
      byteSeed2 = ONEUtil.stringToBytes(seed2)
    }
    otpSeed2 = base32.encode(byteSeed2)
  }
  effectiveTime = Math.floor(effectiveTime / INTERVAL) * INTERVAL
  const { seed: computedSeed, seed2: computedSeed2, hseed, root, leaves, layers, maxOperationsPerInterval: slotSize, randomnessResults, counter, innerTrees } = await ONE.computeMerkleTree({
    otpSeed,
    otpSeed2,
    effectiveTime,
    maxOperationsPerInterval,
    duration,
    randomness,
    hasher,
    reportInterval: config.verbose ? (process.env.REPORT_INTERVAL || 100) : null,
    progressObserver: (i, n, s) => {
      Logger.debug(`${(((i + 1) / n) * 100).toFixed(2)}% (${i}/${n}) (Stage ${s})`)
    }
  })
  const height = layers.length
  const t0 = effectiveTime / INTERVAL
  const lifespan = duration / INTERVAL
  const interval = INTERVAL / 1000

  const innerCores = ONEUtil.makeInnerCores({ innerTrees, effectiveTime, duration })
  // Logger.debug('Inner Cores:', innerCores)

  const core = [ONEUtil.hexString(root), height, interval, t0, lifespan, slotSize]

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

const getEOTP = async ({ seed, hseed, effectiveTime, timeOffset }) => {
  const counter = timeOffset && Math.floor((Date.now() + timeOffset) / INTERVAL)
  const otp = ONEUtil.genOTP({ seed, counter })
  const index = ONEUtil.timeToIndex({ effectiveTime, time: timeOffset && (Date.now() + timeOffset) })
  const eotp = await ONE.computeEOTP({ otp, hseed })
  return { index, eotp }
}

const createWallet = async ({
  salt,
  seed,
  effectiveTime,
  duration,
  lastResortAddress,
  maxOperationsPerInterval = 1,
  spendingLimit = ONE_ETH,
  doubleOtp = false,
  randomness = 0,
  hasher = ONEUtil.sha256b,
  spendingInterval = 3000,
  backlinks = []
}) => {
  const { core, innerCores, identificationKeys, vars } = await makeCores({ salt, seed, maxOperationsPerInterval, doubleOtp, effectiveTime, duration, randomness, hasher })
  const initArgs = [
    core,
    [ new BN(spendingLimit), new BN(0), new BN(0), new BN(spendingInterval), new BN(0), new BN(spendingLimit) ],
    lastResortAddress,
    backlinks,
    [], // old cores - need not testing at the moment. To add later (TODO)
    innerCores,
    identificationKeys,
  ]
  const tx = await deploy(initArgs)
  Logger.debug('Creating ONEWallet contract with parameters', initArgs)
  Logger.debug(tx)
  const successLog = tx.logs.find(log => log.event === 'ONEWalletDeploySuccess')
  if (!successLog) {
    throw new Error('Wallet deploy unsuccessful')
  }
  // Logger.debug(successLog)
  const address = successLog.args.addr
  // Logger.debug('Address', address)
  return {
    identificationKeys,
    address,
    wallet: new Wallet(address),
    ...vars
  }
}

// makeWallet uses an index and unlocked web3.eth.account and creates and funds a ONEwallet
const makeWallet = async ({
  salt,
  deployer,
  effectiveTime,
  duration = DURATION,
  maxOperationsPerInterval = SLOT_SIZE,
  spendingLimit = ONE_ETH,
  fundAmount = HALF_ETH,
  setLastResortAddress = true,
  backlinks = [],
  validate = true
}) => {
  let lastResortAddress = setLastResortAddress ? (await web3.eth.accounts.create()).address : ONEConstants.EmptyAddress
  const { wallet, seed, hseed, client: { layers } } = await createWallet({
    salt: new BN(ONEUtil.keccak(salt)),
    effectiveTime,
    duration,
    maxOperationsPerInterval,
    lastResortAddress,
    spendingLimit,
    backlinks
  })
  let balance = await fundWallet({ to: wallet.address, from: deployer, fundAmount })
  if (validate) { await validateBalance({ address: wallet.address, amount: fundAmount }) }
  const state = await getState(wallet)

  return { walletInfo: { wallet: wallet, seed, hseed, layers, lastResortAddress }, state, balance }
}

// makeTokens makes test ERC20, ERC20Decimals9, ERC721, ERC1155
const makeTokens = async ({
  deployer,
  makeERC20 = true,
  makeERC721 = true,
  makeERC1155 = true,
}) => {
  const testerc20 = makeERC20 && (await TestERC20.new(10000000, { from: deployer }))
  const testerc721 = makeERC721 && (await TestERC721.new(range(10), range(10).map(e => `ipfs://test721/${e}`), { from: deployer }))
  const testerc1155 = makeERC1155 && (await TestERC1155.new(range(10), range(10, 110, 10), range(10).map(e => `ipfs://test1155/${e}`), { from: deployer }))
  return { testerc20, testerc721, testerc1155 }
}

const fundWallet = async ({ from, to, value = HALF_ETH }) => {
  await web3.eth.sendTransaction({ from, to, value })
  const balance = await web3.eth.getBalance(to)
  return new BN(balance).toString()
}

// === EVENT VALIDATION ====
const validateEvent = ({ tx, expectedEvent }) => {
  const events = ONEParser.parseTxLog(tx?.receipt?.rawLogs)
  Logger.debug(`events: ${JSON.stringify(events)}`)
  const event = events.filter(e => e.eventName === expectedEvent)[0]
  const eventName = event?.eventName
  Logger.debug(`eventName: ${eventName}`)
  assert.deepStrictEqual(expectedEvent, eventName, 'Expected event not triggered')
}

// ==== ADDRESS VALIDATION HELPER FUNCTIONS ====
// These functions retrieve values using an address
// They are typically used to validate wallets balances have been funded or updated
// They do not update State
// Functions must not mutate arguments' inner state unless stated in the name

const validateBalance = async ({ address, amount = HALF_ETH }) => {
  let balance = await web3.eth.getBalance(address)
  assert.equal(amount, balance, 'Wallet should have a different balance')
}

// ==== PARSING HELPER FUNCTIONS ====

const getInfoParsed = async (wallet) => {
  let walletInfo = await wallet.getInfo()
  let info = {}
  info = {
    root: walletInfo[0],
    height: new BN(walletInfo[1]).toNumber(),
    interval: new BN(walletInfo[2]).toNumber(),
    t0: new BN(walletInfo[3]).toNumber(),
    lifespan: new BN(walletInfo[4]).toNumber(),
    maxOperationsPerInterval: new BN(walletInfo[5]).toNumber(),
    recoveryAddress: walletInfo[6],
    extra: new BN(walletInfo[7]).toNumber()
  }
  return info
}

const getOldInfosParsed = async (wallet) => {
  const walletOldInfos = await wallet.getOldInfos()
  let oldInfos = []
  for (let x of walletOldInfos) {
    oldInfos.push({
      root: x[0],
      height: new BN(x[1]).toNumber(),
      interval: new BN(x[2]).toNumber(),
      t0: new BN(x[3]).toNumber(),
      lifespan: new BN(x[4]).toNumber(),
      maxOperationsPerInterval: new BN(x[5]).toNumber()
    })
  }
  return oldInfos
}

const getInnerCoresParsed = async (wallet) => {
  const walletInnerCores = await wallet.getInnerCores()
  let innerCores = []
  for (let x of walletInnerCores) {
    innerCores.push({
      root: x[0],
      height: new BN(x[1]).toNumber(),
      interval: new BN(x[2]).toNumber(),
      t0: new BN(x[3]).toNumber(),
      lifespan: new BN(x[4]).toNumber(),
      maxOperationsPerInterval: new BN(x[5]).toNumber()
    })
  }
  return innerCores
}

const getVersionParsed = async (wallet) => {
  const walletVersion = await wallet.getVersion()
  const version = {
    majorVersion: new BN(walletVersion[0]).toNumber(),
    minorVersion: new BN(walletVersion[1]).toNumber()
  }
  return version
}

const getSpendingStateParsed = async (wallet) => {
  const walletSpendingState = await wallet.getSpendingState()
  const spendingState = {
    spendingLimit: walletSpendingState[0].toString(),
    spentAmount: walletSpendingState[1].toString(),
    lastSpendingInterval: walletSpendingState[2].toString(),
    spendingInterval: walletSpendingState[3].toString(),
    lastLimitAdjustmentTime: walletSpendingState[4].toString(),
    highestSpendingLimit: walletSpendingState[5].toString()
  }
  return spendingState
}

const getAllCommitsParsed = async (wallet) => {
  let walletAllCommits = await wallet.getAllCommits()
  const [hashes, paramsHashes, verificationHashes, timestamps, completed] = Object.keys(walletAllCommits).map(k => walletAllCommits[k])
  const allCommits = hashes.map((e, i) => ({ hash: hashes[i], paramsHash: paramsHashes[i], verificationHash: verificationHashes[i], timestamp: timestamps[i], completed: completed[i] }))
  return allCommits
}

const getTrackedTokensParsed = async (wallet) => {
  const walletTrackedTokens = await wallet.getTrackedTokens()
  const [tokenType, contractAddress, tokenId] = Object.keys(walletTrackedTokens).map(k => walletTrackedTokens[k])
  const trackedTokens = tokenType.map((e, i) => ({ tokenType: tokenType[i].toNumber(), contractAddress: contractAddress[i], tokenId: tokenId[i].toNumber() }))
  return trackedTokens
}

const getSignaturesParsed = async (wallet) => {
  const walletSignatures = await wallet.listSignatures(0, MAX_UINT32)
  const [hash, signature, timestamp, expireAt] = Object.keys(walletSignatures).map(k => walletSignatures[k])
  const signatures = hash.map((e, i) => ({ hash: hash[i], signature: signature[i], timestamp: timestamp[i], expireAt: expireAt[i] }))
  return signatures
}

// ==== STATE VALIDATION HELPER FUNCTIONS ====
// These functions validate elements of a wallets STATE
// They are typically used after an un update Operation to validate changed elements
// They return an updated OldState by replacing elements from the current state

const syncAndValidateStateMutation = async ({ wallet, oldState, validateNonce = true }) => {
  if (validateNonce) {
    const nonce = await wallet.getNonce()
    assert.equal(nonce.toNumber(), oldState.nonce + 1, 'wallet.nonce should have been changed')
    oldState.nonce = nonce.toNumber()
  }
  const lastOperationTime = await wallet.lastOperationTime()
  assert.notStrictEqual(lastOperationTime, oldState.lastOperationTime, 'wallet.lastOperationTime should have been updated')
  oldState.lastOperationTime = lastOperationTime.toNumber()
  const allCommits = await getAllCommitsParsed(wallet)
  assert.notDeepEqual(allCommits, oldState.allCommits, 'wallet.allCommits should have been updated')
  oldState.allCommits = allCommits
  return oldState
}

const syncAndValidateSpendingStateMutation = async ({
  expectedSpendingState = {
    highestSpendingLimit: '1000000000000000000', // Default to ONE ETH
    lastLimitAdjustmentTime: '0', // Default to zero i.e. no adjustments
    lastSpendingInterval: '0', // Default to zero i.e. have not changed spending interval
    spendingInterval: '3000', // Default to 30 second spending interval
    spendingLimit: '1000000000000000000', // Default to ONE ETH
    spentAmount: '0', // Default to zero i.e. nothing spent
  },
  wallet
}) => {
  let spendingState = await getSpendingStateParsed(wallet)
  assert.equal(expectedSpendingState.highestSpendingLimit, spendingState.highestSpendingLimit, 'Expected highestSpendingLimit to have changed')
  assert.equal(expectedSpendingState.lastLimitAdjustmentTime, spendingState.lastLimitAdjustmentTime, 'Expected lastLimitAdjustmentTime to have changed')
  assert.equal(expectedSpendingState.lastSpendingInterval, spendingState.lastSpendingInterval, 'Expected lastSpendingInterval to have changed')
  assert.equal(expectedSpendingState.spendingInterval, spendingState.spendingInterval, 'Expected spendingInterval to have changed')
  assert.equal(expectedSpendingState.spendingLimit, spendingState.spendingLimit, 'Expected spendingLimit to have changed')
  assert.equal(expectedSpendingState.spentAmount, spendingState.spentAmount, 'Expected spentAmount to have changed')
  return spendingState
}

const syncAndValidateOldSignaturesMutation = async ({ expectedSignatures, wallet }) => {
  let signatures = getSignaturesParsed(wallet)
  // check all expectedSignatures are valid
  for (let i = 0; i < expectedSignatures.length; i++) {
    const v = await wallet.isValidSignature(expectedSignatures[i].hash, expectedSignatures[i].signature)
    Logger.debug(v)
    assert.strictEqual(v, VALID_SIGNATURE_VALUE, `signature ${expectedSignatures[i].signature} should be valid`)
  }
  return signatures
}

// ==== STATE RETREIVAL AND VALIDATION FUNCTIONS =====

// get OneWallet state
const getState = async (wallet) => {
  Logger.debug(`getting State for: ${wallet.address}`)
  const address = wallet.address
  const identificationKey = await wallet.identificationKey()
  const identificationKeys = await wallet.getIdentificationKeys()
  const forwardAddress = await wallet.getForwardAddress()
  const info = await getInfoParsed(wallet)
  const oldInfos = await getOldInfosParsed(wallet)
  const innerCores = await getInnerCoresParsed(wallet)
  const rootKey = await wallet.getRootKey()
  const version = await getVersionParsed(wallet)
  const spendingState = await getSpendingStateParsed(wallet)
  const nonce = new BN(await wallet.getNonce()).toNumber()
  const lastOperationTime = new BN(await wallet.lastOperationTime()).toNumber()
  const allCommits = await getAllCommitsParsed(wallet)
  const trackedTokens = await getTrackedTokensParsed(wallet)
  const signatures = await getSignaturesParsed(wallet)
  const backlinks = await wallet.getBacklinks()

  let state = {}
  state = {
    address,
    identificationKey,
    identificationKeys,
    forwardAddress,
    info,
    oldInfos,
    innerCores,
    rootKey,
    version,
    spendingState,
    nonce,
    lastOperationTime,
    allCommits,
    trackedTokens,
    backlinks,
    signatures,
  }
  Logger.debug(`state: ${JSON.stringify(state)}`)
  return state
}

// check OneWallet state
const checkONEWalletStateChange = async (oldState, currentState) => {
  assert.deepEqual(currentState.identificationKey, oldState.identificationKey, 'wallet.identificationKey is incorrect')
  assert.deepEqual(currentState.identificationKeys, oldState.identificationKeys, 'wallet.identificationKeys is incorrect')
  assert.deepEqual(currentState.forwardAddress, oldState.forwardAddress, 'wallet.forwardAddress is incorrect')
  assert.deepEqual(currentState.info, oldState.info, 'wallet.info is incorrect')
  assert.deepEqual(currentState.oldInfos, oldState.oldInfos, 'wallet.oldInfos is incorrect')
  assert.deepEqual(currentState.innerCores, oldState.innerCores, 'wallet.innerCores is incorrect')
  assert.deepEqual(currentState.rootKey, oldState.rootKey, 'wallet.rootKey is incorrect')
  assert.deepEqual(currentState.version, oldState.version, 'wallet.version is incorrect')
  assert.deepEqual(currentState.spendingState, oldState.spendingState, 'wallet.spendingState is incorrect')
  // assert.deepEqual(currentState.nonce, oldState.nonce, 'wallet.nonce is incorrect') // nonce is calculated based on INTERVAL so removing for now
  assert.deepEqual(currentState.lastOperationTime, oldState.lastOperationTime, 'wallet.lastOperationTime is incorrect')
  assert.deepEqual(currentState.allCommits, oldState.allCommits, 'wallet.allCommits is incorrect')
  assert.deepEqual(currentState.trackedTokens, oldState.trackedTokens, 'wallet.trackedTokens is incorrect')
  assert.deepEqual(currentState.backlinks, oldState.backlinks, 'wallet.backlinks is incorrect')
  assert.deepEqual(currentState.signatures, oldState.signatures, 'wallet.signatures is incorrect')
}

// ==== EXECUTION FUNCTIONS ====

const commitReveal = async ({ layers, Debugger, index, eotp, paramsHash, commitParams, revealParams, wallet }) => {
  const neighbors = ONE.selectMerkleNeighbors({ layers, index })
  const neighbor = neighbors[0]
  const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
  if (typeof paramsHash === 'function') {
    const { hash } = paramsHash({ ...commitParams })
    paramsHash = hash
  }
  const { hash: verificationHash } = ONE.computeVerificationHash({ paramsHash, eotp })
  Logger.debug(`Committing`, { commitHash: ONEUtil.hexString(commitHash), paramsHash: ONEUtil.hexString(paramsHash), verificationHash: ONEUtil.hexString(verificationHash) })
  await wallet.commit(ONEUtil.hexString(commitHash), ONEUtil.hexString(paramsHash), ONEUtil.hexString(verificationHash))
  Logger.debug(`Committed`)
  const neighborsEncoded = neighbors.map(ONEUtil.hexString)
  Debugger.debugProof({ neighbors, height: layers.length, index, eotp, root: layers[layers.length - 1] })
  const commits = await wallet.lookupCommit(ONEUtil.hexString(commitHash))
  const commitHashCommitted = commits[0][0]
  const paramHashCommitted = commits[1][0]
  const verificationHashCommitted = commits[2][0]
  const timestamp = commits[3][0]
  const completed = commits[4][0]
  Logger.debug({ commit: { commitHashCommitted, paramHashCommitted, verificationHashCommitted, timestamp, completed }, currentTimeInSeconds: Math.floor(Date.now() / 1000) })
  const authParams = [neighborsEncoded, index, ONEUtil.hexString(eotp)]
  if (!revealParams.length) {
    const { operationType, tokenType, contractAddress, tokenId, dest, amount, data } = { ...ONEConstants.NullOperationParams, ...revealParams }
    revealParams = [operationType, tokenType, contractAddress, tokenId, dest, amount, data]
  }
  Logger.debug(`Revealing`, { authParams, revealParams })
  const wouldSucceed = await wallet.reveal.call(authParams, revealParams)
  Logger.debug(`Reveal success prediction`, !!wouldSucceed)
  const tx = await wallet.reveal(authParams, revealParams)
  return { tx, authParams, revealParams }
}

module.exports = {
  // deployment
  init,
  getFactory: (factory) => Factories[factory],

  // infrastructure
  Logger,
  increaseTime,
  snapshot,
  revert,
  wait,
  waitForReceipt,
  bumpTestTime,

  // helpers
  createWallet,
  makeCores,
  printInnerTrees,
  getEOTP,
  makeWallet,
  makeTokens,

  // event validation
  validateEvent,

  // address validation helpers
  validateBalance,

  // parsing helpers
  getInfoParsed,
  getOldInfosParsed,
  getInnerCoresParsed,
  getVersionParsed,
  getSpendingStateParsed,
  getAllCommitsParsed,
  getTrackedTokensParsed,
  getSignaturesParsed,

  // state helpers
  syncAndValidateStateMutation,
  syncAndValidateOldSignaturesMutation,
  syncAndValidateSpendingStateMutation,

  // state retrieval and validation
  getState,
  checkONEWalletStateChange,

  // execution
  commitReveal
}
