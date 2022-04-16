const TestUtil = require('./util')
const config = require('../config')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const ONEWallet = require('../lib/onewallet')
const BN = require('bn.js')
const ONEDebugger = require('../lib/debug')
const assert = require('assert')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
const getEffectiveTime = () => Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const HALF_ETH = unit.toWei('0.5', 'ether')
const Logger = TestUtil.Logger
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
  const eotp = await ONEWallet.computeEOTP({ otp, hseed: walletInfo.hseed })
  let paramsHash
  let commitParams
  let revealParams
  // Process the Operation
  switch (operationType) {
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
  let alice, bob, carol, dora, ernie, state, bobState, carolState, doraState, ernieState, testerc20, testerc721, testerc1155, testerc20v2, testerc721v2, testerc1155v2

  beforeEach(async function () {
    const testData = await TestUtil.init({})
    // const testData = await TestUtil.deployTestData()
    console.log(`testData.alice.wallet.address: ${JSON.stringify(testData.alice.wallet.address)}`)
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
    snapshotId = await TestUtil.snapshot()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE TESTING APP FUNCTIONS ====

  // ====== SIGN ======
  // Test setting signing a transaction
  // Expected result the wallets will sign a transaction
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
  it('AP-BASIC-19 SIGN: must be able to sign a transaction', async () => {
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

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
  // Test revoking all signatures
  // Expected result the signature is revoked (by setting contractAddress to non zero all signatures will be revoked)
  // Alice uses the REVOKE command to revoke a transaction, contract logic is as follows
  // Executor.sol execute
  // signatures.revokeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
  // SignatureManager.sol revokeHandler
  // function revokeHandler(SignatureTracker storage st, address contractAddress, uint256 tokenId, address payable dest, uint256 amount) public {
  //   function revoke(SignatureTracker storage st, bytes32 hash, bytes32 signature) public returns (bool){
  // Revoke Logic
  // contractAddress (if != address(0) then revoke everything base on time if passed )
  // dest = expireAt (if > 0 then revoke all signatures before this time)
  // op.tokenId = hash
  // op.amount = signature
  it('AP-BASIC-20 REVOKE: must be able to revoke a signature', async () => {
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    let messageHash = ONEUtil.keccak('hello world')
    let signature = ONEUtil.keccak('awesome signature')
    let expiryAtDate = Math.floor(((testTime + 30000) / 1000)) // 5 mins after testTime
    let expiryAtBytes = new BN(expiryAtDate).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    let data = ONEUtil.hexStringToBytes(hexData)
    // create a signature so that we can revoke it
    let { tx: tx0, currentState: currentStateSigned } = await executeAppTransaction(
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
    TestUtil.validateEvent({ tx: tx0, expectedEvent: 'SignatureAuthorized' })

    // Alice items that have changed -signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    let expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    expectedSignatures[0].hash = ONEUtil.hexString(messageHash)
    expectedSignatures[0].signature = ONEUtil.hexString(signature)
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentStateSigned)

    // add a second signature
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    messageHash = ONEUtil.keccak('another hello world')
    signature = ONEUtil.keccak('another awesome signature')
    expiryAtDate = Math.floor(((testTime + 30000) / 1000)) // 5 mins after testTime
    expiryAtBytes = new BN(expiryAtDate).toArrayLike(Uint8Array, 'be', 4)
    encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    data = ONEUtil.hexStringToBytes(hexData)
    // create a second signature so that we can revoke it as well
    let { tx: tx1, currentState: currentStateSigned2 } = await executeAppTransaction(
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
    TestUtil.validateEvent({ tx: tx1, expectedEvent: 'SignatureAuthorized' })

    // Alice items that have changed: signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    expectedSignatures[1].hash = ONEUtil.hexString(messageHash)
    expectedSignatures[1].signature = ONEUtil.hexString(signature)
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentStateSigned2)

    // now revoke the signature
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        contractAddress: testerc20.address, // setting the contract address ensures we just remove this signature
        tokenId: new BN(messageHash).toString(),
        dest: ONEUtil.hexString(encodedExpiryAt),
        amount: new BN(signature).toString(),
        data,
        testTime
      }
    )
    // No event is emitted from revokeBefore
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureRevoked' })

    // Alice items that have changed -signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    expectedSignatures = []
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
    // assert.equal('events', 'null', 'lets see the events')
  })

  // ====== CALL ======
  // Test calling a transaction
  // Expected a transaction is called
  // Alice uses the CALL command to call a contract, logic is as follows
  // ONEWallet.sol _execute
  //  if (op.tokenId == 0) {_callContract(op.contractAddress, op.amount, op.data);} else { _multiCall(op.data);}
  // ONEWallet.sol _callContract
  // _callContract(address contractAddress, uint256 amount, bytes memory encodedWithSignature)
  // checks the balance of the contract and the spendingState then calls the contract as follows
  // (bool success, bytes memory ret) = contractAddress.call{value : amount}(encodedWithSignature);
  // Therefore
  // op.tokenId = multicall indicator
  // op.contractAddress = the contract we are calling (should have a balance and be within spending limit)
  // op.data = encodedWithSignature
  it('AP-BASIC-21 CALL: must be able to call a transaction', async () => {
    // Begin Tests
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // create a call to transfer bob 100 erc20 tokens
    const hexData = ONEUtil.encodeCalldata('transfer(address,uint256)', [bob.wallet.address, 100])
    const data = ONEUtil.hexStringToBytes(hexData)

    let { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CALL,
        contractAddress: testerc20.address,
        data,
        testTime
      }
    )
    let bobCurrentState = await TestUtil.getState(bob.wallet)
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'ExternalCallCompleted' })

    // check alice and bobs balance
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20, testerc20],
      tokenAmounts: [[900], [100]]
    })

    // check Alice's current state
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's spending state lastSpendingInterval has been updated
    const newSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    const expectedSpendingState = state.spendingState
    expectedSpendingState.lastSpendingInterval = newSpendingState.lastSpendingInterval
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
    // Check Bob nothing has changed except for balances above
    await TestUtil.assertStateEqual(bobState, bobCurrentState)
  })

  // ====== BATCH ======
  // Test batching transactions
  // Expected result will track an ERC20 and then transfer 100 ERC20 to Bob
  // Following is the structure which we use for ONEUtil.abi.encodeParameters
  //   struct OperationParams {
  //     uint8 Enums.OperationType operationType;
  //     uint8 Enums.TokenType tokenType;
  //     address contractAddress;
  //     uint256 tokenId;
  //     address payable dest;
  //     uint256 amount;
  //     bytes data;
  // }
  it('AP-BASIC-22 BATCH: must be able to process a batch of transactions', async () => {
    // Begin Tests
    let testTime = Date.now()

    // Note here we populate each operation as an object then map it to an array
    // It was felt this was clearer and allows us to leverage default values however it could be done concisely by providing the values in an array as follows
    // let operationParams = [ONEConstants.OperationType.TRACK, ONEConstants.TokenType.ERC20, testerc20.address, 0, alice.wallet.address, 1 , new Uint8Array()]
    let operationParamsArray = []
    // Alice Tracks the ERC20 token
    let operationParamsObject = {
      ...NullOperationParams, // Default all fields to Null values than override
      operationType: ONEConstants.OperationType.TRACK,
      tokenType: ONEConstants.TokenType.ERC20,
      contractAddress: testerc20.address,
      dest: alice.wallet.address,
      amount: 1
    }
    let operationParams = Object.keys(operationParamsObject).map((key) => operationParamsObject[key])
    operationParamsArray.push(operationParams)
    // Alice transfers 100 ERC20 tokens to Bob
    operationParamsObject = {
      ...NullOperationParams, // Default all fields to Null values than override
      operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
      tokenType: ONEConstants.TokenType.ERC20,
      contractAddress: testerc20.address,
      dest: bob.wallet.address,
      amount: 100
    }
    operationParams = Object.keys(operationParamsObject).map((key) => operationParamsObject[key])
    operationParamsArray.push(operationParams)
    const hexData = ONEUtil.abi.encodeParameters(['tuple[](uint8,uint8,address,uint256,address,uint256,bytes)'], [operationParamsArray])
    const data = ONEUtil.hexStringToBytes(hexData)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BATCH,
        data,
        testTime
      }
    )
    let bobCurrentState = await TestUtil.getState(bob.wallet)
    // Validate succesful events emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTracked' })
    TestUtil.validateEvent({ tx, expectedEvent: 'TokenTransferSucceeded' })

    // check alice and bobs balance
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20, testerc20],
      tokenAmounts: [[900], [100]]
    })

    // check Alice's current state
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    const expectedTrackedTokens = state.trackedTokens
    expectedTrackedTokens.push({ tokenType: ONEConstants.TokenType.ERC20, contractAddress: testerc20.address, tokenId: 0 })
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    // const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC20], [testerc20.address], [0]])
    // state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
    // Check Bob nothing has changed except for balances above
    await TestUtil.assertStateEqual(bobState, bobCurrentState)
  })

  // ====== CREATE ======
  // Test create transactions
  // Expected result a create transaction will be processed
  it('TODO-UP-BASIC-29 CREATE: must be able to process a create transactions', async () => {
  })

  // ==== ADDITIONAL POSTIVE TESTING =====

  // ====== REVOKE ======
  // Test revoking a signature by DATE
  // Expected result we create two signatures with different expiration dates then revoke the signature with the earlier expiration date
  // Alice uses the REVOKE command to revoke a transaction, contract logic is as follows
  // Executor.sol execute
  // signatures.revokeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
  // SignatureManager.sol revokeHandler
  // function revokeHandler(SignatureTracker storage st, address contractAddress, uint256 tokenId, address payable dest, uint256 amount) public {
  //   function revoke(SignatureTracker storage st, bytes32 hash, bytes32 signature) public returns (bool){
  // Revoke Logic
  // contractAddress (if != address(0) then revoke everything base on time if passed )
  // dest = expireAt (if > 0 then revoke all signatures before this time)
  // op.tokenId = hash
  // op.amount = signature
  it('TODO-AP-POSITIVE-20 REVOKE-BY-DATE: must be able to revoke a signature', async () => {
  // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    let messageHash = ONEUtil.keccak('hello world')
    let signature = ONEUtil.keccak('awesome signature')
    let expiryAtDate = Math.floor(((testTime + 30000) / 1000)) // 5 mins after testTime
    let expiryAtBytes = new BN(expiryAtDate).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAtSig1 = new Uint8Array(20)
    encodedExpiryAtSig1.set(expiryAtBytes)
    let data = ONEUtil.hexStringToBytes(hexData)
    // create a signature so that we can revoke it
    let { tx: tx0, currentState: currentStateSigned } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SIGN,
        tokenId: new BN(messageHash).toString(),
        dest: ONEUtil.hexString(encodedExpiryAtSig1),
        amount: new BN(signature).toString(),
        data,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx0, expectedEvent: 'SignatureAuthorized' })
    // Not validatiing here just updating the state
    state = currentStateSigned

    // add a second signature
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    messageHash = ONEUtil.keccak('another hello world')
    signature = ONEUtil.keccak('another awesome signature')
    expiryAtDate = Math.floor(((testTime + 30000) / 1000)) // 5 mins after testTime
    expiryAtBytes = new BN(expiryAtDate).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAtSig2 = new Uint8Array(20)
    encodedExpiryAtSig2.set(expiryAtBytes)
    data = ONEUtil.hexStringToBytes(hexData)
    // create a second signature so that we can revoke it as well
    let { tx: tx1, currentState: currentStateSigned2 } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SIGN,
        tokenId: new BN(messageHash).toString(),
        dest: ONEUtil.hexString(encodedExpiryAtSig2),
        amount: new BN(signature).toString(),
        data,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx1, expectedEvent: 'SignatureAuthorized' })
    // Not validatiing here just updating the state
    state = currentStateSigned2

    // now revoke the first signature by using teh eralier Expiry Date (encodedExpiryAtSig1)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        // contractAddress: testerc20.address, // setting the contract address ensures we just remove this signature
        tokenId: new BN(messageHash).toString(),
        dest: ONEUtil.hexString(encodedExpiryAtSig1),
        amount: new BN(signature).toString(),
        data,
        testTime
      }
    )
    // No event is emitted from revokeBefore
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureRevoked' })

    // Alice items that have changed -signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    let expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    expectedSignatures[0].hash = ONEUtil.hexString(messageHash)
    expectedSignatures[0].signature = ONEUtil.hexString(signature)
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
  })

  it('TODO-AP-POSITIVE-20-1 REVOKE-BY-SIGNATURE: must be able to revoke a signature', async () => {
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    let messageHash1 = ONEUtil.keccak('hello world')
    let signature1 = ONEUtil.keccak('awesome signature')
    let expiryAtDate = Math.floor(((testTime + 30000) / 1000)) // 5 mins after testTime
    let expiryAtBytes = new BN(expiryAtDate).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAtSig1 = new Uint8Array(20)
    encodedExpiryAtSig1.set(expiryAtBytes)
    let data = ONEUtil.hexStringToBytes(hexData)
    // create a signature so that we can revoke it
    let { tx: tx0, currentState: currentStateSigned } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SIGN,
        tokenId: new BN(messageHash1).toString(),
        dest: ONEUtil.hexString(encodedExpiryAtSig1),
        amount: new BN(signature1).toString(),
        data,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx0, expectedEvent: 'SignatureAuthorized' })
    // Not validatiing here just updating the state
    state = currentStateSigned

    // add a second signature
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    let messageHash2 = ONEUtil.keccak('another hello world')
    let signature2 = ONEUtil.keccak('another awesome signature')
    expiryAtDate = Math.floor(((testTime + 30000) / 1000)) // 5 mins after testTime
    expiryAtBytes = new BN(expiryAtDate).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAtSig2 = new Uint8Array(20)
    encodedExpiryAtSig2.set(expiryAtBytes)
    data = ONEUtil.hexStringToBytes(hexData)
    // create a second signature so that we can revoke it as well
    let { tx: tx1, currentState: currentStateSigned2 } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SIGN,
        tokenId: new BN(messageHash2).toString(),
        dest: ONEUtil.hexString(encodedExpiryAtSig2),
        amount: new BN(signature2).toString(),
        data,
        testTime
      }
    )
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx: tx1, expectedEvent: 'SignatureAuthorized' })
    // Not validatiing here just updating the state
    state = currentStateSigned2

    // now revoke the first signature by using teh eralier Expiry Date (encodedExpiryAtSig1)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        // contractAddress: testerc20.address, // setting the contract address ensures we just remove this signature
        tokenId: new BN(messageHash2).toString(),
        // dest: ONEUtil.hexString(encodedExpiryAtSig1),
        amount: new BN(signature2).toString(),
        data,
        testTime
      }
    )
    // No event is emitted from revokeBefore
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureRevoked' })

    // Alice items that have changed -signatures
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state, validateCommits: false })
    // check alice signatures have changed by getting the current values and overriding with the expected hash and signature
    // The first signature is the only one that now remains
    let expectedSignatures = await TestUtil.getSignaturesParsed(alice.wallet)
    expectedSignatures[0].hash = ONEUtil.hexString(messageHash1)
    expectedSignatures[0].signature = ONEUtil.hexString(signature1)
    state.signatures = await TestUtil.validateSignaturesMutation({ expectedSignatures, wallet: alice.wallet, validateCommits: false })
    await TestUtil.assertStateEqual(state, currentState)
    // assert.equal('events', 'null', 'lets see the events')
  })

  // ==== NEGATIVE USE CASES (EVENT TESTING) ====

  // Test calling sign twice setting the signature to a different value on the second call.
  // Expected result this will fail and trigger event SignatureMismatch
  // Logic: Look up the existing signature by the hash and check the new signature is the same
  // Signature storage s = st.signatureLocker[hash];
  // if (s.timestamp != 0) {
  //     if (s.signature != signature) {
  //         emit SignatureMismatch(hash, signature, s.signature);
  it('AP-NEGATIVE-19 SIGN: trigger SignatureMismatch when sending a different signature with the same hash', async () => {
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    let signature = ONEUtil.keccak('awesome signature')
    let expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    let data = ONEUtil.hexStringToBytes(hexData)

    let { tx: tx0 } = await executeAppTransaction(
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
    TestUtil.validateEvent({ tx: tx0, expectedEvent: 'SignatureAuthorized' })

    // now set the signature to a different value to trigger the SignatureMismatch
    signature = ONEUtil.keccak('not quite so awesome signature')
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx } = await executeAppTransaction(
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
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureMismatch' })
  })

  // Test calling sign twice.
  // Expected result this will fail and trigger event SignatureAlreadyExist
  // Logic: Look up the existing signature by the hash and check the new signature is the same
  // if (s.timestamp != 0) {
  //   if (s.signature != signature) {
  //       emit SignatureMismatch(hash, signature, s.signature);
  //   } else {
  //       emit SignatureAlreadyExist(hash, signature);
  //   }
  //   return false;
  it('AP-NEGATIVE-19-1 SIGN: trigger SignatureAlreadyExist when sending the same signature twice', async () => {
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    let signature = ONEUtil.keccak('awesome signature')
    let expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    let data = ONEUtil.hexStringToBytes(hexData)

    let { tx: tx0 } = await executeAppTransaction(
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
    TestUtil.validateEvent({ tx: tx0, expectedEvent: 'SignatureAuthorized' })

    // now send the same signature again to trigger SignatureAlreadyExist
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx } = await executeAppTransaction(
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
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureAlreadyExist' })
  })

  // Test calling revoke with the timestamp (dest) set to 0 and no hash(tokenId), encodedExpiryAt(dest), signature(amount)
  // Expected result this will fail and trigger event SignatureNotExist
  // Logic:
  //   Signature storage s = st.signatureLocker[hash];
  //  if (s.timestamp == 0) {
  it('AP-NEGATIVE-20 REVOKE: must be able to revoke a signature', async () => {
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    let expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    let encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    let data = ONEUtil.hexStringToBytes(hexData)
    // create a signature so that we can revoke it
    await executeAppTransaction(
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

    // now call revoke the signature without setting a time (dest) hash (op.tokenId) or a signature (op.amount)
    // this will call revoke and not find the dummy signature and hash thus triggering SignatureNotExist 
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { tx } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        data,
        testTime
      }
    )
    // SignatureNotExist is emitted when the signature cannot be found
    TestUtil.validateEvent({ tx, expectedEvent: 'SignatureNotExist' })
  })

  // ==== COMPLEX SCENARIO TESTING ====
  // ====== CALL MULTI ======
  // Test calling mutliple transactions
  // Expected multiple transactions are called
  // Alice uses the CALL command to call a contract, logic is as follows
  // ONEWallet.sol _execute
  //  if (op.tokenId == 0) {_callContract(op.contractAddress, op.amount, op.data);} else { _multiCall(op.data);}
  // ONEWallet.sol _callContract
  // _callContract(address contractAddress, uint256 amount, bytes memory encodedWithSignature)
  // checks the balance of the contract and the spendingState then calls the contract as follows
  // (bool success, bytes memory ret) = contractAddress.call{value : amount}(encodedWithSignature);
  // Therefore
  // op.tokenId = multicall indicator
  // op.contractAddress = the contract we are calling (should have a balance and be within spending limit)
  // op.data = encodedWithSignature
  it('AP-COMPLEX-21 CALL: must be able to call multiple transactions', async () => {
    // Begin Tests
    let testTime = Date.now()
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Note here we populate each operation as an object then map it to an array
    // It was felt this was clearer and allows us to leverage default values however it could be done concisely by providing the values in an array as follows
    // let operationParams = [ONEConstants.OperationType.TRACK, ONEConstants.TokenType.ERC20, testerc20.address, 0, alice.wallet.address, 1 , new Uint8Array()]
    let destArray = []
    let amountsArray = []
    let encodedParamsArray = []
    let hexData
    let data
    // Alice transfers 100 ERC20 tokens to Bob
    destArray.push(testerc20.address)
    amountsArray.push(0)
    encodedParamsArray.push(ONEUtil.hexStringToBytes(ONEUtil.encodeCalldata('transfer(address,uint256)', [bob.wallet.address, 100])))
    // Alice transfers ERC721 NFT id 3 token to Bob
    destArray.push(testerc721.address)
    amountsArray.push(0)
    encodedParamsArray.push(ONEUtil.hexStringToBytes(ONEUtil.encodeCalldata('safeTransferFrom(address,address,uint256)', [alice.wallet.address, bob.wallet.address, 3])))
    // Alice transfers ERC1155 ID 3 30 tokens to bob
    // Alice transfers 100 ERC20 tokens to Bob
    destArray.push(testerc1155.address)
    amountsArray.push(0)
    encodedParamsArray.push(ONEUtil.hexStringToBytes(ONEUtil.encodeCalldata('safeTransferFrom(address,address,uint256,uint256,bytes)', [alice.wallet.address, bob.wallet.address, 3, 30, ONEConstants.NullOperationParams.data ])))
    hexData = ONEUtil.abi.encodeParameters(['address[]', 'uint256[]', 'bytes[]'], [destArray, amountsArray, encodedParamsArray])
    data = ONEUtil.hexStringToBytes(hexData)

    let { tx, currentState } = await executeAppTransaction(
      {
        ...NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CALL,
        // contractAddress: testerc20.address,
        tokenId: 1,
        data,
        testTime
      }
    )
    let bobCurrentState = await TestUtil.getState(bob.wallet)
    // Validate succesful event emitted
    TestUtil.validateEvent({ tx, expectedEvent: 'ExternalCallCompleted' })

    // check alice and bobs balance
    await TestUtil.validateTokenBalances({
      receivers: [alice.wallet.address, alice.wallet.address, alice.wallet.address, bob.wallet.address, bob.wallet.address, bob.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155, ONEConstants.TokenType.ERC20, ONEConstants.TokenType.ERC721, ONEConstants.TokenType.ERC1155],
      tokenContracts: [testerc20, testerc721, testerc1155, testerc20, testerc721, testerc1155],
      tokenIds: [[], [2], [2], [], [3], [3]],
      tokenAmounts: [[900], [1], [20], [100], [1], [30]]
    })

    // check Alice's current state
    state = await TestUtil.validateOpsStateMutation({ wallet: alice.wallet, state })
    // Alice's spending state lastSpendingInterval has been updated
    const newSpendingState = await TestUtil.getSpendingStateParsed(alice.wallet)
    const expectedSpendingState = state.spendingState
    expectedSpendingState.lastSpendingInterval = newSpendingState.lastSpendingInterval
    state.spendingState = await TestUtil.validateSpendingStateMutation({ expectedSpendingState, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
    // Check Bob tracked tokens have changes as well as balances above
    // tracked tokens
    let expectedTrackedTokens = [
      { tokenType: ONEConstants.TokenType.ERC721, contractAddress: testerc721.address, tokenId: 3 },
      { tokenType: ONEConstants.TokenType.ERC1155, contractAddress: testerc1155.address, tokenId: 3 }
    ]
    bobState.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: bob.wallet })
    await TestUtil.assertStateEqual(bobState, bobCurrentState)
  })
})
