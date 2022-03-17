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
const TestERC20Decimals9 = artifacts.require('TestERC20Decimals9')
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

// makeWallet uses an index and unlocked web3.eth.account and creates and funds a ONEwallet
const makeWallet = async (accountIndex, lastResortAddress) => {
  const { wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
    salt: new BN(accountIndex),
    effectiveTime: EFFECTIVE_TIME,
    duration: DURATION,
    maxOperationsPerInterval: SLOT_SIZE,
    lastResortAddress: lastResortAddress,
    spendingLimit: ONE_ETH
  })
  // Fund wallet
  // console.log(`ONE_CENT : ${ONE_CENT}`)
  // console.log(`HALF_DIME: ${HALF_DIME}`)
  // console.log(`ONE_DIME : ${ONE_DIME}`)
  // console.log(`ONE_ETH  : ${ONE_ETH}`)
  // console.log(`TEN_ETH  : ${TEN_ETH}`)
  let tx = await web3.eth.sendTransaction({
    from: lastResortAddress,
    to: wallet.address,
    value: TEN_ETH
  })
  TestUtil.getReceipt(tx.transactionHash)
  // const InitialWalletBalance = await web3.eth.getBalance(wallet.address)
  // console.log(`InitialWalletBalance: ${InitialWalletBalance}`)
  // console.log(`lastResortAddressBalance: ${lastResortAddressBalance}`)
  // console.log(`ONE_ETH: ${ONE_ETH}`)
  const state = await getONEWalletState(wallet)
  return { wallet, seed, hseed, root, layers, lastResortAddress, state }
}

// makeTokens makes test ERC20, ERC20Decimals9, ERC721, ERC1155
const makeTokens = async (owner) => {
  // create an ERC20
  const testerc20 = await TestERC20.new(10000000, { from: owner })
  // create an ERC20Decimals9
  const testerc20d9 = await TestERC20Decimals9.new(10000000, { from: owner })
  // create an ERC721
  const tids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const uris = ['ipfs://test721/0', 'ipfs://test721/1', 'ipfs://test721/2', 'ipfs://test721/3', 'ipfs://test721/4', 'ipfs://test721/5', 'ipfs://test721/6', 'ipfs://test721/7', 'ipfs://test721/8', 'ipfs://test721/9']
  const testerc721 = await TestERC721.new(tids, uris, { from: owner })
  // create an ERC1155
  const tids1155 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const amounts1155 = [10, 20, 20, 20, 20, 20, 20, 20, 20, 100]
  const uris1155 = ['ipfs://test1155/0', 'ipfs://test1155/1', 'ipfs://test1155/2', 'ipfs://test1155/3', 'ipfs://test1155/4', 'ipfs://test1155/5', 'ipfs://test1155/6', 'ipfs://test1155/7', 'ipfs://test1155/8', 'ipfs://test1155/9']
  const testerc1155 = await TestERC1155.new(tids1155, amounts1155, uris1155, { from: owner })
  return { testerc20, testerc20d9, testerc721, testerc1155 }
}

// assetTransfer commits and reveals a wallet transaction
const assetTransfer = async ({ wallet, operationType, tokenType, contractAddress, tokenId, dest, amount }) => {
  Debugger.printLayers({ layers: wallet.layers })
  const otp = ONEUtil.genOTP({ seed: wallet.seed })
  const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
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
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
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
  let state = {}
  state = {
    address: wallet.address,
    identificationKey: await wallet.identificationKey(),
    identificationKeys: await wallet.getIdentificationKeys(),
    forwardAddress: await wallet.getForwardAddress(),
    info: await wallet.getInfo(),
    oldInfos: await wallet.getOldInfos(),
    innerCores: await wallet.getInnerCores(),
    rootKey: await wallet.getRootKey(),
    version: await wallet.getVersion(),
    spendingState: await wallet.getSpendingState(),
    nonce: await wallet.getNonce(),
    lastOperationTime: await wallet.lastOperationTime(),
    allCommits: await wallet.getAllCommits(),
    trackedTokens: await wallet.getTrackedTokens(),
    backlinks: await wallet.getBacklinks(),
  }
  return state
}

// check OneWallet state
const checkONEWallet = async (wallet, state) => {
  assert.deepStrictEqual(await wallet.identificationKey(), state.identificationKey, 'wallet.identificationKey is incorrect')
  assert.deepStrictEqual(await wallet.getIdentificationKeys(), state.identificationKeys, 'wallet.identificationKeys is incorrect')
  assert.deepStrictEqual(await wallet.getForwardAddress(), state.forwardAddress, 'wallet.forwardAddress is incorrect')
  assert.deepStrictEqual(await wallet.getInfo(), state.info, 'wallet.info is incorrect')
  assert.deepStrictEqual(await wallet.getOldInfos(), state.oldInfos, 'wallet.oldInfos is incorrect')
  assert.deepStrictEqual(await wallet.getInnerCores(), state.innerCores, 'wallet.innerCores is incorrect')
  assert.deepStrictEqual(await wallet.getRootKey(), state.rootKey, 'wallet.rootKey is incorrect')
  assert.deepStrictEqual(await wallet.getVersion(), state.version, 'wallet.version is incorrect')
  assert.deepStrictEqual(await wallet.getSpendingState(), state.spendingState, 'wallet.spendingState is incorrect')
  assert.deepStrictEqual(await wallet.getNonce(), state.nonce, 'wallet.nonce is incorrect')
  assert.deepStrictEqual(await wallet.lastOperationTime(), state.lastOperationTime, 'wallet.lastOperationTime is incorrect')
  assert.deepStrictEqual(await wallet.getAllCommits(), state.allCommits, 'wallet.allCommits is incorrect')
  assert.deepStrictEqual(await wallet.getTrackedTokens(), state.trackedTokens, 'wallet.trackedTokens is incorrect')
  assert.deepStrictEqual(await wallet.getBacklinks(), state.backlinks, 'wallet.backlinks is incorrect')
}

module.exports = {
  makeWallet,
  makeTokens,
  assetTransfer,
  getONEWalletState,
  checkONEWallet
}
