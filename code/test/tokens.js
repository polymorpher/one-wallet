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
    const alice = await makeWallet(1, accounts[1])
    const purse = web3.eth.accounts.create()
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    // alice tranfers ONE CENT to the purse
    await commitReveal(alice, ONEConstants.OperationType.TRANSFER, purse.address, (ONE_CENT / 2))
    const walletBalance = await web3.eth.getBalance(alice.wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(parseInt(aliceInitialWalletBalance) - parseInt(ONE_CENT / 2), walletBalance, 'Alice Wallet has correct balance')
    assert.equal(ONE_CENT / 2, purseBalance, 'Purse has correct balance')
  })

  // ERC20 Token Testing (Transfer, Mint, Track, SpendingLimit)
  it('Wallet_CommitReveal: ERC20(Transfer, Mint, Track) must commit and reveal successfully', async () => {
    // Create Wallets and tokens
    const alice = await makeWallet(1, accounts[1])
    const bob = await makeWallet(2, accounts[2])
    const {testerc20, testerc20d9, testerc721, testerc1155} = await makeTokens(alice.lastResortAddress)
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: alice.wallet.address,
      value: ONE_CENT
    })
    // transfer tokens to alice
    console.log(`testerc20.address: ${testerc20.address}`)
    await testerc20.transfer(alice.wallet.address, 1000, { from: alice.lastResortAddress })
    console.log(`alice testerc20 balance: ${await testerc20.balanceOf(alice.wallet.address)}`)
    // alice transfers tokens to bob
    // TODO this will use computeGeneralOperationHash
    // which takes the parameters
    //   bytes32(uint256(operationType)),
    //   bytes32(uint256(tokenType)),
    //   bytes32(bytes20(contractAddress)),
    //   bytes32(tokenId),
    //   bytes32(bytes20(dest)),
    //   bytes32(amount),
    //   data
    // will probably need to enhance test/util.js for this
    // an example of how this is called is here
    // https://github.com/1wallet-dev/1wallet/blob/testing/code/client/src/pages/Show/Send.jsx#L132

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
  return { wallet: wallet, seed: seed, hseed: hseed, root: root, layers: layers, lastResortAddress }
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

// commitReveal commits and reveals a wallet transaction
const commitReveal = async (wallet, operationType, dest, amount) => {
  Debugger.printLayers({ layers: wallet.layers })
  const otp = ONEUtil.genOTP({ seed: wallet.seed })
  const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
  const eotp = await ONE.computeEOTP({ otp, hseed: wallet.hseed })
  await TestUtil.commitReveal({
    Debugger,
    layers: wallet.layers,
    index,
    eotp,
    paramsHash: ONEWallet.computeTransferHash,
    commitParams: { dest, amount },
    revealParams: { dest, amount, operationType },
    wallet: wallet.wallet
  })
}
