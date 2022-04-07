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
const exp = require('constants')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}
const DUMMY_HEX = '0x'
const ONE_CENT = unit.toWei('0.01', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const TWO_ETH = unit.toWei('2', 'ether')
const THREE_ETH = unit.toWei('3', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const INTERVAL6 = INTERVAL * 6 // 6 intervals is 3 minutes
const NOW = Math.floor(Date.now() / (INTERVAL)) * INTERVAL - 5000
const duration = INTERVAL * 2 * 60 * 24 * 4 // 4 day wallet duration
const getEffectiveTime = () => Math.floor(NOW / INTERVAL6) * INTERVAL6 - duration / 2

const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}
const Debugger = ONEDebugger(Logger)

// ==== EXECUTION FUNCTIONS ====
// executeSecurityTransaction commits and reveals a wallet transaction
const executeSecurityTransaction = async ({
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
  let index = ONEUtil.timeToIndex({ effectiveTime: walletEffectiveTime, time: testTime })
  let eotp = await ONE.computeEOTP({ otp, hseed: walletInfo.hseed })
  let layers = walletInfo.client.layers
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
      paramsHash = ONEWallet.computeAmountHash
      commitParams = { operationType, amount }
      revealParams = { operationType, amount }
      break
    case ONEConstants.OperationType.JUMP_SPENDING_LIMIT:
      // Client Logic
      const tOtpCounter = Math.floor(testTime / INTERVAL)
      const treeIndex = tOtpCounter % 6
      layers = walletInfo.client.innerTrees[treeIndex].layers
      const otpb = ONEUtil.genOTP({ seed: walletInfo.seed, counter: tOtpCounter, n: 6 })
      const otps = []
      for (let i = 0; i < 6; i++) {
        otps.push(otpb.subarray(i * 4, i * 4 + 4))
      }
      index = ONEUtil.timeToIndex({ time: testTime, effectiveTime: walletEffectiveTime, interval: INTERVAL6 })
      eotp = await ONEWallet.computeInnerEOTP({ otps })
      // Commit Reveal parameters
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

  // === BASIC POSITIVE TESTING SECURITY ====

  // ==== DISPLACE =====
  // Test must allow displace operation using 6x6 otps for different durations
  // Expected result: can authenticate otp from new core after displacement
  // Note: this is currently tested in innerCores.js
  it('CO-BASIC-7 DISPLACE : must allow displace operation using 6x6 otps for different durations authenticate otp from new core after displacement', async () => {
    assert.strictEqual(0, 1, 'Please test displace using innerCores.js')
  })

  // ====== CHANGE_SPENDING_LIMIT ======
  // Test changing the spending limit
  // Expected result alice spending limit will be updated
  // Change Logic:
  // Too early: Can't increase the limit twice within the same interval (ss.lastLimitAdjustmentTime + ss.spendingInterval > block.timestamp && newLimit > ss.spendingLimit)
  // Too much : Can't increase the limit by more than double existing limit + 1 native Token (newLimit > (ss.spendingLimit) * 2 + (1 ether))
  it('CO-BASIC-24 CHANGE_SPENDING_LIMIT: must be able to transfer native currency', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-24-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice changes the spending limit
    let { tx, currentState } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: THREE_ETH,
        testTime
      }
    )

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'SpendingLimitChanged' })
    // TestUtil.validateEvent({ tx, expectedEvent: 'HighestSpendingLimitChanged' })

    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    const currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    const expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = THREE_ETH
    expectedSpendingState.highestSpendingLimit = THREE_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== JUMP_SPENDING_LIMIT ======
  // Test transferring native currency
  // Expected result alice can transfer funds to bob
  // Jump Logic:
  // Too Much : Can't increase the limit greater than the highest spending limit (newLimit > ss.highestSpendingLimit)
  // Authentication: from function authenticate in reveal.sol
  // if innerCores are empty, this operation (in this case) is doomed to fail. This is intended. Client should warn the user not to lower the limit too much if the wallet has no innerCores (use Extend to set first innerCores). Client should also advise the user the use Recovery feature to get their assets out, if they are stuck with very low limit and do not want to wait to double them each spendInterval.
  it('CO-BASIC-25 JUMP_SPENDING_LIMIT: must be able to transfer native currency', async () => {
  // create wallets and token contracts used througout the tests
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-25-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 240)

    // alice JUMPS the spending limit
    let { currentState } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.JUMP_SPENDING_LIMIT,
        amount: HALF_ETH,
        testTime
      }
    )

    // JUMP_SPENDING_LIMIT does not trgger an event

    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    let currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    const expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = HALF_ETH
    expectedSpendingState.highestSpendingLimit = ONE_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // === Negative Use Cases (Event Testing) ===

  // === Scenario (Complex) Testing ===

  // Combination testing of multiple functions
})
