const TestUtil = require('./util')
const CheckUtil = require('./checkUtil')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
// const BN = require('bn.js')

const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const FIVE_HEX = ONEUtil.hexString('5')

contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Test creation and validation of wallet
  it('Wallet_Validate: must be able to create and validate a wallet', async () => {
    let alice = await CheckUtil.makeWallet('TT-WALLET-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // Transfer Native Asset to external wallet
  it('Wallet_CommitReveal: Native Asset Transfer must commit and reveal successfully', async () => {
    // Create Wallets and fund
    let alice = await CheckUtil.makeWallet('TT-NATIVE-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await CheckUtil.makeWallet('TT-NATIVE-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    let bobOldState = await CheckUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    const aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    const bobInitialBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(HALF_ETH, aliceInitialBalance, 'Alice Wallet initially has correct balance')

    // alice tranfers ONE CENT to bob
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2)
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // Check Balances for Alice and Bob
    const aliceBalance = await web3.eth.getBalance(alice.wallet.address)
    const bobBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(parseInt(aliceInitialBalance) - parseInt(ONE_CENT / 2), aliceBalance, 'Alice Wallet has correct balance')
    assert.equal(parseInt(bobInitialBalance) + parseInt(ONE_CENT / 2), bobBalance, 'Bob Wallet has correct balance')
    // Alice Items that have changed - nonce, spendingState, lastOperationTime, Commits
    const nonce = await alice.wallet.getNonce()
    assert.notEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), aliceOldState.nonce + 1, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()
    // spendingState
    const spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // lastOperationTime
    const lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    const allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // check bob - nothing has changed
    await CheckUtil.checkONEWalletStateChange(bobOldState, bobCurrentState)
  })

  // ERC20 Token Testing (Transfer, Mint, Track, SpendingLimit)
  it('Wallet_CommitReveal: ERC20(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    let testTime = Date.now()
    // Create Wallets and tokens
    let alice = await CheckUtil.makeWallet('TT-ERC20-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await CheckUtil.makeWallet('TT-ERC20-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    let bobOldState = await CheckUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    const { testerc20 } = await CheckUtil.makeTokens(accounts[0])
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

    // Alice Items that have changed - nothing
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // alice transfers tokens to bob
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 100
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // check alice and bobs balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    bobBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    bobWalletBalanceERC20 = await bob.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, bobBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful and wallet balance updated')
    // Check OneWallet Items that have changed
    // Alice Items that have changed - nonce, lastOperationTime, Commits, trackedTokens
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

    // Check alices state
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // trackedTokens = await bob.wallet.getTrackedTokens()
    // console.log(`bob trackedTokens: ${JSON.stringify(trackedTokens)}`)

    // Bob Items that have changed - nothing
    await CheckUtil.checkONEWalletStateChange(bobOldState, bobCurrentState)

    // Bump Time and check Alice nonce has changed from 1 (she had a transaction in the last interval) to 0 for this new interval
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // nonce should now be back to 0 as it is per interval
    nonce = await alice.wallet.getNonce()
    assert.notDeepEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()

    // check Alices state
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // Transfer remaining tokens and check that alice no longer tracks this token
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 900,
        testTime
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // check alice and bobs balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    bobBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    bobWalletBalanceERC20 = await bob.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(0, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(0, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(1000, bobBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    assert.equal(1000, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful and wallet balance updated')
    // Check OneWallet Items that have changed
    // Alice Items that have changed - nonce, lastOperationTime, Commits, trackedTokens
    // nonce is per interval (so will be 1)
    nonce = await alice.wallet.getNonce()
    assert.notDeepEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()
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
    assert.deepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    aliceOldState.trackedTokens = trackedTokens

    // Check alices state
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // Bob Items that have changed - nothing
    await CheckUtil.checkONEWalletStateChange(bobOldState, bobCurrentState)
  })

  // ERC721 Testing (Transfer, Mint, Track)
  it('Wallet_CommitReveal: ERC721(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // Create Wallets and tokens
    let alice = await CheckUtil.makeWallet('TT-ERC721-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await CheckUtil.makeWallet('TT-ERC721-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    let bobOldState = await CheckUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    let aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(HALF_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    const { testerc721 } = await CheckUtil.makeTokens(accounts[0])
    let aliceWalletBalanceERC721
    let bobWalletBalanceERC721
    assert.equal(accounts[0], await testerc721.ownerOf(8), 'Account 0 owns token 8')

    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 7, { from: accounts[0] })
    await testerc721.safeTransferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
    await testerc721.safeTransferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
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
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // alice transfers tokens to bob
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 8,
        dest: bob.wallet.address,
        amount: 1
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // check alice and bobs balance
    aliceWalletBalanceERC721 = await testerc721.balanceOf(alice.wallet.address)
    bobWalletBalanceERC721 = await testerc721.balanceOf(bob.wallet.address)
    assert.equal(2, aliceWalletBalanceERC721, 'Transfer of 1 ERC721 token from alice.wallet succesful')
    assert.equal(1, bobWalletBalanceERC721, 'Transfer of 1 ERC721 token to bob.wallet succesful')
    assert.equal(bob.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to bob.wallet succesful')
    // Alice Items that have changed - nonce, lastOperationTime, Commits, trackedTokens
    // nonce
    const nonce = await await alice.wallet.getNonce()
    assert.notEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), aliceOldState.nonce + 1, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()
    // lastOperationTime
    const lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    const allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens: Note only tokens transferred using safeTransferFrom are tracked
    // trackedTokens = await bob.wallet.getTrackedTokens()
    // console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
    // assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC721.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC721')
    // assert.deepEqual(trackedTokens[1][0], testerc721.address, 'alice.wallet.trackedTokens tracking testerc721')
    // assert.deepEqual(trackedTokens[2].length, 2, 'alice.wallet.trackedTokens two tokens are now tracked')
    // assert.deepEqual([ trackedTokens[2][0].toString() ], ['9'], 'alice.wallet.trackedTokens tokens 8 and 9 are now tracked')
    // aliceOldState.trackedTokens = trackedTokens

    // Check alices state
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // Bob Items that have changed - tracked tokens
    trackedTokens = await bob.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, bobOldState.trackedTokens, 'bob.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC721.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC721')
    assert.deepEqual(trackedTokens[1][0], testerc721.address, 'alice.wallet.trackedTokens tracking testerc721')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['8'], 'alice.wallet.trackedTokens token 8 is now tracked')
    bobOldState.trackedTokens = trackedTokens
    await CheckUtil.checkONEWalletStateChange(bobOldState, bobCurrentState)
  })

  // ERC1155 Testing (Transfer, Mint, Track)
  it('Wallet_CommitReveal: ERC1155(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    const testWalletDuration = 60 * 2 * INTERVAL // 1 hour duration
    let alice = await CheckUtil.makeWallet('TT-ERC1155-1', accounts[0], EFFECTIVE_TIME, testWalletDuration)
    let bob = await CheckUtil.makeWallet('TT-ERC1155-2', accounts[0], EFFECTIVE_TIME, testWalletDuration)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    let bobOldState = await CheckUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    let aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(HALF_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    const { testerc1155 } = await CheckUtil.makeTokens(accounts[0])
    let aliceWalletBalanceERC1155T8
    let bobWalletBalanceERC1155T8
    assert.equal(20, await testerc1155.balanceOf(accounts[0], 8), 'Alice.lastResortAddress owns 20 of token 8')
    // transfer ERC1155 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc1155.safeTransferFrom(accounts[0], alice.wallet.address, 8, 8, FIVE_HEX, { from: accounts[0] })
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
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
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // alice transfers tokens to bob
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 8,
        dest: bob.wallet.address,
        amount: 3
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // check alice and bobs balance
    aliceWalletBalanceERC1155T8 = await testerc1155.balanceOf(alice.wallet.address, 8)
    bobWalletBalanceERC1155T8 = await testerc1155.balanceOf(bob.wallet.address, 8)
    assert.equal(5, aliceWalletBalanceERC1155T8, 'Transfer of 3 ERC1155 tokens from alice.wallet succesful')
    assert.equal(3, bobWalletBalanceERC1155T8, 'Transfer of 3 ERC1155 token to bob.wallet succesful')
    // Check OneWallet Items that have changed
    // Alice Items that have changed - nonce, lastOperationTime, Commits, trackedTokens
    // nonce
    const nonce = await await alice.wallet.getNonce()
    assert.notEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), aliceOldState.nonce + 1, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()
    // lastOperationTime
    const lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    const allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // // tracked tokens
    // trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(await trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // aliceOldState.trackedTokens = trackedTokens

    // Check alices state
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)

    // Bob Items that have changed - trackedTokens
    // tracked tokens
    trackedTokens = await bob.wallet.getTrackedTokens()
    assert.notDeepEqual(await trackedTokens, bobOldState.trackedTokens, 'bob.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC1155.toString(), 'bob.wallet.trackedTokens tracking tokens of type ERC1155')
    assert.deepEqual(trackedTokens[1][0], testerc1155.address, 'bob.wallet.trackedTokens tracking testerc1155')
    assert.deepEqual(trackedTokens[2].length, 1, 'bob.wallet.trackedTokens one tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['8'], 'bob.wallet.trackedTokens tokens 8 and 9 are now tracked')
    bobOldState.trackedTokens = trackedTokens
    await CheckUtil.checkONEWalletStateChange(bobOldState, bobCurrentState)
  })

  // TokenTracker Testing (track, multitrack, getTrackedTokens, getBalance, recoverToken) also batch transactions
  it('Wallet_CommitReveal: TokenTracker(token management) must commit and reveal successfully', async () => {
    let testTime = Date.now()
    let alice = await CheckUtil.makeWallet('TT-TOKEN-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await CheckUtil.makeWallet('TT-TOKEN-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    let bobOldState = await CheckUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    const { testerc20, testerc721, testerc1155 } = await CheckUtil.makeTokens(accounts[0])
    // alice tranfers ONE CENT to bob
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2)
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // alice transfers tokens to bob
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // ERC20 Transfer
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 100,
        testTime
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    assert.equal(alice.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to alice.wallet succesful')

    // bump the test time
    testTime = await TestUtil.bumpTestTime(testTime, 45)

    // Update alice and bob's current Sate
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // alice transfers tokens to bob
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC721,
        contractAddress: testerc721.address,
        tokenId: 8,
        dest: bob.wallet.address,
        testTime
      }
    )

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // transfer 1155 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc1155.safeTransferFrom(accounts[0], alice.wallet.address, 8, 8, FIVE_HEX, { from: accounts[0] })

    // Update alice and bob's current Sate
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // bump Test Time
    testTime = await TestUtil.bumpTestTime(testTime, 45)

    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)

    // alice transfers tokens to bob
    await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC1155,
        contractAddress: testerc1155.address,
        tokenId: 8,
        dest: bob.wallet.address,
        amount: 3,
        testTime
      }
    )
    // await CheckUtil.checkONEWallet(alice.wallet, aliceOldState)
  })
})
