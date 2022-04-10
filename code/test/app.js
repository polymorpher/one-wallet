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
// executeAppTransaction commits and reveals a wallet transaction
const executeAppTransaction = async ({
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
    // case ONEConstants.OperationType.COMMAND:
    //   paramsHash = ONEWallet.computeGeneralOperationHash
    //   commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
    //   revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
    //   break
    default:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
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

  // === BASIC POSITIVE TESTING APP FUNCTIONS ====

  // ====== SIGN ======
  // Test setting signing a transaction
  // Expected result the wallets will sign a transaction
  it('AP-BASIC-19 SIGN: must be able to sign a transaction', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'AP-BASIC-19-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // Alice uses the SIGN command to sign a transaction, contract logic is as follows
    // Executor.sol execute
    // signatures.authorizeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
    // SignatureManager.sol authorizeHandler
    // authorize(st, bytes32(tokenId), bytes32(amount), uint32(bytes4(bytes20(address(dest)))));
    // function authorize(SignatureTracker storage st, bytes32 hash, bytes32 signature, uint32 expireAt) public returns (bool){
    // Therefore
    // op.tokenId = hash
    // op.amount = signature
    // dest = expireAt
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    const expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    const data = ONEUtil.hexStringToBytes(hexData)

    let { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SIGN,
        tokenId: new BN(messageHash).toString(),
        dest: ONEUtil.hexString(encodedExpiryAt),
        amount: new BN(signature).toString(),
        data,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureAuthorized' })

    // Alice items that have changed -signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    const expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    expectedSignatures[0].hash = ONEUtil.hexString(messageHash)
    expectedSignatures[0].signature = ONEUtil.hexString(signature)
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  // ====== REVOKE ======
  // Test setting of a wallets recovery address
  // Expected result the wallets recovery address
  it('AP-BASIC-20 REVOKE: must be able to revoke a signature', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'AP-BASIC-20-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // Alice uses the SIGN command to sign a transaction, contract logic is as follows
    // Executor.sol execute
    // signatures.authorizeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
    // SignatureManager.sol authorizeHandler
    // authorize(st, bytes32(tokenId), bytes32(amount), uint32(bytes4(bytes20(address(dest)))));
    // function authorize(SignatureTracker storage st, bytes32 hash, bytes32 signature, uint32 expireAt) public returns (bool){
    // Sign Logic
    // op.tokenId = hash
    // op.amount = signature
    // dest = expireAt
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    // const expiryAtDate = Math.floor(((testTime + 30000) / 1000)) // 5 mins after testTime
    // let expiryAtBytes = new BN(expiryAtDate).toArrayLike(Uint8Array, 'be', 4)
    let expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    let data = ONEUtil.hexStringToBytes(hexData)

    let { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SIGN,
        tokenId: new BN(messageHash).toString(),
        dest: ONEUtil.hexString(encodedExpiryAt),
        amount: new BN(signature).toString(),
        data,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureAuthorized' })

    // Alice items that have changed -signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    let expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    expectedSignatures[0].hash = ONEUtil.hexString(messageHash)
    expectedSignatures[0].signature = ONEUtil.hexString(signature)
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Alice uses the REVOKE command to revoke a transaction, contract logic is as follows
    // Executor.sol execute
    // signatures.revokeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
    // SignatureManager.sol revokeHandler
    // function revokeHandler(SignatureTracker storage st, address contractAddress, uint256 tokenId, address payable dest, uint256 amount) public {
    //     function revoke(SignatureTracker storage st, bytes32 hash, bytes32 signature) public returns (bool){
    // Revoke Logic
    // contractAddress (if != address(0) then revoke everything base on time if passed )
    // dest = expireAt (if > 0 then revoke all signatures before this time)
    // op.tokenId = hash
    // op.amount = signature
    let { currentState: currentStateRevoked } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        data,
        testTime
      }
    )
    // No event is emitted from revokeBefore
    // TestUtil.validateEvent({ tx2, expectedEvent: 'SignatureRevoked' })

    // Alice items that have changed -signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    expectedSignatures = []
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentStateRevoked)
  })

  // ====== CALL ======
  // Test calling a transaction
  // Expected a transaction is called
  it('TODO-AP-BASIC-21 CALL: must be able to call a transaction', async () => {
  })

  // ====== BATCH ======
  // Test batching transactions
  // Expected result a batch of transactions will be processed
  it('TODO-UP-BASIC-22 BATCH: must be able to process a batch of transactions', async () => {
  })

  // ====== CREATE ======
  // Test create transactions
  // Expected result a create transaction will be processed
  it('TODO-UP-BASIC-29 CREATE: must be able to process a create transactions', async () => {
  })
})
