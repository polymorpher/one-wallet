/* TODO
1. Remove TestUtil and merge with util.js
2. Return oldState when calling makeWallet and assetTransfer
3. Retrieve currentState as part of checkONEWalletStateChange
3. Remove commented lines
4. Use batch function for token Tracker
5. Add TRACK and UNTRACK and OVERRIDE_TRACK Tests
6. Enhance assetTransfer to be walletTransaction (and cater for additional operations)
*/

const TestUtil = require('./util')
const config = require('../config')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const ONE = require('../lib/onewallet')
const ONEWallet = require('../lib/onewallet')
const BN = require('bn.js')
const ONEDebugger = require('../lib/debug')
const assert = require('assert')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const DUMMY_HEX = '0x'

const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}
const Debugger = ONEDebugger(Logger)

// fundTokens
// funder: address (must have tokens and be unlocked for signing)
// receiver: address
const fundTokens = async ({
  funder,
  receivers = [],
  tokenTypes = [],
  tokenContracts = [],
  tokenAmounts = [[]],
  tokenIds = [[]],
  validate = true
}) => {
  // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alice's wallet
  for (let i = 0; i < tokenTypes.length; i++) {
    switch (tokenTypes[i]) {
      case ONEConstants.TokenType.ERC20:
        await tokenContracts[i].transfer(receivers[i], tokenAmounts[i][0], { from: funder })
        Logger.debug(`Funded ${tokenAmounts[i][0]} ERC20 to ${receivers[i]}`)
        break
      case ONEConstants.TokenType.ERC721:
        for (let j = 0; j < tokenIds[i].length; j++) {
          await tokenContracts[i].safeTransferFrom(funder, receivers[i], tokenIds[i][j], { from: funder })
        }
        Logger.debug(`Funded id=[${tokenIds[i].join(',')}] ERC721 to ${receivers[i]}`)
        break
      case ONEConstants.TokenType.ERC1155:
        for (let j = 0; j < tokenIds[i].length; j++) {
          await tokenContracts[i].safeTransferFrom(funder, receivers[i], tokenIds[i][j], tokenAmounts[i][j], DUMMY_HEX, { from: funder })
        }
        Logger.debug(`Funded token ids [${tokenIds[i].join(',')}] with amount [${tokenAmounts[i].join(',')}] ERC1155 to ${receivers[i]}`)
        break
      default:
        console.log(`ERROR fundTokens: Index ${[i]} - Incorrect TokenType: ${tokenTypes[i]}`)
        return
    }
  }
  if (validate) {
    await validateTokenBalances({ receivers, tokenTypes, tokenContracts, tokenAmounts, tokenIds })
  }
}

// ==== EXECUTION FUNCTIONS ====
// executeStandardTransaction commits and reveals a wallet transaction
const executeTokenTransaction = async ({
  walletInfo,
  operationType,
  tokenType,
  contractAddress,
  tokenId,
  dest,
  amount,
  data,
  testTime = Date.now(),
  getCurrentState = true
}) => {
  // calculate counter from testTime
  const counter = Math.floor(testTime / INTERVAL)
  const otp = ONEUtil.genOTP({ seed: walletInfo.seed, counter })
  // calculate wallets effectiveTime (creation time) from t0
  const info = await walletInfo.wallet.getInfo()
  const t0 = new BN(info[3]).toNumber()
  const walletEffectiveTime = t0 * INTERVAL
  const index = ONEUtil.timeToIndex({ effectiveTime: walletEffectiveTime, time: testTime })
  const eotp = await ONE.computeEOTP({ otp, hseed: walletInfo.hseed })

  // format commit and revealParams
  const commitRevealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
  let { tx, authParams, revealParams } = await TestUtil.commitReveal({
    Debugger,
    layers: walletInfo.layers,
    index,
    eotp,
    paramsHash: ONEWallet.computeGeneralOperationHash,
    commitParams: commitRevealParams,
    revealParams: commitRevealParams,
    wallet: walletInfo.wallet
  })
  let currentState
  if (getCurrentState) { currentState = await TestUtil.getState(walletInfo.wallet) }
  return { tx, authParams, revealParams, currentState }
}

