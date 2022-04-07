const TestUtil = require('./util')
const config = require('../config')
const unit = require('ethjs-unit')
const Flow = require('../lib/api/flow')
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
const ONE_CENT = unit.toWei('0.01', 'ether')
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
// executeStandardTransaction commits and reveals a wallet transaction
const executeCoreTransaction = async ({
  walletInfo,
  operationType,
  tokenType,
  contractAddress,
  tokenId,
  dest,
  amount,
  data,
  address,
  randomSeed,
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
    // Format commit and revealParams for TRANSFER Tranasction
    case ONEConstants.OperationType.TRANSFER:
      paramsHash = ONEWallet.computeTransferHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
    case ONEConstants.OperationType.SET_RECOVERY_ADDRESS:
      paramsHash = ONEWallet.computeDestOnlyHash
      commitParams = { operationType, dest }
      revealParams = { operationType, dest }
      break
    case ONEConstants.OperationType.CHANGE_SPENDING_LIMIT:
    case ONEConstants.OperationType.JUMP_SPENDING_LIMIT:
      paramsHash = ONEWallet.computeAmountHash
      commitParams = { operationType, amount }
      revealParams = { operationType, amount }
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

// ==== Validation Helpers ====

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

  // === BASIC POSITIVE TESTING CORE ====

  // ====== TRANSFER ======
  // Test transferring native currency
  // Expected result alice can transfer funds to bob
  it('CO-BASIC-4 TRANSFER: must be able to transfer native currency', async () => {
  // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-4-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    const { walletInfo: bob, state: bobState } = await TestUtil.makeWallet({ salt: 'CO-BASIC-4-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // alice and bob both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: bob.wallet.address, amount: HALF_ETH })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    let { tx, currentState } = await executeCoreTransaction(
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
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: (HALF_ETH - ONE_CENT) })
    await TestUtil.validateBalance({ address: bob.wallet.address, amount: (Number(HALF_ETH) + Number(ONE_CENT)) })

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
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-5-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION, setLastResortAddress: false })
    const { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'CO-BASIC-5-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let aliceInfoInitial = await TestUtil.getInfoParsed(alice.wallet)
    assert.strictEqual(aliceInfoInitial.recoveryAddress, ONEConstants.EmptyAddress, `Alice should initally have last address set to zero address`)

    // alice sets her recovery address to bobs
    let { tx, currentState } = await executeCoreTransaction(
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

  // ==== RECOVER =====
  // Test recover all native assets from alices wallet
  // Expected result: all native assets will be transferred to her last resort address
  it('CO-BASIC-6 RECOVER: must be able to recover assets', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-6', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    assert.strictEqual(ONEConstants.EmptyAddress, state.forwardAddress, 'Expected forward address to be empty' )
    let info = await TestUtil.getInfoParsed(alice.wallet)
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: info.recoveryAddress, amount: 0 })

    // Begin Tests
    const index = 2 ** (alice.client.layers.length - 1) - 1
    const eotp = await Flow.EotpBuilders.recovery({ wallet: alice.wallet, layers: alice.client.layers })
    const neighbors = ONE.selectMerkleNeighbors({ layers: alice.client.layers, index })
    const neighbor = neighbors[0]
    const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
    const { hash: recoveryHash, bytes: recoveryData } = ONE.computeRecoveryHash({ hseed: alice.hseed })
    const { hash: verificationHash } = ONE.computeVerificationHash({ paramsHash: recoveryHash, eotp })
    const neighborsEncoded = neighbors.map(ONEUtil.hexString)
    await alice.wallet.commit(ONEUtil.hexString(commitHash), ONEUtil.hexString(recoveryHash), ONEUtil.hexString(verificationHash))
    const tx = await alice.wallet.reveal(
      [neighborsEncoded, index, ONEUtil.hexString(eotp)],
      [ONEConstants.OperationType.RECOVER, ONEConstants.TokenType.NONE, ONEConstants.EmptyAddress, 0, ONEConstants.EmptyAddress, 0, ONEUtil.hexString(recoveryData)]
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'RecoveryTriggered' })

    let currentState = await TestUtil.getState(alice.wallet)
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: 0 })
    await TestUtil.validateBalance({ address: info.recoveryAddress, amount: HALF_ETH })
    // Alice Items that have changed - nonce, lastOperationTime, commits
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's forward address should now be the recovery address
    state.forwardAddress = await TestUtil.validateFowardAddressMutation({ expectedForwardAddress: info.recoveryAddress, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // === Negative Use Cases (Event Testing) ===

  // === Scenario (Complex) Testing ===

  // Combination testing of multiple functions
})
