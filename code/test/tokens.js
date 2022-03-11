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
  it('Wallet_CommitReveal: must commit and reveal a transfer successfully', async () => {
    const purse = web3.eth.accounts.create()
    const { wallet, seed, hseed, root, client: { layers } } = await TestUtil.createWallet({
      salt: new BN(2),
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    })

    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: ONE_CENT
    })

    Debugger.printLayers({ layers })
    const otp = ONEUtil.genOTP({ seed })
    const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
    const eotp = await ONE.computeEOTP({ otp, hseed })
    const tx = await TestUtil.commitReveal({
      Debugger,
      layers,
      index,
      eotp,
      paramsHash: ONEWallet.computeTransferHash,
      commitParams: { dest: purse.address, amount: ONE_CENT / 2 },
      revealParams: { dest: purse.address, amount: ONE_CENT / 2, operationType: ONEConstants.OperationType.TRANSFER },
      wallet
    })
    // const event = tx.receipt.logs.filter(e => e.event === 'PaymentSent')[0]
    // console.log(`tx: ${JSON.stringify(tx)}`)
    const event = tx.tx.receipt.logs[0]
    console.log(`event: ${JSON.stringify(event.event)}`)
    console.log(`event args: ${JSON.stringify(event.args)}`)
    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(ONE_CENT / 2, walletBalance, 'Wallet has correct balance')
    assert.equal(ONE_CENT / 2, purseBalance, 'Purse has correct balance')
  })
  // Enforce Daily spending limit
  it('Wallet_spendingLimit: must respect daily limit', async () => {
    const purse = web3.eth.accounts.create()
    const { seed, hseed, wallet, client: { layers } } = await TestUtil.createWallet({
      salt: new BN(3),
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_CENT
    })
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: ONE_DIME
    })
    const otp = ONEUtil.genOTP({ seed })
    const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
    const eotp = await ONE.computeEOTP({ otp, hseed })
    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]
    // console.log(`layers: ${JSON.stringify(layers)}`)
    // console.log(`index: ${JSON.stringify(index)}`)
    // console.log(`neighbors: ${JSON.stringify(neighbors)}`)
    // console.log(`neighbor: ${JSON.stringify(neighbors)}`)
    // console.log(`index: ${JSON.stringify(index)}`)
    // console.log(`otp: ${JSON.stringify(otp)}`)
    // console.log(`eotp: ${JSON.stringify(eotp)}`)
    const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
    const { hash: transferHash } = ONE.computeTransferHash({ dest: purse.address, amount: HALF_DIME })
    const { hash: verificationHash } = ONE.computeVerificationHash({ paramsHash: transferHash, eotp })
    const neighborsEncoded = neighbors.map(ONEUtil.hexString)
    await wallet.commit(ONEUtil.hexString(commitHash), ONEUtil.hexString(transferHash), ONEUtil.hexString(verificationHash))
    // bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp,
    //   OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data
    await wallet.reveal(
      [neighborsEncoded, index, ONEUtil.hexString(eotp)],
      [ONEConstants.OperationType.TRANSFER, ONEConstants.TokenType.NONE, ONEConstants.EmptyAddress, 0, purse.address, HALF_DIME, '0x']
    )
    // console.log(`tx: ${JSON.stringify(tx)}`)
    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(ONE_DIME, walletBalance, 'Wallet has original balance')
    assert.equal(0, purseBalance, 'Purse has 0 balance')
  })

  it('Wallet_Recover: must recover funds to recovery address without using otp', async () => {
    const purse = web3.eth.accounts.create()
    const { hseed, wallet, client: { layers } } = await TestUtil.createWallet({
      salt: new BN(4),
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_CENT
    })
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: ONE_DIME
    })
    const index = 2 ** (layers.length - 1) - 1
    const eotp = await Flow.EotpBuilders.recovery({ wallet, layers })
    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]
    const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
    const { hash: recoveryHash, bytes: recoveryData } = ONE.computeRecoveryHash({ hseed })
    const { hash: verificationHash } = ONE.computeVerificationHash({ paramsHash: recoveryHash, eotp })
    const neighborsEncoded = neighbors.map(ONEUtil.hexString)
    await wallet.commit(ONEUtil.hexString(commitHash), ONEUtil.hexString(recoveryHash), ONEUtil.hexString(verificationHash))
    const tx = await wallet.reveal(
      [neighborsEncoded, index, ONEUtil.hexString(eotp)],
      [ONEConstants.OperationType.RECOVER, ONEConstants.TokenType.NONE, ONEConstants.EmptyAddress, 0, ONEConstants.EmptyAddress, HALF_DIME, ONEUtil.hexString(recoveryData)]
    )
    // console.log(`tx: ${JSON.stringify(tx)}`)
    const event = tx.receipt.logs[0]
    console.log(`event: ${JSON.stringify(event.event)}`)
    console.log(`event args: ${JSON.stringify(event.args)}`)
    Logger.debug('tx', tx)
    assert.ok(tx.tx, 'Transaction must succeed')
    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(0, walletBalance, 'Wallet has 0 balance')
    assert.equal(ONE_DIME, purseBalance, 'Purse has entire balance')
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
