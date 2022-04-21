const TestUtil = require('./util')
const { keccak256 } = require('web3-utils')
const unit = require('ethjs-unit')
const ONEUtil = require('./../lib/util')
const ONEDebugger = require('./../lib/debug')
const ONEWallet = require('./../lib/onewallet')
const ONEConstants = require('./../lib/constants')
const BN = require('bn.js')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}

const ONE_CENT = unit.toWei('0.01', 'ether')
const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const TWO_ETH = unit.toWei('2', 'ether')
const THREE_ETH = unit.toWei('3', 'ether')
const FOUR_ETH = unit.toWei('4', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const INTERVAL6 = INTERVAL * 6 // 6 intervals is 3 minutes
const NOW_MINUS_5 = Math.floor(Date.now() / (INTERVAL)) * INTERVAL - 5000
const duration = INTERVAL * 2 * 60 * 24 * 4 // 4 day wallet duration
const getEffectiveTime = () => Math.floor(NOW_MINUS_5 / INTERVAL6) * INTERVAL6 - duration / 2
// constants used for displace testing
const SLOT_SIZE = 1
const MULTIPLES = process.env.LIGHT ? [24] : [24, 26, 28, 30, 32, 34, 36]
const DURATIONS = MULTIPLES.map(e => INTERVAL * e) // need to be greater than 16 to trigger innerCore generations
// const EFFECTIVE_TIMES = DURATIONS.map(d => Math.floor(NOW_MINUS_5 / INTERVAL) * INTERVAL - d / 2)

const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)

