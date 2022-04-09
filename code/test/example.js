// Administrative Function Testing

const TestUtil = require('./util')
// const unit = require('ethjs-unit')
// const ONEUtil = require('../lib/util')
// const ONEConstants = require('../lib/constants')
// const BN = require('bn.js')

// const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
// const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
const getEffectiveTime = () => Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

// === TESTING
contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  let snapshotId
  beforeEach(async function () {
    await TestUtil.init()
    snapshotId = await TestUtil.snapshot()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === EXAMPLE UTILITY FUNCTIONS ====

  // ====== CREATE_WALLET ======
  // Test creation and validation of wallet
  // Expected result the wallet is now created and validate
  it('EX.UTILITY-1: must be able to create and validate a wallet', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'EX-UTILITY-1-1', deployer: accounts[0], effectiveTime: getEffectiveTime(), duration: DURATION })
    let currentState = await TestUtil.getState(alice.wallet)
    await TestUtil.assertStateEqual(state, currentState)
  })
})
