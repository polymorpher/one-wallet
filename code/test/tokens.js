/* TODO
1. Remove TestUtil and merge with util.js
2. Return oldState when calling makeWallet and assetTransfer
3. Retrieve currentState as part of checkONEWalletStateChange
3. Remove commented lines
4. Use batch function for token Tracker
5. Add TRACK and UNTRACK and OVERRIDE_TRACK Tests
6. Enhance assetTransfer to be walletTransaction (and cater for additional operations)
*/

const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
// const BN = require('bn.js')

const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
// const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const DUMMY_HEX = ONEUtil.hexString('5') // Dummy Hex string for 5 i.e. 0x05

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

  // Test creation and validation of wallet
  it('TT-WALLET-1: must be able to create and validate a wallet', async () => {
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TT-WALLET-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })


  // ERC20 Token Testing (Transfer, Mint, Track, SpendingLimit)
  // Positive use case handled in general.ts `'OPERATION 2 TRANSFER_TOKEN`
  it('TT-ERC20-1: ERC20(Transfer, Mint, Track) must commit and reveal successfully', async () => {
  })

  // ERC721 Testing (Transfer, Mint, Track)
  it('TT-ERC721-1: ERC721(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TT-ERC721-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: bob, walletOldState: bobOldState } = await TestUtil.makeWallet({ salt: 'TT-ERC721-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // make Tokens
    const { testerc721 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: false })
    let aliceWalletBalanceERC721
    let bobWalletBalanceERC721
    assert.equal(accounts[0], await testerc721.ownerOf(8), 'Account 0 owns token 8')

    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 7, { from: accounts[0] })
    await testerc721.safeTransferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
    await testerc721.safeTransferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceWalletBalanceERC721 = await testerc721.balanceOf(alice.wallet.address)
    assert.equal(3, aliceWalletBalanceERC721, 'Transfer of 3 ERC721 token to alice.wallet succesful')
    assert.equal(alice.wallet.address, await testerc721.ownerOf(7), 'Transfer of ERC721 token 7 to alice.wallet succesful')
    assert.equal(alice.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to alice.wallet succesful')
    assert.equal(alice.wallet.address, await testerc721.ownerOf(9), 'Transfer of ERC721 token 9 to alice.wallet succesful')
    // Alice Items that have changed - trackedTokens
    // tracked tokens: Note only tokens transferred using safeTransferFrom are tracked
    let trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC721.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC721')
    assert.deepEqual(trackedTokens[1][0], testerc721.address, 'alice.wallet.trackedTokens tracking testerc721')
    assert.deepEqual(trackedTokens[2].length, 2, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString(), trackedTokens[2][1].toString() ], ['8', '9'], 'alice.wallet.trackedTokens tokens 8 and 9 are now tracked')
    aliceOldState.trackedTokens = trackedTokens
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // alice transfers tokens to bob
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 8,
        dest: bob.wallet.address
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    let bobCurrentState = await TestUtil.getONEWalletState(bob.wallet)

    // check alice and bobs balance
    aliceWalletBalanceERC721 = await testerc721.balanceOf(alice.wallet.address)
    bobWalletBalanceERC721 = await testerc721.balanceOf(bob.wallet.address)
    assert.equal(2, aliceWalletBalanceERC721, 'Transfer of 1 ERC721 token from alice.wallet succesful')
    assert.equal(1, bobWalletBalanceERC721, 'Transfer of 1 ERC721 token to bob.wallet succesful')
    assert.equal(bob.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to bob.wallet succesful')

    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })

    // Check alices state
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // Bob Items that have changed - tracked tokens
    trackedTokens = await bob.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, bobOldState.trackedTokens, 'bob.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC721.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC721')
    assert.deepEqual(trackedTokens[1][0], testerc721.address, 'alice.wallet.trackedTokens tracking testerc721')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['8'], 'alice.wallet.trackedTokens token 8 is now tracked')
    bobOldState.trackedTokens = trackedTokens
    await TestUtil.checkONEWalletStateChange(bobOldState, bobCurrentState)
  })

  // ERC1155 Testing (Transfer, Mint, Track)
  it('TT-ERC1155-1: ERC1155(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TT-ERC1155-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: bob, walletOldState: bobOldState } = await TestUtil.makeWallet({ salt: 'TT-ERC1155-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // make Tokens
    const { testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: false, makeERC721: true, makeERC1155: true })
    let aliceWalletBalanceERC1155T8
    let bobWalletBalanceERC1155T8
    assert.equal(20, await testerc1155.balanceOf(accounts[0], 8), 'Alice.lastResortAddress owns 20 of token 8')
    // transfer ERC1155 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc1155.safeTransferFrom(accounts[0], alice.wallet.address, 8, 8, DUMMY_HEX, { from: accounts[0] })
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceWalletBalanceERC1155T8 = await testerc1155.balanceOf(alice.wallet.address, 8)
    assert.equal(8, aliceWalletBalanceERC1155T8, 'Transfer of 8 ERC721 token to alice.wallet succesful')
    // Alice Items that have changed - trackedTokens
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(await trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC1155.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC1155')
    assert.deepEqual(trackedTokens[1][0], testerc1155.address, 'alice.wallet.trackedTokens tracking testerc1155')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens one tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['8'], 'alice.wallet.trackedTokens tokens 8 and 9 are now tracked')
    aliceOldState.trackedTokens = trackedTokens

    // check alices state
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // alice transfers tokens to bob
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 8,
        dest: bob.wallet.address,
        amount: 3
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    let bobCurrentState = await TestUtil.getONEWalletState(bob.wallet)

    // check alice and bobs balance
    aliceWalletBalanceERC1155T8 = await testerc1155.balanceOf(alice.wallet.address, 8)
    bobWalletBalanceERC1155T8 = await testerc1155.balanceOf(bob.wallet.address, 8)
    assert.equal(5, aliceWalletBalanceERC1155T8, 'Transfer of 3 ERC1155 tokens from alice.wallet succesful')
    assert.equal(3, bobWalletBalanceERC1155T8, 'Transfer of 3 ERC1155 token to bob.wallet succesful')
    // Check OneWallet Items that have changed
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })

    // Check alices state
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // Bob Items that have changed - trackedTokens
    // tracked tokens
    trackedTokens = await bob.wallet.getTrackedTokens()
    assert.notDeepEqual(await trackedTokens, bobOldState.trackedTokens, 'bob.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC1155.toString(), 'bob.wallet.trackedTokens tracking tokens of type ERC1155')
    assert.deepEqual(trackedTokens[1][0], testerc1155.address, 'bob.wallet.trackedTokens tracking testerc1155')
    assert.deepEqual(trackedTokens[2].length, 1, 'bob.wallet.trackedTokens one tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['8'], 'bob.wallet.trackedTokens tokens 8 and 9 are now tracked')
    bobOldState.trackedTokens = trackedTokens
    await TestUtil.checkONEWalletStateChange(bobOldState, bobCurrentState)
  })

  // TokenTracker Testing (track, multitrack, getTrackedTokens, getBalance, recoverToken) also batch transactions
  it('TT-COMBO-1: TokenTracker(token management) must commit and reveal successfully', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice } = await TestUtil.makeWallet({ salt: 'TT-COMBO-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TT-COMBO-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // make Tokens
    const { testerc20, testerc721, testerc1155 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: true, makeERC1155: true })
    let testTime = Date.now()
    // alice transfers half of ONE CENT to bob
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2)
      }
    )

    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    // alice transfers tokens to bob
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // ERC20 Transfer
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 100,
        testTime
      }
    )

    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })

    // bump the test time
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // alice transfers tokens to bob
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 8,
        dest: bob.wallet.address,
        testTime
      }
    )

    // transfer 1155 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc1155.safeTransferFrom(accounts[0], alice.wallet.address, 8, 8, DUMMY_HEX, { from: accounts[0] })

    // bump Test Time
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // alice transfers tokens to bob
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 8,
        dest: bob.wallet.address,
        amount: 3,
        testTime
      }
    )
    // await TestUtil.checkONEWallet(alice.wallet, aliceOldState)
  })
})
