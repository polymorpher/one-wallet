const TestUtil = require('./util')
const CheckUtil = require('./checkUtil')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const Logger = TestUtil.Logger
const ONEConstants = require('../lib/constants')
// const BN = require('bn.js')

const MILLI_CENT = unit.toWei('0.00001', 'ether')
// const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
// const TEN_ETH = unit.toWei('10', 'ether')
const INTERVAL = 30000
const DURATION = INTERVAL * 12
// const SLOT_SIZE = 1

contract('ONEWallet', (accounts) => {
  const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Test bumping time
  it('TimeBump: Check Bumping of Time works', async () => {
    // Create Wallets and fund
    let alice = await CheckUtil.makeWallet('IN-TIMEBUMP-1', accounts[0], EFFECTIVE_TIME)
    let bob = await CheckUtil.makeWallet('IN-TIMEBUMP-2', accounts[0], EFFECTIVE_TIME)
    const aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)
    assert.equal(HALF_ETH, aliceInitialBalance, 'Alice Wallet initially has correct balance')
    let testTime = Date.now()
    for (let i = 0; i < 100; i++) {
      testTime = await TestUtil.bumpTestTime(testTime, 45)
      // alice tranfers ONE CENT to bob
      alice = await CheckUtil.assetTransfer(
        {
          wallet: alice,
          operationType: ONEConstants.OperationType.TRANSFER,
          dest: bob.wallet.address,
          amount: (MILLI_CENT)
        }
      )
      Logger.debug(`TimeBump Iteration Succesfull: ${i}`)
    }
  })

  // Test Snapshotting works
  it('SnapshotLoop : Check Snapshotting works', async () => {
    let snapshotId
    let testTime = Date.now()
    for (let i = 0; i < 100; i++) {
      snapshotId = await TestUtil.snapshot()
      await TestUtil.init()
      let alice = await CheckUtil.makeWallet('IN-SNAPLOOP-1', accounts[0], EFFECTIVE_TIME)
      let bob = await CheckUtil.makeWallet('IN-SNAPLOOP-2', accounts[0], EFFECTIVE_TIME)
      await CheckUtil.assetTransfer(
        {
          wallet: alice,
          operationType: ONEConstants.OperationType.TRANSFER,
          dest: bob.wallet.address,
          amount: (MILLI_CENT)
        }
      )
      // transfer ERC721 tokens from accounts[0] (which owns the tokens) to alices wallet
      const { testerc721 } = await CheckUtil.makeTokens(accounts[0])
      await testerc721.transferFrom(accounts[0], alice.wallet.address, 8, { from: accounts[0] })
      await testerc721.transferFrom(accounts[0], alice.wallet.address, 9, { from: accounts[0] })
      // alice transfers tokens to bob
      testTime = TestUtil.bumpTestTime(testTime, 45)
      alice = await CheckUtil.assetTransfer(
        {
          wallet: alice,
          operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
          tokenType: ONEConstants.TokenType.ERC721,
          contractAddress: testerc721.address,
          tokenId: 8,
          dest: bob.wallet.address,
          testTime
        }
      )
      await TestUtil.revert(snapshotId)
      Logger.debug(`SnapshotLoop succesful: ${i}`)
    }
  })

  it('SnapshotValidate 1 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-1', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 2 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-2', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 3 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-3', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 4 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-4', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 5 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-5', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 6 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 7 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 8 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 9 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 10 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 11 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 12 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 13 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 14 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 15 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 16 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 17 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 18 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 19 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })

  it('SnapshotValidate 20 : Check Snapshotting works', async () => {
    await CheckUtil.makeWallet('IN-SNAP-7', accounts[0], EFFECTIVE_TIME)
  })
})
