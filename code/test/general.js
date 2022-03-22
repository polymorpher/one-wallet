const TestUtil = require('./util')
const CheckUtil = require('./checkUtil')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
// const BN = require('bn.js')

const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 12 // 6 minute wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const FIVE_HEX = ONEUtil.hexString('5')
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Test COMMAND function
// } else if (op.operationType == Enums.OperationType.COMMAND) {
//   backlinkAddresses.command(op.tokenType, op.contractAddress, op.tokenId, op.dest, op.amount, op.data);
  it('Wallet_Command: must be able to run a command', async () => {
    let alice = await CheckUtil.makeWallet('GE-COMMAND-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })
})
