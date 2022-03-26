const { loadContracts } = require('../extensions/loader')
const config = require('../config')
const base32 = require('hi-base32')
const BN = require('bn.js')
const unit = require('ethjs-unit')
const ONE = require('../lib/onewallet')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const ONEWallet = require('../lib/onewallet')
const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')
const TestERC1155 = artifacts.require('TestERC1155')

// const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
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
const ONEDebugger = require('../lib/debug')
const Debugger = ONEDebugger(Logger)
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

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
const wait = async (seconds) => {
  Logger.debug(`wait: ${seconds}`)
  await sleep(seconds * 1000)
}
const getReceipt = async (transactionHash) => {
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
  spendingInterval = 86400,
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

const getEOTP = async ({ seed, hseed, effectiveTime, timeOffset }) => {
  const counter = timeOffset && Math.floor((Date.now() + timeOffset) / INTERVAL)
  const otp = ONEUtil.genOTP({ seed, counter })
  const index = ONEUtil.timeToIndex({ effectiveTime, time: timeOffset && (Date.now() + timeOffset) })
  const eotp = await ONE.computeEOTP({ otp, hseed })
  return { index, eotp }
}

// transactionExecute commits and reveals a wallet transaction
const transactionExecute = async ({ wallet, operationType, tokenType, contractAddress, tokenId, dest, amount, data, address, randomSeed, backlinkAddresses, testTime }) => {
  if (testTime === undefined) { testTime = Date.now() }
  // // calculate counter from testTime
  const counter = Math.floor(testTime / INTERVAL)
  const otp = ONEUtil.genOTP({ seed: wallet.seed, counter })
  // // calculate wallets effectiveTime (creation time) from t0
  const info = await wallet.wallet.getInfo()
  const t0 = new BN(info[3]).toNumber()
  const walletEffectiveTime = t0 * INTERVAL
  const index = ONEUtil.timeToIndex({ effectiveTime: walletEffectiveTime, time: testTime })
  const eotp = await ONE.computeEOTP({ otp, hseed: wallet.hseed })

  // Format commit and revealParams based on tokenType
  let commitParams
  let revealParams
  let paramsHash
  console.log(`operationType: ${operationType}`)
  switch (operationType) {
    case ONEConstants.OperationType.TRACK:
    case ONEConstants.OperationType.UNTRACK:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, dest }
      revealParams = { operationType, tokenType, contractAddress, dest }
      break
    case ONEConstants.OperationType.OVERRIDE_TRACK:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
    case ONEConstants.OperationType.RECOVER_SELECTED_TOKENS:
    case ONEConstants.OperationType.BATCH:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, data }
      revealParams = { operationType, data }
      break
    case ONEConstants.OperationType.BACKLINK_ADD:
    case ONEConstants.OperationType.BACKLINK_DELETE:
    case ONEConstants.OperationType.BACKLINK_OVERRIDE:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, backlinkAddresses, data }
      revealParams = { operationType, backlinkAddresses, data }
      break
    case ONEConstants.OperationType.COMMAND:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
    case ONEConstants.OperationType.SET_RECOVERY_ADDRESS:
      paramsHash = ONEWallet.computeSetRecoveryAddressHash
      commitParams = { operationType, address }
      revealParams = { operationType, address }
      break
    case ONEConstants.OperationType.FORWARD:
      paramsHash = ONEWallet.computeForwardHash
      commitParams = { operationType, address }
      revealParams = { operationType, address }
      break
    case ONEConstants.OperationType.RECOVER:
      paramsHash = ONEWallet.computeRecoveryHash
      commitParams = { operationType, randomSeed }
      revealParams = { operationType, randomSeed }
      break
    case ONEConstants.OperationType.CHANGE_SPENDING_LIMIT:
    case ONEConstants.OperationType.JUMP_SPENDING_LIMIT:
      console.log('Updating Spending Limit')
      paramsHash = ONEWallet.computeAmountHash
      commitParams = { operationType, amount }
      revealParams = { operationType, amount }
      break
    case ONEConstants.OperationType.SIGN:
    case ONEConstants.OperationType.REVOKE:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, contractAddress, tokenId, dest, amount }
      revealParams = { operationType, contractAddress, tokenId, dest, amount }
      break
    case ONEConstants.OperationType.TRANSFER_TOKEN:
      paramsHash = ONEWallet.computeGeneralOperationHash
      switch (tokenType) {
        case ONEConstants.TokenType.ERC20:
          commitParams = { operationType, tokenType, contractAddress, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, dest, amount }
          break
        case ONEConstants.TokenType.ERC721:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest }
          break
        case ONEConstants.TokenType.ERC1155:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          break
        default:
          console.log(`TODO: add in Token error handling for TRANSFER_TOKEN`)
          return
      }
      break
    case ONEConstants.OperationType.TRANSFER:
      paramsHash = ONEWallet.computeTransferHash
      commitParams = { operationType, dest, amount }
      revealParams = { operationType, dest, amount }
      break
    default:
      console.log(`TODO: add in error handling`)
      return
  }
  await commitReveal({
    Debugger,
    layers: wallet.layers,
    index,
    eotp,
    paramsHash,
    commitParams,
    revealParams,
    wallet: wallet.wallet
  })
}

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
  await wallet.reveal(authParams, revealParams)
  return { authParams, revealParams }
}