// ==== EXECUTION FUNCTIONS ====
// executeSecurityTransaction commits and reveals a wallet transaction
const executeSecurityTransaction = async ({
  walletInfo,
  layers,
  index,
  eotp,
  operationType,
  tokenType,
  contractAddress,
  tokenId,
  dest,
  amount,
  data,
  effectiveTime,
  duration,
  numTrees = 6,
  treeIndex,
  testTime = Date.now(),
  getCurrentState = true
}) => {
  const info = await walletInfo.wallet.getInfo()
  const t0 = new BN(info[3]).toNumber()
  const walletEffectiveTime = t0 * INTERVAL
  if (!layers) { layers = walletInfo.client.layers }
  if (!index) {
    // calculate wallets effectiveTime (creation time) from t0
    index = ONEUtil.timeToIndex({ effectiveTime: walletEffectiveTime, time: testTime })
  }
  if (!eotp) {
    // calculate counter from testTime
    const counter = Math.floor(testTime / INTERVAL)
    const otp = ONEUtil.genOTP({ seed: walletInfo.seed, counter })
    eotp = await ONEWallet.computeEOTP({ otp, hseed: walletInfo.hseed })
  }
  let paramsHash
  let commitParams
  let revealParams
  let tOtpCounter
  let otpb
  let otps
  // Process the Operation
  switch (operationType) {
    case ONEConstants.OperationType.CHANGE_SPENDING_LIMIT:
      paramsHash = ONEWallet.computeAmountHash
      commitParams = { operationType, amount }
      revealParams = { operationType, amount }
      break
    case ONEConstants.OperationType.JUMP_SPENDING_LIMIT:
      // Client Logic
      tOtpCounter = Math.floor(testTime / INTERVAL)
      treeIndex = tOtpCounter % 6
      layers = walletInfo.client.innerTrees[treeIndex].layers
      otpb = ONEUtil.genOTP({ seed: walletInfo.seed, counter: tOtpCounter, n: 6 })
      otps = []
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
    case ONEConstants.OperationType.DISPLACE:
      // Commit Reveal parameters
      paramsHash = ONEWallet.computeDataHash
      commitParams = { data: ONEUtil.hexStringToBytes(data) }
      revealParams = { data, operationType: ONEConstants.OperationType.DISPLACE }
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

  // testForTime Logic overview
  // Logic Overview example using 24 intervals of 30 seconds = 12 minutes duration
  // testTime: rounded to the nearest 30 seconds e.g. 05:02:30
  // effectiveTime: testTime - half duration e.g. 04:56:30 (i.e. testTime - 6 minutes)
  // * makeWallet: creates a wallet using the seed storing the root of 6 merkle trees (each with 4 passwords) in innerCores
  // * makeCores: is called by makeWallet and populates the 24 otps into layers and innerTrees held in the client object
  // * makeCores: is called again with a newSeed to generate another 24 otps
  // for each of the (6) Trees (holding 4 passwords)
  //   we increase t0 by 1 (needed to DISPLACE the cores)
  //   we generate a new Root (needed to DISPLACE the cores)
  //   we populate the data with the new Core Information (used in the Displace)
  //   we generate the tOTP (time based one time password) from the original password set by using alice.seed
  //   we calculate innerEffectiveTime and innerExpiryTime and reconstruct the otps array from the original otpb
  //      otpb (is an array of the 24 one time passwords)
  //      otpb: {"0":0,"1":6,"2":11,"3":217,"4":0,"5":13,"6":245,"7":73,"8":0,"9":0,"10":73,"11":83,"12":0,"13":13,"14":85,"15":212,"16":0,"17":2,"18":104,"19":150,"20":0,"21":11,"22":7,"23":74}
  //      otps (is an array of 6 objects each holding four passords)
  //      otps: [{"0":0,"1":6,"2":11,"3":217},{"0":0,"1":13,"2":245,"3":73},{"0":0,"1":0,"2":73,"3":83},{"0":0,"1":13,"2":85,"3":212},{"0":0,"1":2,"2":104,"3":150},{"0":0,"1":11,"2":7,"3":74}]
  //   we calculate the index for the otp (based on the testTime, effectiveTime and duration)
  //   we call displace which updates the wallet with 6 new Root entries in innercores, updates the Info, and OldInfo
  //   we validate that the wallet was succesfully updated
  // endfor
  // we return the wallet(alice), newEffectiveTime and state (i.e. alices wallet with 24 new cores added and 6 oldInfos)
  const testForTime = async ({ multiple, effectiveTime, duration, seedBase = '0xdeadbeef1234567890023456789012', numTrees = 6, checkDisplacementSuccess = false, testTime = Date.now() }) => {
    Logger.debug('testing:', { multiple, effectiveTime, duration })
    const creationSeed = '0x' + (new BN(ONEUtil.hexStringToBytes(seedBase)).addn(duration).toString('hex'))
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: creationSeed, deployer: accounts[0], effectiveTime, duration, buildInnerTrees: true })
    TestUtil.printInnerTrees({ Debugger, innerTrees: alice.client.innerTrees })
    // Start Tests
    const newSeed = '0xdeedbeaf1234567890123456789012'
    let newCore, newInnerCores, newKeys, newEffectiveTime, newComputedSeed, newHseed, newClient
    const tOtpCounter = Math.floor(testTime / INTERVAL)
    const baseCounter = Math.floor(tOtpCounter / 6) * 6
    for (let c = 0; c < numTrees; c++) {
      ({ core: newCore, innerCores: newInnerCores, identificationKeys: newKeys, vars: { seed: newComputedSeed, hseed: newHseed, client: newClient } } = await TestUtil.makeCores({
        seed: newSeed,
        effectiveTime: (Math.floor(testTime / INTERVAL / 6) + c) * INTERVAL * 6,
        duration: duration,
        buildInnerTrees: true
      }))
      const data = ONEWallet.encodeDisplaceDataHex({ core: newCore, innerCores: newInnerCores, identificationKey: newKeys[0] })
      Logger.debug(`tOtpCounter=${tOtpCounter} baseCounter=${baseCounter} c=${c}`)
      const otpb = ONEUtil.genOTP({ seed: alice.seed, counter: baseCounter + c, n: 6 })
      const otps = []
      for (let i = 0; i < 6; i++) {
        otps.push(otpb.subarray(i * 4, i * 4 + 4))
      }
      const innerEffectiveTime = Math.floor(effectiveTime / (INTERVAL * 6)) * (INTERVAL * 6)
      const innerExpiryTime = innerEffectiveTime + Math.floor(duration / (INTERVAL * 6)) * (INTERVAL * 6)
      assert.isBelow(testTime, innerExpiryTime, 'Current time must be greater than inner expiry time')
      const index = ONEUtil.timeToIndex({ time: testTime, effectiveTime: innerEffectiveTime, interval: INTERVAL * 6 }) // passed to Commit Reveal
      const eotp = await ONEWallet.computeInnerEOTP({ otps }) // passed to Commit Reveal
      const treeIndex = c
      Logger.debug({
        otps: otps.map(e => {
          const r = new DataView(new Uint8Array(e).buffer)
          return r.getUint32(0, false)
        }),
        eotp: ONEUtil.hexString(eotp),
        index,
        c
      })
      Debugger.printLayers({ layers: alice.client.innerTrees[treeIndex].layers })
      const layers = alice.client.innerTrees[treeIndex].layers // passed to commitReveal
      let { tx, currentState } = await executeSecurityTransaction(
        {
          ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
          walletInfo: alice,
          layers,
          index,
          eotp,
          operationType: ONEConstants.OperationType.DISPLACE,
          data,
          effectiveTime,
          duration,
          testTime
        }
      )

      if (checkDisplacementSuccess) {
        TestUtil.validateEvent({ tx, expectedEvent: 'CoreDisplaced' })
        // Alice Items that have changed - nonce, lastOperationTime
        state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
        // Alice items that have changed identificationKeys, infos, oldInfos, innerCores
        // Identification keys now have the newKeys added
        const expectedIdentificationKeys = await alice.wallet.getIdentificationKeys()
        state.identificationKeys = expectedIdentificationKeys
        // info t0 and root have changed
        const expectedInfo = await TestUtil.getInfoParsed(alice.wallet)
        state.info = expectedInfo
        // oldInfos has the previous info appended to it
        const expectedOldInfos = await TestUtil.getOldInfosParsed(alice.wallet)
        state.oldInfos = expectedOldInfos
        // innerCores will have new entries added (6 new entries per iteration)
        const expectedInnerCores = await TestUtil.getInnerCoresParsed(alice.wallet)
        state.innerCores = expectedInnerCores

        await TestUtil.assertStateEqual(state, currentState)
      }
    }
    alice.client = newClient
    alice.seed = newComputedSeed
    alice.hseed = newHseed
    return { walletInfo: alice, state, newEffectiveTime, balance: alice.balance }
  }

  // === BASIC POSITIVE TESTING SECURITY ====

  // ==== DISPLACE =====
  // Test must allow displace operation using 6x6 otps for different durations
  // Expected result: can authenticate otp from new core after displacement
  it('SE-BASIC-7 DISPLACE: must allow displace operation using 6x6 otps for different durations authenticate otp from new core after displacement', async () => {
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    testTime = Math.floor(testTime / (INTERVAL)) * INTERVAL - 5000
    const multiple = 24
    const duration = INTERVAL * 24 // need to be greater than 16 to trigger innerCore generations
    const effectiveTime = Math.floor(testTime / INTERVAL) * INTERVAL - (duration / 2)
    await testForTime({ multiple, effectiveTime, duration, testTime })
    // assert.equal('events', 'NoEvents', 'lets see the events')
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
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'CO-BASIC-25-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration, buildInnerTrees: true })
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

  // ==== ADDITIONAL POSTIVE TESTING =====

  // ==== NEGATIVE USE CASES (EVENT TESTING) ====

  // Test calling DISPLACE when forward has been set
  // Expected result this will fail and trigger event CoreDisplacementFailed "Wallet deprecated"
  // Logic: if (forwardAddress != address(0))
  it('SE-NEGATIVE-7 DISPLACE: must fail if forward address has been set', async () => {
    // Here we have a special case where we want alice's wallet backlinked to carol
    // create wallets and token contracts used througout the test
    const multiple = 24 // number of 30 second slots wallet is active for
    const duration = INTERVAL * multiple // need to be greater than 16 to trigger innerCore generations
    let testTime = Date.now()
    testTime = Math.floor(testTime / INTERVAL) * INTERVAL + INTERVAL
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let walletEffectiveTime = Math.floor(testTime / INTERVAL / (multiple / 2)) * INTERVAL * (multiple / 2) - (duration / 2) // walletEffectiveTime (when the wallet theoretically was created) is half the duration of the wallet
    let { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'UP-BASIC-8-1', deployer: accounts[0], effectiveTime: walletEffectiveTime, duration, buildInnerTrees: true })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'UP-BASIC-8-2', deployer: accounts[0], effectiveTime: walletEffectiveTime, duration, backlinks: [alice.wallet.address], buildInnerTrees: true })

    // set alice's forwarding address to carol's wallet address
    // testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx: tx0 } = await TestUtil.executeUpgradeTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx0, expectedEvent: 'ForwardAddressUpdated' })

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // Start Displacement Tests
    const newSeed = '0xdeedbeaf1234567890123456789012'
    const tOtpCounter = Math.floor(testTime / INTERVAL)
    const baseCounter = Math.floor(tOtpCounter / 6) * 6
    let newEffectiveTime = (Math.floor(walletEffectiveTime / INTERVAL) + 1) * INTERVAL
    let { core: newCore, innerCores: newInnerCores, identificationKeys: newKeys } = await TestUtil.makeCores({
      seed: newSeed,
      effectiveTime: newEffectiveTime,
      duration: duration,
      buildInnerTrees: true
    })
    const data = ONEWallet.encodeDisplaceDataHex({ core: newCore, innerCores: newInnerCores, identificationKey: newKeys[0] })
    Logger.debug(`tOtpCounter=${tOtpCounter} baseCounter=${baseCounter} c=${1}`)
    const otpb = ONEUtil.genOTP({ seed: alice.seed, counter: baseCounter + 1, n: 6 })
    const otps = []
    for (let i = 0; i < 6; i++) {
      otps.push(otpb.subarray(i * 4, i * 4 + 4))
    }
    const innerEffectiveTime = Math.floor(walletEffectiveTime / INTERVAL) * INTERVAL
    const innerExpiryTime = innerEffectiveTime + Math.floor(duration / INTERVAL) * (INTERVAL)
    assert.isBelow(testTime, innerExpiryTime, 'Current time must be greater than inner expiry time')
    const index = ONEUtil.timeToIndex({ time: testTime, effectiveTime: innerEffectiveTime, interval: INTERVAL * 6 }) // passed to Commit Reveal
    const eotp = await ONEWallet.computeInnerEOTP({ otps }) // passed to Commit Reveal
    const treeIndex = 1
    Logger.debug({
      otps: otps.map(e => {
        const r = new DataView(new Uint8Array(e).buffer)
        return r.getUint32(0, false)
      }),
      eotp: ONEUtil.hexString(eotp),
      index,
      c: 1
    })
    Debugger.printLayers({ layers: alice.client.innerTrees[treeIndex].layers })
    const layers = alice.client.innerTrees[treeIndex].layers // passed to commitReveal
    let { tx } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        layers,
        index,
        eotp,
        operationType: ONEConstants.OperationType.DISPLACE,
        data,
        effectiveTime: walletEffectiveTime,
        duration,
        testTime
      }
    )

    TestUtil.validateEvent({ tx, expectedEvent: 'CoreDisplacementFailed' })
    // assert.equal('events', 'NoEvents', 'lets see the events')
  })

  // Test calling DISPLACE with an older Time Range
  // Expected result this will fail and trigger event CoreDisplacementFailed "Must have newer time range"
  // Logic: (newCore.t0 + newCore.lifespan <= oldCore.t0 + oldCore.lifespan || newCore.t0 <= oldCore.t0)
  it('SE-NEGATIVE-7-1 DISPLACE: must fail if called with an older or the same Time Range', async () => {
    const multiple = 24 // number of 30 second slots wallet is active for
    const duration = INTERVAL * multiple // need to be greater than 16 to trigger innerCore generations
    let testTime = Date.now()
    testTime = Math.floor(testTime / INTERVAL) * INTERVAL + INTERVAL
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let walletEffectiveTime = Math.floor(testTime / INTERVAL / (multiple / 2)) * INTERVAL * (multiple / 2) - (duration / 2) // walletEffectiveTime (when the wallet theoretically was created) is half the duration of the wallet
    let { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'SE-NEGATIVE-7-1-1', deployer: accounts[0], effectiveTime: walletEffectiveTime, duration, buildInnerTrees: true })
    const { core: newCore, innerCores: newInnerCores, identificationKeys: newKeys } = await TestUtil.makeCores({
      seed: alice.seed,
      effectiveTime: walletEffectiveTime,
      duration,
      buildInnerTrees: true
    })
    // Here we do not increase t0 (newCore[3]) which causes CoreDisplacementFailed Must have newer time range
    // newCore[3] += 1
    // newCore[0] = keccak256(c.toString())
    const data = ONEWallet.encodeDisplaceDataHex({ core: newCore, innerCores: newInnerCores, identificationKey: newKeys[0] })
    Logger.debug(`counter: ${1}`)
    const tOtpCounter = Math.floor(testTime / INTERVAL)
    const baseCounter = Math.floor(tOtpCounter / 6) * 6
    Logger.debug(`tOtpCounter=${tOtpCounter} baseCounter=${baseCounter} c=${1}`)
    const otpb = ONEUtil.genOTP({ seed: alice.seed, counter: baseCounter + 1, n: 6 })
    const otps = []
    for (let i = 0; i < 6; i++) {
      otps.push(otpb.subarray(i * 4, i * 4 + 4))
    }
    const innerEffectiveTime = Math.floor(walletEffectiveTime / (INTERVAL * 6)) * (INTERVAL * 6)
    const innerExpiryTime = innerEffectiveTime + Math.floor(duration / (INTERVAL * 6)) * (INTERVAL * 6)
    assert.isBelow(testTime, innerExpiryTime, 'Current time must be greater than inner expiry time')
    const index = ONEUtil.timeToIndex({ time: testTime, effectiveTime: innerEffectiveTime, interval: INTERVAL * 6 }) // passed to Commit Reveal
    const eotp = await ONEWallet.computeInnerEOTP({ otps }) // passed to Commit Reveal
    Logger.debug({
      otps: otps.map(e => {
        const r = new DataView(new Uint8Array(e).buffer)
        return r.getUint32(0, false)
      }),
      eotp: ONEUtil.hexString(eotp),
      index,
      c: 1
    })
    Debugger.printLayers({ layers: alice.client.innerTrees[1].layers })
    const layers = alice.client.innerTrees[1].layers // passed to commitReveal
    let { tx } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        layers,
        index,
        eotp,
        operationType: ONEConstants.OperationType.DISPLACE,
        data,
        testTime
      }
    )

    TestUtil.validateEvent({ tx, expectedEvent: 'CoreDisplacementFailed' })
  })

  // Test calling DISPLACE with the same root
  // Expected result this will fail and trigger event CoreDisplacementFailed "Must have different root"
  // Logic: if (newCore.root == oldCore.root) {
  it('SE-NEGATIVE-7-2 DISPLACE: must fail if called with the same root', async () => {
    const multiple = 24 // number of 30 second slots wallet is active for
    const duration = INTERVAL * multiple // need to be greater than 16 to trigger innerCore generations
    let testTime = Date.now()
    testTime = Math.floor(testTime / INTERVAL) * INTERVAL + INTERVAL
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let walletEffectiveTime = Math.floor(testTime / INTERVAL / (multiple / 2)) * INTERVAL * (multiple / 2) - (duration / 2) // walletEffectiveTime (when the wallet theoretically was created) is half the duration of the wallet
    let { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'SE-NEGATIVE-7-2-1', deployer: accounts[0], effectiveTime: walletEffectiveTime, duration, buildInnerTrees: true })
    let newEffectiveTime = (Math.floor(walletEffectiveTime / INTERVAL) + 1) * INTERVAL
    const { core: newCore, innerCores: newInnerCores, identificationKeys: newKeys } = await TestUtil.makeCores({
      seed: alice.seed,
      effectiveTime: newEffectiveTime,
      duration,
      buildInnerTrees: true
    })
    // Here we do  not change the root (newCore[0]) which causes CoreDisplacementFailed "Must have different root"
    newCore[3] += 1
    // newCore[0] = keccak256(c.toString())
    const data = ONEWallet.encodeDisplaceDataHex({ core: newCore, innerCores: newInnerCores, identificationKey: newKeys[0] })
    Logger.debug(`counter: ${1}`)
    const tOtpCounter = Math.floor(testTime / INTERVAL)
    const baseCounter = Math.floor(tOtpCounter / 6) * 6
    Logger.debug(`tOtpCounter=${tOtpCounter} baseCounter=${baseCounter} c=${1}`)
    const otpb = ONEUtil.genOTP({ seed: alice.seed, counter: baseCounter + 1, n: 6 })
    const otps = []
    for (let i = 0; i < 6; i++) {
      otps.push(otpb.subarray(i * 4, i * 4 + 4))
    }
    const innerEffectiveTime = Math.floor(newEffectiveTime / (INTERVAL * 6)) * (INTERVAL * 6)
    const innerExpiryTime = innerEffectiveTime + Math.floor(duration / (INTERVAL * 6)) * (INTERVAL * 6)
    assert.isBelow(testTime, innerExpiryTime, 'Current time must be greater than inner expiry time')
    const index = ONEUtil.timeToIndex({ time: testTime, effectiveTime: innerEffectiveTime, interval: INTERVAL * 6 }) // passed to Commit Reveal
    const eotp = await ONEWallet.computeInnerEOTP({ otps }) // passed to Commit Reveal
    Logger.debug({
      otps: otps.map(e => {
        const r = new DataView(new Uint8Array(e).buffer)
        return r.getUint32(0, false)
      }),
      eotp: ONEUtil.hexString(eotp),
      index,
      c: 1
    })
    Debugger.printLayers({ layers: alice.client.innerTrees[1].layers })
    const layers = alice.client.innerTrees[1].layers // passed to commitReveal
    let { tx } = await executeSecurityTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        layers,
        index,
        eotp,
        operationType: ONEConstants.OperationType.DISPLACE,
        data,
        testTime
      }
    )

    TestUtil.validateEvent({ tx, expectedEvent: 'CoreDisplacementFailed' })
  })

  // Test calling CHANGE_SPENDING_LIMIT too early
  // Expected result this will fail and trigger event SpendingLimitChangeFailed "Too early"
  // Logic: if (ss.lastLimitAdjustmentTime + ss.spendingInterval > block.timestamp && newLimit > ss.spendingLimit)
  it('SE-NEGATIVE-24 CHANGE_SPENDING_LIMIT: must fail when called too early', async () => {
  })

  // Test calling CHANGE_SPENDING_LIMIT too much
  // Expected result this will fail and trigger event SpendingLimitChangeFailed "Too much""
  // Logic: if (newLimit > (ss.spendingLimit) * 2 + (1 ether))
  it('SE-NEGATIVE-24-1 CHANGE_SPENDING_LIMIT: must fail when called changing too much', async () => {
  })

  // Test calling CHANGE_SPENDING_LIMIT too high
  // Expected result this will fail and trigger event SpendingLimitChangeFailed "Too high"
  // Logic: if (newLimit > ss.highestSpendingLimit)
  it('SE-NEGATIVE-24-2 CHANGE_SPENDING_LIMIT: must fail when called too early', async () => {
  })

  // ==== COMPLEX SCENARIO TESTING ====

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
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'SE-COMPLEX-24-25-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration, buildInnerTrees: true })
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
  it('SE-COMPLEX-7: must allow displace operation using 6x6 otps for different durations', async () => {
    // Begin Tests
    let testTime = Date.now()
    const EFFECTIVE_TIMES = DURATIONS.map(d => Math.floor(testTime / INTERVAL) * INTERVAL - d / 2)
    for (let i = 0; i < MULTIPLES.length; i++) {
      testTime = await TestUtil.bumpTestTime(testTime, 60)
      testTime = Math.floor(testTime / (INTERVAL)) * INTERVAL - 5000
      await testForTime({ multiple: MULTIPLES[i], effectiveTime: EFFECTIVE_TIMES[i], duration: DURATIONS[i], testTime })
    }
  })
  // ===== DISPLACEMENT AUTHENTICATION TESTING ====
  it('SE-COMPLEX-7-0: must authenticate otp from new core after displacement', async () => {
    let testTime = Date.now()
    testTime = Math.floor(testTime / INTERVAL) * INTERVAL + INTERVAL
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const EFFECTIVE_TIMES = DURATIONS.map(d => Math.floor(testTime / INTERVAL) * INTERVAL - d / 2)
    let { walletInfo: alice, state, newEffectiveTime } = await testForTime({
      multiple: MULTIPLES[0],
      effectiveTime: EFFECTIVE_TIMES[0],
      duration: DURATIONS[0],
      seedBase: '0xdeadbeef1234567890123456789012',
      numTrees: 1,
      checkDisplacementSuccess: true
    })
    Logger.debug('newSeed', alice.seed)
    // Now test a transfer using the updated otp info
    testTime = await TestUtil.bumpTestTime(testTime, 180)
    const counter = Math.floor(testTime / INTERVAL)
    const otp = ONEUtil.genOTP({ seed: alice.seed, counter })
    const index = ONEUtil.timeToIndex({ time: testTime, effectiveTime: newEffectiveTime })
    const eotp = await ONEWallet.computeEOTP({ otp, hseed: alice.hseed })
    // alice tranfers ONE CENT to bob
    let { tx, currentState } = await TestUtil.executeCoreTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        index,
        eotp,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: ONE_CENT,
        testTime
      }
    )
    let bobCurrentState = await TestUtil.getState(bob.wallet)

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'PaymentSent' })

    // Check alice's balance bob's is updated after the transfer
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
})
