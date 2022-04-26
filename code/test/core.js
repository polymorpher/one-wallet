const TestUtil = require('./util')
const unit = require('ethjs-unit')
const Flow = require('../lib/api/flow')
const ONEConstants = require('../lib/constants')
const BN = require('bn.js')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}
const ONE_CENT = unit.toWei('0.01', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
const getEffectiveTime = () => Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const Logger = TestUtil.Logger

// ==== Validation Helpers ====

contract('ONEWallet', (accounts) => {
  Logger.debug(`Testing with ${accounts.length} accounts`)
  Logger.debug(accounts)
  let snapshotId
  let alice, bob, state, bobState

  beforeEach(async function () {
    ({ alice, bob, state, bobState } = await TestUtil.init())
    snapshotId = await TestUtil.snapshot()
    console.log(`Taken snapshot id=${snapshotId}`)
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
    await TestUtil.sleep(500)
  })

  // === BASIC POSITIVE TESTING CORE ====

  // ====== TRANSFER ======
  // Test transferring native currency
  // Expected result alice can transfer funds to bob
  it('CO-BASIC-4 TRANSFER: must be able to transfer native currency', async () => {
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    let { tx, currentState } = await TestUtil.executeCoreTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: ONE_CENT,
        testTime
      }
    )
    let bobCurrentState = await TestUtil.getState(bob.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'PaymentSent' })

    // Check alice's balance  bob's is ONE ETH after the forward
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: new BN(HALF_ETH).sub(ONE_CENT) })
    await TestUtil.validateBalance({ address: bob.wallet.address, amount: new BN(HALF_ETH).add(ONE_CENT) })

    // Alice Items that have changed - balance, nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = ONE_CENT
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
    // Bob Items that have changed - nothing in the wallet just his balance above
    await TestUtil.assertStateEqual(bobState, bobCurrentState)
  })

  // ====== SET_RECOVERY_ADDRESS ======
  // Test setting of alices recovery address
  // Expected result: alices lastResortAddress will change to bobs last Resort address
  // Notes: Cannot set this to zero address, the same address or the treasury address
  // Fails to update if you have create alice wallet with `setLastResortAddress: true` as an address already set.
  it('CO-BASIC-5 SET_RECOVERY_ADDRESS: must be able to set recovery address', async () => {
    // Here we have a special case where we want alice last resort address not to be set so we can set this to carol
    // create wallets and token contracts used througout the test
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-5-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, setLastResortAddress: false })
    const { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'CO-BASIC-5-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let aliceInfoInitial = await TestUtil.getInfoParsed(alice.wallet)
    assert.strictEqual(aliceInfoInitial.recoveryAddress, ONEConstants.EmptyAddress, `Alice should initally have last address set to zero address`)

    // alice sets her recovery address to bobs
    let { tx, currentState } = await TestUtil.executeCoreTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        dest: carol.wallet.address,
        testTime
      }
    )

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'RecoveryAddressUpdated' })

    // Alice Items that have changed - nonce, lastOperationTime, recoveryAddress, commits
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // recoveryAddress
    let expectedInfo = await TestUtil.getInfoParsed(alice.wallet)
    expectedInfo.recoveryAddress = carol.wallet.address
    state.info = await TestUtil.validateInfoMutation({ expectedInfo, wallet: alice.wallet })
    // check alice
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ==== RECOVER TO BE REPLACED=====
  // Test recover all native assets from alices wallet
  // Expected result: all native assets will be transferred to her last resort address
  it('CO-BASIC-6 RECOVER: must be able to recover assets', async () => {
    // verify alice does not have forward address set initially
    assert.strictEqual(state.forwardAddress, ONEConstants.EmptyAddress, 'Expected forward address to be empty')
    let info = await TestUtil.getInfoParsed(alice.wallet)
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: info.recoveryAddress, amount: 0 })

    // Begin Tests
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const index = 2 ** (alice.client.layers.length - 1) - 1
    const eotp = await Flow.EotpBuilders.recovery({ wallet: alice.wallet, layers: alice.client.layers })
    // Recover Alices wallet
    let { tx, currentState } = await TestUtil.executeCoreTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        index,
        eotp,
        operationType: ONEConstants.OperationType.RECOVER,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'RecoveryTriggered' })

    // let currentState = await TestUtil.getState(alice.wallet)
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: info.recoveryAddress, amount: HALF_ETH })
    // Alice Items that have changed - nonce, lastOperationTime, commits
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's forward address should now be the recovery address
    state.forwardAddress = await TestUtil.validateFowardAddressMutation({ expectedForwardAddress: info.recoveryAddress, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ==== ADDITIONAL POSTIVE TESTING =====

  // Test calling TRANSFER when forwarding address is set
  // Expected result this will fail and trigger event PaymentForwarded
  // Logic: // if sender is anyone else (including self), simply forward the payment
  it('CO-POSITIVE-4 TRANSFER: must forward funds automatically when forward address is set', async () => {
    // Here we have a special case where we want alice's wallet backlinked to carol
    // create wallets and token contracts used througout the test
    let { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'CP-POSITIVE-4-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'CO-POSITIVE-4-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, backlinks: [alice.wallet.address] })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )

    // let tx2 = await TestUtil.fundTokens({ to: alice.wallet.address, amount: ONE_CENT })
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // bob tranfers ONE CENT to alice which get's forwarded to carol
    let { tx } = await TestUtil.executeCoreTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: bob,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: alice.wallet.address,
        amount: ONE_CENT,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'PaymentForwarded' })
  })

  // ==== NEGATIVE USE CASES (EVENT TESTING) ====

  // Test calling TRANSFER with insufficient funds
  // Expected result this will fail and trigger event InsufficientFund
  // Logic: if (address(this).balance < amount)
  it('CO-NEGATIVE-4 TRANSFER: must fail with insufficient funds', async () => {
  })

  // Test calling TRANSFER with for an amount that exceeds the spending limit
  // Expected result this will fail and trigger event ExceedSpendingLimit
  // Logic: if (!isWithinLimit(ss, amount))
  it('CO-NEGATIVE-4-1 TRANSFER: must fail with exceeding spending limit', async () => {
  })

  // Test calling TRANSFER which fails
  // Expected result this will fail and trigger event TransferError
  // Logic: if (!success) where (bool success, bytes memory ret) = dest.call{value : amount}("");
  it('CO-NEGATIVE-4-1 TRANSFER: must fail with transfer error', async () => {
  })

  // Test calling RECOVER were last resort address is not set
  // Expected result this will fail and trigger event LastResortAddressNotSet
  // Logic: if (!Recovery.isRecoveryAddressSet(recoveryAddress))
  it('SE-NEGATIVE-6 RECOVER: must fail with last address not set', async () => {
  })
  // ==== COMPLEX SCENARIO TESTING ====
})
