const TestUtil = require('./util')
const CheckUtil = require('./checkUtil')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEDebugger = require('../lib/debug')
const ONE = require('../lib/onewallet')
const ONEConstants = require('../lib/constants')
const Flow = require('../lib/api/flow')
const ONEWallet = require('../lib/onewallet')
const crypto = require('crypto')
const BN = require('bn.js')
const { getIdentificationKey } = require('../lib/util')

const INTERVAL = 30000
const DURATION = INTERVAL * 12
const SLOT_SIZE = 1
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
// const ONE_ETH = unit.toWei('1', 'ether')
const TEN_ETH = unit.toWei('10', 'ether')

const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)

contract('ONEWallet', (accounts) => {
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })

  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Transfer Native Token to external wallet
  it('Wallet_CommitReveal: Transfer must commit and reveal successfully', async () => {
    // Create Wallets and tokens
    let alice = await makeWallet(1, accounts[1])
    const purse = web3.eth.accounts.create()
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    // alice tranfers ONE CENT to the purse
    await tokenTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: purse.address,
        amount: (ONE_CENT / 2)
      }
    )
    const walletBalance = await web3.eth.getBalance(alice.wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(parseInt(aliceInitialWalletBalance) - parseInt(ONE_CENT / 2), walletBalance, 'Alice Wallet has correct balance')
    assert.equal(ONE_CENT / 2, purseBalance, 'Purse has correct balance')
    // ONEWallet Items that have changed
    alice.state.spendingState.spentAmount = ONE_CENT / 2
    alice.state.spendingState.lastSpendingInterval = '19065'
    console.log(`alice.state.spendingState.spentAmount: ${alice.state.spendingState.spentAmount}`)
    console.log(`alice.state.spendingState: ${JSON.stringify(alice.state.spendingState)}`)

    await CheckUtil.checkONEWallet(alice.wallet, alice.state)
  })

  // ERC20 Token Testing (Transfer, Mint, Track, SpendingLimit)
  it('Wallet_CommitReveal: ERC20(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // Create Wallets and tokens
    const alice = await makeWallet(1, accounts[1])
    const bob = await makeWallet(2, accounts[2])
    const { testerc20 } = await makeTokens(alice.lastResortAddress)
    let aliceWalletBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from alice.lastResortAddress (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: alice.lastResortAddress })
    aliceWalletBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    // alice transfers tokens to bob
    await tokenTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        dest: bob.wallet.address,
        amount: 100
      }
    )
    // OneWallet Items that have changed
    // check alice and bobs balance
    aliceWalletBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    bobWalletBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    // check tokens tracked by alice and bob
    console.log(`alice.wallet.getTrackedTokens: ${JSON.stringify(await alice.wallet.getTrackedTokens())}`)
    console.log(`bob.wallet.getTrackedTokens: ${JSON.stringify(await bob.wallet.getTrackedTokens())}`)
  })

  // ERC20 Decimals 9 Testing (Transfer, Mint, Track, SpendingLimit)
  it('Wallet_CommitReveal: ERC20-9(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // Create Wallets and tokens
    const alice = await makeWallet(1, accounts[1])
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    const bob = await makeWallet(2, accounts[2])
    const { testerc20d9 } = await makeTokens(alice.lastResortAddress)
    let aliceWalletBalanceERC20d9
    let bobWalletBalanceERC20d9
    // transfer ERC20d9 tokens from alice.lastResortAddress (which owns the tokens) to alices wallet
    await testerc20d9.transfer(alice.wallet.address, 1000, { from: alice.lastResortAddress })
    aliceWalletBalanceERC20d9 = await testerc20d9.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceWalletBalanceERC20d9, 'Transfer of 1000 ERC20d9 tokens to alice.wallet succesful')
    // alice transfers tokens to bob
    await tokenTransfer(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20d9.address,
        dest: bob.wallet.address,
        amount: 100
      }
    )
    // check alice and bobs balance
    aliceWalletBalanceERC20d9 = await testerc20d9.balanceOf(alice.wallet.address)
    bobWalletBalanceERC20d9 = await testerc20d9.balanceOf(bob.wallet.address)
    assert.equal(900, aliceWalletBalanceERC20d9, 'Transfer of 100 ERC20d9 tokens from alice.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20d9, 'Transfer of 100 ERC20d9 tokens to bob.wallet succesful')
    // check tokens tracked by alice and bob
  })

  // ERC721 Testing (Transfer, Mint, Track)
  it('Wallet_CommitReveal: ERC721(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // Create Wallets and tokens
    const alice = await makeWallet(1, accounts[1])
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    const bob = await makeWallet(2, accounts[2])
    const { testerc721 } = await makeTokens(alice.lastResortAddress)
    let aliceWalletBalanceERC721
    let bobWalletBalanceERC721
    assert.equal(alice.lastResortAddress, await testerc721.ownerOf(8), 'Alice.lastResortAddress owns token 8')
    // transfer ERC721 tokens from alice.lastResortAddress (which owns the tokens) to alices wallet
    await testerc721.transferFrom(alice.lastResortAddress, alice.wallet.address, 8, { from: alice.lastResortAddress })
    aliceWalletBalanceERC721 = await testerc721.balanceOf(alice.wallet.address)
    assert.equal(1, aliceWalletBalanceERC721, 'Transfer of 1 ERC721 token to alice.wallet succesful')
    assert.equal(alice.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to alice.wallet succesful')
    // alice transfers tokens to bob
    await tokenTransfer(
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
    assert.equal(0, aliceWalletBalanceERC721, 'Transfer of 1 ERC721 token from alice.wallet succesful')
    assert.equal(1, bobWalletBalanceERC721, 'Transfer of 1 ERC721 token to bob.wallet succesful')
    assert.equal(bob.wallet.address, await testerc721.ownerOf(8), 'Transfer of ERC721 token 8 to bob.wallet succesful')
    // check tokens tracked by alice and bob
  })

  // ERC1155 Testing (Transfer, Mint, Track) 
  it('Wallet_CommitReveal: ERC1155(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    const alice = await makeWallet(1, accounts[1])
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    const bob = await makeWallet(2, accounts[2])
    const { testerc1155 } = await makeTokens(alice.lastResortAddress)
    let aliceWalletBalanceERC1155T8
    let bobWalletBalanceERC1155T8
    assert.equal(20, await testerc1155.balanceOf(alice.lastResortAddress, 8), 'Alice.lastResortAddress owns 20 of token 8')
    // transfer ERC721 tokens from alice.lastResortAddress (which owns the tokens) to alices wallet
    // TODO review the bytes value we are passing in safeTransferFrom (currently using ONEUtil.hexStringToBytes('5') )
    await testerc1155.safeTransferFrom(alice.lastResortAddress, alice.wallet.address, 8, 8, ONEUtil.hexStringToBytes('5'), { from: alice.lastResortAddress })
    aliceWalletBalanceERC1155T8 = await testerc1155.balanceOf(alice.wallet.address, 8)
    assert.equal(8, aliceWalletBalanceERC1155T8, 'Transfer of 8 ERC721 token to alice.wallet succesful')
    // alice transfers tokens to bob
    await tokenTransfer(
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
  })
  // TokenTracker Testing (track, multitrack, getTrackedTokens, getBalance, recoverToken) also batch transactions
  it('Wallet_CommitReveal: TokenTracker(token management) must commit and reveal successfully', async () => {
    console.log(`TODO: TokenTracker(tokenManagement) must commit and reveal successfully`)
  })
})

