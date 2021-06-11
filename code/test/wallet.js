const TestUtil = require('./util')
// const ONEWalletUtil = require('../lib/util')
// const BN = require('bn.js')

const INTERVAL = 30000
const DURATION = INTERVAL * 8
const SLOT_SIZE = 1
const DAILY_LIMIT = 10

contract('ONEWAllet', (accounts) => {
  const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL) * INTERVAL - DURATION / 2
  const SMALL_AMOUNT = web3.utils.toWei('0.01', 'ether')
  it('must create wallet with expected parameters', async () => {
    const purse = web3.eth.accounts.create()
    const {
      seed,
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
})
