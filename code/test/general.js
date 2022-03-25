const TestUtil = require('./util')
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
const HALF_DIME = unit.toWei('0.05', 'ether')
const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const ONE_ETH = unit.toWei('1', 'ether')
const TWO_ETH = unit.toWei('2', 'ether')
const THREE_ETH = unit.toWei('3', 'ether')
const FOUR_ETH = unit.toWei('4', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 2 * 60 * 24 * 1 // 1 day wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const DUMMY_HEX = ONEUtil.hexString('5') // Dummy Hex string for 5 i.e. 0x05
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

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

  // ====== TRACK ======
  // Test tacking of an ERC20 token
  // Expected result the token is now tracked
  it('OPERATION 0 TRACK: must be able to track tokens', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP0-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
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
    // Update alice current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC20 token
  // Expected result the token is no longer tracked
  it('OPERATION 1 UNTRACK: must be able to untrack tokens', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP1-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    // Need to track a token before untracking
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
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
    // Update alice current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceOldState = aliceCurrentState

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
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
    assert.equal(trackedTokens[0].length, 0, 'alice.wallet.trackedTokens not tracking tokens of type ERC20')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('OPERATION 2 TRANSFER_TOKEN: must be able to transfer assets', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP2-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await TestUtil.makeWallet('TG-OP2-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // check alice and bobs balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    bobBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    bobWalletBalanceERC20 = await bob.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, bobBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful and wallet balance updated')
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
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alices Token Tracking information
  // Expected result: Alice will now track testerc20v2 instead of testerc20
  it('OPERATION 3 OVERRIDE_TRACK: must be able to override tracked tokens', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP3-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    const { testerc20: testerc20v2 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    // First track testerc20 
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
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
    // Update alice current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceOldState = aliceCurrentState

    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    let newTrackedTokens = await alice.wallet.getTrackedTokens()
    newTrackedTokens[1] = [testerc20v2.address]
    let hexData = ONEUtil.abi.encodeParameters(['uint8[]', 'address[]', 'uint8[]'], [newTrackedTokens[0], newTrackedTokens[1], newTrackedTokens[2]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ========= TRANSFER =========
  // Test transferring of Native Currency from alice to bob
  // Expected result: Alices balance will decrease bobs will increase, alice spendingState is updated
  it('OPERATION 4 TRANSFER : must be able to transfer native assets', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP4-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await TestUtil.makeWallet('TG-OP4-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    let aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    let bobInitialBalance = await web3.eth.getBalance(bob.wallet.address)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2),
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Check Balances for Alice and Bob
    let aliceBalance = await web3.eth.getBalance(alice.wallet.address)
    let bobBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(parseInt(aliceInitialBalance) - parseInt(ONE_CENT / 2), aliceBalance, 'Alice Wallet has correct balance')
    assert.equal(parseInt(bobInitialBalance) + parseInt(ONE_CENT / 2), bobBalance, 'Bob Wallet has correct balance')
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
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== SET_RECOVERY_ADDRESS =====
  // Test setting of alices recovery address
  // Expected result: alices lastResortAddress will change to bobs last Resort address
  it('OPERATION 5 SET_RECOVERY_ADDRESS: must be able to set recovery address', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP5-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await TestUtil.makeWallet('TG-OP5-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        address: carol.wallet.address,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== RECOVER =====
  // Test recover all funds and tokens from alices wallet
  // Expected result: will be transferred tos her last resort address (currently bob's last resort address)
  it('OPERATION 6 RECOVER: must be able to recover assets', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP6-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // create randomSeed
    let randomSeed = new Uint8Array(new BigUint64Array([0n, BigInt(testTime)]).buffer)
    // recover Alices wallet
    //
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.RECOVER,
        randomSeed,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== DISPLACE =====
  // Test must allow displace operation using 6x6 otps for different durations
  // Expected result: can authenticate otp from new core after displacement
  // Note: this is currently tested in innerCores.js
  it('OPERATION 7 DISPLACE : must allow displace operation using 6x6 otps for different durations authenticate otp from new core after displacement', async () => {
    assert.equal(0, 1, 'Please test displace using innerCores.js')
  })

  // ==== FORWARD =====
  // Test Can forward alices wallet to Carols wallet
  // Expected result: Funds will now be available in Carols Wallet
  it('OPERATION 8 FORWARD : must be able to forward to a different wallet', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP81', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await TestUtil.makeWallet('TG-OP8-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    const { testerc20: testerc20v2 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // forward Alices wallet to Carol
    //
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        address: carol.wallet.address,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== RECOVER_SELECTED_TOKENS =====
  // Test : Recovery of Selected Tokens
  // Expected result: Alice will recover her tokens to her last resort address
  it('OPERATION 9 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP9-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await TestUtil.makeWallet('TG-OP9-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and recover them
    let recoverTrackedTokens = await alice.wallet.getTrackedTokens()
    let hexData = ONEUtil.abi.encodeParameters(['uint8[]', 'address[]', 'uint8[]'], [recoverTrackedTokens[0], recoverTrackedTokens[1], recoverTrackedTokens[2]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BUT_DOMAIN ====
  // Test Buy a harmony domain and link it to the wallet address 
  // Expected result: Domain is linked to wallet
  // Note: Will not be implemented as part of phase 2 testing
  it('OPERATION 10 BUY_DOMAIN : must be able to buy a domain', async () => {
    assert.equal(0, 1, 'OPERATION 10 BUY_DOMAIN will be implemented as part of phase 2 testing ')
  })

  // ==== COMMAND =====
  // Test executing a transfer of some ERC20 tokens to a backlinked wallet
  // Expected result: command will transfer tokens from Alice's wallet to the backlinked Carol's wallet
  it('OPERATION 11 COMMAND: must be able to execute a command', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP11-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await TestUtil.makeWallet('TG-OP11-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Call
    let backlinkAddresses = [carol.wallet]
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // check alice and carols balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    let carolBalanceERC20 = await testerc20.balanceOf(carol.wallet.address)
    let carolWalletBalanceERC20 = await carol.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(800, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(800, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, carolBalanceERC20, 'Transfer of 100 ERC20 tokens to carol.wallet succesful')
    assert.equal(100, carolWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to carol.wallet succesful and wallet balance updated')
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
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    // assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    // assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    // assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    // aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BACKLINK_ADD =====
  // Test add a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will be backlinked to Carols
  it('OPERATION 12 BACKLINK_ADD: must be able to backlink to another ONEWallet', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP12-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await TestUtil.makeWallet('TG-OP12-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let backlinkAddresses = [carol.wallet]
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
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
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.deepEqual(backlinks[0].toString(), carol.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal carol.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BACKLINK_DELETE =====
  // Test remove a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will not be backlinked to Carols
  it('OPERATION 13 BACKLINK_DELETE: must be able to delete backlink to another wallet', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP13-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await TestUtil.makeWallet('TG-OP13-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    // Add a backlink from Alice to Carol
    let backlinkAddresses = [carol.wallet]
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceOldState = aliceCurrentState

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Remove the backlink from Alice to Carol
    backlinkAddresses = [carol.wallet]
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_DELETE,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, backlinkedAddresses
    // lastOperationTime
    let lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.equal(backlinks.length, 0, 'alice.wallet.backlinkedAddresses should be empty')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BACKLINK_OVERRIDE =====
  // Test override a backlink from Alices wallet to Carols with Alices Wallet to Doras
  // Expected result: Alices wallet will be backlinked to Doras
  it('OPERATION 14 BACKLINK_OVERRIDE: must be able to override a backlink to andother wallet', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP14-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await TestUtil.makeWallet('TG-OP14-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let dora = await TestUtil.makeWallet('TG-OP14-4', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    // First Link Alice to Carol
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let backlinkAddresses = [carol.wallet]
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    await TestUtil.transactionExecute(
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
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[dora.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_OVERRIDE,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
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
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.deepEqual(backlinks[0].toString(), dora.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal dora.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== RENEW_DOMAIN =====
  // Test renew a domain already associated with wallet address 
  // Expected result: domain is renewed
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 15 RENEW_DOMAIN: must be able to renew a domain', async () => {
    assert.equal(0, 1, 'OPERATION 15 RENEW_DOMAIN will be implemented as part of phase 2 testing ')
  })

  // ==== TRANSFER_DOMAIN =====
  // Test transfer a domain from alices wallet to carols wallet
  // Expected result: carol's wallet is now associated with the domain
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 16 TRANSFER_DOMAIN: must be able to transfer a domain', async () => {
    assert.equal(0, 1, 'OPERATION 16 TRANSFER_DOMAIN: will be implemented as part of phase 2 testing ')
  })

  // ==== RECLAIM_REVERSE_DOMAIN =====
  // Test reclam a domain previously associated with a wallet
  // Expected result: domain is reassoicated with the wallet
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 17 RECLAIM_REVERSE_DOMAIN: must be able to reclaim a domain from a wallet', async () => {
    assert.equal(0, 1, 'OPERATION 17 RECLAIM_REVERSE_DOMAIN will be implemented as part of phase 2 testing ')
  })

  // ==== RECLAIM_DOMAIN_FROM_BACKLINK =====
  // Test reclaim a domain associated with a backlinked wallet 
  // Expected result: carol's wallet has a backlink to alice which owns the domain,
  // carol reclaims the domain and it is now associated with her wallet.
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 18 RECLAIM_DOMAIN_FROM_BACKLINK: must be able to reclaim a domain from a backlinked wallet', async () => {
    assert.equal(0, 1, 'OPERATION 18 RECLAIM_DOMAIN_FROM_BACKLINK will be implemented as part of phase 2 testing ')
  })

  // ==== SIGN =====
  // Test Sign a transaction to authorize spending of a token by another wallet
  // Expected result: Alice will sign a transaction to enable ernie to spend 100 tokens
  it('OPERATION 19 SIGN: must be able to sign a transaction', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP19-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await TestUtil.makeWallet('TG-OP19-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let ernie = await TestUtil.makeWallet('TG-OP19-5', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.SIGN,
        // tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: ernie.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // check alice and bobs balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    bobBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    bobWalletBalanceERC20 = await bob.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, bobBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful and wallet balance updated')
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
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    // assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    // assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    // assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    // aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== REVOKE =====
  // Test Revoke authorization for spending of a token by another wallet
  // Expected result: Alice will revoke the ability to spend by Ernie
  it('OPERATION 20 REVOKE: must be able to revoke authorizations', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP20-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await TestUtil.makeWallet('TG-OP20-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let ernie = await TestUtil.makeWallet('TG-OP20-5', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        // tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: ernie.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // check alice and bobs balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    bobBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    bobWalletBalanceERC20 = await bob.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, bobBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful and wallet balance updated')
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
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    // assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    // assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    // assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    // aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== CALL =====
  // Test Create a signed transaction for a contract and then CALL this contract to execute it
  // Expected result: Alice will sign a transfer for 100 ERC20 tokens to Bob the CALL will execute and alice and bobs ERC20 balances will be updated
  it('OPERATION 21 CALL: must be able to call signed transactions', async () => {
    assert.equal(0, 1, 'OPERATION 21 CALL is still to be implemented and is dependant on SIGN working ')
  })

  // ==== BATCH =====
  // Test batch a number of transactions and ensure they have all been processed
  // Expected result: Alice will do two transfers to Bob and validate balances have been updated
  it('OPERATION 22 BATCH : must be able to batch operations', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP22-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await TestUtil.makeWallet('TG-OP22-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    let aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    let bobInitialBalance = await web3.eth.getBalance(bob.wallet.address)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const calls = []
    // set up transfer and destination for the batch
    // alice tranfers ONE CENT to bob
    let call = [
      ONEConstants.OperationType.TRANSFER,
      bob.wallet.address,
      ONE_CENT
    ]
    calls.push(call)
    // alice tranfers ONE HALF_DIME to bob
    call[2] = HALF_DIME
    calls.push(call)
    // alice tranfers ONE DIME to bob
    call[2] = ONE_DIME
    calls.push(call)
    console.log(`calls: ${JSON.stringify(calls)}`)
    // Sample from onewallet.js 
    // return Util.abi.encodeParameters(['tuple(bytes32,uint8,uint8,uint32,uint32,uint8)', 'tuple[](bytes32,uint8,uint8,uint32,uint32,uint8)', 'bytes'], [core, innerCores, identificationKey])
    let hexData = ONEUtil.abi.encodeParameters(['tuple[](uint8,address,uint256)'], [calls])
    // hexData = ONEUtil.encodeMultiCall(calls)
    // move the batch information into data
    let data = ONEUtil.hexStringToBytes(hexData)

    // // Sample approache using encodeMultiCall
    // let call = {
    //   operationType: ONEConstants.OperationType.TRANSFER,
    //   dest: bob.wallet.address,
    //   amount: ONE_CENT
    // }
    // calls.push(call)
    // // alice tranfers ONE HALF_DIME to bob
    // calls.amount = HALF_DIME
    // calls.push(call)
    // // alice tranfers ONE DIME to bob
    // calls.amount = ONE_DIME
    // calls.push(call)
    // // For examples refer to encodeMulticalls and Reclaim.jsx for standard calls and Unwrap.jsx for safeTransferFrom
    // hexData = ONEUtil.encodeMultiCall(calls)
    // // move the batch information into data
    // data = ONEUtil.hexStringToBytes(hexData)

    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BATCH,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Check Balances for Alice and Bob
    let aliceBalance = await web3.eth.getBalance(alice.wallet.address)
    let bobBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(parseInt(aliceInitialBalance) - parseInt(ONE_CENT + HALF_DIME + ONE_DIME), aliceBalance, 'Alice Wallet has correct balance')
    assert.equal(parseInt(bobInitialBalance) + parseInt(ONE_CENT + HALF_DIME + ONE_DIME), bobBalance, 'Bob Wallet has correct balance')
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
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT + HALF_DIME + ONE_DIME).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== NOOP =====
  it('OPERATION 23 NOOP : this operation is obsolete', async () => {
  })

  // ==== CHANGE_SPENDING_LIMIT =====
  // Test : Increase the spending limit
  // Expected result: Will Increase Alices Spending Limit from ONE_ETH TO THREE_ETH
  it('OPERATION 24 CHANGE_SPENDING_LIMIT: must be able to change spending limit', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP24-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: THREE_ETH,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.notEqual(spendingState.highestSpendingLimit, aliceOldState.spendingState.highestSpendingLimit, 'alice wallet.highestSpendingLimit should have been changed')
    assert.equal(spendingState.highestSpendingLimit, THREE_ETH.toString(), 'alice wallet.highestSpendingLimit should be THREE_ETH')
    aliceOldState.spendingState.highestSpendingLimit = spendingState.highestSpendingLimit
    assert.notEqual(spendingState.lastLimitAdjustmentTime, aliceOldState.spendingState.lastLimitAdjustmentTime, 'alice wallet.lastLimitAdjustmentTime should have been changed')
    aliceOldState.spendingState.lastLimitAdjustmentTime = spendingState.lastLimitAdjustmentTime
    assert.notEqual(spendingState.spendingLimit, aliceOldState.spendingState.spendingLimit, 'alice wallet.spendingLimit should have been changed')
    assert.equal(spendingState.spendingLimit, THREE_ETH.toString(), 'alice wallet.spendingLimit should be THREE_ETH')
    aliceOldState.spendingState.spendingLimit = spendingState.spendingLimit
    // assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    assert.equal(spendingState.lastSpendingInterval, aliceOldState.spendingState.lastSpendingInterval, 'alice wallet.lastSpendingInterval should not have been changed')
    assert.equal(spendingState.spendingInterval, aliceOldState.spendingState.spendingInterval, 'alice wallet.spendingInterval should not have been changed')
    assert.equal(spendingState.spentAmount, aliceOldState.spendingState.spentAmount, 'alice wallet.spentAmount should not have been changed')
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== JUMP_SPENDING_LIMIT =====
  // Test jump alices spending limit jump cannot be higher than highestSpendingLimit and does not update lastLimitAdjustmentTime
  // Expected result: will jump alices spending limit from THREE_ETH to TWO_ETH
  it('OPERATION 25 JUMP_SPENDING_LIMIT: must be able to jump spending limit', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-OP25-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.JUMP_SPENDING_LIMIT,
        amount: FOUR_ETH,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    // assert.notEqual(spendingState.highestSpendingLimit, aliceOldState.spendingState.highestSpendingLimit, 'alice wallet.highestSpendingLimit should have been changed')
    assert.equal(spendingState.highestSpendingLimit, THREE_ETH.toString(), 'alice wallet.highestSpendingLimit should be THREE_ETH')
    // aliceOldState.spendingState.highestSpendingLimit = spendingState.highestSpendingLimit
    assert.notEqual(spendingState.lastLimitAdjustmentTime, aliceOldState.spendingState.lastLimitAdjustmentTime, 'alice wallet.lastLimitAdjustmentTime should have been changed')
    aliceOldState.spendingState.lastLimitAdjustmentTime = spendingState.lastLimitAdjustmentTime
    assert.notEqual(spendingState.spendingLimit, aliceOldState.spendingState.spendingLimit, 'alice wallet.spendingLimit should have been changed')
    assert.equal(spendingState.spendingLimit, TWO_ETH.toString(), 'alice wallet.spendingLimit should be TWO_ETH')
    aliceOldState.spendingState.spendingLimit = spendingState.spendingLimit
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    assert.equal(spendingState.lastSpendingInterval, aliceOldState.spendingState.lastSpendingInterval, 'alice wallet.lastSpendingInterval should not have been changed')
    assert.equal(spendingState.spendingInterval, aliceOldState.spendingState.spendingInterval, 'alice wallet.spendingInterval should not have been changed')
    assert.equal(spendingState.spentAmount, aliceOldState.spendingState.spentAmount, 'alice wallet.spentAmount should not have been changed')
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // Test all ONEWallet operations
  it('General: must be able to run all ONEWallet operations', async () => {
    // create wallets and token contracts used througout the tests
    let alice = await TestUtil.makeWallet('TG-GEN-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await TestUtil.makeWallet('TG-GEN-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let carol = await TestUtil.makeWallet('TG-GEN-3', accounts[0], EFFECTIVE_TIME, DURATION)
    let dora = await TestUtil.makeWallet('TG-GEN-4', accounts[0], EFFECTIVE_TIME, DURATION)
    let ernie = await TestUtil.makeWallet('TG-GEN-5', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    let bobOldState = await TestUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await TestUtil.getONEWalletState(bob.wallet)
    const { testerc20 } = await TestUtil.makeTokens(accounts[0])
    const { testerc20: testerc20v2 } = await TestUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END TRACK ====

    // ====== UNTRACK ======
    // Test untracking of an ERC20 token
    // Expected result the token is no longer tracked
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END UNTRACK ====

    // ====== TRANSFER_TOKEN ======
    // Test transferring a token
    // Expected result the token is now tracked and alices balance has decreased and bobs increased
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END TRANSFER_TOKEN ====
/*
    // ====== OVERRIDE_TRACK ======
    // Test overriding all of Alices Token Tracking information
    // Expected result: Alice will now track testerc20v2 instead of testerc20
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    let newTrackedTokens = await alice.wallet.getTrackedTokens()
    newTrackedTokens[1] = [testerc20v2.address]
    let hexData = ONEUtil.abi.encodeParameters(['uint8[]', 'address[]', 'uint8[]'], [newTrackedTokens[0], newTrackedTokens[1], newTrackedTokens[2]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END OVERRIDE_TRACK ====
*/
    // ========= TRANSFER =========
    // Test transferring of Native Currency from alice to bob
    // Expected result: Alices balance will decrease bobs will increase, alice spendingState is updated
    let aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    let bobInitialBalance = await web3.eth.getBalance(bob.wallet.address)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2),
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Check Balances for Alice and Bob
    let aliceBalance = await web3.eth.getBalance(alice.wallet.address)
    let bobBalance = await web3.eth.getBalance(bob.wallet.address)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ======= END TRANSFER =======
/*
    // ==== SET_RECOVERY_ADDRESS =====
    // Test setting of alices recovery address
    // Expected result: alices lastResortAddress will change to bobs last Resort address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        address: carol.wallet.address,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
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
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.RECOVER,
        randomSeed,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
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
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        address: carol.wallet.address,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END FORWARD ===
  */
/*
    // ==== RECOVER_SELECTED_TOKENS =====
    // Test : Recovery of Selected Tokens
    // Expected result: Alice will recover her tokens to her last resort address
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and recover them
    let recoverTrackedTokens = await alice.wallet.getTrackedTokens()
    let hexData = ONEUtil.abi.encodeParameters(['uint8[]', 'address[]', 'uint8[]'], [recoverTrackedTokens[0], recoverTrackedTokens[1], recoverTrackedTokens[2]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
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
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END BACKLINK_ADD ===
/*
    // ==== COMMAND =====
    // Test executing a transfer of some ERC20 tokens to a backlinked wallet
    // Expected result: command will transfer tokens from Alice's wallet to the backlinked Carol's wallet
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Call
    backlinkAddresses = [carol.wallet]
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
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
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END COMMAND ===
*/
    // ==== BACKLINK_DELETE =====
    // Test remove a backlink from Alices wallet to Carols
    // Expected result: Alices wallet will not be backlinked to Carols
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    backlinkAddresses = [carol.wallet]
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_DELETE,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END BACKLINK_DELETE ===

    // ==== BACKLINK_OVERRIDE =====
    // Test override a backlink from Alices wallet to Carols with Alices Wallet to Doras
    // Expected result: Alices wallet will be backlinked to Doras

    // First Link Alice to Carol
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    backlinkAddresses = [carol.wallet]
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    await TestUtil.transactionExecute(
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
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[dora.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BACKLINK_OVERRIDE,
        backlinkAddresses,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
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
/*
    // ==== SIGN =====
    // Test Sign a transaction to authorize spending of a token by another wallet
    // Expected result: Alice will sign a transaction to enable ernie to spend 100 tokens
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.SIGN,
        // tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: ernie.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    // assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    // assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    // assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    // aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END SIGN ===
*/
    // ==== CALL =====
    // Test Create a signed transaction for a contract and then CALL this contract to execute it
    // Expected result: Alice will sign a transfer for 100 ERC20 tokens to Bob the CALL will execute and alice and bobs ERC20 balances will be updated

    // === END CALL ===
/*
    // ==== REVOKE =====
    // Test Revoke authorization for spending of a token by another wallet
    // Expected result: Alice will revoke the ability to spend by Ernie
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        // tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: ernie.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
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
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    // assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    // assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    // assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    // aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END REVOKE ===
*/
    // ==== CALL =====
    // Test Create a signed transaction for a contract and then CALL this contract to execute it
    // Expected result: Alice will sign a transfer for 100 ERC20 tokens to Bob the CALL will execute and alice and bobs ERC20 balances will be updated

    // === END CALL ===
/*
    // ==== BATCH =====
    // Test batch a number of transactions and ensure they have all been processed
    // Expected result: Alice will do two transfers to Bob and validate balances have been updated
    aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    bobInitialBalance = await web3.eth.getBalance(bob.wallet.address)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const calls = []
    // set up transfer and destination for the batch
    // alice tranfers ONE CENT to bob
    let call = [
      ONEConstants.OperationType.TRANSFER,
      bob.wallet.address,
      ONE_CENT
    ]
    calls.push(call)
    // alice tranfers ONE HALF_DIME to bob
    call[2] = HALF_DIME
    calls.push(call)
    // alice tranfers ONE DIME to bob
    call[2] = ONE_DIME
    calls.push(call)
    console.log(`calls: ${JSON.stringify(calls)}`)
    // Sample from onewallet.js 
    // return Util.abi.encodeParameters(['tuple(bytes32,uint8,uint8,uint32,uint32,uint8)', 'tuple[](bytes32,uint8,uint8,uint32,uint32,uint8)', 'bytes'], [core, innerCores, identificationKey])
    hexData = ONEUtil.abi.encodeParameters(['tuple[](uint8,address,uint256)'], [calls])
    // hexData = ONEUtil.encodeMultiCall(calls)
    // move the batch information into data
    data = ONEUtil.hexStringToBytes(hexData)

    // // Sample approache using encodeMultiCall
    // let call = {
    //   operationType: ONEConstants.OperationType.TRANSFER,
    //   dest: bob.wallet.address,
    //   amount: ONE_CENT
    // }
    // calls.push(call)
    // // alice tranfers ONE HALF_DIME to bob
    // calls.amount = HALF_DIME
    // calls.push(call)
    // // alice tranfers ONE DIME to bob
    // calls.amount = ONE_DIME
    // calls.push(call)
    // // For examples refer to encodeMulticalls and Reclaim.jsx for standard calls and Unwrap.jsx for safeTransferFrom
    // hexData = ONEUtil.encodeMultiCall(calls)
    // // move the batch information into data
    // data = ONEUtil.hexStringToBytes(hexData)

    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.BATCH,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Check Balances for Alice and Bob
    aliceBalance = await web3.eth.getBalance(alice.wallet.address)
    bobBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(parseInt(aliceInitialBalance) - parseInt(ONE_CENT + HALF_DIME + ONE_DIME), aliceBalance, 'Alice Wallet has correct balance')
    assert.equal(parseInt(bobInitialBalance) + parseInt(ONE_CENT + HALF_DIME + ONE_DIME), bobBalance, 'Bob Wallet has correct balance')
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT + HALF_DIME + ONE_DIME).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END BATCH ===
*/
    // ==== NOOP =====
    // This operation is obsolete.

    // === END NOOP ===

    // ==== CHANGE_SPENDING_LIMIT =====
    // Test : Increase the spending limit
    // Expected result: Will Increase Alices Spending Limit from ONE_ETH TO THREE_ETH
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: THREE_ETH,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    spendingState = await alice.wallet.getSpendingState()
    assert.notEqual(spendingState.highestSpendingLimit, aliceOldState.spendingState.highestSpendingLimit, 'alice wallet.highestSpendingLimit should have been changed')
    assert.equal(spendingState.highestSpendingLimit, THREE_ETH.toString(), 'alice wallet.highestSpendingLimit should be THREE_ETH')
    aliceOldState.spendingState.highestSpendingLimit = spendingState.highestSpendingLimit
    assert.notEqual(spendingState.lastLimitAdjustmentTime, aliceOldState.spendingState.lastLimitAdjustmentTime, 'alice wallet.lastLimitAdjustmentTime should have been changed')
    aliceOldState.spendingState.lastLimitAdjustmentTime = spendingState.lastLimitAdjustmentTime
    assert.notEqual(spendingState.spendingLimit, aliceOldState.spendingState.spendingLimit, 'alice wallet.spendingLimit should have been changed')
    assert.equal(spendingState.spendingLimit, THREE_ETH.toString(), 'alice wallet.spendingLimit should be THREE_ETH')
    aliceOldState.spendingState.spendingLimit = spendingState.spendingLimit
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    assert.equal(spendingState.lastSpendingInterval, aliceOldState.spendingState.lastSpendingInterval, 'alice wallet.lastSpendingInterval should not have been changed')
    assert.equal(spendingState.spendingInterval, aliceOldState.spendingState.spendingInterval, 'alice wallet.spendingInterval should not have been changed')
    assert.equal(spendingState.spentAmount, aliceOldState.spendingState.spentAmount, 'alice wallet.spentAmount should not have been changed')
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END CHANGE_SPENDING_LIMIT ===
/*
    // ==== JUMP_SPENDING_LIMIT =====
    // Test jump alices spending limit jump cannot be higher than highestSpendingLimit and does not update lastLimitAdjustmentTime
    // Expected result: will jump alices spending limit from THREE_ETH to TWO_ETH
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    await TestUtil.transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.JUMP_SPENDING_LIMIT,
        amount: FOUR_ETH,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    spendingState = await alice.wallet.getSpendingState()
    // assert.notEqual(spendingState.highestSpendingLimit, aliceOldState.spendingState.highestSpendingLimit, 'alice wallet.highestSpendingLimit should have been changed')
    assert.equal(spendingState.highestSpendingLimit, THREE_ETH.toString(), 'alice wallet.highestSpendingLimit should be THREE_ETH')
    // aliceOldState.spendingState.highestSpendingLimit = spendingState.highestSpendingLimit
    assert.notEqual(spendingState.lastLimitAdjustmentTime, aliceOldState.spendingState.lastLimitAdjustmentTime, 'alice wallet.lastLimitAdjustmentTime should have been changed')
    aliceOldState.spendingState.lastLimitAdjustmentTime = spendingState.lastLimitAdjustmentTime
    assert.notEqual(spendingState.spendingLimit, aliceOldState.spendingState.spendingLimit, 'alice wallet.spendingLimit should have been changed')
    assert.equal(spendingState.spendingLimit, TWO_ETH.toString(), 'alice wallet.spendingLimit should be TWO_ETH')
    aliceOldState.spendingState.spendingLimit = spendingState.spendingLimit
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    assert.equal(spendingState.lastSpendingInterval, aliceOldState.spendingState.lastSpendingInterval, 'alice wallet.lastSpendingInterval should not have been changed')
    assert.equal(spendingState.spendingInterval, aliceOldState.spendingState.spendingInterval, 'alice wallet.spendingInterval should not have been changed')
    assert.equal(spendingState.spentAmount, aliceOldState.spendingState.spentAmount, 'alice wallet.spentAmount should not have been changed')
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // === END JUMP_SPENDING_LIMIT ===
*/
  })
})
