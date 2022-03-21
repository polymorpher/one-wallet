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
const INTERVAL = 30000
const DURATION = INTERVAL * 12
// const SLOT_SIZE = 1
const FIVE_HEX = ONEUtil.hexString('5')

contract('ONEWallet', (accounts) => {
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
    await CheckUtil.makeWallet('TT-WALLET-1', accounts[0], EFFECTIVE_TIME)
    // await CheckUtil.checkONEWallet(alice.wallet, alice.oldState)
  })

  // Transfer Native Asset to external wallet
  it('Wallet_CommitReveal: Native Asset Transfer must commit and reveal successfully', async () => {
    // Create Wallets and fund
    let alice = await CheckUtil.makeWallet('TT-NATIVE-1', accounts[0], EFFECTIVE_TIME)
    let bob = await CheckUtil.makeWallet('TT-NATIVE-2', accounts[0], EFFECTIVE_TIME)
    const aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    const bobInitialBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(HALF_ETH, aliceInitialBalance, 'Alice Wallet initially has correct balance')
    // alice tranfers ONE CENT to bob
    alice = await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2)
      }
    )
    // Check Balances for Alice and Bob
    const aliceBalance = await web3.eth.getBalance(alice.wallet.address)
    const bobBalance = await web3.eth.getBalance(bob.wallet.address)
    assert.equal(parseInt(aliceInitialBalance) - parseInt(ONE_CENT / 2), aliceBalance, 'Alice Wallet has correct balance')
    assert.equal(parseInt(bobInitialBalance) + parseInt(ONE_CENT / 2), bobBalance, 'Bob Wallet has correct balance')
    // Alice Items that have changed - nonce, spendingState, lastOperationTime, Commits
    const nonce = await await alice.wallet.getNonce()
    assert.notEqual(nonce, alice.oldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), alice.oldState.nonce + 1, 'alice wallet.nonce should have been changed')
    alice.oldState.nonce = nonce.toNumber()
    // spendingState
    const spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    alice.oldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    alice.oldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // lastOperationTime
    const lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, alice.oldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    alice.oldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    const allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, alice.oldState.allCommits, 'alice wallet.allCommits should have been updated')
    alice.oldState.allCommits = alice.currentState.allCommits
    // check alice
    await CheckUtil.checkONEWallet(alice)
  })

  // ERC20 Token Testing (Transfer, Mint, Track, SpendingLimit)
  it('Wallet_CommitReveal: ERC20(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    let testTime = Date.now()
    // Create Wallets and tokens
    let alice = await CheckUtil.makeWallet('TT-ERC20-1', accounts[0], EFFECTIVE_TIME)
    let bob = await CheckUtil.makeWallet('TT-ERC20-2', accounts[0], EFFECTIVE_TIME)
    const { testerc20 } = await CheckUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    // Alice Items that have changed - nothing
    alice.oldState = alice.currentState
    await CheckUtil.getONEWalletState(alice.wallet)
    await CheckUtil.checkONEWallet(alice)
    // alice transfers tokens to bob
    alice = await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 100
      }
    )
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
    assert.notEqual(nonce, alice.oldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), alice.oldState.nonce + 1, 'alice wallet.nonce should have been changed')
    alice.oldState.nonce = nonce.toNumber()
    // lastOperationTime
    let lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, alice.oldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    alice.oldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, alice.oldState.allCommits, 'alice wallet.allCommits should have been updated')
    alice.oldState.allCommits = allCommits
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, alice.oldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    alice.oldState.trackedTokens = alice.currentState.trackedTokens
    await CheckUtil.checkONEWallet(alice)
    // Bob Items that have changed - nothing
    bob.oldState = bob.currentState
    CheckUtil.getONEWalletState(bob.wallet)
    await CheckUtil.checkONEWallet(bob)
    // Transfer remaining tokens and check that alice no longer tracks this token
    testTime = TestUtil.bumpTestTime(testTime, 45)
    // nonce should now be back to 0 as it is per interval
    nonce = await alice.wallet.getNonce()
    console.log(`nonce: ${nonce}`)
    assert.notDeepEqual(nonce, alice.oldState.nonce, 'alice wallet.nonce should have been changed')
    alice.oldState.nonce = nonce.toNumber()
    testTime = TestUtil.bumpTestTime(testTime, 45)
    // check that nothing else has changed for alice
    alice.oldState = alice.currentState
    await CheckUtil.getONEWalletState(alice.wallet)
    await CheckUtil.checkONEWallet(alice)

    alice = await CheckUtil.assetTransfer(
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
    assert.notDeepEqual(nonce, alice.oldState.nonce, 'alice wallet.nonce should have been changed')
    alice.oldState.nonce = nonce.toNumber()
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, alice.oldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    alice.oldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, alice.oldState.allCommits, 'alice wallet.allCommits should have been updated')
    alice.oldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    assert.deepEqual(trackedTokens, alice.oldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    alice.oldState.trackedTokens = alice.currentState.trackedTokens
    await CheckUtil.checkONEWallet(alice)
    // Bob Items that have changed - nothing
    bob.oldState = bob.currentState
    await CheckUtil.getONEWalletState(bob.wallet)
    await CheckUtil.checkONEWallet(bob)
  })

  // ERC721 Testing (Transfer, Mint, Track)
  it('Wallet_CommitReveal: ERC721(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // Create Wallets and tokens
    let alice = await CheckUtil.makeWallet('TT-ERC721-1', accounts[0], EFFECTIVE_TIME)
    let bob = await CheckUtil.makeWallet('TT-ERC721-2', accounts[0], EFFECTIVE_TIME)
    let aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(HALF_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    const { testerc721 } = await CheckUtil.makeTokens(accounts[0])
    let aliceWalletBalanceERC721
    let bobWalletBalanceERC721
    assert.equal(accounts[0], await testerc721.ownerOf(8), 'Account 0 owns token 8')
    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
    aliceWalletBalanceERC721 = await testerc721.balanceOf(alice.wallet.address)
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })
    aliceWalletBalanceERC721 = await testerc721.balanceOf(alice.wallet.address)
    assert.equal(2, aliceWalletBalanceERC721, 'Transfer of 2 ERC721 token to alice.wallet succesful')
    assert.equal(alice.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to alice.wallet succesful')
    assert.equal(alice.wallet.address, await testerc721.ownerOf(9), 'Transfer of ERC721 token 9 to alice.wallet succesful')
    // Alice Items that have changed - nothing
    alice.oldState = alice.currentState
    await CheckUtil.getONEWalletState(alice.wallet)
    await CheckUtil.checkONEWallet(alice)
    // alice transfers tokens to bob
    alice = await CheckUtil.assetTransfer(
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
    // check alice and bobs balance
    aliceWalletBalanceERC721 = await testerc721.balanceOf(alice.wallet.address)
    bobWalletBalanceERC721 = await testerc721.balanceOf(bob.wallet.address)
    assert.equal(1, aliceWalletBalanceERC721, 'Transfer of 1 ERC721 token from alice.wallet succesful')
    assert.equal(1, bobWalletBalanceERC721, 'Transfer of 1 ERC721 token to bob.wallet succesful')
    assert.equal(bob.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to bob.wallet succesful')
    // Alice Items that have changed - nonce, lastOperationTime, Commits, trackedTokens
    // nonce
    const nonce = await await alice.wallet.getNonce()
    assert.notEqual(nonce, alice.oldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), alice.oldState.nonce + 1, 'alice wallet.nonce should have been changed')
    alice.oldState.nonce = nonce.toNumber()
    // lastOperationTime
    const lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, alice.oldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    alice.oldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    const allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, alice.oldState.allCommits, 'alice wallet.allCommits should have been updated')
    alice.oldState.allCommits = allCommits
    // tracked tokens
    // const trackedTokens = await alice.wallet.getTrackedTokens()
    // assert.notDeepEqual(await trackedTokens, alice.oldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    // alice.oldState.trackedTokens = trackedTokens
    // await CheckUtil.checkONEWallet(alice)
    // Bob Items that have changed - nothing
    bob.oldState = bob.currentState
    await CheckUtil.getONEWalletState(bob.wallet)
    await CheckUtil.checkONEWallet(bob)
  })

  // ERC1155 Testing (Transfer, Mint, Track)
  it('Wallet_CommitReveal: ERC1155(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    let alice = await CheckUtil.makeWallet('TT-ERC1155-1', accounts[0], EFFECTIVE_TIME)
    let bob = await CheckUtil.makeWallet('TT-ERC1155-2', accounts[0], EFFECTIVE_TIME)
    let aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(HALF_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    const { testerc1155 } = await CheckUtil.makeTokens(accounts[0])
    let aliceWalletBalanceERC1155T8
    let bobWalletBalanceERC1155T8
    assert.equal(20, await testerc1155.balanceOf(accounts[0], 8), 'Alice.lastResortAddress owns 20 of token 8')
    // transfer ERC1155 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc1155.safeTransferFrom(accounts[0], alice.wallet.address, 8, 8, FIVE_HEX, { from: accounts[0] })
    aliceWalletBalanceERC1155T8 = await testerc1155.balanceOf(alice.wallet.address, 8)
    assert.equal(8, aliceWalletBalanceERC1155T8, 'Transfer of 8 ERC721 token to alice.wallet succesful')
    // Alice Items that have changed - nothing
    alice.oldState = alice.currentState
    await CheckUtil.getONEWalletState(alice.wallet)
    await CheckUtil.checkONEWallet(alice)
    // alice transfers tokens to bob
    alice = await CheckUtil.assetTransfer(
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
    // check alice and bobs balance
    aliceWalletBalanceERC1155T8 = await testerc1155.balanceOf(alice.wallet.address, 8)
    bobWalletBalanceERC1155T8 = await testerc1155.balanceOf(bob.wallet.address, 8)
    assert.equal(5, aliceWalletBalanceERC1155T8, 'Transfer of 3 ERC1155 tokens from alice.wallet succesful')
    assert.equal(3, bobWalletBalanceERC1155T8, 'Transfer of 3 ERC1155 token to bob.wallet succesful')
    // Check OneWallet Items that have changed
    // Alice Items that have changed - nonce, lastOperationTime, Commits, trackedTokens
    // nonce
    const nonce = await await alice.wallet.getNonce()
    assert.notEqual(nonce, alice.oldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), alice.oldState.nonce + 1, 'alice wallet.nonce should have been changed')
    alice.oldState.nonce = nonce.toNumber()
    // lastOperationTime
    const lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, alice.oldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    alice.oldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    const allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, alice.oldState.allCommits, 'alice wallet.allCommits should have been updated')
    alice.oldState.allCommits = allCommits
    // tracked tokens
    const trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(await trackedTokens, alice.oldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    alice.oldState.trackedTokens = trackedTokens
    await CheckUtil.checkONEWallet(alice)
    // Bob Items that have changed - nothing
    bob.oldState = bob.currentState
    CheckUtil.getONEWalletState(bob.wallet)
    await CheckUtil.checkONEWallet(bob)
  })

  // TokenTracker Testing (track, multitrack, getTrackedTokens, getBalance, recoverToken) also batch transactions
  it('Wallet_CommitReveal: TokenTracker(token management) must commit and reveal successfully', async () => {
    let testTime = Date.now()
    let alice = await CheckUtil.makeWallet('TT-TOKEN-1', accounts[0], EFFECTIVE_TIME)
    let bob = await CheckUtil.makeWallet('TT-TOKEN-2', accounts[0], EFFECTIVE_TIME)
    const { testerc20, testerc721, testerc1155 } = await CheckUtil.makeTokens(accounts[0])
    // alice tranfers ONE CENT to bob
    alice = await CheckUtil.assetTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2)
      }
    )
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    // alice transfers tokens to bob
    testTime = TestUtil.bumpTestTime(testTime, 45)
    alice.oldState = alice.currentState
    alice = await CheckUtil.assetTransfer(
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
    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
    await testerc721.transferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })
    assert.equal(alice.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to alice.wallet succesful')
    // alice transfers tokens to bob
    testTime = TestUtil.bumpTestTime(testTime, 45)
    alice.oldState = alice.currentState
    alice = await CheckUtil.assetTransfer(
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
    // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc1155.safeTransferFrom(accounts[0], alice.wallet.address, 8, 8, FIVE_HEX, { from: accounts[0] })
    // alice transfers tokens to bob
    testTime = TestUtil.bumpTestTime(testTime, 45)
    alice.oldState = alice.currentState
    alice = await CheckUtil.assetTransfer(
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
    // await CheckUtil.checkONEWallet(alice.wallet, alice.oldState)
  })
})
