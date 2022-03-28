// Test all events emitted
// Provides negative use case coverage

// TODO
// Retrieve the transaction from Commit Reveal whch has the event in tx.receipt.logs.

const TestUtil = require('./util')
// const unit = require('ethjs-unit')
// const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
// const BN = require('bn.js')
// const ONE = require('../lib/onewallet')
// const ONEWallet = require('../lib/onewallet')
// const ONEDebugger = require('../lib/debug')
// const Logger = TestUtil.Logger
// const Debugger = ONEDebugger(Logger)

// const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
// const HALF_ETH = unit.toWei('0.5', 'ether')
// const ONE_ETH = unit.toWei('1', 'ether')
// const TWO_ETH = unit.toWei('2', 'ether')
// const THREE_ETH = unit.toWei('3', 'ether')
// const FOUR_ETH = unit.toWei('4', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 2 * 60 * 24 * 1 // 1 day wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
// const DUMMY_HEX = ONEUtil.hexString('5') // Dummy Hex string for 5 i.e. 0x05
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  // let snapshotId
  beforeEach(async function () {
    // snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    // await TestUtil.revert(snapshotId)
  })

  // ====== TRACK ======
  // Test tacking of an ERC20 token
  // TokenTracked: Expected result the token is now tracked
  // *TokenAlreadTracked: No event is emitted just returns
  // *TokenInvalid: No validation is done with TokenManager
  it('EVENTS 0.0 TRACK.TokenTracked : must be able to track tokens', async () => {
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

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // let { authParams, revealParams, revealTx } = await TestUtil.executeStandardTransaction(
    await TestUtil.executeStandardTransaction(
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

    // event testing
    // console.log(`authParams: ${JSON.stringify(authParams)}`)
    // console.log(`revealParams: ${JSON.stringify(revealParams)}`)
    // console.log(`revealTx: ${JSON.stringify(revealTx)}`)
    // const event = tx.receipt.logs.filter(e => e.event === 'TokenTracked')[0]
    // const tokenIds = event.args.ids

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
  // TokenUntracked: Expected result the token is no longer tracked
  // TokenNotFound:  Token was not being tracked
  // *TokenInvalid: No validation is done with TokenManager
  it('EVENTS 1.0 UNTRACK.TokenUntracked: must be able to untrack tokens', async () => {
  })

  it('EVENTS 1.1 UNTRACK.TokenNotFound: error when token not found', async () => {
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alices Token Tracking information
  // * Expected result: Alice will now track testerc20v2 instead of testerc20
  it('EVENTS 3.0 OVERRIDE_TRACK: must be able to override tracked tokens', async () => {
  })

  // ========= TRANSFER =========
  // Test transferring of Native Currency from alice to bob
  // PaymentSent: Expected result Alices balance will decrease bobs will increase, alice spendingState is updated
  // TransferError : Problem with doing the actual transfer
  // ExceedSpendingLimit: Would exceed spending limit
  // InsufficientFund: Do not have enough funds for the transfer
  it('OPERATION 4.0 TRANSFER.PaymentSent : must be able to transfer native assets', async () => {
  })

  it('OPERATION 4.1 TRANSFER.TransferError : must be able to transfer native assets', async () => {
  })

  it('OPERATION 4.2 TRANSFER.ExceedSpendingLimit : must be able to transfer native assets', async () => {
  })

  it('OPERATION 4.3 TRANSFER.InsufficientFund : must be able to transfer native assets', async () => {
  })

  // ==== CHANGE_SPENDING_LIMIT =====
  // Test : Increase the spending limit
  // SpendingLimitChanged: Expected result Will Increase Alices Spending Limit from ONE_ETH TO THREE_ETH
  // HighestSpendingLimitChanged: Expected result if this spending limit is higher than any previous spending limit
  // SpendingLimitChangeFailed: Will fail if we try to change the spending limit twice within the spending interval
  it('EVENTS 24.0 CHANGE_SPENDING_LIMIT.SpendingLimitChanged: must be able to change spending limit', async () => {
  })

  it('EVENTS 24.1 CHANGE_SPENDING_LIMIT.HighestSpendingLimitChanged: must be able to change spending limit', async () => {
  })

  it('EVENTS 24 CHANGE_SPENDING_LIMIT.SpendingLimitChangeFailed: must be able to change spending limit', async () => {
  })

  // ==== JUMP_SPENDING_LIMIT =====
  // Test jump alices spending limit jump cannot be higher than highestSpendingLimit and does not update lastLimitAdjustmentTime
  // SpendingLimitJumped: Expected result will jump alices spending limit from THREE_ETH to TWO_ETH
  it('EVENT 25.0 JUMP_SPENDING_LIMIT.SpendingLimitJumped: must be able to jump spending limit', async () => {
  })
})