// ==== Validation Helpers ====
const validateTokenBalances = async ({
  receivers = [],
  tokenTypes = [],
  tokenContracts = [],
  tokenIds = [[]],
  tokenAmounts = [[]]
}) => {
  for (let i = 0; i < tokenTypes.length; i++) {
    switch (tokenTypes[i]) {
      case ONEConstants.TokenType.ERC20:
        let balanceERC20 = await tokenContracts[i].balanceOf(receivers[i])
        assert.strictEqual(tokenAmounts[i][0].toString(), balanceERC20.toString(), 'Should have transferred ERC20 tokens to wallet')
        break
      case ONEConstants.TokenType.ERC721:
        for (let j = 0; j < tokenIds[i].length; j++) {
          let balanceERC721 = await tokenContracts[i].balanceOf(receivers[i])
          assert.strictEqual(tokenAmounts[i].toString(), balanceERC721.toString(), 'Transfer of ERC721 token to receiver validated by balance')
          let owner = await tokenContracts[i].ownerOf(tokenIds[i][j])
          assert.strictEqual(receivers[i], owner, 'Transfer of ERC721 token validated by owner')
        }
        break
      case ONEConstants.TokenType.ERC1155:
        for (let j = 0; j < tokenIds[i].length; j++) {
          let balanceERC1155 = await tokenContracts[i].balanceOf(receivers[i], tokenIds[i][j])
          assert.strictEqual(tokenAmounts[i][j].toString(), balanceERC1155.toString(), 'ERC1155 token to balance validated')
          // assert.strictEqual(tokenAmounts[i][j], await tokenContracts[i].balanceOf(receivers[i], tokenContracts[i][j]), 'Transfer of ERC1155 token to receiver validated by balance')
        }
        break
      default:
        Logger.debug(`ERROR validateTokenBalances: Index ${[i]} Incorrect TokenType:  ${tokenTypes[i]}`)
    }
  }
}

