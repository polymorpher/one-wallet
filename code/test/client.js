const ONEUtil = require('../lib/util')
const ONE = require('../lib/onewallet')
const INTERVAL = 30000
const DURATION = INTERVAL * 8
const { Logger, createWallet } = require('./util')
const ONEConstants = require('../lib/constants')
const unit = require('ethjs-unit')

const ONE_ETH = unit.toWei('1', 'ether')
const ONE_CENT = unit.toWei('0.01', 'ether')
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
        leaves: ONEUtil.hexString(leaves),
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
    const counterOffset = 3
    const otp = ONEUtil.genOTP({ seed, counter: counter + counterOffset })
    const recovered = await ONE.recoverRandomness({ hseed, otp, randomness: 16, hasher: ONEUtil.argon2, leaf: leaves.subarray(counterOffset * 32, counterOffset * 32 + 32) })
    // console.log(recovered, randomnessResults[counterOffset])
    assert.equal(recovered, randomnessResults[counterOffset], 'Controlled Randomness must be recovered')
  })

  const transferTest = async ({ hasher = ONEUtil.sha256b }) => {
    const effectiveTime = Math.floor(Date.now() / INTERVAL) * INTERVAL - DURATION / 2
    const randomness = 16
    const purse = web3.eth.accounts.create()

    const {
      seed,
      seed2,
      hseed,
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
      effectiveTime,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: ONEConstants.EmptyAddress,
      dailyLimit: ONE_ETH,
      randomness,
      hasher,
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

    const otp = ONEUtil.genOTP({ seed })
    const otp2 = ONEUtil.genOTP({ seed: seed2 })
    const index = ONEUtil.timeToIndex({ effectiveTime })
    const leaf = leaves.subarray(index * 32, index * 32 + 32)
    Logger.debug(`otp=${ONEUtil.decodeOtp(otp)} otp2=${ONEUtil.decodeOtp(otp2)} index=${index}. Recovering rand...`)
    const rand = await ONE.recoverRandomness({ hseed, otp, otp2, randomness, hasher, leaf })
    Logger.debug(`rand=${rand} recovered`)
    assert.ok(rand !== null, 'Recover randomness must succeed')
    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]
    const eotp = await ONE.computeEOTP({ otp, otp2, rand, hseed, hasher })
    Logger.debug(`eotp=${ONEUtil.hexString(eotp)} SHA256(eotp)=${ONEUtil.hexString(ONEUtil.sha256(eotp))} leaf=${ONEUtil.hexString(leaf)}`)
    assert.ok(ONEUtil.bytesEqual(ONEUtil.sha256(eotp), leaf), 'SHA256(EOTP) must be leaf')
    const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
    const { hash: paramsHash } = ONE.computeTransferHash({ dest: purse.address, amount: ONE_CENT.divn(2) })
    const { hash: verificationHash } = ONE.computeVerificationHash({ paramsHash, eotp })
    const neighborsEncoded = neighbors.map(ONEUtil.hexString)
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: wallet.address,
      value: ONE_CENT
    })
    Logger.debug(`Deposited ${ONE_CENT.toString()} wei`)
    await wallet.commit(ONEUtil.hexString(commitHash), ONEUtil.hexString(paramsHash), ONEUtil.hexString(verificationHash))
    const tx = await wallet.reveal(
      neighborsEncoded, index, ONEUtil.hexString(eotp),
      ONEConstants.OperationType.TRANSFER, ONEConstants.TokenType.NONE, ONEConstants.EmptyAddress, 0, purse.address, ONE_CENT.divn(2), '0x'
    )
    Logger.debug('tx=', tx)
    assert.ok(tx.tx, 'Transaction must succeed')
    const walletBalance = await web3.eth.getBalance(wallet.address)
    const purseBalance = await web3.eth.getBalance(purse.address)
    assert.equal(ONE_CENT.divn(2).toString(), walletBalance, `Wallet must have correct balance: ${ONE_CENT.divn(2)}`)
    assert.equal(ONE_CENT.divn(2).toString(), purseBalance, `Purse must have correct balance: ${ONE_CENT.divn(2)}`)
  }

  it('Client_Transfer: must compute EOTP correctly and complete transfer, using double OTP + argon2', async () => {
    await transferTest({ hasher: ONEUtil.sha256b })
  })

  it('Client_Transfer: must compute EOTP correctly and complete transfer, using double OTP + sha256b', async () => {
    await transferTest({ hasher: ONEUtil.argon2 })
  })
})
