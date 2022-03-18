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

const ONE_CENT = unit.toWei('0.01', 'ether')
const HALF_DIME = unit.toWei('0.05', 'ether')
const ONE_DIME = unit.toWei('0.1', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const TEN_ETH = unit.toWei('10', 'ether')
const INTERVAL = 30000
const DURATION = INTERVAL * 12
const SLOT_SIZE = 1
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const JSSHA = require('jssha')

const utils = {
  timeToIndex: ({
    effectiveTime,
    time,
    interval = 30000,
    nonce = 0,
    maxOperationsPerInterval = 1
  }) => {
    if (time === undefined) {
      time = Date.now()
      console.log('Setting default time')
    }
    effectiveTime = Math.floor(effectiveTime / interval) * interval
    const index = Math.floor((time - effectiveTime) / interval)
    const indexWithNonce = index * maxOperationsPerInterval + nonce
    return indexWithNonce
  },
  genOTP: ({ seed, interval = 30000, time, counter = Math.floor(Date.now() / interval), n = 1, progressObserver }) => {
    const codes = new Uint8Array(n * 4)
    const v = new DataView(codes.buffer)
    const b = new DataView(new ArrayBuffer(8))
    if (time === undefined) {
      time = Date.now()
      console.log('Setting default time')
    }
    counter = Math.floor(time / interval)
    for (let i = 0; i < n; i += 1) {
      const t = counter + i
      b.setUint32(0, 0, false)
      b.setUint32(4, t, false)
      const jssha = new JSSHA('SHA-1', 'UINT8ARRAY')
      jssha.setHMACKey(seed, 'UINT8ARRAY')
      jssha.update(new Uint8Array(b.buffer))
      const h = jssha.getHMAC('UINT8ARRAY')
      const p = h[h.length - 1] & 0x0f
      const x1 = (h[p] & 0x7f) << 24
      const x2 = (h[p + 1] & 0xff) << 16
      const x3 = (h[p + 2] & 0xff) << 8
      const x4 = (h[p + 3] & 0xff)
      const c = x1 | x2 | x3 | x4
      const r = c % 1000000
      v.setUint32(i * 4, r, false)
      if (progressObserver) {
        progressObserver(i, n)
      }
    }
    return codes
  },
}

// makeWallet uses an index and unlocked web3.eth.account and creates and funds a ONEwallet
const makeWallet = async (salt, deployer) => {
  const lastResortAccount = web3.eth.accounts.create()
  const { wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
    salt: new BN(ONEUtil.keccak(salt)),
    effectiveTime: EFFECTIVE_TIME,
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
  const state = await getONEWalletState(wallet)
  return { wallet, seed, hseed, root, layers, lastResortAddress: lastResortAccount.address, state }
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
  const otp = utils.genOTP({ seed: wallet.seed, time: testTime })
  const effectiveTime = Math.floor(testTime / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
  const index = utils.timeToIndex({ effectiveTime, time: testTime })
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
}

// get OneWallet state
const getONEWalletState = async (wallet) => {
  let i
  const address = (wallet.address).toString()
  const identificationKey = (await wallet.identificationKey()).toString()
  const walletIdentificationKeys = await wallet.getIdentificationKeys()
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
      spendingLimit: new BN(unit.fromWei(walletSpendingState[0], 'ether')).toNumber(),
      spendingAmount: new BN(unit.fromWei(walletSpendingState[1], 'ether')).toNumber(),
      lastSpendingInterval: new BN(walletSpendingState[2]).toNumber(),
      spendingInterval: new BN(walletSpendingState[3]).toNumber(),
      lastLimitAdjustmentTime: new BN(walletSpendingState[4]).toNumber(),
      highestSpendingLimit: new BN(unit.fromWei(walletSpendingState[5], 'ether')).toNumber(),
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
const checkONEWallet = async (wallet, state) => {
  const newState = await getONEWalletState(wallet)
  assert.deepEqual(newState.identificationKey, state.identificationKey, 'wallet.identificationKey is incorrect')
  assert.deepEqual(newState.identificationKeys, state.identificationKeys, 'wallet.identificationKeys is incorrect')
  assert.deepEqual(newState.forwardAddress, state.forwardAddress, 'wallet.forwardAddress is incorrect')
  assert.deepEqual(newState.info, state.info, 'wallet.info is incorrect')
  assert.deepEqual(newState.oldInfo, state.oldInfo, 'wallet.oldInfos is incorrect')
  assert.deepEqual(newState.innerCores, state.innerCores, 'wallet.innerCores is incorrect')
  assert.deepEqual(newState.rootKey, state.rootKey, 'wallet.rootKey is incorrect')
  assert.deepEqual(newState.version, state.version, 'wallet.version is incorrect')
  assert.deepEqual(newState.spendingState, state.spendingState, 'wallet.spendingState is incorrect')
  assert.deepEqual(newState.nonce, state.nonce, 'wallet.nonce is incorrect')
  assert.deepEqual(newState.lastOperationTime, state.lastOperationTime, 'wallet.lastOperationTime is incorrect')
  assert.deepEqual(newState.allCommits, state.allCommits, 'wallet.allCommits is incorrect')
  assert.deepEqual(newState.trackedTokens, state.trackedTokens, 'wallet.trackedTokens is incorrect')
  assert.deepEqual(newState.backlinks, state.backlinks, 'wallet.backlinks is incorrect')
}

module.exports = {
  makeWallet,
  makeTokens,
  assetTransfer,
  getONEWalletState,
  checkONEWallet
}
