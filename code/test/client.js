const ONEUtil = require('../lib/util')
const ONE = require('../lib/onewallet')
const INTERVAL = 30000
const DURATION = INTERVAL * 8
const { Logger, createWallet } = require('./util')
const ONEConstants = require('../lib/constants')
const unit = require('ethjs-unit')

const ONE_ETH = unit.toWei('1', 'ether')
const SLOT_SIZE = 1

contract('ONEWallet', (accounts) => {
  // 2021-06-13T03:55:00.000Z

  const EFFECTIVE_TIME = Math.floor(1623556500000 / INTERVAL) * INTERVAL - DURATION / 2
  it('must generate consistent, recoverable randomness', async () => {
    const {
      seed,
      hseed,
      counter,
      randomnessResults,
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
      } } = await createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: ONEConstants.EmptyAddress,
      dailyLimit: ONE_ETH,
      randomness: 16,
    })
    Logger.debug({
      seed,
      hseed,
      randomnessResults,
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
    const { randomnessResults: randomnessResults2 } = await createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: ONEConstants.EmptyAddress,
      dailyLimit: ONE_ETH,
      randomness: 16,
    })
    for (let i = 0; i < randomnessResults.length; i++) {
      assert.equal(randomnessResults[i], randomnessResults2[i], 'Randomness must be consistent when the same seed is given')
    }
    const recoveredList = []
    for (let i = 0; i < leaves.length / 32; i++) {
      const otp = ONEUtil.genOTP({ seed, counter: counter + i })
      const recovered = await ONE.recoverRandomness({ hseed, otp, randomness: 16, hasher: ONEUtil.sha256b, leaf: leaves.subarray(i * 32, i * 32 + 32) })
      recoveredList.push(recovered)
    }
    assert.deepEqual(recoveredList, randomnessResults, 'Controlled Randomness must be recovered')
  })

  it('must generate consistent, recoverable randomness with double OTP', async () => {
    const {
      seed,
      seed2,
      hseed,
      counter,
      randomnessResults,
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
      } } = await createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: ONEConstants.EmptyAddress,
      dailyLimit: ONE_ETH,
      randomness: 16,
      doubleOtp: true,
    })
    Logger.debug({
      seed,
      seed2,
      hseed,
      randomnessResults,
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
    const { randomnessResults: randomnessResults2 } = await createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: ONEConstants.EmptyAddress,
      dailyLimit: ONE_ETH,
      randomness: 16,
    })
    for (let i = 0; i < randomnessResults.length; i++) {
      assert.equal(randomnessResults[i], randomnessResults2[i], 'Randomness must be consistent when the same seed is given')
    }
    const recoveredList = []
    for (let i = 0; i < leaves.length / 32; i++) {
      const otp = ONEUtil.genOTP({ seed, counter: counter + i })
      const otp2 = ONEUtil.genOTP({ seed: seed2, counter: counter + i })
      const recovered = await ONE.recoverRandomness({ hseed, otp, otp2, randomness: 16, hasher: ONEUtil.sha256b, leaf: leaves.subarray(i * 32, i * 32 + 32) })
      recoveredList.push(recovered)
    }
    assert.deepEqual(recoveredList, randomnessResults, 'Controlled Randomness must be recovered')
  })

  it('must generate consistent, recoverable randomness with argon2', async () => {
    const {
      seed,
      hseed,
      counter,
      randomnessResults,
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
      } } = await createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: ONEConstants.EmptyAddress,
      dailyLimit: ONE_ETH,
      randomness: 16,
      hasher: ONEUtil.argon2
    })
    Logger.debug({
      seed,
      hseed,
      randomnessResults,
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
    const { randomnessResults: randomnessResults2 } = await createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: ONEConstants.EmptyAddress,
      dailyLimit: ONE_ETH,
      randomness: 16,
      hasher: ONEUtil.argon2
    })
    for (let i = 0; i < randomnessResults.length; i++) {
      assert.equal(randomnessResults[i], randomnessResults2[i], 'Randomness must be consistent when the same seed is given')
    }
    const otp = ONEUtil.genOTP({ seed, counter: counter })
    const recovered = await ONE.recoverRandomness({ hseed, otp, randomness: 16, hasher: ONEUtil.argon2, leaf: leaves.subarray(0, 32) })

    assert.equal(recovered, randomnessResults[0], 'Controlled Randomness must be recovered')
  })
})