const validateTrackedTokens = async ({
  expectedTrackedTokens,
  wallet
}) => {
  const trackedTokens = await wallet.getTrackedTokens()
  Logger.debug(`expectedTrackedTokens: ${JSON.stringify(expectedTrackedTokens)}`)
  Logger.debug(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
  assert.strictEqual(expectedTrackedTokens[0].length, trackedTokens[0].length, 'Number of Tracked Tokens is different than expected')
  for (let i = 0; i < trackedTokens[0].length; i++) {
    assert.strictEqual(expectedTrackedTokens[0][i].toString(), trackedTokens[0][i].toString(), 'Tracked Token Type is different than expected')
    assert.strictEqual(expectedTrackedTokens[1][i].toString(), trackedTokens[1][i].toString(), 'Tracked Token Address is different than expected')
    assert.strictEqual(expectedTrackedTokens[2][i].toString(), trackedTokens[2][i].toString(), 'Tracked Token Ids are different than expected')
  }
  return trackedTokens
}

// === TESTING
contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE TESTING ERC20 ====

  // ====== TRACK ======
  // Test tacking of an ERC20 token
  // Expected result: the token is now tracked
  it('TN.BASIC.0 TRACK: must be able to track ERC20 tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TN.BASIC.0.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: aliceCurrentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )

    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state: state })
    // check that tracked tokens are as expected
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC20], [testerc20.address], [[0]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    // check alice's state consistency
    await TestUtil.assertStateEqual(state, aliceCurrentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC20 token
  // Expected result: the token is no longer tracked
  it('TN.BASIC.1 UNTRACK: must be able to untrack ERC20 tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TN.BASIC.1.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: state } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState: aliceCurrentStateUntracked } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.UNTRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = [[], [], [[]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, aliceCurrentStateUntracked)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('TN.BASIC.2 TRANSFER_TOKEN: must be able to transfer ERC20 token', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.2.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TN.BASIC.2.2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    let testTime = Date.now()
    await fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [[1000]]
    })
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // TODO investigate how to combine populating objects that already exist
    let { currentState: aliceTransferState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 100,
        testTime
      }
    )
    // check alice and bobs balance
    await validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20, testerc20],
      tokenAmounts: [[900], [100]]
    })

    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC20], [testerc20.address], [[0]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, aliceTransferState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alices Token Tracking information
  // Expected result: Alice will now track testerc20v2 instead of testerc20
  it('TN.BASIC.3 OVERRIDE_TRACK: must be able to override ERC20 tracked tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.3.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    const { testerc20: testerc20v2 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    let testTime = Date.now()

    // First track testerc20
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: state } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: alice.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Get alice's current tracked tokens and override the address from testerc20 to testerc20v2
    const newTrackedTokens = await alice.wallet.getTrackedTokens()
    newTrackedTokens[1] = [testerc20v2.address]
    const hexData = ONEUtil.abi.encodeParameters(['uint256[]', 'address[]', 'uint256[]'], [newTrackedTokens[0], newTrackedTokens[1], newTrackedTokens[2]])
    const data = ONEUtil.hexStringToBytes(hexData)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState: overrideState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        data,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC20], [testerc20v2.address], [[0]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, overrideState)
  })

  // ==== ADDITIONAL POSITIVE TESTING ERC721 ====

  // ====== TRACK ======
  // Test tacking of an ERC721 token
  // Expected result: the token is now tracked
  it('TN.POSITIVE.0 TRACK: must be able to track ERC721 tokens', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.0.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 3,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC721], [testerc721.address], [[3]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC721 token
  // Expected result: the token is no longer tracked
  it('TN.POSITIVE.1 UNTRACK: must be able to untrack ERC721 tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.1.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: state } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 3,
        testTime
      }
    )
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.UNTRACK,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 3,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = [[], [], [[]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a ERC721 token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('TN.POSITIVE.2 TRANSFER_TOKEN: must be able to transfer ERC721 tokens', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.2.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TN.BASIC.2.2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })

    // Begin Tests
    let testTime = Date.now()
    // Fund Alice with 2 ERC721 TOKENS (2,3)
    await fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC721],
      tokenContracts: [testerc721],
      tokenIds: [[2, 3]],
      tokenAmounts: [[2]]
    })
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        dest: bob.wallet.address,
        tokenId: 3,
        amount: 1,
        testTime
      }
    )
    await validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC721],
      tokenContracts: [testerc721, testerc721],
      tokenIds: [[2], [3]],
      tokenAmounts: [[1], [1]]
    })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC721], [testerc721.address, testerc721.address], ['2', '3']]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alice's Token Tracking information
  // Expected result: Alice will now track testerc721v2 instead of testerc721
  it('TN.POSITIVE.3 OVERRIDE_TRACK: must be able to override tracked tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.3.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })
    const { testerc721: testerc721v2 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: state } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 2,
        dest: alice.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    const [trackedTokenTypes] = await alice.wallet.getTrackedTokens()
    const hexData = ONEUtil.abi.encodeParameters(['uint256[]', 'address[]', 'uint256[]'], [trackedTokenTypes, [testerc721v2.address], [3]])
    const data = ONEUtil.hexStringToBytes(hexData)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        data,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC721], [testerc721v2.address], [[3]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ==== ADDITIONAL POSITIVE TESTING ERC1155 ====

  // ====== TRACK ======
  // Test tacking of an ERC1155 token
  // Expected result: the token is now tracked
  it('TN.POSITIVE.0.1 TRACK: must be able to track ERC1155 tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.0.1.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 3,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC1155], [testerc1155.address], [[3]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC1155 token
  // Expected result the token is no longer tracked
  it('TN.POSITIVE.1.1 UNTRACK: must be able to untrack ERC1155 tokens', async () => {
    let { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.1.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: state } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 3,
        testTime
      }
    )

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.UNTRACK,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 3,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = [[], [], [[]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a ERC1155 token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('TN.POSITIVE.2.1 TRANSFER_TOKEN: must be able to transfer ERC1155 tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.2.1.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.2.1.2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })
    let testTime = Date.now()
    // Fund Alice with 2 ERC721 tokens (2,3) quantity 20, 30
    await fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc1155],
      tokenIds: [[2, 3]],
      tokenAmounts: [[20, 30]]
    })
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    const { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        dest: bob.wallet.address,
        tokenId: 3,
        amount: 30,
        testTime
      }
    )
    await validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc1155, testerc1155],
      tokenIds: [[2], [3]],
      tokenAmounts: [[20], [30]]
    })

    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC1155], [testerc1155.address, testerc1155.address], ['2', '3']]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alices Token Tracking information
  // Expected result: Alice will now track testerc1155v2 instead of testerc1155
  it('TN.POSITIVE.3.1 OVERRIDE_TRACK: must be able to override tracked tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TN.POSITIVE.3.1.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })
    const { testerc1155: testerc1155v2 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: state } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 2,
        dest: alice.wallet.address,
        testTime
      }
    )
    // Get alice's current tracked tokens and override the address from testerc20 to testerc20v2
    const [trackedTokenTypes] = await alice.wallet.getTrackedTokens()
    const hexData = ONEUtil.abi.encodeParameters(['uint256[]', 'address[]', 'uint256[]'], [trackedTokenTypes, [testerc1155v2.address], [3]])
    const data = ONEUtil.hexStringToBytes(hexData)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        data,
        testTime
      }
    )
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = [[ONEConstants.TokenType.ERC1155], [testerc1155v2.address], [[3]]]
    state.trackedTokens = await validateTrackedTokens({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // Complex Scenario Testing
  // TokenTracker Testing (track, multitrack, getTrackedTokens, getBalance, recoverToken) also batch transactions
  it('TT.COMBO.1: TokenTracker(token management) must commit and reveal successfully', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TT.COMBO.1.1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TT.COMBO.1.2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    const { testerc20, testerc721, testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: true, makeERC1155: true })
    let testTime = Date.now()
    await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 100,
        testTime
      }
    )
    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 8,
        dest: bob.wallet.address,
        testTime
      }
    )
    // transfer 1155 tokens from accounts[0] (which owns the tokens) to alice's wallet
    await testerc1155.safeTransferFrom(accounts[0], alice.wallet.address, 8, 8, DUMMY_HEX, { from: accounts[0] })
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 8,
        dest: bob.wallet.address,
        amount: 3,
        testTime
      }
    )
  })
})
