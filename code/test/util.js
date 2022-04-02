const { loadContracts } = require('../extensions/loader')
const config = require('../config')
const base32 = require('hi-base32')
const BN = require('bn.js')
const unit = require('ethjs-unit')
const ONE = require('../lib/onewallet')
const ONEParser = require('../lib/parser')
const ONEDebugger = require('../lib/debug')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
// const ONEWallet = require('../lib/onewallet')
const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')
const TestERC1155 = artifacts.require('TestERC1155')

// const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const INTERVAL = 30000
const DURATION = INTERVAL * 12
const SLOT_SIZE = 1
const MAX_UINT32 = Math.pow(2, 32) - 1
const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}
// const Debugger = ONEDebugger(Logger)
let Factories
// eslint-disable-next-line no-unused-vars
let Libraries
let Wallet

// ==== DEPLOYMENT FUNCTIONS ====
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
const waitForReceipt = async (transactionHash) => {
  let transactionReceipt = null
  let i = 0
  while (transactionReceipt == null && i < 10) { // Waiting expectedBlockTime until the transaction is mined
    transactionReceipt = await web3.eth.getTransactionReceipt(transactionHash)
    if (transactionReceipt !== null) { break }
    await sleep(1000)
    i++
    Logger.debug(`waiting`)
  }
  assert.notEqual(null, transactionReceipt, `transactionReceipt not found for ${transactionHash} after waiting 10 seconds`)
}

const bumpTestTime = async (testEffectiveTime, bumpSeconds) => {
  Logger.debug(`testEffective   : ${testEffectiveTime}`)
  Logger.debug(`bumpSeconds     : ${bumpSeconds}`)
  testEffectiveTime = testEffectiveTime + (bumpSeconds * 1000)
  const blockNumber = await web3.eth.getBlockNumber()
  const chainTime = await ((await web3.eth.getBlock(blockNumber)).timestamp) * 1000
  const chainBumpSeconds = Math.floor((testEffectiveTime - chainTime) / 1000)
  Logger.debug(`Date.now()      : ${Date.now()}`)
  Logger.debug(`blockNumber     : ${JSON.stringify(blockNumber)}`)
  Logger.debug(`chainTime       : ${JSON.stringify(chainTime)}`)
  Logger.debug(`testEffective   : ${testEffectiveTime}`)
  Logger.debug(`chainBumpSeconds: ${chainBumpSeconds}`)
  await increaseTime(chainBumpSeconds)
  const newBlockNumber = await web3.eth.getBlockNumber()
  const newChainTime = (await web3.eth.getBlock(newBlockNumber)).timestamp * 1000
  Logger.debug(`newBlockNumber  : ${JSON.stringify(newBlockNumber)}`)
  Logger.debug(`newChainTime    : ${JSON.stringify(newChainTime)}`)
  Logger.debug(`==================`)
  return testEffectiveTime
}

// ==== HELPER FUNCTIONS ====

