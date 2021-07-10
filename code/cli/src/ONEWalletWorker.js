import ONE from '../../lib/onewallet'
import { parentPort } from 'worker_threads'

parentPort.once('message', ({ seed, effectiveTime, duration, slotSize, interval } = {}) => {
  if (!seed) {
    console.log('Worker: received event but it has no valid data')
    return
  }
  // console.log('Worker: generating wallet:', { seed, effectiveTime, duration, slotSize, interval })

  const {
    hseed,
    leaves,
    root,
    layers,
    maxOperationsPerInterval,
  } = ONE.computeMerkleTree({
    otpSeed: seed,
    effectiveTime,
    duration,
    maxOperationsPerInterval: slotSize,
    otpInterval: interval,
    progressObserver: (current, total, stage) => {
      parentPort.postMessage({ status: 'working', current: current, total: total, stage })
    }
  })
  // console.log('Worker: done')
  parentPort.postMessage({
    status: 'done',
    result: {
      hseed,
      leaves,
      root,
      layers,
      maxOperationsPerInterval,
    }
  }, layers.map(e => e.buffer))
})
