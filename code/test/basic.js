const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEDebugger = require('../lib/debug')
const ONE = require('../lib/onewallet')
const ONEConstants = require('../lib/constants')
const Flow = require('../lib/api/flow')
const ONEWallet = require('../lib/onewallet')
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
  it('Wallet_Create: must create wallet with expected parameters', async () => {
    const purse = web3.eth.accounts.create()
    const {
      seed,
      hseed,
      address,
      root,
      client: {
        leaves,
        layers,
      },
      contract: {
        slotSize,
        t0,
        lifespan,
        interval
      } } = await TestUtil.createWallet({
      salt: new BN(1),
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    })
    Logger.debug({
      address,
      seed,
      hseed,
      root,
      client: {
        leaves,
        layers,
      },
      contract: {
        slotSize,
        t0,
        lifespan,
        interval
      } })
    Logger.debug(`Sending ${ONE_CENT} from ${accounts[0]} to ${address}`)
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: address,
      value: ONE_CENT
    })
    Logger.debug(`Sent ${ONE_CENT} to ${address}`)
    const balance = await web3.eth.getBalance(address)
    assert.equal(balance, ONE_CENT, 'Wallet has correct balance')
  })

  it('Wallet_CommitReveal: must commit and reveal a transfer successfully', async () => {
    const purse = web3.eth.accounts.create()
    const { wallet, seed, hseed, client: { layers } } = await TestUtil.createWallet({
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

    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(walletBalance, ONE_CENT / 2, 'Wallet has correct balance')
    assert.equal(purseBalance, ONE_CENT / 2, 'Purse has correct balance')
  })

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
    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(walletBalance, ONE_DIME, 'Wallet has original balance')
    assert.equal(purseBalance, 0, 'Purse has 0 balance')
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
    Logger.debug('tx', tx)
    assert.ok(tx.tx, 'Transaction must succeed')
    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(walletBalance, 0, 'Wallet has 0 balance')
    assert.equal(purseBalance, ONE_DIME, 'Purse has entire balance')
  })
})
