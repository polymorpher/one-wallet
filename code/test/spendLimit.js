const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEDebugger = require('../lib/debug')
const ONEWallet = require('../lib/onewallet')
const ONEConstants = require('../lib/constants')
const BN = require('bn.js')
const ONE = require('../lib/onewallet')
const INTERVAL = 30000
const INTERVAL6 = INTERVAL * 6
const SLOT_SIZE = 1

const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)
const NOW = Math.floor(Date.now() / (INTERVAL)) * INTERVAL - 5000

contract('ONEWallet', (accounts) => {
  const ONE_ETH = unit.toWei('1', 'ether')
  const ONE_DIME = unit.toWei('0.1', 'ether')
  const duration = INTERVAL * 24
  const effectiveTime = Math.floor(NOW / INTERVAL6) * INTERVAL6 - duration / 2
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
  })

  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  it('SpendLimit_Basic: must obey spend limit changing rules', async () => {
    const purse = web3.eth.accounts.create()
    const { wallet, seed, hseed, client: { layers, innerTrees, } } = await TestUtil.createWallet({
      salt: new BN(10),
      effectiveTime,
      duration,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    })
    {
      const newLimit = ONE_ETH.muln(2)
      const { eotp, index } = await TestUtil.getEOTP({ seed, hseed, effectiveTime })
      const { tx } = await TestUtil.commitReveal({
        Debugger,
        layers,
        index,
        eotp,
        paramsHash: ONEWallet.computeAmountHash,
        commitParams: { amount: newLimit },
        revealParams: { amount: newLimit.toString(), operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT },
        wallet
      })
      const spendingState = await wallet.getSpendingState()
      Logger.debug(spendingState)
      Logger.debug(tx)
      assert.equal(spendingState.spendingLimit.toString(), newLimit.toString(), 'New limit should be 2 ETH')
    }
    {
      await TestUtil.increaseTime(60)
      const newLimit = ONE_ETH.muln(3)
      const { eotp, index } = await TestUtil.getEOTP({ seed, hseed, effectiveTime, timeOffset: 60000 })
      const { tx } = await TestUtil.commitReveal({
        Debugger,
        layers,
        index,
        eotp,
        paramsHash: ONEWallet.computeAmountHash,
        commitParams: { amount: newLimit },
        revealParams: {
          amount: newLimit.toString(),
          operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT
        },
        wallet
      })
      const spendingState = await wallet.getSpendingState()
      Logger.debug(spendingState)
      Logger.debug(tx)
      assert.equal(spendingState.spendingLimit.toString(), ONE_ETH.muln(2).toString(), 'New limit still should be 2 ETH, not 3 ETH')
    }
    {
      await TestUtil.increaseTime(60)
      const newLimit = ONE_DIME
      const { eotp, index } = await TestUtil.getEOTP({ seed, hseed, effectiveTime, timeOffset: 120000 })
      const { tx } = await TestUtil.commitReveal({
        Debugger,
        layers,
        index,
        eotp,
        paramsHash: ONEWallet.computeAmountHash,
        commitParams: { amount: newLimit },
        revealParams: {
          amount: newLimit.toString(),
          operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT
        },
        wallet
      })
      const spendingState = await wallet.getSpendingState()
      Logger.debug(spendingState)
      Logger.debug(tx)
      assert.equal(spendingState.spendingLimit.toString(), ONE_DIME.toString(), 'New limit should be 0.1 ETH')
    }
    {
      await TestUtil.increaseTime(60)
      const newLimit = ONE_ETH
      const { eotp, index } = await TestUtil.getEOTP({ seed, hseed, effectiveTime, timeOffset: 180000 })
      const { tx } = await TestUtil.commitReveal({
        Debugger,
        layers,
        index,
        eotp,
        paramsHash: ONEWallet.computeAmountHash,
        commitParams: { amount: newLimit },
        revealParams: {
          amount: newLimit.toString(),
          operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT
        },
        wallet
      })
      const spendingState = await wallet.getSpendingState()
      Logger.debug(spendingState)
      Logger.debug(tx)
      assert.equal(spendingState.spendingLimit.toString(), ONE_DIME.toString(), 'New limit still should be 0.1 ETH')
    }
    {
      await TestUtil.increaseTime(60)
      const newLimit = ONE_ETH.muln(2)
      const now = Date.now() + 240000
      const tOtpCounter = Math.floor(now / INTERVAL)
      const treeIndex = tOtpCounter % 6
      const otpb = ONEUtil.genOTP({ seed, counter: tOtpCounter, n: 6 })
      const otps = []
      for (let i = 0; i < 6; i++) {
        otps.push(otpb.subarray(i * 4, i * 4 + 4))
      }
      const index = ONEUtil.timeToIndex({ time: now, effectiveTime, interval: INTERVAL6 })
      const eotp = await ONEWallet.computeInnerEOTP({ otps })
      const { tx } = await TestUtil.commitReveal({
        Debugger,
        layers: innerTrees[treeIndex].layers,
        index,
        eotp,
        paramsHash: ONEWallet.computeAmountHash,
        commitParams: { amount: newLimit },
        revealParams: {
          amount: newLimit.toString(),
          operationType: ONEConstants.OperationType.JUMP_SPENDING_LIMIT
        },
        wallet
      })
      const spendingState = await wallet.getSpendingState()
      Logger.debug(spendingState)
      Logger.debug(tx)
      assert.equal(spendingState.spendingLimit.toString(), newLimit.toString(), 'New limit still should be 2 ETH')
    }
  })
})
