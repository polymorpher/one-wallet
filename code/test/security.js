const TestUtil = require('./util')
const config = require('../config')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const ONEWallet = require('../lib/onewallet')
const BN = require('bn.js')
const ONEDebugger = require('../lib/debug')
// const assert = require('assert')
const exp = require('constants')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}
const DUMMY_HEX = '0x'
const ONE_CENT = unit.toWei('0.01', 'ether')
const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const TWO_ETH = unit.toWei('2', 'ether')
const THREE_ETH = unit.toWei('3', 'ether')
const FOUR_ETH = unit.toWei('4', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const INTERVAL6 = INTERVAL * 6 // 6 intervals is 3 minutes
const NOW = Math.floor(Date.now() / (INTERVAL)) * INTERVAL - 5000
const duration = INTERVAL * 2 * 60 * 24 * 4 // 4 day wallet duration
const getEffectiveTime = () => Math.floor(NOW / INTERVAL6) * INTERVAL6 - duration / 2
// constants used for displace testing
const SLOT_SIZE = 1
const MULTIPLES = process.env.LIGHT ? [24] : [24, 26, 28, 30, 32, 34, 36]
const DURATIONS = MULTIPLES.map(e => INTERVAL * e) // need to be greater than 16 to trigger innerCore generations
const EFFECTIVE_TIMES = DURATIONS.map(d => Math.floor(NOW / INTERVAL) * INTERVAL - d / 2)

const Logger = TestUtil.Logger
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
  let eotp = await ONEWallet.computeEOTP({ otp, hseed: walletInfo.hseed })
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
      Logger.debug(`Invalid Operation passed`)
      assert.strictEqual(operationType, 'A Valid Operation', 'Error invalid operationType passed')
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
  const testForTime = async (multiple, effectiveTime, duration, seedBase = '0xdeadbeef1234567890023456789012', numTrees = 6, checkDisplacementSuccess = false) => {
    Logger.debug('testing:', { multiple, effectiveTime, duration })
    const purse = web3.eth.accounts.create()
    const creationSeed = '0x' + (new BN(ONEUtil.hexStringToBytes(seedBase)).addn(duration).toString('hex'))
    const creationPackage = await TestUtil.createWallet({
      seed: creationSeed,
      effectiveTime,
      duration,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    })
    const {
      wallet,
      seed,
      client: { innerTrees, },
    } = creationPackage

    // TestUtil.printInnerTrees({ Debugger, innerTrees })
    const newSeed = '0xdeedbeaf1234567890123456789012'
    const newEffectiveTime = Math.floor(NOW / INTERVAL / 6) * INTERVAL * 6
    const { core: newCore, innerCores: newInnerCores, identificationKeys: newKeys, vars: { seed: newComputedSeed, hseed: newHseed, client: { layers: newLayers } } } = await TestUtil.makeCores({
      seed: newSeed,
      effectiveTime: newEffectiveTime,
      duration: duration,
    })
    const data = ONEWallet.encodeDisplaceDataHex({ core: newCore, innerCores: newInnerCores, identificationKey: newKeys[0] })

    const tOtpCounter = Math.floor(NOW / INTERVAL)
    const baseCounter = Math.floor(tOtpCounter / 6) * 6
    for (let c = 0; c < numTrees; c++) {
      Logger.debug(`tOtpCounter=${tOtpCounter} baseCounter=${baseCounter} c=${c}`)
      const otpb = ONEUtil.genOTP({ seed, counter: baseCounter + c, n: 6 })
      const otps = []
      for (let i = 0; i < 6; i++) {
        otps.push(otpb.subarray(i * 4, i * 4 + 4))
      }
      const innerEffectiveTime = Math.floor(effectiveTime / (INTERVAL * 6)) * (INTERVAL * 6)
      const innerExpiryTime = innerEffectiveTime + Math.floor(duration / (INTERVAL * 6)) * (INTERVAL * 6)
      assert.isBelow(NOW, innerExpiryTime, 'Current time must be greater than inner expiry time')
      const index = ONEUtil.timeToIndex({ time: NOW, effectiveTime: innerEffectiveTime, interval: INTERVAL * 6 })
      const eotp = await ONEWallet.computeInnerEOTP({ otps })
      // const treeIndex = Math.floor((NOW - effectiveTime) / INTERVAL) % 6
      const treeIndex = c
      Logger.debug({
        otps: otps.map(e => {
          const r = new DataView(new Uint8Array(e).buffer)
          return r.getUint32(0, false)
        }),
        eotp: ONEUtil.hexString(eotp),
        index,
        treeIndex
      })
      Debugger.printLayers({ layers: innerTrees[treeIndex].layers })

      const { tx, authParams, revealParams } = await TestUtil.commitReveal({
        Debugger,
        layers: innerTrees[treeIndex].layers,
        index,
        eotp,
        paramsHash: ONEWallet.computeDataHash,
        commitParams: { data: ONEUtil.hexStringToBytes(data) },
        revealParams: { data, operationType: ONEConstants.OperationType.DISPLACE },
        wallet
      })
      const successLog = tx.logs.find(log => log.event === 'CoreDisplaced') || tx.receipt.rawLogs.find(log => log.topics.includes('0x0b6dd4942da3070d72e5249990ad2b2703efd3f3a99c79cd0ce1a8eb50f8fdf4'))
      if (checkDisplacementSuccess && !successLog) {
        console.error(tx, authParams, revealParams)
        Logger.debug(tx.receipt.rawLogs)
        throw new Error('CoreDisplaced log missing')
      }
    }
    return { wallet, newCore, newInnerCores, newKeys, newSeed: newComputedSeed, newEffectiveTime, newHseed, newLayers }
    // assert.equal(ONE_CENT, balance, 'Wallet has correct balance')
  }

  // === BASIC POSITIVE TESTING SECURITY ====

  // ==== DISPLACE =====
  // Test must allow displace operation using 6x6 otps for different durations
  // Expected result: can authenticate otp from new core after displacement
  // Note: this is currently tested in innerCores.js
  it('SE-BASIC-7 DISPLACE : must allow displace operation using 6x6 otps for different durations authenticate otp from new core after displacement', async () => {
    const MULTIPLE = 24
    const DURATION = INTERVAL * 24 // need to be greater than 16 to trigger innerCore generations
    const EFFECTIVE_TIME = Math.floor(NOW / INTERVAL) * INTERVAL - 24 / 2
    await testForTime(MULTIPLE, EFFECTIVE_TIME, DURATION)
  })

  // ====== CHANGE_SPENDING_LIMIT ======
  // Test changing the spending limit
  // Expected result alice spending limit will be updated
  // Change Logic:
  // Too early: Can't increase the limit twice within the same interval (ss.lastLimitAdjustmentTime + ss.spendingInterval > block.timestamp && newLimit > ss.spendingLimit)
  // Too much : Can't increase the limit by more than double existing limit + 1 native Token (newLimit > (ss.spendingLimit) * 2 + (1 ether))
  it('SE-BASIC-24 CHANGE_SPENDING_LIMIT: must be able to change the spending limit', async () => {
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
    TestUtil.validateEvent({ tx, expectedEvent: 'HighestSpendingLimitChanged' })

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
  // Test jumping the spending limit
  // Expected the spending limit will be changed
  // Jump Logic:
  // Too Much : Can't increase the limit greater than the highest spending limit (newLimit > ss.highestSpendingLimit)
  // Authentication: from function authenticate in reveal.sol
  // if innerCores are empty, this operation (in this case) is doomed to fail. This is intended. Client should warn the user not to lower the limit too much if the wallet has no innerCores (use Extend to set first innerCores). Client should also advise the user the use Recovery feature to get their assets out, if they are stuck with very low limit and do not want to wait to double them each spendInterval.
  it('SE-BASIC-25 JUMP_SPENDING_LIMIT: must be able to jump the spending limit', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-25-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration })
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
  // ====== SPENDING LIMIT RULES ======
  // Test spending limit rules
  // Expected all spending limit rules will be obeyed
  // Change Logic:
  // Too early: Can't increase the limit twice within the same interval (ss.lastLimitAdjustmentTime + ss.spendingInterval > block.timestamp && newLimit > ss.spendingLimit)
  // Too much : Can't increase the limit by more than double existing limit + 1 native Token (newLimit > (ss.spendingLimit) * 2 + (1 ether))
  // Jump Logic:
  // Too Much : Can't increase the limit greater than the highest spending limit (newLimit > ss.highestSpendingLimit)
  // Authentication: from function authenticate in reveal.sol
  // if innerCores are empty, this operation (in this case) is doomed to fail. This is intended. Client should warn the user not to lower the limit too much if the wallet has no innerCores (use Extend to set first innerCores). Client should also advise the user the use Recovery feature to get their assets out, if they are stuck with very low limit and do not want to wait to double them each spendInterval.
  it('SE-COMPLEX-24-25 SPENDING LIMIT RULES: must be able to update spending limit according to the rules', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'SE-COMPLEX-24-25-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration })
    let testTime = Date.now()
    // alice changes the spending limit to TWO_ETH
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx: tx1, currentState: currentState1 } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: TWO_ETH,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx1, expectedEvent: 'SpendingLimitChanged' })
    TestUtil.validateEvent({ tx: tx1, expectedEvent: 'HighestSpendingLimitChanged' })
    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    let currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    let expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = TWO_ETH
    expectedSpendingState.highestSpendingLimit = TWO_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState1)

    // alice changes the spending limit to THREE_ETH which fails and the new limit still should be 2 ETH, not 3 ETH
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx: tx2, currentState: currentState2 } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: THREE_ETH,
        testTime
      }
    )
    // Validate SpendingLimitChangeFailed event emitted
    TestUtil.validateEvent({ tx: tx2, expectedEvent: 'SpendingLimitChangeFailed' })
    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = TWO_ETH
    expectedSpendingState.highestSpendingLimit = TWO_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState2)

    // alice changes the spending limit back to ONE_DIME
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx: tx3, currentState: currentState3 } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: ONE_DIME,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx3, expectedEvent: 'SpendingLimitChanged' })
    // TestUtil.validateEvent({ tx, expectedEvent: 'HighestSpendingLimitChanged' })
    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = ONE_DIME
    expectedSpendingState.highestSpendingLimit = TWO_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState3)

    // alice changes the spending limit up to ONE_ETH which fails as you can't increase the limit if you have already changed it within an interval
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx: tx4, currentState: currentState4 } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: ONE_ETH,
        testTime
      }
    )
    // Validate SpendingLimitChangeFailed event emitted
    TestUtil.validateEvent({ tx: tx4, expectedEvent: 'SpendingLimitChangeFailed' })
    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = ONE_DIME
    expectedSpendingState.highestSpendingLimit = TWO_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState4)

    // alice JUMPS the spending limit after waiting 4 minutes
    testTime = await TestUtil.bumpTestTime(testTime, 2400)
    let { tx: tx5, currentState: currentState5 } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.JUMP_SPENDING_LIMIT,
        amount: TWO_ETH,
        testTime
      }
    )
    // JUMP_SPENDING_LIMIT does not trigger an event
    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = TWO_ETH
    expectedSpendingState.highestSpendingLimit = TWO_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState5)

    // alice changes the spending limit to 4 ETH after waiting a day
    testTime = await TestUtil.bumpTestTime(testTime, (24 * 3600))
    let { tx: tx6, currentState: currentState6 } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: FOUR_ETH,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx6, expectedEvent: 'SpendingLimitChanged' })
    TestUtil.validateEvent({ tx: tx6, expectedEvent: 'HighestSpendingLimitChanged' })
    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Spending State
    currentSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet) // retrieve this  as it will have lastLimitAdjustmentTime
    expectedSpendingState = state.spendingState
    expectedSpendingState.spendingLimit = FOUR_ETH
    expectedSpendingState.highestSpendingLimit = FOUR_ETH
    expectedSpendingState.lastLimitAdjustmentTime = currentSpendingState.lastLimitAdjustmentTime
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState6)
  })

  // ===== DISPLACE TESTING FOR DIFFERENT DURATIONS ====
  it('SE-COMPLEX-8: must allow displace operation using 6x6 otps for different durations', async () => {
    for (let i = 0; i < MULTIPLES.length; i++) {
      await testForTime(MULTIPLES[i], EFFECTIVE_TIMES[i], DURATIONS[i])
    }
  })
  // ===== DISPLACEMENT AUTHENTICATION TESTING ====
  it('SE-COMPLEX-8-0: must authenticate otp from new core after displacement', async () => {
    const { wallet, newSeed, newEffectiveTime, newHseed, newLayers } = await testForTime(MULTIPLES[0], EFFECTIVE_TIMES[0], DURATIONS[0], '0xdeadbeef1234567890123456789012', 1, true)
    Logger.debug('newSeed', newSeed)
    const counter = Math.floor(NOW / INTERVAL)
    const otp = ONEUtil.genOTP({ seed: newSeed, counter })
    const index = ONEUtil.timeToIndex({ time: NOW, effectiveTime: newEffectiveTime })
    const eotp = await ONEWallet.computeEOTP({ otp, hseed: newHseed })
    const purse = web3.eth.accounts.create()

    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: ONE_DIME
    })
    await TestUtil.commitReveal({
      Debugger,
      layers: newLayers,
      index,
      eotp,
      paramsHash: ONEWallet.computeTransferHash,
      commitParams: { dest: purse.address, amount: (ONE_DIME / 2).toString() },
      revealParams: { dest: purse.address, amount: (ONE_DIME / 2).toString(), operationType: ONEConstants.OperationType.TRANSFER },
      wallet
    })

    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(ONE_DIME / 2, purseBalance, 'Purse has correct balance')
  })

  // Combination testing of multiple functions
})
