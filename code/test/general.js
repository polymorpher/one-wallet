const TestUtil = require('./util')
const CheckUtil = require('./checkUtil')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const BN = require('bn.js')
const ONE = require('../lib/onewallet')
const ONEWallet = require('../lib/onewallet')
const ONEDebugger = require('../lib/debug')
const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)

const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 2 * 60 * 24 * 1 // 1 day wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const DUMMY_HEX = ONEUtil.hexString('5') // Dummy Hex string for 5 i.e. 0x05
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

// assetTransfer commits and reveals a wallet transaction
const transactionExecute = async ({ wallet, operationType, tokenType, contractAddress, tokenId, dest, amount, data, address, randomSeed, backlinkAddresses, testTime }) => {
  Debugger.printLayers({ layers: wallet.layers })
  if (testTime === undefined) { testTime = Date.now() }
  // // calculate counter from testTime
  const counter = Math.floor(testTime / INTERVAL)
  const otp = ONEUtil.genOTP({ seed: wallet.seed, counter })
  // // calculate wallets effectiveTime (creation time) from t0
  const info = await wallet.wallet.getInfo()
  const t0 = new BN(info[3]).toNumber()
  const walletEffectiveTime = t0 * INTERVAL
  const index = ONEUtil.timeToIndex({ effectiveTime: walletEffectiveTime, time: testTime })
  const eotp = await ONE.computeEOTP({ otp, hseed: wallet.hseed })

  // Format commit and revealParams based on tokenType
  let commitParams
  let revealParams
  let paramsHash
  console.log(`operationType: ${operationType}`)
  switch (operationType) {
    case ONEConstants.OperationType.TRACK:
    case ONEConstants.OperationType.UNTRACK:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, dest }
      revealParams = { operationType, tokenType, contractAddress, dest }
      break
    case ONEConstants.OperationType.OVERRIDE_TRACK:
    case ONEConstants.OperationType.RECOVER_SELECTED_TOKENS:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, data }
      revealParams = { operationType, data }
      break
    case ONEConstants.OperationType.BACKLINK_ADD:
    case ONEConstants.OperationType.BACKLINK_DELETE:
    case ONEConstants.OperationType.BACKLINK_OVERRIDE:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, backlinkAddresses, data }
      revealParams = { operationType, backlinkAddresses, data }
      break
    case ONEConstants.OperationType.COMMAND:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount, data }
      break
    case ONEConstants.OperationType.SET_RECOVERY_ADDRESS:
      paramsHash = ONEWallet.computeSetRecoveryAddressHash
      commitParams = { operationType, address }
      revealParams = { operationType, address }
      break
    case ONEConstants.OperationType.FORWARD:
      paramsHash = ONEWallet.computeForwardHash
      commitParams = { operationType, address }
      revealParams = { operationType, address }
      break
    case ONEConstants.OperationType.RECOVER:
      paramsHash = ONEWallet.computeRecoveryHash
      commitParams = { operationType, randomSeed }
      revealParams = { operationType, randomSeed }
      break
    case ONEConstants.OperationType.TRANSFER_TOKEN:
      paramsHash = ONEWallet.computeGeneralOperationHash
      switch (tokenType) {
        case ONEConstants.TokenType.ERC20:
          commitParams = { operationType, tokenType, contractAddress, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, dest, amount }
          break
        case ONEConstants.TokenType.ERC721:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest }
          break
        case ONEConstants.TokenType.ERC1155:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          break
        default:
          console.log(`TODO: add in Token error handling for TRANSFER_TOKEN`)
          return
      }
      break
    case ONEConstants.OperationType.TRANSFER:
      paramsHash = ONEWallet.computeTransferHash
      commitParams = { operationType, dest, amount }
      revealParams = { operationType, dest, amount }
      break
    default:
      console.log(`TODO: add in error handling`)
      return
  }
  await TestUtil.commitReveal({
    Debugger,
    layers: wallet.layers,
    index,
    eotp,
    paramsHash,
    commitParams,
    revealParams,
    wallet: wallet.wallet
  })
}

contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Test all ONEWallet operations
  it('General: must be able to run all ONEWallet operations', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await CheckUtil.makeWallet('TG-GEN-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await CheckUtil.makeWallet('TG-GEN-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await CheckUtil.makeWallet('TG-GEN-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let dora = await CheckUtil.makeWallet('TG-GEN-4', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    let bobOldState = await CheckUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    const { testerc20 } = await CheckUtil.makeTokens(accounts[0])
    const { testerc20: testerc20v2 } = await CheckUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    // ====== TRACK ======
    // Test tacking of an ERC20 token
    // Expected result the token is now tracked
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: alice.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    // nonce
    let nonce = await alice.wallet.getNonce()
    assert.notEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), aliceOldState.nonce + 1, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()
    // lastOperationTime
    let lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    // console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END TRACK ====

    // ====== UNTRACK ======
    // Test untracking of an ERC20 token
    // Expected result the token is no longer tracked
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.UNTRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: alice.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    // console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0].length, 0, 'alice.wallet.trackedTokens not tracking tokens of type ERC20')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END UNTRACK ==== 

    // ====== TRANSFER_TOKEN ======
    // Test transferring a token
    // Expected result the token is now tracked and alices balance has decreased and bobs increased
    const aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    const bobInitialBalance = await web3.eth.getBalance(bob.wallet.address)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: bob.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // check alice and bobs balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    bobBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    bobWalletBalanceERC20 = await bob.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, bobBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful and wallet balance updated')
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END TRANSFER_TOKEN ====
/*
    // ====== OVERRIDE_TRACK ======
    // Test overriding all of Alices Token Tracking information
    // Expected result: Alice will now track testerc20v2 instead of testerc20
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    let newTrackedTokens = await alice.wallet.getTrackedTokens()
    newTrackedTokens[1] = [testerc20v2.address]
    let dataHex = ONEUtil.abi.encodeParameters(['uint8[]', 'address[]', 'uint8[]'], [newTrackedTokens[0], newTrackedTokens[1], newTrackedTokens[2]])
    let data = ONEUtil.hexStringToBytes(dataHex)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        // tokenType: ONEConstants.TokenType.ERC20,
        // contractAddress: testerc20.address,
        // tokenId: 1,
        // dest: bob.wallet.address,
        // amount: 1,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END OVERRIDE_TRACK ====
*/
    // ========= TRANSFER =========
    // Test transferring of Native Currency from alice to bob
    // Expected result: Alices balance will decrease bobs will increase, alice spendingState is updated
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2),
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Check Balances for Alice and Bob
    const aliceBalance = await web3.eth.getBalance(alice.wallet.address)
    const bobBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(parseInt(aliceInitialBalance) - parseInt(ONE_CENT / 2), aliceBalance, 'Alice Wallet has correct balance')
    assert.equal(parseInt(bobInitialBalance) + parseInt(ONE_CENT / 2), bobBalance, 'Bob Wallet has correct balance')
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ======= END TRANSFER =======
/*
    // ==== SET_RECOVERY_ADDRESS =====
    // Test setting of alices recovery address
    // Expected result: alices lastResortAddress will change to bobs last Resort address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        address: carol.wallet.address,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ===END SET_RECOVERY_ADDRESS ===
*/
/*
    // ==== RECOVER =====
    // Test recover all funds and tokens from alices wallet
    // Expected result: will be transferred tos her last resort address (currently bob's last resort address)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // create randomSeed
    let randomSeed = new Uint8Array(new BigUint64Array([0n, BigInt(testTime)]).buffer)
    // recover Alices wallet
    //
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.RECOVER,
        randomSeed,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ===END RECOVER ===
*/
    // ==== DISPLACE =====
    // Test must allow displace operation using 6x6 otps for different durations
    // Expected result: can authenticate otp from new core after displacement
    // Note: this is currently tested in innerCores.js
    // === END DISPLACE ===
/*
    // ==== FORWARD =====
    // Test Can forward alices wallet to Carols wallet
    // Expected result: Funds will now be available in Carols Wallet
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // forward Alices wallet to Carol
    //
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        address: carol.wallet.address,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END FORWARD ===
  */
/*
    // ==== RECOVER_SELECTED_TOKENS =====
    // Test : Recovery of Selected Tokens
    // Expected result: Alice will recover her tokens to her last resort address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and recover them
    let recoverTrackedTokens = await alice.wallet.getTrackedTokens()
    let dataHex = ONEUtil.abi.encodeParameters(['uint8[]', 'address[]', 'uint8[]'], [recoverTrackedTokens[0], recoverTrackedTokens[1], recoverTrackedTokens[2]])
    let data = ONEUtil.hexStringToBytes(dataHex)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        // tokenType: ONEConstants.TokenType.ERC20,
        // contractAddress: testerc20.address,
        // tokenId: 1,
        // dest: bob.wallet.address,
        // amount: 1,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END RECOVER_SELECTED_TOKENS ===
*/
    // ==== BUY_DOMAIN =====
    // Test Buy a harmony domain and link it to the wallet address 
    // Expected result: Domain is linked to wallet
    // Note: Will not be implemented as part of phase1 testing

    // === END BUY_DOMAIN ===

    // ==== BACKLINK_ADD =====
    // Test add a backlink from Alices wallet to Carols
    // Expected result: Alices wallet will be backlinked to Carols
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let backlinkAddresses = [carol.wallet]
    let dataHex = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(dataHex)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, backlinkedAddresses
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.deepEqual(backlinks[0].toString(), carol.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal carol.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END BACKLINK_ADD ===
/*
    // ==== COMMAND =====
    // Test executing a transfer of some ERC20 tokens to a backlinked wallet
    // Expected result: command will transfer tokens from Alice's wallet to the backlinked Carol's wallet
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Call
    backlinkAddresses = [carol.wallet]
    dataHex = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(dataHex)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.COMMAND,
        backlinkAddresses,
        data,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: carol.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice and carols's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // check alice and carols balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    let carolBalanceERC20 = await testerc20.balanceOf(carol.wallet.address)
    let carolWalletBalanceERC20 = await carol.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(800, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(800, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, carolBalanceERC20, 'Transfer of 100 ERC20 tokens to carol.wallet succesful')
    assert.equal(100, carolWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to carol.wallet succesful and wallet balance updated')
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    // assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    // assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    // assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    // aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END COMMAND ===
*/
    // ==== BACKLINK_DELETE =====
    // Test remove a backlink from Alices wallet to Carols
    // Expected result: Alices wallet will not be backlinked to Carols
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    backlinkAddresses = [carol.wallet]
    dataHex = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(dataHex)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_DELETE,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, backlinkedAddresses
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // backlinkedAddresses
    backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.equal(backlinks.length, 0, 'alice.wallet.backlinkedAddresses should be empty')
    aliceOldState.backlinks = backlinks
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END BACKLINK_DELETE ===

    // ==== BACKLINK_OVERRIDE =====
    // Test override a backlink from Alices wallet to Carols with Alices Wallet to Doras
    // Expected result: Alices wallet will be backlinked to Doras

    // First Link Alice to Carol
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    backlinkAddresses = [carol.wallet]
    dataHex = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(dataHex)
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Now overwride link to Carol with link to Dora
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    backlinkAddresses = [dora.wallet]
    dataHex = ONEUtil.abi.encodeParameters(['address[]'], [[dora.wallet.address]])
    data = ONEUtil.hexStringToBytes(dataHex)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_OVERRIDE,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, backlinkedAddresses
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // backlinkedAddresses
    backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.deepEqual(backlinks[0].toString(), dora.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal dora.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END BACKLINK_OVERRIDE ===

    // ==== RENEW_DOMAIN =====
    // Test renew a domain already associated with wallet address 
    // Expected result: domain is renewed
    // Note: Will not be implemented as part of phase1 testing

    // === END RENEW_DOMAIN ===

    // ==== TRANSFER_DOMAIN =====
    // Test transfer a domain from alices wallet to carols wallet
    // Expected result: carol's wallet is now associated with the domain
    // Note: Will not be implemented as part of phase1 testing

    // === END TRANSFER_DOMAIN ===

    // ==== RECLAIM_REVERSE_DOMAIN =====
    // Test reclam a domain previously associated with a wallet
    // Expected result: domain is reassoicated with the wallet
    // Note: Will not be implemented as part of phase1 testing

    // === END RECLAIM_REVERSE_DOMAIN ===

    // ==== RECLAIM_DOMAIN_FROM_BACKLINK =====
    // Test reclaim a domain associated with a backlinked wallet 
    // Expected result: carol's wallet has a backlink to alice which owns the domain,
    // carol reclaims the domain and it is now associated with her wallet.
    // Note: Will not be implemented as part of phase1 testing

    // === END RECLAIM_DOMAIN_FROM_BACKLINK ===

    // ==== SIGN =====
    // Test 
    // Expected result: 

    // === END SIGN ===

    // ==== REVOKE =====
    // Test 
    // Expected result: 

    // === END REVOKE ===

    // ==== CALL =====
    // Test 
    // Expected result: 

    // === END CALL ===

    // ==== BATCH =====
    // Test 
    // Expected result: 

    // === END BATCH ===

    // ==== NOOP =====
    // This operation is obsolete.

    // === END NOOP ===

    // ==== CHANGE_SPENDING_LIMIT =====
    // Test 
    // Expected result: 

    // === END CHANGE_SPENDING_LIMIT ===

    // ==== JUMP_SPENDING_LIMIT =====
    // Test 
    // Expected result: 

    // === END JUMP_SPENDING_LIMIT ===
  })
})
