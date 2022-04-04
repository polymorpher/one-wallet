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

  // === BASIC POSITIVE TESTING ADMIN FUNCTIONS ====

  // ====== DISPLACE ======
  // Test displace operation using 6x6 otps for different durations
  // Expected result must authenticate otp from new core after displacement
  it('AD.BASIC.7 DISPLACE: must authenticate otp from new core after displacement', async () => {
  })

  // ====== COMMAND ======
  // Test wallet issuing a command
  // Expected result command is succesfully issued
  it('AD.BASIC.11 COMMAND: must be able to issue a command', async () => {
  })

  // ====== CALL ======
  // Test calling a transaction
  // Expected a transaction is called
  it('AD.BASIC.21 CALL: must be able to add a signature', async () => {
  })

  // ====== BATCH ======
  // Test batching transactions
  // Expected result a batch of transactions will be processed
  it('AD.BASIC.22 BATCH: must be able to process a batch of transactions', async () => {
  })
})
