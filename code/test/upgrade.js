// Test upgrade scenario

const TestUtil = require('./util')
// const unit = require('ethjs-unit')
// const ONEUtil = require('../lib/util')
// const ONEConstants = require('../lib/constants')
// const BN = require('bn.js')
// const ONE = require('../lib/onewallet')
// const ONEWallet = require('../lib/onewallet')
// const ONEDebugger = require('../lib/debug')
// const Logger = TestUtil.Logger
// const Debugger = ONEDebugger(Logger)

// const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
// const HALF_ETH = unit.toWei('0.5', 'ether')
// const ONE_ETH = unit.toWei('1', 'ether')
// const TWO_ETH = unit.toWei('2', 'ether')
// const THREE_ETH = unit.toWei('3', 'ether')
// const FOUR_ETH = unit.toWei('4', 'ether')
// const INTERVAL = 30000 // 30 second Intervals
// const DURATION = INTERVAL * 2 * 60 * 24 * 1 // 1 day wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
// const DUMMY_HEX = ONEUtil.hexString('5') // Dummy Hex string for 5 i.e. 0x05
// const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  // let snapshotId
  beforeEach(async function () {
    // snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    // await TestUtil.revert(snapshotId)
  })

  // ====== LEGACY WALLET CREATE ======
  // Creation of an existing wallet
  it('UPGRADE 0 LEGACY WALLET CREATE : must be able to create wallet', async () => {
  })

  // ====== UPGRADE WALLET ======
  // Creation of new wallet
  // Create Backlink to existing wallet
  it('UPGRADE 1 WALLET: Create Upgrade Wallet and link to old wallet', async () => {
  })

  // ====== UPGRADE SPENDING ======
  // Spending Limit Tests
  it('UPGRADE 2 SPENDING : Spending Limit Tests', async () => {
  })

  // ====== UPGRADE TOKEN MANAGEMENT AND TRANSFER ======
  // Transfer Tokens
  // Manage Tokens
  it('UPGRADE 3 TOKEN : Transfer and Manage Tokens', async () => {
  })

  // ====== UPGRADE AUTHORIZATION ======
  // Authorize various Signers for varying amounts
  it('UPGRADE 4 AUTHORIZATION: Authorize various Signers for varying amounts', async () => {
  })

  // ====== UPGRADE RECOVERY ======
  // Recovery of Wallets and Tokens
  it('UPGRADE 5 RECOVERY : Recovery of Wallets and Tokens', async () => {
  })

  // ====== UPGRADE MISCELLANEOUS ======
  // Additional Upgrade Testing
  it('UPGRADE 6 MISCELLANEOUS : Additional Upgrade Testing', async () => {
  })
})
