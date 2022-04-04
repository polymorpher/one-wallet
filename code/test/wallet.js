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
const DUMMY_HEX = '0x'
const ONE_ETH = unit.toWei('1', 'ether')
const ONE_CENT = unit.toWei('0.01', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const duration = INTERVAL * 12 // 6 minute wallet duration
const SLOT_SIZE = 1 // 1 transaction per interval
const effectiveTime = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - duration / 2

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
const executeWalletTransaction = async ({
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
    // Format commit and revealParams for FORWARD Tranasction
    case ONEConstants.OperationType.FORWARD:
    case ONEConstants.OperationType.SET_RECOVERY_ADDRESS:
      paramsHash = ONEWallet.computeForwardHash
      commitParams = { address: dest }
      revealParams = { operationType, dest }
      break
    case ONEConstants.OperationType.COMMAND:
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
    layers: walletInfo.layers,
    index,
    eotp,
    paramsHash,
    commitParams,
    revealParams,
    wallet: walletInfo.wallet
  })
  let currentState
  if (getCurrentState) { currentState = await TestUtil.getONEWalletState(walletInfo.wallet) }
  return { tx, authParams, revealParams: returnedRevealParams, currentState }
}

// ==== Validation Helpers ====
const updateOldfowardAddress = async ({
  expectedForwardAddress,
  wallet
}) => {
  // check Alices Forward address
  let forwardAddress = await wallet.getForwardAddress()
  Logger.debug(`forwardAddress: ${forwardAddress}`)
  assert.strictEqual(expectedForwardAddress, forwardAddress, 'forward address should have been updated')
  return forwardAddress
}

