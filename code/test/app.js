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
  it('AP-BASIC-21 CALL: must be able to call a transaction', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'AP-BASIC-21-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: bob, state: bobState } = await TestUtil.makeWallet({ salt: 'AP-BASIC-21-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [[1000]]
    })

    testTime = await TestUtil.bumpTestTime(testTime, 60)

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
  it('AP-BASIC-22 BATCH: must be able to process a batch of transactions', async () => {
  //   struct OperationParams {
  //     uint8 Enums.OperationType operationType;
  //     uint8 Enums.TokenType tokenType;
  //     address contractAddress;
  //     uint256 tokenId;
  //     address payable dest;
  //     uint256 amount;
  //     bytes data;
  // }

    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'AP-BASIC-22-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let { walletInfo: bob, state: bobState } = await TestUtil.makeWallet({ salt: 'AP-BASIC-22-2', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    await TestUtil.fundTokens({
      funder: accounts[0],
      receivers: [alice.wallet.address],
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [[1000]]
    })

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
    const expectedTrackedTokens = TestUtil.parseTrackedTokens([[ONEConstants.TokenType.ERC20], [testerc20.address], [0]])
    state.trackedTokens = await TestUtil.validateTrackedTokensMutation({ expectedTrackedTokens, wallet: alice.wallet })
    await TestUtil.assertStateEqual(state, currentState)
    // Check Bob nothing has changed except for balances above
    await TestUtil.assertStateEqual(bobState, bobCurrentState)
  })

  // ====== CREATE ======
  // Test create transactions
  // Expected result a create transaction will be processed
  it('TODO-UP-BASIC-29 CREATE: must be able to process a create transactions', async () => {
  })
})