const printInnerTrees = ({ Debugger, innerTrees }) => {
  for (let [index, innerTree] of innerTrees.entries()) {
    const { layers: innerLayers, root: innerRoot } = innerTree
    console.log(`Inner tree ${index}, root=${ONEUtil.hexString(innerRoot)}`)
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
  let lastResortAddress
  if (setLastResortAddress) {
    let lastResortAccount = await web3.eth.accounts.create()
    lastResortAddress = lastResortAccount.address
  } else {
    lastResortAddress = ONEConstants.EmptyAddress
  }
  const { wallet, seed, hseed, client: { layers } } = await createWallet({
    salt: new BN(ONEUtil.keccak(salt)),
    effectiveTime,
    duration,
    maxOperationsPerInterval,
    lastResortAddress,
    spendingLimit,
    backlinks
  })
  let initialBalance = await fundWallet({ wallet, funder: deployer, fundAmount })
  if (validate) { await validateBalance({ address: wallet.address, amount: fundAmount }) }
  const walletOldState = await getONEWalletState(wallet)
  const walletCurrentState = walletOldState

  return {
    walletInfo: { wallet: wallet, seed, hseed, layers, lastResortAddress },
    walletOldState,
    walletCurrentState,
    initialBalance
  }
}

// makeTokens makes test ERC20, ERC20Decimals9, ERC721, ERC1155
const makeTokens = async ({
  deployer,
  makeERC20 = true,
  makeERC721 = true,
  makeERC1155 = true,
  fund = true,
  validate = true
}) => {
  let testerc20
  let testerc721
  let testerc1155
  // create an ERC20
  if (makeERC20) { testerc20 = await TestERC20.new(10000000, { from: deployer }) }
  // create an ERC721
  if (makeERC721) {
    const tids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const uris = tids.map(e => `ipfs://test721/${e}`)
    testerc721 = await TestERC721.new(tids, uris, { from: deployer })
  }
  // create an ERC1155
  if (makeERC1155) {
    const tids1155 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const amounts1155 = [10, 20, 20, 20, 20, 20, 20, 20, 20, 100]
    const uris1155 = tids1155.map(e => `ipfs://test1155/${e}`)
    testerc1155 = await TestERC1155.new(tids1155, amounts1155, uris1155, { from: deployer })
  }
  return { testerc20, testerc721, testerc1155 }
}

// fundwallet
const fundWallet = async ({ funder, wallet, value = HALF_ETH }) => {
  // Fund wallet
  await web3.eth.sendTransaction({
    from: funder,
    to: wallet.address,
    value
  })
  let balance = await web3.eth.getBalance(wallet.address)
  return balance
}

// ==== ADDRESS VALIDATION HELPER FUNCTIONS ====
// These functions retrieve values using an address
// They are typically used to validate wallets balances have been funded or updated
// They do not update State

const validateBalance = async ({ address, amount = HALF_ETH }) => {
  let balance = await web3.eth.getBalance(address)
  assert.equal(amount, balance, 'Wallet should have a different balance')
}

// updateOldTxnInfo: changed - nonce, lastOperationTime, commits,
const updateOldTxnInfo = async ({ wallet, oldState, validateNonce = true }) => {
  // nonce
  if (validateNonce) {
    let nonce = await wallet.getNonce()
    // assert.notEqual(nonce, oldState.nonce, 'wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), oldState.nonce + 1, 'wallet.nonce should have been changed')
    oldState.nonce = nonce.toNumber()
  }
  // lastOperationTime
  let lastOperationTime = await wallet.lastOperationTime()
  assert.notStrictEqual(lastOperationTime, oldState.lastOperationTime, 'wallet.lastOperationTime should have been updated')
  oldState.lastOperationTime = lastOperationTime.toNumber()
  // commits
  let allCommits = await wallet.getAllCommits()
  assert.notDeepEqual(allCommits, oldState.allCommits, 'wallet.allCommits should have been updated')
  oldState.allCommits = allCommits
  return oldState
}

// updateOldSpendingState
const updateOldSpendingState = async ({
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
  let spendingState = await wallet.getSpendingState()
  // newSpendingState reflects the current Spending State overwritten by the expectedSpendingState allowing us to 
  let newSpendingState = { ...spendingState, ...expectedSpendingState }
  if (newSpendingState.highestSpendingLimit) {
    assert.equal(newSpendingState.highestSpendingLimit, spendingState.highestSpendingLimit, 'Expected highestSpendingLimit to have changed')
  }
  if (newSpendingState.lastLimitAdjustmentTime) {
    assert.equal(newSpendingState.lastLimitAdjustmentTime, spendingState.lastLimitAdjustmentTime, 'Expected lastLimitAdjustmentTime to have changed')
  }
  if (newSpendingState.lastSpendingInterval) {
    assert.equal(newSpendingState.lastSpendingInterval, spendingState.lastSpendingInterval, 'Expected lastSpendingInterval to have changed')
  }
  if (newSpendingState.spendingInterval) {
    assert.equal(newSpendingState.spendingInterval, spendingState.spendingInterval, 'Expected spendingInterval to have changed')
  }
  if (newSpendingState.spendingLimit) {
    assert.equal(newSpendingState.spendingLimit, spendingState.spendingLimit, 'Expected spendingLimit to have changed')
  }
  if (newSpendingState.spentAmount) {
    assert.equal(newSpendingState.spentAmount, spendingState.spentAmount, 'Expected spentAmount to have changed')
  }
  let spendingStateObject = {
    spendingLimit: expectedSpendingState[0].toString(),
    spentAmount: expectedSpendingState[1].toString(),
    lastSpendingInterval: expectedSpendingState[2].toString(),
    spendingInterval: expectedSpendingState[3].toString(),
    lastLimitAdjustmentTime: expectedSpendingState[4].toString(),
    highestSpendingLimit: expectedSpendingState[5].toString()
  }
  return spendingStateObject
}

const validateEvent = ({ tx, expectedEvent }) => {
  const events = ONEParser.parseTxLog(tx?.receipt?.rawLogs)
  const event = events.filter(e => e.eventName === expectedEvent)[0]
  const eventName = event?.eventName
  console.log(`eventName: ${eventName}`)
  assert.deepStrictEqual(expectedEvent, eventName, 'Expected event not triggered') 
}

// ==== STATE RETREIVAL AND VALIDATION FUNCTIONS =====

// get OneWallet state
const getONEWalletState = async (wallet) => {
  Logger.debug(`getting State for: ${wallet.address}`)
  const address = (wallet.address).toString()
  const identificationKey = (await wallet.identificationKey()).toString()
  // console.log(`identificationKey: ${JSON.stringify(identificationKey)}`)
  const walletIdentificationKeys = await wallet.getIdentificationKeys()
  // console.log(`walletIdentificationKeys: ${JSON.stringify(walletIdentificationKeys)}`)
  let identificationKeys = []
  for (let x of walletIdentificationKeys) {
    identificationKeys.push(x[0].toString())
  }
  const forwardAddress = (await wallet.getForwardAddress()).toString()
  const walletInfo = await wallet.getInfo()
  let info = {}
  info = {
    root: walletInfo[0].toString(),
    height: new BN(walletInfo[1]).toNumber(),
    interval: new BN(walletInfo[2]).toNumber(),
    t0: new BN(walletInfo[3]).toNumber(),
    lifespan: new BN(walletInfo[4]).toNumber(),
    maxOperationsPerInterval: new BN(walletInfo[5]).toNumber(),
    recoveryAddress: walletInfo[6].toString(),
    extra: new BN(walletInfo[7]).toNumber()
  }
  const walletOldInfo = await wallet.getOldInfos()
  let oldInfo = []
  for (let x of walletOldInfo) {
    oldInfo.push({
      root: x[0].toString(),
      height: new BN(x[1]).toNumber(),
      interval: new BN(x[2]).toNumber(),
      t0: new BN(x[3]).toNumber(),
      lifespan: new BN(x[4]).toNumber(),
      maxOperationsPerInterval: new BN(x[5]).toNumber()
    })
  }
  const walletInnerCores = await wallet.getInnerCores()
  let innerCores = []
  for (let x of walletInnerCores) {
    innerCores.push({
      root: x[0].toString(),
      height: new BN(x[1]).toNumber(),
      interval: new BN(x[2]).toNumber(),
      t0: new BN(x[3]).toNumber(),
      lifespan: new BN(x[4]).toNumber(),
      maxOperationsPerInterval: new BN(x[5]).toNumber()
    })
  }
  const rootKey = (await wallet.getRootKey()).toString()
  const walletVersion = await wallet.getVersion()
  let version = {}
  version = {
    majorVersion: new BN(walletVersion[0]).toNumber(),
    minorVersion: new BN(walletVersion[1]).toNumber()
  }
  const walletSpendingState = await wallet.getSpendingState()
  let spendingState = {}
  spendingState = {
    spendingLimit: walletSpendingState[0].toString(),
    spentAmount: walletSpendingState[1].toString(),
    lastSpendingInterval: walletSpendingState[2].toString(),
    spendingInterval: walletSpendingState[3].toString(),
    lastLimitAdjustmentTime: walletSpendingState[4].toString(),
    highestSpendingLimit: walletSpendingState[5].toString()
  }
  const nonce = new BN(await wallet.getNonce()).toNumber()
  const lastOperationTime = new BN(await wallet.lastOperationTime()).toNumber()
  const walletAllCommits = await wallet.getAllCommits()
  // const [hashes, paramsHashes, verificationHashes, timestamps, completed] = Object.keys(walletAllCommits).map(k => walletAllCommits[k])
  // const allCommits = hashes.map((e, i) => ({ hash: hashes[i], paramsHash: paramsHashes[i], verificationHash: verificationHashes[i], timestamp: timestamps[i], completed: completed[i] }))
  let allCommits = {}
  // commitHashArray
  allCommits[0] = walletAllCommits[0]
  // paramHashArray
  allCommits[1] = walletAllCommits[1]
  // veriFicationHashArray
  allCommits[2] = walletAllCommits[2]
  // timestampArray
  allCommits[3] = walletAllCommits[3]
  // completedArray
  allCommits[4] = walletAllCommits[4]
  const walletTrackedTokens = await wallet.getTrackedTokens()
  // const [tokenType, contractAddress, tokenId] = Object.keys(walletTrackedTokens).map(k => walletTrackedTokens[k])
  // const trackedTokens = hashes.map((e, i) => ({ tokenType: tokenType[i], contractAddress: contractAddress[i], tokenId: tokenId[i] }))
  let trackedTokens = {}
  // tokenTypeArray
  trackedTokens[0] = walletTrackedTokens[0]
  // contractAddressArray
  trackedTokens[1] = walletTrackedTokens[1]
  // tokenIdArray
  trackedTokens[2] = walletTrackedTokens[2]
  const walletBacklinks = await wallet.getBacklinks()
  // const [backlinkAddresses] = Object.keys(walletBacklinks).map(k => walletBacklinks[k])
  // const backlinks = hashes.map((e, i) => ({ backlinkAddresses: backlinkAddresses[i] }))
  let backlinks = []
  for (let x of walletBacklinks) {
    backlinks.push(x)
  }
  const walletSignatures = await wallet.listSignatures(0, MAX_UINT32)
  // const [timestamp, expireAt, signature, hash] = Object.keys(walletSignatures).map(k => walletSignatures[k])
  // const signatures = hashes.map((e, i) => ({ timestamp: timestamp[i], expireAt: expireAt[i], signature: signature[i], hash: hash[i] }))
  let signatures = {}
  // Signature Tracker Hashes
  signatures[0] = walletSignatures[0]
  // signatures
  signatures[1] = walletSignatures[1]
  // timestamps
  signatures[2] = walletSignatures[2]
  // expiries
  signatures[3] = walletSignatures[3]

  let state = {}
  state = {
    address,
    identificationKey,
    identificationKeys,
    forwardAddress,
    info,
    oldInfo,
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
  // console.log(`state: ${JSON.stringify(state)}`)
  Logger.debug(`state: ${JSON.stringify(state)}`)
  return state
}

// check OneWallet state
const checkONEWalletStateChange = async (oldState, currentState) => {
  assert.deepEqual(currentState.identificationKey, oldState.identificationKey, 'wallet.identificationKey is incorrect')
  assert.deepEqual(currentState.identificationKeys, oldState.identificationKeys, 'wallet.identificationKeys is incorrect')
  assert.deepEqual(currentState.forwardAddress, oldState.forwardAddress, 'wallet.forwardAddress is incorrect')
  assert.deepEqual(currentState.info, oldState.info, 'wallet.info is incorrect')
  assert.deepEqual(currentState.oldInfo, oldState.oldInfo, 'wallet.oldInfos is incorrect')
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
  init,
  increaseTime,
  createWallet,
  makeCores,
  Logger,
  getFactory: (factory) => Factories[factory],
  commitReveal,
  printInnerTrees,
  getEOTP,
  snapshot,
  revert,
  wait,
  waitForReceipt,
  bumpTestTime,
  makeWallet,
  makeTokens,
  getONEWalletState,
  checkONEWalletStateChange,
  validateBalance,
  updateOldTxnInfo,
  updateOldSpendingState,
  validateEvent
}
