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
  const alice = {}
  const aliceLastResortAddress = accounts[1]
  const bob = {}
  const bobLastResortAddress = accounts[2]
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
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
    alice.wallet = wallet
    alice.seed = seed
    alice.hseed = hseed
    alice.root = root
    alice.layers = layers
    alice.lastResortAddress = aliceLastResortAddress
    // eslint-disable-next-line no-lone-blocks
    { ({ wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
      salt: new BN(11),
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: bobLastResortAddress,
      spendingLimit: TEN_ETH
    })) }
    bob.wallet = wallet
    bob.seed = seed
    bob.hseed = hseed
    bob.root = root
    bob.layers = layers
    bob.lastResortAddress = bobLastResortAddress
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
  // TODO
  // const TestERC20
  // const TestERC20Decimals9
  // const TestERC721
  // const TestERC1155
  // TokenTracker.trackToken for each of the Tokens??
  // Transfer each ot the Token Types
  // computeGeneralOperationHash
  // tokenTrackerState.transferToken(op.tokenType, op.contractAddress, op.tokenId, op.dest, op.amount, op.data);

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

  // Transfer Native Token
  it('Wallet_CommitReveal: ERC20 transfer must commit and reveal successfully', async () => {
    // const purse = web3.eth.accounts.create()
    const aliceInitialWalletBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(TEN_ETH, aliceInitialWalletBalance, 'Alice Wallet initially has correct balance')
    // await web3.eth.sendTransaction({
    //   from: accounts[0],
    //   to: alice.wallet.address,
    //   value: ONE_CENT
    // })
    // const layers = alice.layers
    // const seed = alice.seed
    // const hseed = alice.hseed
    // const wallet = alice.wallet
    // Debugger.printLayers({ layers })
    // const otp = ONEUtil.genOTP({ seed })
    // const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
    // const eotp = await ONE.computeEOTP({ otp, hseed })
    // await TestUtil.commitReveal({
    //   Debugger,
    //   layers,
    //   index,
    //   eotp,
    //   paramsHash: ONEWallet.computeTransferHash,
    //   commitParams: { dest: purse.address, amount: ONE_CENT / 2 },
    //   revealParams: { dest: purse.address, amount: ONE_CENT / 2, operationType: ONEConstants.OperationType.TRANSFER },
    //   wallet
    // })
    // const walletBalance = await web3.eth.getBalance(alice.wallet.address)
    // const purseBalance = await web3.eth.getBalance(purse.address)
    // assert.equal(parseInt(aliceInitialWalletBalance) + parseInt(ONE_CENT / 2), walletBalance, 'Alice Wallet has correct balance')
    // assert.equal(ONE_CENT / 2, purseBalance, 'Purse has correct balance')
  })
})

// OneWallet Event testing 
// event TransferError(address dest, bytes error);
// event LastResortAddressNotSet();
// event RecoveryAddressUpdated(address dest);
// event PaymentReceived(uint256 amount, address from);
// event PaymentSent(uint256 amount, address dest);
// event PaymentForwarded(uint256 amount, address dest);
// event AutoRecoveryTriggered(address from);
// event AutoRecoveryTriggeredPrematurely(address from, uint256 requiredTime);
// event RecoveryFailure();
// event RecoveryTriggered();
// event Retired();
// event ForwardedBalance(bool success);
// event ForwardAddressUpdated(address dest);
// event ForwardAddressAlreadySet(address dest);
// event ForwardAddressInvalid(address dest);
// event ExternalCallCompleted(address contractAddress, uint256 amount, bytes data, bytes ret);
// event ExternalCallFailed(address contractAddress, uint256 amount, bytes data, bytes ret);

// Other update functions
// receive()
// retire()
// commit(bytes32,bytes32,bytes32)
// tokenManager
/*   function onERC1155Received(
  address operator,
  address from,
  uint256 id,
  uint256 value,
  bytes calldata data
)
*/
//  function onERC1155BatchReceived(address operator, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) 
/*
function onERC721Received(
  address operator,
  address from,
  uint256 tokenId,
  bytes calldata data
) 
*/
