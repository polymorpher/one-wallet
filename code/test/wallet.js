const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONE = require('../lib/onewallet')
// const BN = require('bn.js')

const INTERVAL = 30000
const DURATION = INTERVAL * 8
const SLOT_SIZE = 1
const DAILY_LIMIT = 10

contract('ONEWallet', (accounts) => {
  const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL) * INTERVAL - DURATION / 2
  const SMALL_AMOUNT = unit.toWei('0.01', 'ether')
  it('must create wallet with expected parameters', async () => {
    const purse = web3.eth.accounts.create()
    const {
      seed,
      hseed,
      wallet,
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
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      dailyLimit: DAILY_LIMIT
    })
    console.log({
      seed,
      hseed,
      wallet: wallet.toString(),
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
    console.log(`Sending ${SMALL_AMOUNT} from ${accounts[0]} to ${wallet.address}`)
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: SMALL_AMOUNT
    })
    console.log(`Sent ${SMALL_AMOUNT} to ${wallet.address}`)
    const balance = await web3.eth.getBalance(wallet.address)
    assert.equal(SMALL_AMOUNT, balance, 'Wallet has correct balance')
  })

  // WIP
  it('must commit and reveal a transfer successfully', async () => {
    const purse = web3.eth.accounts.create()
    const { seed, hseed, wallet, client: { layers } } = await TestUtil.createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      dailyLimit: DAILY_LIMIT
    })

    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: SMALL_AMOUNT
    })

    const otp = ONEUtil.genOTP({ seed })
    const index = ONEUtil.timeToIndex({ effectiveTime: EFFECTIVE_TIME })
    const eotp = ONE.computeEOTP({ otp, hseed })
    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]
    const transferHash = ONE.computeTransferHash({
      neighbor,
      index,
      eotp,
      dest: purse.address,
      amount: SMALL_AMOUNT / 2
    })
    await wallet.commit(transferHash)
    // function revealTransfer(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, address payable dest, uint256 amount) external
    // isCorrectProof(neighbors, indexWithNonce, eotp)
    const neighborsEncoded = neighbors.map(n => ONEUtil.hexString(n))
    await wallet.revealTransfer(neighborsEncoded, index, ONEUtil.hexString(eotp), purse.address, SMALL_AMOUNT / 2)
    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(SMALL_AMOUNT / 2, walletBalance, 'Wallet has correct balance')
    assert.equal(SMALL_AMOUNT / 2, purseBalance, 'Purse has correct balance')
  })
})
