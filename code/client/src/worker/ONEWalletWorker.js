const ONE = require('../../../lib/onewallet')

onmessage = function (event) {
  const { seed, effectiveTime, lifespan, slotSize } = event.data
  if (!seed) {
    // console.log('worker: received event but it has no valid data', event)
    return
  }
  console.log('worker: generating wallet:', event.data)

  const {
    hseed,
    leaves,
    root,
    layers,
    maxOperationsPerInterval,
  } = ONE.computeMerkleTree({
    otpSeed: seed,
    effectiveTime,
    duration: lifespan,
    maxOperationsPerInterval: slotSize,
    progressObserver: (current, total, stage) => {
      postMessage({ status: 'working', current: current, total: total, stage })
    }
  })
  console.log('worker: done')
  postMessage({
    status: 'done',
    result: {
      hseed,
      leaves,
      root,
      layers,
      maxOperationsPerInterval,
    }
  })
}
