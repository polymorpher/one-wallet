import { runBenchmark } from '../../../benchmark/hash'
onmessage = function (event) {
  const { action, caller, size } = event.data
  console.log(event.data)
  if (caller !== 'ONEWallet') {
    return
  }
  if (action === 'runBenchmark') {
    const subworkers = []
    for (let i = 0; i < navigator.hardwareConcurrency; i += 1) {
      subworkers.push(new Worker('sha256benchmarkWorker.js'))
    }
    runBenchmark(size, (key, time) => {
      postMessage({ key, time })
    }, subworkers)
  }
}