const printInnerTrees = ({ Debugger, innerTrees }) => {
  for (let [index, innerTree] of innerTrees.entries()) {
    const { layers: innerLayers, root: innerRoot } = innerTree
    console.log(`Inner tree ${index}, root=${ONEUtil.hexString(innerRoot)}`)
    Debugger.printLayers({ layers: innerLayers })
  }
}

// makeWallet uses an index and unlocked web3.eth.account and creates and funds a ONEwallet
const makeWallet = async (salt, deployer, effectiveTime, duration) => {
  if (duration === undefined) { duration = DURATION }
  const lastResortAccount = web3.eth.accounts.create()
  const { wallet, seed, hseed, root, client: { layers } } = await createWallet({
    salt: new BN(ONEUtil.keccak(salt)),
    effectiveTime,
    duration,
    maxOperationsPerInterval: SLOT_SIZE,
    lastResortAddress: lastResortAccount.address,
    spendingLimit: ONE_ETH
  })
  // Fund wallet
  await web3.eth.sendTransaction({
    from: deployer,
    to: wallet.address,
    value: HALF_ETH
  })
  return { wallet, seed, hseed, root, layers, lastResortAddress: lastResortAccount.address }
}

// makeTokens makes test ERC20, ERC20Decimals9, ERC721, ERC1155
const makeTokens = async (owner) => {
  // create an ERC20
  const testerc20 = await TestERC20.new(10000000, { from: owner })
  // create an ERC721
  const tids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const uris = ['ipfs://test721/0', 'ipfs://test721/1', 'ipfs://test721/2', 'ipfs://test721/3', 'ipfs://test721/4', 'ipfs://test721/5', 'ipfs://test721/6', 'ipfs://test721/7', 'ipfs://test721/8', 'ipfs://test721/9']
  const testerc721 = await TestERC721.new(tids, uris, { from: owner })
  // create an ERC1155
  const tids1155 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const amounts1155 = [10, 20, 20, 20, 20, 20, 20, 20, 20, 100]
  const uris1155 = ['ipfs://test1155/0', 'ipfs://test1155/1', 'ipfs://test1155/2', 'ipfs://test1155/3', 'ipfs://test1155/4', 'ipfs://test1155/5', 'ipfs://test1155/6', 'ipfs://test1155/7', 'ipfs://test1155/8', 'ipfs://test1155/9']
  const testerc1155 = await TestERC1155.new(tids1155, amounts1155, uris1155, { from: owner })
  return { testerc20, testerc721, testerc1155 }
}

