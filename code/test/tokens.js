const TestUtil = require('./util')
const config = require('../config')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const ONE = require('../lib/onewallet')
const ONEWallet = require('../lib/onewallet')
const BN = require('bn.js')
const ONEDebugger = require('../lib/debug')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
const getEffectiveTime = () => Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const HALF_ETH = unit.toWei('0.5', 'ether')
const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}
const Debugger = ONEDebugger(Logger)

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
  data = new Uint8Array(),
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
  let layers = walletInfo.client.layers
  let paramsHash
  let commitParams
  let revealParams
  // Process the Operation
  switch (operationType) {
    // Format commit and revealParams for RECOVER_SELECTED_TOKENS Tranasction
    case ONEConstants.OperationType.RECOVER_SELECTED_TOKENS:
      paramsHash = ONEWallet.computeDestDataHash
      commitParams = { operationType, dest, data }
      revealParams = { operationType, dest, data }
      break
    default:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
  }
  let { tx, authParams, revealParams: returnedRevealParams } = await TestUtil.commitReveal({
    Debugger,
    layers,
    index,
    eotp,
    paramsHash,
    commitParams,
    revealParams,
    wallet: walletInfo.wallet
  })
  let currentState
  if (getCurrentState) { currentState = await TestUtil.getState(walletInfo.wallet) }
  return { tx, authParams, revealParams: returnedRevealParams, currentState }
}

