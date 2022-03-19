const TestUtil = require('./util')
const ONEUtil = require('../lib/util')
const unit = require('ethjs-unit')
const ONE = require('../lib/onewallet')
const BN = require('bn.js')
const ONEConstants = require('../lib/constants')
const ONEWallet = require('../lib/onewallet')
const ONEDebugger = require('../lib/debug')
const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)
const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')
const TestERC1155 = artifacts.require('TestERC1155')

// const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const TEN_ETH = unit.toWei('10', 'ether')
const INTERVAL = 30000
const DURATION = INTERVAL * 12
const SLOT_SIZE = 1

// makeWallet uses an index and unlocked web3.eth.account and creates and funds a ONEwallet
const makeWallet = async (salt, deployer, effectiveTime) => {
  const lastResortAccount = web3.eth.accounts.create()
  const { wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
    salt: new BN(ONEUtil.keccak(salt)),
    effectiveTime: effectiveTime,
    duration: DURATION,
    maxOperationsPerInterval: SLOT_SIZE,
    lastResortAddress: lastResortAccount.address,
    spendingLimit: ONE_ETH
  })
  // Fund wallet
  await web3.eth.sendTransaction({
    from: deployer,
    to: wallet.address,
    value: TEN_ETH
  })
  const currentState = await getONEWalletState(wallet)
  return { wallet, seed, hseed, root, layers, lastResortAddress: lastResortAccount.address, currentState }
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

// assetTransfer commits and reveals a wallet transaction
const assetTransfer = async ({ wallet, operationType, tokenType, contractAddress, tokenId, dest, amount, testTime }) => {
  Debugger.printLayers({ layers: wallet.layers })
  if (testTime === undefined) { testTime = Date.now() }
  // calculate counter from testTime
  const counter = Math.floor(testTime) / INTERVAL
  const otp = ONEUtil.genOTP({ seed: wallet.seed, counter })
  // calculate effectiveTime from t0
  const info = await wallet.wallet.getInfo()
  const t0 = new BN(info[3]).toNumber()
  const walletEffectiveTime = t0 * INTERVAL
  console.log(`walletEffectiveTime: ${walletEffectiveTime}`)
  console.log(`DateNow: ${Date.now()}`)
  const effectiveTime = Math.floor(walletEffectiveTime / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
  const index = ONEUtil.timeToIndex({ effectiveTime, time: testTime })
  const eotp = await ONE.computeEOTP({ otp, hseed: wallet.hseed })
  // Format commit and revealParams based on tokenType
  let commitParams
  let revealParams
  let paramsHash
  switch (operationType) {
    case ONEConstants.OperationType.TRANSFER:
      paramsHash = ONEWallet.computeTransferHash
      commitParams = { dest, amount }
      revealParams = { dest, amount, operationType }
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
          console.log(`TODO: add in Token error handling`)
          return
      }
      break
    default:
      console.log(`TODO: add in error handling`)
      return
  }
  await TestUtil.commitReveal({
    Debugger,
    layers: wallet.layers,
    index,
    eotp,
    paramsHash,
    commitParams,
    revealParams,
    wallet: wallet.wallet
  })
  wallet.oldState = wallet.currentState
  wallet.currentState = await getONEWalletState(wallet.wallet)
  return wallet
}

