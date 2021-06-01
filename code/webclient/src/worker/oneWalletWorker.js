const { generateWallet } = require('../../../lib/wallet')

onmessage = function (event) {
  const { otpSeed, merkleTreeDepth, otpInterval, effectiveTime } = event.data
  if (!otpSeed) {
    // console.log('worker: received event but it has no valid data', event)
    return
  }
  console.log('worker: generating wallet:', event.data)
  console.log(wallet)
  const wallet = generateWallet(
    otpSeed, merkleTreeDepth, otpInterval, effectiveTime,
    (current, total) => {
      postMessage({ status: 'working', current: current, total: total })
    })
  console.log('worker: done')
  postMessage({ status: 'done', wallet })
}
