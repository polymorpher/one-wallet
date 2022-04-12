const TestUtil = require('./util')
const config = require('../config')
const unit = require('ethjs-unit')
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
const HALF_ETH = unit.toWei('0.5', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const TWO_ETH = unit.toWei('2', 'ether')
const THREE_ETH = unit.toWei('3', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
const getEffectiveTime = () => Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}
const Debugger = ONEDebugger(Logger)

// ==== EXECUTION FUNCTIONS ====
// executeUpgradeTransaction commits and reveals a wallet transaction
const executeUpgradeTransaction = async ({
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
  let paramsHash
  let commitParams
  let revealParams
  // Process the Operation
  switch (operationType) {
    // Format commit and revealParams for FORWARD Tranasction
    case ONEConstants.OperationType.FORWARD:
    case ONEConstants.OperationType.SET_RECOVERY_ADDRESS:
      paramsHash = ONEWallet.computeDestOnlyHash
      commitParams = { dest }
      revealParams = { operationType, dest }
      break
    case ONEConstants.OperationType.COMMAND:
    case ONEConstants.OperationType.TRACK:
    case ONEConstants.OperationType.RECOVER_SELECTED_TOKENS:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
    case ONEConstants.OperationType.BACKLINK_ADD:
    case ONEConstants.OperationType.BACKLINK_DELETE:
    case ONEConstants.OperationType.BACKLINK_OVERRIDE:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, data }
      revealParams = { operationType, data }
      break
    default:
      console.log(`Invalid Operation passed`)
      assert.strictEqual(operationType, 'A Valid Operation', 'Error invalid operationType passed')
      return
  }
  let { tx, authParams, revealParams: returnedRevealParams } = await TestUtil.commitReveal({
    Debugger,
    layers: walletInfo.client.layers,
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

contract('ONEWallet', (accounts) => {
  Logger.debug(`Testing with ${accounts.length} accounts`)
  Logger.debug(accounts)
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  let snapshotId
  let alice, bob, carol, dora, ernie, state, bobState, carolState, doraState, ernieState, testerc20, testerc721, testerc1155, testerc20v2, testerc721v2, testerc1155v2

  beforeEach(async function () {
    await TestUtil.init()
    snapshotId = await TestUtil.snapshot()
    const testData = await TestUtil.deployTestData()
    alice = testData.alice
    bob = testData.bob
    carol = testData.carol
    dora = testData.dora
    ernie = testData.ernie
    state = testData.state
    bobState = testData.bobState
    carolState = testData.carolState
    doraState = testData.doraState
    ernieState = testData.ernieState
    testerc20 = testData.testerc20
    testerc721 = testData.testerc721
    testerc1155 = testData.testerc1155
    testerc20v2 = testData.testerc20v2
    testerc721v2 = testData.testerc721v2
    testerc1155v2 = testData.testerc1155v2
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE UPGRADE WALLET ====

  // ====== FORWARD ======
  // Test forwarding to another wallet
  // Expected result the wallet will be forwarded to
  it('UP-BASIC-8 FORWARD: must be able to set forward to another wallet', async () => {
    // Here we have a special case where we want alice's wallet backlinked to carol
    // create wallets and token contracts used througout the test
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-BASIC-8-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'UP-BASIC-8-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, backlinks: [alice.wallet.address] })

    // alice and carol both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: HALF_ETH })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'ForwardAddressUpdated' })

    // Check alice's balance is now 0 and carol's is ONE ETH after the forward
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: ONE_ETH })

    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's forward address should now be carol's address
    state.forwardAddress = await TestUtil.validateFowardAddressMutation({ expectedForwardAddress: carol.wallet.address, wallet: alice.wallet })
    // Alice's spending state has been updated spentAmount = HALF_ETH and lastSpendingInterval has been updated
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = HALF_ETH
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's wallet hasn't changed (just her balances above)
    const carolCurrentState = await TestUtil.getState(carol.wallet)
    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })

  // ====== COMMAND ======
  // Test wallet issuing a command for a backlinked wallet
  // Expected result Carol will execute a command which adds a signature to Alice's wallet
  // Logic: This executes command in WalletGraph.sol and wallets must be backlinked
  it('TODO-UP-BASIC-11 COMMAND: must be able to issue a command', async () => {
  })

  // ====== BACKLINK_ADD ======
  // Test add a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will be backlinked to Carols
  it('UP-BASIC-12 BACKLINK_ADD: must be able to add a backlink', async () => {
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        data,
        testTime
      }
    )

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'BackLinkAltered' })

    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepStrictEqual(backlinks, state.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.strictEqual(backlinks[0].toString(), carol.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal carol.wallet.address')
    state.backlinks = backlinks
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== BACKLINK_DELETE ======
  // Test remove a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will not be backlinked to Carols
  it('UP-BASIC-13 BACKLINK_DELETE: must be able to delete a backlink', async () => {
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { currentState: stateLinked } = await executeUpgradeTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        data,
        testTime
      }
    )

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Remove the backlink from Alice to Carol
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_DELETE,
        data,
        testTime
      }
    )

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'BackLinkAltered' })

    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepStrictEqual(backlinks, stateLinked.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.strictEqual(backlinks.length, 0, 'alice.wallet.backlinkedAddresses should be empty')
    state.backlinks = backlinks
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== BACKLINK_OVERRIDE ======
  // Test override a backlink from Alices wallet to Carols with Alices Wallet to Doras
  // Expected result: Alices wallet will be backlinked to Doras
  it('UP-BASIC-14 BACKLINK_OVERRIDE: must be able to override a backlink', async () => {
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { currentState: linkedToCarolState } = await executeUpgradeTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        data,
        testTime
      }
    )

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // Now overwride link to Carol with link to Dora
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[dora.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_OVERRIDE,
        data,
        testTime
      }
    )

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'BackLinkAltered' })

    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepStrictEqual(backlinks, linkedToCarolState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.strictEqual(backlinks[0].toString(), dora.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal dora.wallet.address')
    state.backlinks = backlinks
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== UPGRADE ======
  // Test upgrade transactions
  // Expected result an upgrade transactions will be processed
  it('TODO-UP-BASIC-30 UPGRADE: must be able to process a upgrade transactions', async () => {
  })

  // === Negative Use Cases (Event Testing) ===

  // === Scenario (Complex) Testing ===

  // ====== FORWARD + COMMAND ======
  // Test signing a transaction with a backlinked wallet
  // Expected result the backlinked wallet will sign a transaction for the linked wallet
  it('UP-COMPLEX-8-0 FORWARD-COMMAND: must be able to sign a transaction for a backlinked wallet', async () => {
    // Here we have a special case where we want alice's wallet backlinked to carol
    // create wallets and token contracts used througout the test
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-0-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-0-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, backlinks: [alice.wallet.address] })

    // alice and carol both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: HALF_ETH })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )
    let carolCurrentState = await TestUtil.getState(carol.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'ForwardAddressUpdated' })

    // Check alice's balance is now 0 and carol's is ONE ETH after the forward
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: ONE_ETH })

    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's forward address should now be carol's address
    state.forwardAddress = await TestUtil.validateFowardAddressMutation({ expectedForwardAddress: carol.wallet.address, wallet: alice.wallet })
    // Alice's spending state has been updated spentAmount = HALF_ETH and lastSpendingInterval has been updated
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = HALF_ETH
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's wallet hasn't changed (just her balances above)
    await TestUtil.assertStateEqual(carolState, carolCurrentState)

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // Carols uses the CALL command to sign a transaction
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    const expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    Logger.debug(`----====-----`)
    Logger.debug(messageHash.length, signature.length)
    const data = ONEUtil.hexStringToBytes(hexData)

    let { tx: tx2, currentState: carolCurrentStateSigned } = await executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: carol,
        operationType: ONEConstants.OperationType.COMMAND,
        tokenId: new BN(messageHash).toString(),
        dest: ONEUtil.hexString(encodedExpiryAt),
        amount: new BN(signature).toString(),
        data,
        testTime
      }
    )
    currentState = await TestUtil.getState(alice.wallet)
    Logger.debug(tx2)

    // Alice items that have changed -signatures
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    const expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    expectedSignatures[0].hash = ONEUtil.hexString(messageHash)
    expectedSignatures[0].signature = ONEUtil.hexString(signature)
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
    // Carol Items that have changed - lastOperationTime, commits, trackedTokens
    carolState = await TestUtil.validateOpsStateMutation({ wallet: carol.wallet, state: carolState })
    // check carol's wallet hasn't changed (just her balances above)
    await TestUtil.assertStateEqual(carolState, carolCurrentStateSigned)
  })

  // ====== FORWARD MULTIPLE TOKENS  ======
  // Test forwarding to another wallet
  // Expected result all tracked tokens will be forwarded to the destination wallet
  it('UP-COMPLEX-8-1 FORWARD-EXISTING: must be able to forward all assets to another wallet', async () => {
    // Here we have a special case where we want alice's wallet backlinked to carol
    // create wallets and token contracts used througout the test
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-1-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, backlinks: [alice.wallet.address] })

    // alice and carol both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: HALF_ETH })

    // Make Tokens and Fund Alices Wallet
    const { testerc20, testerc721, testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: true, makeERC1155: true })
    // Fund Alice with 1000 ERC20, 2 ERC721 and 50 ERC1155
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [0, [2, 3], [2, 3]],
      tokenAmounts: [[1000], [2], [20, 30]]
    })

    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [0, [2, 3], [2, 3]],
      tokenAmounts: [[1000], [2], [20, 30]]
    })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )
    const carolCurrentState = await TestUtil.getState(carol.wallet)
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'ForwardAddressUpdated' })

    // Check alice's balance is now 0 and carol's is ONE ETH after the forward
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: ONE_ETH })

    // Validate Alice and Carols Token Balance
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, carol.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [0, [2, 3], [2, 3]],
      tokenAmounts: [[1000], [2], [20, 30]]
    })

    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's forward address should now be carol's address
    state.forwardAddress = await TestUtil.validateFowardAddressMutation({ expectedForwardAddress: carol.wallet.address, wallet: alice.wallet })
    // Alice's spending state has been updated spentAmount = HALF_ETH and lastSpendingInterval has been updated
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = HALF_ETH
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    // tracked tokens
    let expectedTrackedTokens = [
      // { tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })

    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's wallet has changed: trackedTokens
    // tracked tokens
    expectedTrackedTokens = [
      // { tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    carolState.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: carol.wallet })

    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })

  // ====== FORWARD NATIVE TOKENS AUTOMATICALLY ======
  // Test forwarding to another wallet
  // Expected result all tracked tokens will be automatically forwarded to the destination wallet
  it('UP-COMPLEX-8-2 FORWARD-AUTOMATICALLY-NATIVE: native assets should be forwarded automatically', async () => {
    // Here we have a special case where we want alice's wallet backlinked to carol
    // create wallets and token contracts used througout the test
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-2-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-2-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, backlinks: [alice.wallet.address] })

    // alice and carol both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: HALF_ETH })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )
    let carolCurrentState = await TestUtil.getState(carol.wallet)
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'ForwardAddressUpdated' })

    // Check alice's balance is now 0 and carol's is ONE ETH after the forward
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: ONE_ETH })

    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's forward address should now be carol's address
    state.forwardAddress = await TestUtil.validateFowardAddressMutation({ expectedForwardAddress: carol.wallet.address, wallet: alice.wallet })
    // Alice's spending state has been updated spentAmount = HALF_ETH and lastSpendingInterval has been updated
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = HALF_ETH
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's wallet hasn't changed (just her balances above)
    await TestUtil.assertStateEqual(carolState, carolCurrentState)

    // Now fund Alice with TWO_ETH which should be forwarded to Carol
    await TestUtil.fundWallet({ to: alice.wallet.address, from: accounts[0], value: TWO_ETH })
    currentState = await TestUtil.getState(alice.wallet)
    carolCurrentState = await TestUtil.getState(carol.wallet)
    // Check alice's balance is now 0 and carol's is THREE ETH after the forward
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: THREE_ETH })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's wallet hasn't changed (just her balances above)
    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })

  // ====== FORWARD MULTIPLE TOKENS AUTOMATICALLY ======
  // Test forwarding to another wallet
  // Expected result all tracked tokens will be automatically forwarded to the destination wallet
  it('UP-COMPLEX-8-3 FORWARD-AUTOMATICALLY-TOKENS: must be able to forward all assets to another wallet', async () => {
    // Here we have a special case where we want alice's wallet backlinked to carol
    // create wallets and token contracts used througout the test
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-3-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol, state: carolState } = await TestUtil.makeWallet({ salt: 'UP-COMPLEX-8-3-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, backlinks: [alice.wallet.address] })

    // alice and carol both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: HALF_ETH })

    // Make Tokens
    const { testerc20, testerc721, testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: true, makeERC1155: true })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )
    let carolCurrentState = await TestUtil.getState(carol.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'ForwardAddressUpdated' })

    // Check alice's balance is now 0 and carol's is ONE ETH after the forward
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: ONE_ETH })

    // Fund Alice with 1000 ERC20, 2 ERC721 and 50 ERC1155
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [0, [2, 3], [2, 3]],
      tokenAmounts: [[1000], [2], [20, 30]],
      validate: false
    })
    currentState = await TestUtil.getState(alice.wallet)
    carolCurrentState = await TestUtil.getState(carol.wallet)

    // Validate Alice and Carol's Token BAlances These should have been forwarded to Carol
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, carol.wallet.address, carol.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155],
      tokenIds: [0, [2, 3], [2, 3]],
      tokenAmounts: [[1000], [2], [20, 30]]
    })

    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's forward address should now be carol's address
    state.forwardAddress = await TestUtil.validateFowardAddressMutation({ expectedForwardAddress: carol.wallet.address, wallet: alice.wallet })
    // Alice's spending state has been updated spentAmount = HALF_ETH and lastSpendingInterval has been updated
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = HALF_ETH
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    // tracked tokens
    let expectedTrackedTokens = [
      // { tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 },
      // { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 2 },
      // { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      // { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 2 },
      // { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })

    // check alice
    await TestUtil.assertStateEqual(state, currentState)
    // check carol's wallet has changed: trackedTokens
    // tracked tokens
    expectedTrackedTokens = [
      // { tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 2 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    carolState.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: carol.wallet })

    await TestUtil.assertStateEqual(carolState, carolCurrentState)
  })
// Combination testing of multiple functions
})