// get OneWallet state
const getONEWalletState = async (wallet) => {
  Logger.debug(`getting State for: ${wallet.address}`)
  const address = (wallet.address).toString()
  const identificationKey = (await wallet.identificationKey()).toString()
  // console.log(`identificationKey: ${JSON.stringify(identificationKey)}`)
  const walletIdentificationKeys = await wallet.getIdentificationKeys()
  // console.log(`walletIdentificationKeys: ${JSON.stringify(walletIdentificationKeys)}`)
  let identificationKeys = []
  try {
    for (let x of walletIdentificationKeys) {
      identificationKeys.push(x[0].toString())
    }
  } catch (ex) {
    console.log(`Failed to parse walletIdentificationKeys: ${ex.toString()}`)
  }
  const forwardAddress = (await wallet.getForwardAddress()).toString()
  const walletInfo = await wallet.getInfo()
  let info = {}
  try {
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
  } catch (ex) {
    console.log(`Failed to parse Wallet Info: ${ex.toString()}`)
  }
  const walletOldInfo = await wallet.getOldInfos()
  let oldInfo = []
  try {
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
  } catch (ex) {
    console.log(`Failed to parse Old Info: ${ex.toString()}`)
  }
  const walletInnerCores = await wallet.getInnerCores()
  let innerCores = []
  try {
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
  } catch (ex) {
    console.log(`Failed to parse walletInnerCores: ${ex.toString()}`)
  }
  const rootKey = (await wallet.getRootKey()).toString()
  const walletVersion = await wallet.getVersion()
  let version = {}
  try {
    version = {
      majorVersion: new BN(walletVersion[0]).toNumber(),
      minorVersion: new BN(walletVersion[1]).toNumber()
    }
  } catch (ex) {
    console.log(`Failed to parse walletVersion: ${ex.toString()}`)
  }
  const walletSpendingState = await wallet.getSpendingState()
  let spendingState = {}
  try {
    spendingState = {
      spendingLimit: walletSpendingState[0].toString(),
      spentAmount: walletSpendingState[1].toString(),
      lastSpendingInterval: walletSpendingState[2].toString(),
      spendingInterval: walletSpendingState[3].toString(),
      lastLimitAdjustmentTime: walletSpendingState[4].toString(),
      highestSpendingLimit: walletSpendingState[5].toString()
    }
  } catch (ex) {
    console.log(`Failed to parse walletSpendingState: ${ex.toString()}`)
  }
  const nonce = new BN(await wallet.getNonce()).toNumber()
  const lastOperationTime = new BN(await wallet.lastOperationTime()).toNumber()
  const walletAllCommits = await wallet.getAllCommits()
  let allCommits = {}
  try {
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
  } catch (ex) {
    console.log(`Failed to parse walletAllCommits: ${ex.toString()}`)
  }
  const walletTrackedTokens = await wallet.getTrackedTokens()
  let trackedTokens = {}
  try {
    // tokenTypeArray
    trackedTokens[0] = walletTrackedTokens[0]
    // contractAddressArray
    trackedTokens[1] = walletTrackedTokens[1]
    // tokenIdArray
    trackedTokens[2] = walletTrackedTokens[2]
  } catch (ex) {
    console.log(`Failed to parse walletTrackedTokens: ${ex.toString()}`)
  }
  const walletBacklinks = await wallet.getBacklinks()
  let backlinks = []
  try {
    for (let x of walletBacklinks) {
      backlinks.push(x)
    }
  } catch (ex) {
    console.log(`Failed to parse walletBacklinks: ${ex.toString()}`)
  }
  const walletSignatures = await wallet.listSignatures(0, MAX_UINT32)
  let signatures = {}
  try {
    // Signature Tracker Hashes
    signatures[0] = walletSignatures[0]
    // signatures
    signatures[1] = walletSignatures[1]
    // timestamps
    signatures[2] = walletSignatures[2]
    // expiries
    signatures[3] = walletSignatures[3]
  } catch (ex) {
    console.log(`Failed to parse walletSignatures: ${ex.toString()}`)
  }

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
  assert.deepEqual(currentState.nonce, oldState.nonce, 'wallet.nonce is incorrect')
  assert.deepEqual(currentState.lastOperationTime, oldState.lastOperationTime, 'wallet.lastOperationTime is incorrect')
  assert.deepEqual(currentState.allCommits, oldState.allCommits, 'wallet.allCommits is incorrect')
  assert.deepEqual(currentState.trackedTokens, oldState.trackedTokens, 'wallet.trackedTokens is incorrect')
  assert.deepEqual(currentState.backlinks, oldState.backlinks, 'wallet.backlinks is incorrect')
  assert.deepEqual(currentState.signatures, oldState.signatures, 'wallet.signatures is incorrect')
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
  getReceipt,
  bumpTestTime,
  transactionExecute,
  makeWallet,
  makeTokens,
  getONEWalletState,
  checkONEWalletStateChange
}