contract('ONEWallet', (accounts) => {
  Logger.debug(`Testing with ${accounts.length} accounts`)
  Logger.debug(accounts)
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    console.log(`Taken snapshot id=${snapshotId}`)
    await TestUtil.init()
  })

  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE TESTING WALLET ====

  // ====== SET_RECOVERY_ADDRESS ======
  // Test setting of alices recovery address
  // Expected result: alices lastResortAddress will change to bobs last Resort address
  // Notes: Cannot set this to zero address, the same address or the treasury address
  // Fails to update if you have create alice wallet with `setLastResortAddress: true` as an address already set.
  it('WA.BASIC.5 SET_RECOVERY_ADDRESS: must be able to set recovery address', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'WA.BASIC.5.1', deployer: accounts[0], effectiveTime, duration, setLastResortAddress: false })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'WA.BASIC.5.2', deployer: accounts[0], effectiveTime, duration })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let aliceInfoInitial = await TestUtil.getInfoParsed(alice.wallet)
    assert.strictEqual(aliceInfoInitial.recoveryAddress, ONEConstants.EmptyAddress, `Alice should initally have last address set to zero address`)

    // alice sets her recovery address to bobs
    let { tx, currentState: aliceCurrentState } = await executeWalletTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        dest: carol.wallet.address,
        testTime
      }
    )

    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'RecoveryAddressUpdated' })

    // Alice Items that have changed - nonce, lastOperationTime, recoveryAddress, commits
    aliceOldState = await TestUtil.updateOldTxnInfo({ wallet: alice.wallet, oldState: aliceOldState })
    // recoveryAddress
    let aliceInfo = await TestUtil.getInfoParsed(alice.wallet)
    assert.notDeepStrictEqual(aliceInfo, aliceOldState.info, 'alice wallet.getInfo recoveryAddress should have been changed')
    assert.strictEqual(aliceInfo.recoveryAddress, carol.wallet.address, 'alice wallet.getInfo recoveryAddress should equal carol.wallet.address')
    aliceOldState.info.recoveryAddress = aliceInfo.recoveryAddress
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== RECOVER ======
  // Test setting of recovering assets to the recovery address
  // Expected result the assets will be transferred to the wallets recovery address
  // Logic: additional authentication required (see _recover in ONEWallet.sol)
  /// To initiate recovery, client should submit leaf_{-1} as eotp, where leaf_{-1} is the last leaf in OTP Merkle Tree. Note that leaf_0 = hasher(hseed . nonce . OTP . randomness) where hasher is either sha256 or argon2, depending on client's security parameters. The definition of leaf_{-1} ensures attackers cannot use widespread miners to brute-force for seed or hseed, even if keccak256(leaf_{i}) for any i is known. It has been considered that leaf_0 should be used instead of leaf_{-1}, because leaf_0 is extremely unlikely to be used for any wallet operation. It is only used if the user performs any operation within the first 60 seconds of seed generation (when QR code is displayed). Regardless of which leaf is used to trigger recovery, this mechanism ensures hseed remains secret at the client. Even when the leaf becomes public (on blockchain), it is no longer useful because the wallet would already be deprecated (all assets transferred out). It can be used to repeatedly trigger recovery on this deprecated wallet, but that would cause no harm.
  it('WA.BASIC.6 RECOVER: must be able to recover assets', async () => {
  })

  // ====== FORWARD ======
  // Test forwarding to another wallet
  // Expected result the wallet will be forwarded to
  it('WA.BASIC.8 FORWARD: must be able to set forward to another wallet', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'WA.BASIC.8.1', deployer: accounts[0], effectiveTime, duration })
    let { walletInfo: carol, walletOldState: carolOldState } = await TestUtil.makeWallet({ salt: 'WA.BASIC.8.2', deployer: accounts[0], effectiveTime, duration, backlinks: [alice.wallet.address] })

    // alice and carol both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: HALF_ETH })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState: aliceCurrentState } = await executeWalletTransaction(
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
    aliceOldState = await TestUtil.updateOldTxnInfo({ wallet: alice.wallet, oldState: aliceOldState, validateNonce: false })
    // Alice's forward address should now be carol's address
    aliceOldState.forwardAddress = await updateOldfowardAddress({ expectedForwardAddress: carol.wallet.address, wallet: alice.wallet })
    // Alice's spending state has been updated spentAmount = HALF_ETH and lastSpendingInterval has been updated
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = HALF_ETH
    aliceOldState.spendingState = await TestUtil.updateOldSpendingState({ expectedSpendingState, wallet: alice.wallet })
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // check carol's wallet hasn't changed (just her balances above)
    const carolCurrentState = await TestUtil.getONEWalletState(carol.wallet)
    await TestUtil.checkONEWalletStateChange(carolOldState, carolCurrentState)
  })

  // ====== RECOVER_SELECTED_TOKENS ======
  // Test recovering selected tokens
  // Expected result the tokens will be recovered
  it('WA.BASIC.9 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
  })

  // ====== BACKLINK_ADD ======
  // Test add a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will be backlinked to Carols
  it('WA.BASIC.12 BACKLINK_ADD: must be able to add a backlink', async () => {
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'WA.BASIC.12.1', deployer: accounts[0], effectiveTime, duration })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'WA.BASIC.12.1', deployer: accounts[0], effectiveTime, duration })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { tx, currentState: aliceCurrentState } = await executeWalletTransaction(
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
    aliceOldState = await TestUtil.updateOldTxnInfo({ wallet: alice.wallet, oldState: aliceOldState })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepStrictEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.strictEqual(backlinks[0].toString(), carol.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal carol.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== BACKLINK_DELETE ======
  // Test remove a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will not be backlinked to Carols
  it('WA.BASIC.13 BACKLINK_DELETE: must be able to delete a backlink', async () => {
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'WA.BASIC.13.1', deployer: accounts[0], effectiveTime, duration })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'WA.BASIC.13.2', deployer: accounts[0], effectiveTime, duration })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { currentState: aliceStateLinked } = await executeWalletTransaction(
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
    let { tx, currentState: aliceCurrentState } = await executeWalletTransaction(
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
    aliceOldState = await TestUtil.updateOldTxnInfo({ wallet: alice.wallet, oldState: aliceOldState })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepStrictEqual(backlinks, aliceStateLinked.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.strictEqual(backlinks.length, 0, 'alice.wallet.backlinkedAddresses should be empty')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== BACKLINK_OVERRIDE ======
  // Test override a backlink from Alices wallet to Carols with Alices Wallet to Doras
  // Expected result: Alices wallet will be backlinked to Doras
  it('WA.BASIC.14 BACKLINK_OVERRIDE: must be able to override a backlink', async () => {
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'WA.BASIC.14.1', deployer: accounts[0], effectiveTime, duration })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'WA.BASIC.14.2', deployer: accounts[0], effectiveTime, duration })
    let { walletInfo: dora } = await TestUtil.makeWallet({ salt: 'WA.BASIC.14.3', deployer: accounts[0], effectiveTime, duration })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let { currentState: aliceLinkedToCarolState } = await executeWalletTransaction(
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
    let { tx, currentState: aliceCurrentState } = await executeWalletTransaction(
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
    aliceOldState = await TestUtil.updateOldTxnInfo({ wallet: alice.wallet, oldState: aliceOldState })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepStrictEqual(backlinks, aliceLinkedToCarolState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.strictEqual(backlinks[0].toString(), dora.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal dora.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== SIGN ======
  // Test setting signing a transaction
  // Expected result the wallets will sign a transaction
  it('WA.BASIC.19 SIGN: must be able to sign a transaction', async () => {
  })

  // ====== REVOKE ======
  // Test setting of a wallets recovery address
  // Expected result the wallets recovery address
  it('WA.BASIC.20 REVOKE: must be able to revoke a signature', async () => {
  })

  // === Negative Use Cases (Event Testing) ===

  // === Scenario (Complex) Testing ===

  // ====== FORWARD + COMMAND ======
  // Test signing a transaction with a backlinked wallet
  // Expected result the backlinked wallet will sign a transaction for the linked wallet
  it('WA.COMPLEX.8.0 FORWARD.COMMAND: must be able to sign a transaction for a backlinked wallet', async () => {
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'WA.COMPLEX.8.0.1', deployer: accounts[0], effectiveTime, duration })
    let { walletInfo: carol, walletOldState: carolOldState } = await TestUtil.makeWallet({ salt: 'WA.COMPLEX.8.0.2', deployer: accounts[0], effectiveTime, duration, backlinks: [alice.wallet.address] })

    // alice and carol both have an initial balance of half an ETH
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    await TestUtil.validateBalance({ address: carol.wallet.address, amount: HALF_ETH })

    // Begin Tests
    let testTime = Date.now()

    // set alice's forwarding address to carol's wallet address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState: aliceCurrentState } = await executeWalletTransaction(
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
    aliceOldState = await TestUtil.updateOldTxnInfo({ wallet: alice.wallet, oldState: aliceOldState, validateNonce: false })
    // Alice's forward address should now be carol's address
    aliceOldState.forwardAddress = await updateOldfowardAddress({ expectedForwardAddress: carol.wallet.address, wallet: alice.wallet })
    // Alice's spending state has been updated spentAmount = HALF_ETH and lastSpendingInterval has been updated
    let expectedSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    expectedSpendingState.spentAmount = HALF_ETH
    aliceOldState.spendingState = await TestUtil.updateOldSpendingState({ expectedSpendingState, wallet: alice.wallet })
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // check carol's wallet hasn't changed (just her balances above)
    let carolCurrentState = await TestUtil.getONEWalletState(carol.wallet)
    await TestUtil.checkONEWalletStateChange(carolOldState, carolCurrentState)

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // Carols uses the CALL command to sign a transaction
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    const expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    Logger.debug(messageHash.length, signature.length)
    const data = ONEUtil.hexStringToBytes(hexData)

    let { tx: tx2, currentState: carolCurrentStateSigned } = await executeWalletTransaction(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    Logger.debug(tx2)

    // Alice items that have changed -signatures
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    const expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    aliceOldState.signatures = expectedSignatures
    aliceOldState.signatures[0].hash = ONEUtil.hexString(messageHash)
    aliceOldState.signatures[0].signature = ONEUtil.hexString(signature)
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // Carol Items that have changed - lastOperationTime, commits, trackedTokens
    carolOldState = await TestUtil.updateOldTxnInfo({ wallet: carol.wallet, oldState: carolOldState, validateNonce: false })
    // check carol's wallet hasn't changed (just her balances above)
    await TestUtil.checkONEWalletStateChange(carolOldState, carolCurrentStateSigned)
  })
// Combination testing of multiple functions
})
