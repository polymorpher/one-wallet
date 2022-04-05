// Administrative Function Testing
const TestUtil = require('./util')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
// Wallets effective time is the current time minus half the duration (3 minutes ago)
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
contract('ONEWallet', (accounts) => {
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Test creation and validation of wallet
  it('AD-WALLET-1: must be able to create and validate a wallet', async () => {
    let { walletInfo: alice, state } = await TestUtil.makeWallet({ salt: 'TT-WALLET-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let newState = await TestUtil.getState(alice.wallet)
    await TestUtil.assertStateEqual(state, newState)
  })
})
