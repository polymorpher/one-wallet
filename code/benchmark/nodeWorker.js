const { Worker, parentPort } = require('worker_threads')
const fastSHA256 = require('fast-sha256')
const util = require('util')

parentPort.once('message', ({ id, beginIndex, endIndex, workerData, workerResult }) => {
  // console.log(id, 'received', endIndex - beginIndex)
  const decoder = new util.TextDecoder()
  const workerDataView = new Uint8Array(workerData)
  const workerResultView = new Uint8Array(workerResult)
  for (let i = 0; i < endIndex - beginIndex; i += 1) {
    const a = workerDataView.subarray(i * 32, i * 32 + 32)
    const r = fastSHA256(a)
    const r2 = fastSHA256(r)
    workerResultView.set(r2, i * 32)
  }
  // console.log(id, 'done')
  parentPort.postMessage({ id, workerData, workerResult }, [workerData, workerResult])
})
