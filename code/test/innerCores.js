const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEDebugger = require('../lib/debug')
const ONEWallet = require('../lib/onewallet')
const ONEConstants = require('../lib/constants')
const BN = require('bn.js')
const INTERVAL = 30000
const SLOT_SIZE = 1

const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)
const NOW = Math.floor(Date.now() / (INTERVAL)) * INTERVAL - 5000

contract('ONEWallet', (accounts) => {
  const ONE_ETH = unit.toWei('1', 'ether')
  const ONE_DIME = unit.toWei('0.1', 'ether')
  const MULTIPLES = process.env.LIGHT ? [24] : [24, 26, 28, 30, 32, 34, 36]
  const DURATIONS = MULTIPLES.map(e => INTERVAL * e) // need to be greater than 16 to trigger innerCore generations
  const EFFECTIVE_TIMES = DURATIONS.map(d => Math.floor(NOW / INTERVAL) * INTERVAL - d / 2)
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
  })

  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })
  const testForTime = async (multiple, effectiveTime, duration, seedBase = '0xdeadbeef1234567890023456789012', numTrees = 6, checkDisplacementSuccess = false) => {
    console.log('testing:', { multiple, effectiveTime, duration })
    const purse = web3.eth.accounts.create()
    const creationSeed = '0x' + (new BN(ONEUtil.hexStringToBytes(seedBase)).addn(duration).toString('hex'))
    const creationPackage = await TestUtil.createWallet({
      seed: creationSeed,
      effectiveTime,
      duration,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    })
    const {
      wallet,
      seed,
      client: { innerTrees, },
    } = creationPackage

    TestUtil.printInnerTrees({ Debugger, innerTrees })
    const newSeed = '0xdeedbeaf1234567890123456789012'
    const newEffectiveTime = Math.floor(NOW / INTERVAL / 6) * INTERVAL * 6
    const { core: newCore, innerCores: newInnerCores, identificationKeys: newKeys, vars: { seed: newComputedSeed, hseed: newHseed, client: { layers: newLayers } } } = await TestUtil.makeCores({
      seed: newSeed,
      effectiveTime: newEffectiveTime,
      duration: duration,
    })
    const data = ONEWallet.encodeDisplaceDataHex({ core: newCore, innerCores: newInnerCores, identificationKey: newKeys[0] })

    const tOtpCounter = Math.floor(NOW / INTERVAL)
    const baseCounter = Math.floor(tOtpCounter / 6) * 6
    for (let c = 0; c < numTrees; c++) {
      console.log(`tOtpCounter=${tOtpCounter} baseCounter=${baseCounter} c=${c}`)
      const otpb = ONEUtil.genOTP({ seed, counter: baseCounter + c, n: 6 })
      const otps = []
      for (let i = 0; i < 6; i++) {
        otps.push(otpb.subarray(i * 4, i * 4 + 4))
      }
      const innerEffectiveTime = Math.floor(effectiveTime / (INTERVAL * 6)) * (INTERVAL * 6)
      const innerExpiryTime = innerEffectiveTime + Math.floor(duration / (INTERVAL * 6)) * (INTERVAL * 6)
      assert.isBelow(NOW, innerExpiryTime, 'Current time must be greater than inner expiry time')
      const index = ONEUtil.timeToIndex({ time: NOW, effectiveTime: innerEffectiveTime, interval: INTERVAL * 6 })
      const eotp = await ONEWallet.computeInnerEOTP({ otps })
      // const treeIndex = Math.floor((NOW - effectiveTime) / INTERVAL) % 6
      const treeIndex = c
      Logger.debug({
        otps: otps.map(e => {
          const r = new DataView(new Uint8Array(e).buffer)
          return r.getUint32(0, false)
        }),
        eotp: ONEUtil.hexString(eotp),
        index,
        treeIndex
      })
      Debugger.printLayers({ layers: innerTrees[treeIndex].layers })

      const { tx, authParams, revealParams } = await TestUtil.commitReveal({
        Debugger,
        layers: innerTrees[treeIndex].layers,
        index,
        eotp,
        paramsHash: ONEWallet.computeDataHash,
        commitParams: { data: ONEUtil.hexStringToBytes(data) },
        revealParams: { data, operationType: ONEConstants.OperationType.DISPLACE },
        wallet
      })
      const successLog = tx.logs.find(log => log.event === 'CoreDisplaced') || tx.receipt.rawLogs.find(log => log.topics.includes('0x0b6dd4942da3070d72e5249990ad2b2703efd3f3a99c79cd0ce1a8eb50f8fdf4'))
      if (checkDisplacementSuccess && !successLog) {
        console.error(tx, authParams, revealParams)
        console.log(tx.receipt.rawLogs)
        throw new Error('CoreDisplaced log missing')
      }
    }
    return { wallet, newCore, newInnerCores, newKeys, newSeed: newComputedSeed, newEffectiveTime, newHseed, newLayers }
    // assert.equal(ONE_CENT, balance, 'Wallet has correct balance')
  }
  it('InnerCores_Displace: must allow displace operation using 6x6 otps for different durations', async () => {
    for (let i = 0; i < MULTIPLES.length; i++) {
      await testForTime(MULTIPLES[i], EFFECTIVE_TIMES[i], DURATIONS[i])
    }
  })
  it('InnerCores_New: must authenticate otp from new core after displacement', async () => {
    const { wallet, newSeed, newEffectiveTime, newHseed, newLayers } = await testForTime(MULTIPLES[0], EFFECTIVE_TIMES[0], DURATIONS[0], '0xdeadbeef1234567890123456789012', 1, true)
    console.log('newSeed', newSeed)
    const counter = Math.floor(NOW / INTERVAL)
    const otp = ONEUtil.genOTP({ seed: newSeed, counter })
    const index = ONEUtil.timeToIndex({ time: NOW, effectiveTime: newEffectiveTime })
    const eotp = await ONEWallet.computeEOTP({ otp, hseed: newHseed })
    const purse = web3.eth.accounts.create()

    // const info = await wallet.getInfo()
    // console.log(info)
    // const oldInfos = await wallet.getOldInfos()
    // console.log(oldInfos)
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: ONE_DIME
    })
    const { tx, authParams, revealParams } = await TestUtil.commitReveal({
      Debugger,
      layers: newLayers,
      index,
      eotp,
      paramsHash: ONEWallet.computeTransferHash,
      commitParams: { dest: purse.address, amount: (ONE_DIME / 2).toString() },
      revealParams: { dest: purse.address, amount: (ONE_DIME / 2).toString(), operationType: ONEConstants.OperationType.TRANSFER },
      wallet
    })

    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(ONE_DIME / 2, purseBalance, 'Purse has correct balance')
  })
})
