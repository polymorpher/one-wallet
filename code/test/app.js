const TestUtil = require('./util')
const config = require('../config')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const ONE = require('../lib/onewallet')
const ONEWallet = require('../lib/onewallet')
const BN = require('bn.js')
const ONEDebugger = require('../lib/debug')

const NullOperationParams = {
  ...ONEConstants.NullOperationParams,
  data: new Uint8Array()

}
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
const getEffectiveTime = () => Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
const HALF_ETH = unit.toWei('0.5', 'ether')
const Logger = {
  debug: (...args) => {
    if (config.verbose) {
      console.log(...args)
    }
  }
}
const Debugger = ONEDebugger(Logger)


contract('ONEWallet', (accounts) => {
  Logger.debug(`Testing with ${accounts.length} accounts`)
  Logger.debug(accounts)
  let snapshotId
  beforeEach(async function () {
    await TestUtil.init()
    snapshotId = await TestUtil.snapshot()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // === BASIC POSITIVE TESTING APP FUNCTIONS ====

  // ====== COMMAND ======
  // Test wallet issuing a command
  // Expected result command is succesfully issued
  it('AP-BASIC-11 COMMAND: must be able to issue a command', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })

  // ====== SIGN ======
  // Test setting signing a transaction
  // Expected result the wallets will sign a transaction
  it('UP-BASIC-19 SIGN: must be able to sign a transaction', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })

  // ====== REVOKE ======
  // Test setting of a wallets recovery address
  // Expected result the wallets recovery address
  it('UP-BASIC-20 REVOKE: must be able to revoke a signature', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })

  // ====== CALL ======
  // Test calling a transaction
  // Expected a transaction is called
  it('UP-BASIC-21 CALL: must be able to add a signature', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })

  // ====== BATCH ======
  // Test batching transactions
  // Expected result a batch of transactions will be processed
  it('UP-BASIC-22 BATCH: must be able to process a batch of transactions', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })

  // ====== CREATE ======
  // Test create transactions
  // Expected result a create transaction will be processed
  it('UP-BASIC-29 CREATE: must be able to process a create transactions', async () => {
    assert.strictEqual(0, 1, 'Under Development')
  })
})
