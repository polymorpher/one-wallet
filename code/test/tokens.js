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

const INTERVAL = 30000
const DURATION = INTERVAL * 12
const SLOT_SIZE = 1

const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)

contract('ONEWallet', (accounts) => {
  const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
  const ONE_CENT = unit.toWei('0.01', 'ether')
  const HALF_DIME = unit.toWei('0.05', 'ether')
  const ONE_DIME = unit.toWei('0.1', 'ether')
  const ONE_ETH = unit.toWei('1', 'ether')
  const TEN_ETH = unit.toWei('10', 'ether')
  // Set alice and bobs lastResortAddress
  let alice = {}
  const aliceLastResortAddress = accounts[1]
  let bob = {}
  const bobLastResortAddress = accounts[2]
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
    // Create alice and bobs wallet
    let wallet
    let seed
    let hseed
    let root
    let layers
    // eslint-disable-next-line no-lone-blocks
    { ({ wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
      salt: new BN(10),
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: aliceLastResortAddress,
      spendingLimit: TEN_ETH
    })) }
    alice = {}
    alice = { wallet: wallet, seed: seed, hseed: hseed, root: root, layers: layers, lastResortAddress: accounts[1] }
    // eslint-disable-next-line no-lone-blocks
    { ({ wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
      salt: new BN(11),
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: bobLastResortAddress,
      spendingLimit: TEN_ETH
    })) }
    bob = {}
    bob = { wallet: wallet, seed: seed, hseed: hseed, root: root, layers: layers, lastResortAddress: accounts[2] }
    // Fund alice and bobs wallet
    await web3.eth.sendTransaction({
      from: alice.lastResortAddress,
      to: alice.wallet.address,
      value: TEN_ETH
    })
    await web3.eth.sendTransaction({
      from: bob.lastResortAddress,
      to: bob.wallet.address,
      value: TEN_ETH
    })
    // create an ERC20
    const TESTERC20 = artifacts.require('TestERC20')
    const testerc20 = await TESTERC20.new(10000000)
    // create an ERC20Decimals9
    const TESTERC20DECIMALS9 = artifacts.require('TestERC20Decimals9')
    const testerc20decimals9 = await TESTERC20DECIMALS9.new(10000000)
    // create an ERC721
    const TESTERC721 = artifacts.require('TestERC721')
    const tids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const uris = ['ipfs://test721/0', 'ipfs://test721/1', 'ipfs://test721/2', 'ipfs://test721/3', 'ipfs://test721/4', 'ipfs://test721/5', 'ipfs://test721/6', 'ipfs://test721/7', 'ipfs://test721/8', 'ipfs://test721/9']
    const testerc721 = await TESTERC721.new(tids,uris)
    // create and ERC1155
    const TESTERC1155 = artifacts.require('TestERC1155')
    const tids1155 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    const amounts1155 = [10, 20, 20, 20, 20, 20, 20, 20, 20, 100]
    const uris1155 = ['ipfs://test1155/0', 'ipfs://test1155/1', 'ipfs://test1155/2', 'ipfs://test1155/3', 'ipfs://test1155/4', 'ipfs://test1155/5', 'ipfs://test1155/6', 'ipfs://test1155/7', 'ipfs://test1155/8', 'ipfs://test1155/9']
    const testerc1155 = await TESTERC1155.new(tids1155, amounts1155, uris1155)
    // console.log(`testerc1155.uri(4): ${await testerc1155.uri(4)}`)
  })

  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Transfer Native Token
  it('Wallet_CommitReveal: Transfer must commit and reveal successfully', async () => {
    const purse = web3.eth.accounts.create()
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: alice.wallet.address,
      value: ONE_CENT
    })
    const layers = alice.layers
    const seed = alice.seed
    const hseed = alice.hseed
    const wallet = alice.wallet
    Debugger.printLayers({ layers })
    // TODO see if we can use apply https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply
    // const newPrintLayers = Debugger.printLayers.apply(null, alice.layers)
    const otp = ONEUtil.genOTP({ seed })
    const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
    const eotp = await ONE.computeEOTP({ otp, hseed })
    await TestUtil.commitReveal({
      Debugger,
      layers,
      index,
      eotp,
      paramsHash: ONEWallet.computeTransferHash,
      commitParams: { dest: purse.address, amount: ONE_CENT / 2 },
      revealParams: { dest: purse.address, amount: ONE_CENT / 2, operationType: ONEConstants.OperationType.TRANSFER },
      wallet
    })
    const walletBalance = await web3.eth.getBalance(alice.wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(parseInt(aliceInitialWalletBalance) + parseInt(ONE_CENT / 2), walletBalance, 'Alice Wallet has correct balance')
    assert.equal(ONE_CENT / 2, purseBalance, 'Purse has correct balance')
  })

  // ERC20 Token Testing (Transfer, Mint, Track, SpendingLimit)
  it('Wallet_CommitReveal: ERC20(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: alice.wallet.address,
      value: ONE_CENT
    })
    // transfer tokens to alice
    // alice transfers tokens to bob
    // check alice and bobs balance
    // check tokens tracked by alice and bob
  })
  // ERC20 Decimals 9 Testing (Transfer, Mint, Track, SpendingLimit) 
  it('Wallet_CommitReveal: ERC20-9(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    console.log(`TODO: ERC20-9(Transfer, Mint, Track) must commit and reveal successfully`)
  })
  // ERC721 Testing (Transfer, Mint, Track) 
  it('Wallet_CommitReveal: ERC721(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    console.log(`TODO: ERC721(Transfer, Mint, Track) must commit and reveal successfully`)
  })
  // ERC1155 Testing (Transfer, Mint, Track) 
  it('Wallet_CommitReveal: ERC1155(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    console.log(`TODO: ERC1155(Transfer, Mint, Track) must commit and reveal successfully`)
  })
  // TokenTracker Testing (track, multitrack, getTrackedTokens, getBalance, recoverToken) also batch transactions
  it('Wallet_CommitReveal: TokenTracker(token management) must commit and reveal successfully', async () => {
    console.log(`TODO: TokenTracker(tokenManagement) must commit and reveal successfully`)
  })
})
