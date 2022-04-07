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
const ONE_ETH = unit.toWei('1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
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
      paramsHash = ONEWallet.computeForwardHash
      commitParams = { address: dest }
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
      assert.strictEqual('A Valid Operation', operationType, 'Error invalid operationType passed')
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
  let snapshotId
  beforeEach(async function () {
    await TestUtil.init()
    snapshotId = await TestUtil.snapshot()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE UPGRADE WALLET ====

  // ====== FORWARD ======
  // Test forwarding to another wallet
  // Expected result the wallet will be forwarded to
  it('UP-BASIC-8 FORWARD: must be able to set forward to another wallet', async () => {
    // create wallets and token contracts used througout the tests
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
  it('UP-BASIC-11 COMMAND: must be able to issue a command', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })

  // ====== BACKLINK_ADD ======
  // Test add a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will be backlinked to Carols
  it('UP-BASIC-12 BACKLINK_ADD: must be able to add a backlink', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-BASIC-12-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'UP-BASIC-12-1-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
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
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-BASIC-13-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'UP-BASIC-13.2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
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
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'UP-BASIC-14-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'UP-BASIC-14.2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: dora } = await TestUtil.makeWallet({ salt: 'UP-BASIC-14.3', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
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
  it('UP-BASIC-30 UPGRADE: must be able to process a upgrade  transactions', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })

  // === Negative Use Cases (Event Testing) ===

  // === Scenario (Complex) Testing ===

  // ====== FORWARD + COMMAND ======
  // Test signing a transaction with a backlinked wallet
  // Expected result the backlinked wallet will sign a transaction for the linked wallet
  it('UP-COMPLEX-8-0 FORWARD.COMMAND: must be able to sign a transaction for a backlinked wallet', async () => {
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
    state.signatures = expectedSignatures
    state.signatures[0].hash = ONEUtil.hexString(messageHash)
    state.signatures[0].signature = ONEUtil.hexString(signature)
    await TestUtil.assertStateEqual(state, currentState)
    // Carol Items that have changed - lastOperationTime, commits, trackedTokens
    carolState = await TestUtil.validateOpsStateMutation({ wallet: carol.wallet, state: carolState })
    // check carol's wallet hasn't changed (just her balances above)
    await TestUtil.assertStateEqual(carolState, carolCurrentStateSigned)
  })
// Combination testing of multiple functions
})
