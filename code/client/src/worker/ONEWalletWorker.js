const ONE = require('../../../lib/onewallet')
const ONEUtil = require('../../../lib/util')

onmessage = async function (event) {
  const { seed, seed2, effectiveTime, duration, slotSize, interval, randomness, hasher } = event.data
  if (!seed) {
    // console.log('worker: received event but it has no valid data', event)
    return
  }
  console.log('worker: generating wallet:', event.data)

  const {
    hseed,
    doubleOtp,
    leaves,
    root,
    layers,
    maxOperationsPerInterval,
  } = await ONE.computeMerkleTree({
    otpSeed: seed,
    otpSeed2: seed2,
    effectiveTime,
    duration,
    randomness,
    hasher: ONEUtil.getHasher(hasher),
    maxOperationsPerInterval: slotSize,
    otpInterval: interval,
    progressObserver: (current, total, stage) => {
      postMessage({ status: 'working', current: current, total: total, stage })
    }
  })
  console.log('worker: done')
  postMessage({
    status: 'done',
    result: {
      hseed,
      doubleOtp,
      leaves,
      root,
      layers,
      maxOperationsPerInterval,
    }
  })
}
