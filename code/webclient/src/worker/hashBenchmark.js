import { runBenchmark } from '../../../benchmark/hash'
onmessage = function (event) {
  const { action, caller, size } = event.data
  console.log(event.data)
  if (caller !== 'ONEWallet') {
    return
  }
  if (action === 'runBenchmark') {
    runBenchmark(size, (key, time) => {
      postMessage({ key, time })
    })
  }
}