// === TESTING
contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  let snapshotId

  beforeEach(async function () {
    await TestUtil.init()
    snapshotId = await TestUtil.snapshot()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE TESTING ERC20 ====

  // ====== TRACK ======
  // Test tacking of an ERC20 token
  // Expected result: the token is now tracked
  it('TO-BASIC-0 TRACK: must be able to track ERC20 tokens', async () => {
    // create wallets and token contracts used throughout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-BASIC-0-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState: aliceCurrentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTracked' })

    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state: state })
    // check that tracked tokens are as expected
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC20], [testerc20.address], [0]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    // check alice's state consistency
    await TestUtil.assertStateEqual(state, aliceCurrentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC20 token
  // Expected result: the token is no longer tracked
  it('TO-BASIC-1 UNTRACK: must be able to untrack ERC20 tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TO-BASIC-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
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
    const { tx, currentState: aliceCurrentStateUntracked } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.UNTRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenUntracked' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[], [], []])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, aliceCurrentStateUntracked)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('TO-BASIC-2 TRANSFER_TOKEN: must be able to transfer ERC20 token', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-BASIC-2-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TO-BASIC-2-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    let testTime = Date.now()
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [[1000]]
    })
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let { tx, currentState: aliceTransferState } = await executeTokenTransaction(
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
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20, testerc20],
      tokenAmounts: [[900], [100]]
    })

    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTransferSucceeded' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC20], [testerc20.address], [0]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, aliceTransferState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alices Token Tracking information
  // Expected result: Alice will now track testerc20v2 instead of testerc20
  it('TO-BASIC-3 OVERRIDE_TRACK: must be able to override ERC20 tracked tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-3-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
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
    const hexData = ONEUtil.abi.encodeParameters(['uint256[]', 'address[]', 'uint256[]'], [[ONEConstants.TokenType.ERC20], [testerc20v2.address], [0]])
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
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC20], [testerc20v2.address], [0]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, overrideState)
  })

  // ====== RECOVER_SELECTED_TOKENS ======
  // Test recovering selected tokens
  // Expected result the tokens will be recovered
  it('TO-BASIC-9 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-BASIC-9-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'TO-BASIC-9-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })

    // Begin Tests
    let testTime = Date.now()

    // Fund Alice with 1000 ERC20 tokens
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [[1000]]
    })

    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20, testerc20],
      tokenAmounts: [[1000], [0]]
    })

    // Before we can recover we need to track testERC20
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )
    state.trackedTokens = await TestUtil.getTrackedTokensParsed(alice.wallet)
    Logger.debug(`trackedTokens: ${JSON.stringify(state.trackedTokens)}`)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Recover test tokens takes an array of uint32 which are the indices of the tracked tokens to recover
    let hexData = ONEUtil.abi.encodeParameters(['uint32[]'], [[0]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.RECOVER_SELECTED_TOKENS,
        dest: carol.wallet.address,
        data,
        testTime
      }
    )
    const carolCurrentState = await TestUtil.getState(carol.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenRecovered' })

    // check alices and carols balance

    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20, testerc20],
      tokenAmounts: [[0], [1000]]
    })

    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's wallet hasn't changed (just her balances above)
    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })

  // ==== ADDITIONAL POSITIVE TESTING ERC721 ====

  // ====== TRACK ======
  // Test tacking of an ERC721 token
  // Expected result: the token is now tracked
  it('TO-POSITIVE-0 TRACK: must be able to track ERC721 tokens', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-0-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { tx, currentState } = await executeTokenTransaction(
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
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTracked' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC721], [testerc721.address], [3]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC721 token
  // Expected result: the token is no longer tracked
  it('TO-POSITIVE-1 UNTRACK: must be able to untrack ERC721 tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
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
    const { tx, currentState } = await executeTokenTransaction(
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
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenUntracked' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[], [], []])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a ERC721 token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('TO-POSITIVE-2 TRANSFER_TOKEN: must be able to transfer ERC721 tokens', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-2-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TO-BASIC-2-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })

    // Begin Tests
    let testTime = Date.now()
    // Fund Alice with 2 ERC721 TOKENS (2,3)
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC721],
      tokenContracts: [testerc721],
      tokenIds: [[2, 3]],
      tokenAmounts: [[2]]
    })
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { tx, currentState } = await executeTokenTransaction(
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
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC721],
      tokenContracts: [testerc721, testerc721],
      tokenIds: [[2], [3]],
      tokenAmounts: [[1], [1]]
    })
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTransferSucceeded' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC721], [testerc721.address, testerc721.address], ['2', '3']])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alice's Token Tracking information
  // Expected result: Alice will now track testerc721v2 instead of testerc721
  it('TO-POSITIVE-3 OVERRIDE_TRACK: must be able to override tracked tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-3-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
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
    const hexData = ONEUtil.abi.encodeParameters(['uint256[]', 'address[]', 'uint256[]'], [[ONEConstants.TokenType.ERC721], [testerc721v2.address], [3]])
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
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC721], [testerc721v2.address], [3]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== RECOVER_SELECTED_TOKENS ======
  // Test recovering of an ERC721  tokens
  // Expected result the ERC721 tokens will be recovered
  it('TO-POSITIVE-9 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-9-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-9-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // make Tokens
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })

    // Begin Tests
    let testTime = Date.now()

    // Fund Alice with 2 ERC721 TOKENS (2,3)
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC721],
      tokenContracts: [testerc721],
      tokenIds: [[2, 3]],
      tokenAmounts: [[2]]
    })
    state.trackedTokens = await TestUtil.getTrackedTokensParsed(alice.wallet)
    Logger.debug(`trackedTokens: ${JSON.stringify(state.trackedTokens)}`)

    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC721],
      tokenContracts: [testerc721, testerc721],
      tokenIds: [[2], [3]],
      tokenAmounts: [[2], [2]]
    })

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Recover test tokens takes an array of uint32 which are the indices of the tracked tokens to recover
    let hexData = ONEUtil.abi.encodeParameters(['uint32[]'], [[0, 1]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.RECOVER_SELECTED_TOKENS,
        dest: carol.wallet.address,
        data,
        testTime
      }
    )
    const carolCurrentState = await TestUtil.getState(carol.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenRecovered' })

    // check carols token balance
    await TestUtil.validateTokenBalances({
      receivers: [carol.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC721],
      tokenContracts: [testerc721, testerc721],
      tokenIds: [[2], [3]],
      tokenAmounts: [[2], [2]]
    })

    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's tracked tokens have changed
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC721], [testerc721.address, testerc721.address], ['2', '3']])
    carolState.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: carol.wallet })
    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })

  // ==== ADDITIONAL POSITIVE TESTING ERC1155 ====

  // ====== TRACK ======
  // Test tacking of an ERC1155 token
  // Expected result: the token is now tracked
  it('TO-POSITIVE-0-1 TRACK: must be able to track ERC1155 tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-0-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeTokenTransaction(
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
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTracked' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC1155], [testerc1155.address], [3]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC1155 token
  // Expected result the token is no longer tracked
  it('TO-POSITIVE-1-1 UNTRACK: must be able to untrack ERC1155 tokens', async () => {
    let { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
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
    const { tx, currentState } = await executeTokenTransaction(
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
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenUntracked' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateNonce: false })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[], [], []])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a ERC1155 token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('TO-POSITIVE-2-1 TRANSFER_TOKEN: must be able to transfer ERC1155 tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-2-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-2-1-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })
    let testTime = Date.now()
    // Fund Alice with 2 ERC721 tokens (2,3) quantity 20, 30
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc1155],
      tokenIds: [[2, 3]],
      tokenAmounts: [[20, 30]]
    })
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    const { tx, currentState } = await executeTokenTransaction(
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
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc1155, testerc1155],
      tokenIds: [[2], [3]],
      tokenAmounts: [[20], [30]]
    })

    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTransferSucceeded' })
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC1155], [testerc1155.address, testerc1155.address], ['2', '3']])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alices Token Tracking information
  // Expected result: Alice will now track testerc1155v2 instead of testerc1155
  it('TO-POSITIVE-3-1 OVERRIDE_TRACK: must be able to override tracked tokens', async () => {
    const { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-3-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
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
    const hexData = ONEUtil.abi.encodeParameters(['uint256[]', 'address[]', 'uint256[]'], [[ONEConstants.TokenType.ERC1155], [testerc1155v2.address], [3]])
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
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC1155], [testerc1155v2.address], [3]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== RECOVER_SELECTED_TOKENS ======
  // Test recovering of an ERC1155  tokens
  // Expected result the ERC1155 tokens will be recovered
  it('TO-POSITIVE-9-1 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-9-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'TO-POSITIVE-9-1-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // make Tokens
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: false, makeERC1155: true })

    // Begin Tests
    let testTime = Date.now()

    // Fund Alice with 2 ERC721 tokens (2,3) quantity 20, 30
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc1155],
      tokenIds: [[2, 3]],
      tokenAmounts: [[20, 30]]
    })
    state.trackedTokens = await TestUtil.getTrackedTokensParsed(alice.wallet)
    Logger.debug(`trackedTokens: ${JSON.stringify(state.trackedTokens)}`)

    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc1155, testerc1155],
      tokenIds: [[2], [3]],
      tokenAmounts: [[20], [30]]
    })

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Recover test tokens takes an array of uint32 which are the indices of the tracked tokens to recover
    let hexData = ONEUtil.abi.encodeParameters(['uint32[]'], [[0, 1]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.RECOVER_SELECTED_TOKENS,
        dest: carol.wallet.address,
        data,
        testTime
      }
    )
    const carolCurrentState = await TestUtil.getState(carol.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenRecovered' })

    // check carols token balance
    await TestUtil.validateTokenBalances({
      receivers: [carol.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc1155, testerc1155],
      tokenIds: [[2], [3]],
      tokenAmounts: [[20], [30]]
    })

    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's tracked tokens have changed
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC1155], [testerc1155.address, testerc1155.address], ['2', '3']])
    carolState.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: carol.wallet })
    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })

  // Complex Scenario Testing
  // TokenTracker Testing (track, multitrack, getTrackedTokens, getBalance, recoverToken) also batch transactions
  it('TO-COMBO-1: TokenTracker(token management) must commit and reveal successfully', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TT-COMBO-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TT-COMBO-1-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { testerc20, testerc721, testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: true, makeERC1155: true })
    // Fund Alice with 1000 ERC20, 2 ERC721 and 50 ERC1155
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [[], [2, 3], [2, 3]],
      tokenAmounts: [[1000], [2], [20, 30]]
    })
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
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
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 3,
        dest: bob.wallet.address,
        testTime
      }
    )
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 3,
        dest: bob.wallet.address,
        amount: 30,
        testTime
      }
    )
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTransferSucceeded' })

    // check alice and bobs balance

    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [[0], [2], [2]],
      tokenAmounts: [[900], [1], [20]]
    })

    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // tracked tokens
    const expectedTrackedTokens = [
      { tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })

    // check alice
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== RECOVER_SELECTED_TOKENS MULTIPLE Tokens======
  // Test recovering mulitple selected tokens
  // Expected result the tokens will be recovered
  it('TO-COMPLEX-9 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TO-COMPLEX-9-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'TO-COMPLEX-9-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    const { testerc20, testerc721, testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: true, makeERC1155: true })
    // Fund Alice with 1000 ERC20, 2 ERC721 and 50 ERC1155
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [[], [2, 3], [2, 3]],
      tokenAmounts: [[1000], [2], [20, 30]]
    })
    state.trackedTokens = await TestUtil.getTrackedTokensParsed(alice.wallet)
    Logger.debug(`trackedTokens: ${JSON.stringify(state.trackedTokens)}`)

    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20, testerc721, testerc1155, testerc20],
      tokenIds: [[], [2, 3], [2, 3], []],
      tokenAmounts: [[1000], [2], [20, 30], [0]]
    })

    // Before we can recover we need to track testERC20
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )
    state.trackedTokens = await TestUtil.getTrackedTokensParsed(alice.wallet)
    Logger.debug(`trackedTokens: ${JSON.stringify(state.trackedTokens)}`)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Recover test tokens takes an array of uint32 which are the indices of the tracked tokens to recover
    let hexData = ONEUtil.abi.encodeParameters(['uint32[]'], [[1, 3, 4]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState } = await executeTokenTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.RECOVER_SELECTED_TOKENS,
        dest: carol.wallet.address,
        data,
        testTime
      }
    )
    const carolCurrentState = await TestUtil.getState(carol.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenRecovered' })

    // check alice and carols balance
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address, carol.wallet.address, carol.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155, testerc20, testerc721, testerc1155],
      tokenIds: [[], [2], [2], [], [3], [3]],
      tokenAmounts: [[0], [1], [20], [1000], [1], [30]]
    })

    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // tracked tokens
    let expectedTrackedTokens = [
      { tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })

    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's tracked tokens have changed (and her balances above)
    // tracked tokens
    expectedTrackedTokens = [
      // { tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 },
      // { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      // { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    carolState.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: carol.wallet })

    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })
})