// get OneWallet state
const getONEWalletState = async (wallet) => {
  let i
  const address = (wallet.address).toString()
  const identificationKey = (await wallet.identificationKey()).toString()
  console.log(`identificationKey: ${JSON.stringify(identificationKey)}`)
  const walletIdentificationKeys = await wallet.getIdentificationKeys()
  console.log(`walletIdentificationKeys: ${JSON.stringify(walletIdentificationKeys)}`)
  let identificationKeys = {}
  i = 0
  try {
    for (let x of walletIdentificationKeys) {
      identificationKeys[i] = {
        key: x[0].toString()
      }
      i++
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
  let oldInfo = {}
  i = 0
  try {
    for (let x of walletOldInfo) {
      oldInfo[i] = {
        root: x[0].toString(),
        height: new BN(x[1]).toNumber(),
        interval: new BN(x[2]).toNumber(),
        t0: new BN(x[3]).toNumber(),
        lifespan: new BN(x[4]).toNumber(),
        maxOperationsPerInterval: new BN(x[5]).toNumber()
      }
      i++
    }
  } catch (ex) {
    console.log(`Failed to parse Old Info: ${ex.toString()}`)
  }
  const walletInnerCores = await wallet.getInnerCores()
  let innerCores = {}
  i = 0
  try {
    for (let x of walletInnerCores) {
      innerCores[i] = {
        root: x[0].toString(),
        height: new BN(x[1]).toNumber(),
        interval: new BN(x[2]).toNumber(),
        t0: new BN(x[3]).toNumber(),
        lifespan: new BN(x[4]).toNumber(),
        maxOperationsPerInterval: new BN(x[5]).toNumber()
      }
      i++
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
      spendingLimit: walletSpendingState[0],
      spentAmount: walletSpendingState[1],
      lastSpendingInterval: walletSpendingState[2],
      spendingInterval: walletSpendingState[3],
      lastLimitAdjustmentTime: walletSpendingState[4],
      highestSpendingLimit: walletSpendingState[5],
    }
  } catch (ex) {
    console.log(`Failed to parse walletSpendingState: ${ex.toString()}`)
  }
  const nonce = new BN(await wallet.getNonce()).toNumber()
  const lastOperationTime = new BN(await wallet.lastOperationTime()).toNumber()
  const walletAllCommits = await wallet.getAllCommits()
  let allCommits = {
    commitHashArray: {},
    paramHashArray: {},
    veriFicationHashArray: {},
    timestampArray: {},
    completedArray: {}
  }
  try {
    allCommits.commitHashArray = walletAllCommits[0]
    allCommits.paramHashArray = walletAllCommits[1]
    allCommits.veriFicationHashArray = walletAllCommits[2]
    allCommits.timestampArray = walletAllCommits[3]
    allCommits.completedArray = walletAllCommits[4]
  } catch (ex) {
    console.log(`Failed to parse walletAllCommits: ${ex.toString()}`)
  }
  const walletTrackedTokens = await wallet.getTrackedTokens()
  let trackedTokens = {
    tokenTypeArray: {},
    contractAddressArray: {},
    tokenIdArray: {}
  }
  try {
    trackedTokens.tokenTypeArray = walletTrackedTokens[0]
    trackedTokens.contractAddressArray = walletTrackedTokens[1]
    trackedTokens.tokenIdArray = walletTrackedTokens[2]
  } catch (ex) {
    console.log(`Failed to parse walletTrackedTokens: ${ex.toString()}`)
  }
  const walletBacklinks = await wallet.getBacklinks()
  let backlinks = {
    addressArray: {},
  }
  try {
    backlinks.addressArray = walletBacklinks[0]
  } catch (ex) {
    console.log(`Failed to parse walletBacklinks: ${ex.toString()}`)
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
  }
  return state
}

// check OneWallet state
const checkONEWallet = async (wallet) => {
  assert.deepEqual(wallet.currentState.identificationKey, wallet.oldState.identificationKey, 'wallet.identificationKey is incorrect')
  assert.deepEqual(wallet.currentState.identificationKeys, wallet.oldState.identificationKeys, 'wallet.identificationKeys is incorrect')
  assert.deepEqual(wallet.currentState.forwardAddress, wallet.oldState.forwardAddress, 'wallet.forwardAddress is incorrect')
  assert.deepEqual(wallet.currentState.info, wallet.oldState.info, 'wallet.info is incorrect')
  assert.deepEqual(wallet.currentState.oldInfo, wallet.oldState.oldInfo, 'wallet.oldInfos is incorrect')
  assert.deepEqual(wallet.currentState.innerCores, wallet.oldState.innerCores, 'wallet.innerCores is incorrect')
  assert.deepEqual(wallet.currentState.rootKey, wallet.oldState.rootKey, 'wallet.rootKey is incorrect')
  assert.deepEqual(wallet.currentState.version, wallet.oldState.version, 'wallet.version is incorrect')
  assert.deepEqual(wallet.currentState.spendingState, wallet.oldState.spendingState, 'wallet.spendingState is incorrect')
  assert.deepEqual(wallet.currentState.nonce, wallet.oldState.nonce, 'wallet.nonce is incorrect')
  assert.deepEqual(wallet.currentState.lastOperationTime, wallet.oldState.lastOperationTime, 'wallet.lastOperationTime is incorrect')
  assert.deepEqual(wallet.currentState.allCommits, wallet.oldState.allCommits, 'wallet.allCommits is incorrect')
  assert.deepEqual(wallet.currentState.trackedTokens, wallet.oldState.trackedTokens, 'wallet.trackedTokens is incorrect')
  assert.deepEqual(wallet.currentState.backlinks, wallet.oldState.backlinks, 'wallet.backlinks is incorrect')
}

module.exports = {
  makeWallet,
  makeTokens,
  assetTransfer,
  getONEWalletState,
  checkONEWallet
}
