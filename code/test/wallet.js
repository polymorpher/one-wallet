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
const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')
const TestERC1155 = artifacts.require('TestERC1155')

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
      paramsHash = ONEWallet.computeForwardHash
      commitParams = { address: dest }
      revealParams = { operationType, dest }
      break
    case ONEConstants.OperationType.COMMAND:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
    default:
      console.log(`Invalid Operation passed`)
      assert.equal('A Valid Operation', operationType, 'Error invalid operationType passed')
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

contract('ONEWallet', (accounts) => {
  Logger.debug(`Testing with ${accounts.length} accounts`)
  Logger.debug(accounts)
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    console.log(`Taken snapshot id=${snapshotId}`)
  })

  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE TESTING WALLET ====

  // ====== SET_RECOVERY_ADDRESS ======
  // Test setting of a wallets recovery address
  // Expected result the wallets recovery address
  it('WA.BASIC.5 SET_RECOVERY_ADDRESS: must be able to set recovery address', async () => {
  })

  // ====== RECOVER ======
  // Test setting of recovering assets to the recovery address
  // Expected result the assets will be transferred to the wallets recovery address
  it('WA.BASIC.6 RECOVER: must be able to recover assets', async () => {
  })

  // ====== FORWARD ======
  // Test forwarding to another wallet
  // Expected result the wallet will be forwarded to
  it('WA.BASIC.8 FORWARD: must be able to set forward to another wallet', async () => {
  })

  // ====== RECOVER_SELECTED_TOKENS ======
  // Test recovering selected tokens
  // Expected result the tokens will be recovered
  it('WA.BASIC.9 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
  })

  // ====== BACKLINK_ADD ======
  // Test adding a backlink
  // Expected result the wallet will have a backlink added
  it('WA.BASIC.12 BACKLINK_ADD: must be able to add a backlink', async () => {
  })

  // ====== BACKLINK_DELETE ======
  // Test deleting a backlink
  // Expected result the backlink will be deleted
  it('WA.BASIC.13 BACKLINK_DELETE: must be able to delete a backlink', async () => {
  })

  // ====== BACKLINK_OVERRIDE ======
  // Test overriding a backlink
  // Expected result the backlink will be overwritten
  it('WA.BASIC.14 BACKLINK_OVERRIDE: must be able to override a backlink', async () => {
  })

  // ====== SIGN ======
  // Test setting signing a transaction
  // Expected result the wallets will sign a transaction
  it('WA.BASIC.19 SIGN: must be able to sign a transaction', async () => {
    const purse = web3.eth.accounts.create()

    const commonCreationArgs = {
      effectiveTime,
      duration,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    }
    const { wallet: w1, seed: s1, hseed: hs1, client: { layers: l1 } } = await TestUtil.createWallet({
      salt: new BN(ONEUtil.keccak('Wallet_Command_w1').slice(24)),
      ...commonCreationArgs
    })
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: w1.address,
      value: ONE_CENT
    })
    assert.equal(await web3.eth.getBalance(w1.address), ONE_CENT, 'w1 should receive 1 cent')
    assert.equal(await web3.eth.getBalance(purse.address), '0', 'purse should be empty')

    const { wallet: w2, seed: s2, hseed: hs2, client: { layers: l2 } } = await TestUtil.createWallet({
      salt: new BN(ONEUtil.keccak('Wallet_Command_w2').slice(24)),
      ...commonCreationArgs,
      backlinks: [w1.address]
    })
    const { eotp: e1, index: i1 } = await TestUtil.getEOTP({ seed: s1, hseed: hs1, effectiveTime })
    const { tx: tx1 } = await TestUtil.commitReveal({
      Debugger,
      layers: l1,
      index: i1,
      eotp: e1,
      paramsHash: ONEWallet.computeForwardHash,
      commitParams: { address: w2.address },
      revealParams: { dest: w2.address, operationType: ONEConstants.OperationType.FORWARD },
      wallet: w1
    })
    Logger.debug(tx1)

    const forwardAddress = await w1.getForwardAddress()
    Logger.debug(forwardAddress)
    assert.equal(w2.address, forwardAddress, 'forward address should equal to second wallet')

    const { eotp: e2, index: i2 } = await TestUtil.getEOTP({ seed: s2, hseed: hs2, effectiveTime })
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [w1.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    const expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    const data = ONEUtil.hexStringToBytes(hexData)
    const execParams = {
      operationType: ONEConstants.OperationType.COMMAND,
      tokenType: ONEConstants.TokenType.NONE,
      contractAddress: ONEConstants.EmptyAddress,
      tokenId: new BN(messageHash).toString(),
      dest: ONEUtil.hexString(encodedExpiryAt),
      amount: new BN(signature).toString(),
      data,
    }
    // Logger.debug('execParams', execParams)
    // Logger.debug('hexData', hexData)
    assert.equal(await web3.eth.getBalance(w2.address), ONE_CENT, 'w2 should receive 1 cent forwarded from w1')
    const { tx: tx2 } = await TestUtil.commitReveal({
      Debugger,
      layers: l2,
      index: i2,
      eotp: e2,
      paramsHash: ONEWallet.computeGeneralOperationHash,
      commitParams: { ...execParams },
      revealParams: { ...execParams },
      wallet: w2
    })
    // Logger.debug(tx2)
    // Logger.debug(messageHash.length, signature.length)
    // const sigs = await w1.listSignatures(0, 999)
    // Logger.debug(sigs)
    const v = await w1.isValidSignature(ONEUtil.hexString(messageHash), ONEUtil.hexString(signature))
    // Logger.debug(v)
    assert.equal(v, '0x1626ba7e', `signature ${ONEUtil.hexString(signature)} should be valid`)
    const invalidSignature = ONEUtil.hexString(ONEUtil.keccak(signature))
    const v1 = await w1.isValidSignature(ONEUtil.hexString(messageHash), invalidSignature)
    assert.equal(v1, '0xffffffff', `signature ${invalidSignature} should be invalid`)
  })

  // ====== REVOKE ======
  // Test setting of a wallets recovery address
  // Expected result the wallets recovery address
  it('WA.BASIC.20 REVOKE: must be able to revoke a signature', async () => {
  })

  // === Negative Use Cases (Event Testing) ===

  // === Scenario (Complex) Testing ===

  // ====== SIGN ======
  // TO BE REMOVED
  // Test signing a transaction with a backlinked wallet
  // Expected result the backlinked wallet will sign a transaction for the linked wallet
  it('WA.COMPLEX.19.X SIGN.BACKLINK: must be able to sign a transaction for a backlinked wallet', async () => {
    const purse = web3.eth.accounts.create()

    const commonCreationArgs = {
      effectiveTime,
      duration,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    }
    const { wallet: w1, seed: s1, hseed: hs1, client: { layers: l1 } } = await TestUtil.createWallet({
      salt: new BN(ONEUtil.keccak('Wallet_Command_w1').slice(24)),
      ...commonCreationArgs
    })
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: w1.address,
      value: ONE_CENT
    })
    assert.equal(await web3.eth.getBalance(w1.address), ONE_CENT, 'w1 should receive 1 cent')
    assert.equal(await web3.eth.getBalance(purse.address), '0', 'purse should be empty')

    const { wallet: w2, seed: s2, hseed: hs2, client: { layers: l2 } } = await TestUtil.createWallet({
      salt: new BN(ONEUtil.keccak('Wallet_Command_w2').slice(24)),
      ...commonCreationArgs,
      backlinks: [w1.address]
    })
    const { eotp: e1, index: i1 } = await TestUtil.getEOTP({ seed: s1, hseed: hs1, effectiveTime })
    const { tx: tx1 } = await TestUtil.commitReveal({
      Debugger,
      layers: l1,
      index: i1,
      eotp: e1,
      paramsHash: ONEWallet.computeForwardHash,
      commitParams: { address: w2.address },
      revealParams: { dest: w2.address, operationType: ONEConstants.OperationType.FORWARD },
      wallet: w1
    })
    Logger.debug(tx1)

    const forwardAddress = await w1.getForwardAddress()
    Logger.debug(forwardAddress)
    assert.equal(w2.address, forwardAddress, 'forward address should equal to second wallet')

    const { eotp: e2, index: i2 } = await TestUtil.getEOTP({ seed: s2, hseed: hs2, effectiveTime })
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [w1.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    const expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    const data = ONEUtil.hexStringToBytes(hexData)
    const execParams = {
      operationType: ONEConstants.OperationType.COMMAND,
      tokenType: ONEConstants.TokenType.NONE,
      contractAddress: ONEConstants.EmptyAddress,
      tokenId: new BN(messageHash).toString(),
      dest: ONEUtil.hexString(encodedExpiryAt),
      amount: new BN(signature).toString(),
      data,
    }
    // Logger.debug('execParams', execParams)
    // Logger.debug('hexData', hexData)
    assert.equal(await web3.eth.getBalance(w2.address), ONE_CENT, 'w2 should receive 1 cent forwarded from w1')
    const { tx: tx2 } = await TestUtil.commitReveal({
      Debugger,
      layers: l2,
      index: i2,
      eotp: e2,
      paramsHash: ONEWallet.computeGeneralOperationHash,
      commitParams: { ...execParams },
      revealParams: { ...execParams },
      wallet: w2
    })
    // Logger.debug(tx2)
    // Logger.debug(messageHash.length, signature.length)
    // const sigs = await w1.listSignatures(0, 999)
    // Logger.debug(sigs)
    const v = await w1.isValidSignature(ONEUtil.hexString(messageHash), ONEUtil.hexString(signature))
    // Logger.debug(v)
    assert.equal(v, '0x1626ba7e', `signature ${ONEUtil.hexString(signature)} should be valid`)
    const invalidSignature = ONEUtil.hexString(ONEUtil.keccak(signature))
    const v1 = await w1.isValidSignature(ONEUtil.hexString(messageHash), invalidSignature)
    assert.equal(v1, '0xffffffff', `signature ${invalidSignature} should be invalid`)
  })

  // Test signing a transaction with a backlinked wallet
  // Expected result the backlinked wallet will sign a transaction for the linked wallet
  it('WA.COMPLEX.19.0 SIGN.BACKLINK: must be able to sign a transaction for a backlinked wallet', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'WA.COMPLEX.19.0.1', deployer: accounts[0], effectiveTime, duration })
    let { walletInfo: carol, walletOldState: carolOldState } = await TestUtil.makeWallet({ salt: 'WA.COMPLEX.19.0.2', deployer: accounts[0], effectiveTime, duration, backlinks: [alice.wallet.address] })

    // Alice's lastResortAddress is a purse created automatically for testing and ensure that it's empty
    Logger.debug(`alice.lastResortAddress: ${alice.lastResortAddress}`)
    assert.strictEqual(await web3.eth.getBalance(alice.lastResortAddress), '0', 'purse should be empty')
    let forwardAddress = await alice.wallet.getForwardAddress()
    Logger.debug(`forwardAddress after carol wallet create: ${forwardAddress}`)
    assert.strictEqual(forwardAddress, ONEConstants.EmptyAddress, 'forward address should initially be the zero address')
    assert.equal(await web3.eth.getBalance(carol.wallet.address), HALF_ETH, 'Carol initially has 0.5 ETH')

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

    // check Alices Forward address
    forwardAddress = await alice.wallet.getForwardAddress()
    Logger.debug(`forwardAddress after forward: ${forwardAddress}`)
    assert.strictEqual(carol.wallet.address, forwardAddress, 'forward address should be equal to carols wallet')
    assert.equal(await web3.eth.getBalance(carol.wallet.address), ONE_ETH, 'w2 should receive 1 cent forwarded from w1')

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // Carols uses the CALL command to sign a transaction
    // const { eotp: e2, index: i2 } = await TestUtil.getEOTP({ seed: s2, hseed: hs2, effectiveTime })
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [alice.wallet.address, ONEConstants.OperationType.SIGN, new Uint8Array()])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    const expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    Logger.debug(messageHash.length, signature.length)
    const data = ONEUtil.hexStringToBytes(hexData)

    let { tx: tx2, currentState: carolCurrentState } = await executeWalletTransaction(
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
    Logger.debug(tx2)

    const sigs = await alice.wallet.listSignatures(0, 999)
    Logger.debug(sigs)
    const v = await alice.wallet.isValidSignature(ONEUtil.hexString(messageHash), ONEUtil.hexString(signature))
    Logger.debug(v)
    assert.strictEqual(v, '0x1626ba7e', `signature ${ONEUtil.hexString(signature)} should be valid`)
    const invalidSignature = ONEUtil.hexString(ONEUtil.keccak(signature))
    const v1 = await alice.wallet.isValidSignature(ONEUtil.hexString(messageHash), invalidSignature)
    assert.strictEqual(v1, '0xffffffff', `signature ${invalidSignature} should be invalid`)
  })
// Combination testing of multiple functions
})