// makeWallet uses an index and unlocked web3.eth.account and creates and funds a ONEwallet
const makeWallet = async (accountIndex, lastResortAddress) => {
  // create wallet
  const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
  const TEN_ETH = unit.toWei('10', 'ether')
  const { wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
    salt: new BN(accountIndex),
    effectiveTime: EFFECTIVE_TIME,
    duration: DURATION,
    maxOperationsPerInterval: SLOT_SIZE,
    lastResortAddress,
    spendingLimit: TEN_ETH
  })
  // Fund wallet
  await web3.eth.sendTransaction({
    from: lastResortAddress,
    to: wallet.address,
    value: TEN_ETH
  })
  const state = await CheckUtil.getONEWalletState(wallet)
  return { wallet, seed, hseed, root, layers, lastResortAddress, state }
}

// makeTokens makes test ERC20, ERC20Decimals9, ERC721, ERC1155
const makeTokens = async (owner) => {
  // create an ERC20
  const TESTERC20 = artifacts.require('TestERC20')
  const testerc20 = await TESTERC20.new(10000000, { from: owner })
  // create an ERC20Decimals9
  const TESTERC20DECIMALS9 = artifacts.require('TestERC20Decimals9')
  const testerc20d9 = await TESTERC20DECIMALS9.new(10000000, { from: owner })
  // create an ERC721
  const TESTERC721 = artifacts.require('TestERC721')
  const tids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const uris = ['ipfs://test721/0', 'ipfs://test721/1', 'ipfs://test721/2', 'ipfs://test721/3', 'ipfs://test721/4', 'ipfs://test721/5', 'ipfs://test721/6', 'ipfs://test721/7', 'ipfs://test721/8', 'ipfs://test721/9']
  const testerc721 = await TESTERC721.new(tids, uris, { from: owner })
  // create and ERC1155
  const TESTERC1155 = artifacts.require('TestERC1155')
  const tids1155 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const amounts1155 = [10, 20, 20, 20, 20, 20, 20, 20, 20, 100]
  const uris1155 = ['ipfs://test1155/0', 'ipfs://test1155/1', 'ipfs://test1155/2', 'ipfs://test1155/3', 'ipfs://test1155/4', 'ipfs://test1155/5', 'ipfs://test1155/6', 'ipfs://test1155/7', 'ipfs://test1155/8', 'ipfs://test1155/9']
  const testerc1155 = await TESTERC1155.new(tids1155, amounts1155, uris1155, { from: owner })
  // console.log(`testerc1155.uri(4): ${await testerc1155.uri(4)}`)
  return { testerc20, testerc20d9, testerc721, testerc1155 }
}

// tokenTransfer commits and reveals a wallet transaction
const tokenTransfer = async ({ wallet, operationType, tokenType, contractAddress, tokenId, dest, amount }) => {
  Debugger.printLayers({ layers: wallet.layers })
  const otp = ONEUtil.genOTP({ seed: wallet.seed })
  const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
  const eotp = await ONE.computeEOTP({ otp, hseed: wallet.hseed })
  // Format commit and revealParams based on tokenType
  let commitParams
  let revealParams
  let paramsHash
  switch (operationType) {
    case ONEConstants.OperationType.TRANSFER:
      paramsHash = ONEWallet.computeTransferHash
      commitParams = { dest, amount }
      revealParams = { dest, amount, operationType }
      break
    case ONEConstants.OperationType.TRANSFER_TOKEN:
      paramsHash = ONEWallet.computeGeneralOperationHash
      switch (tokenType) {
        case ONEConstants.TokenType.ERC20:
          commitParams = { operationType, tokenType, contractAddress, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, dest, amount }
          break
        case ONEConstants.TokenType.ERC721:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          break
        case ONEConstants.TokenType.ERC1155:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          break
        default:
          console.log(`TODO: add in Token error handling`)
          return
      }
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
