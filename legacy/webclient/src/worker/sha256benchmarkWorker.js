import sha256 from 'fast-sha256'

onmessage = function (event) {
  const { id, beginIndex, endIndex, workerData, workerResult } = event.data
  // console.log(id, 'received', endIndex - beginIndex)
  const decoder = new TextDecoder()
  const workerDataView = new Uint8Array(workerData)
  const workerResultView = new Uint8Array(workerResult)
  for (let i = 0; i < endIndex - beginIndex; i += 1) {
    const a = workerDataView.subarray(i * 32, i * 32 + 32)
    const r = sha256(a)
    const r2 = sha256(r)
    workerResultView.set(r2, i * 32)
  }
  postMessage({ id, workerData, workerResult }, [workerData, workerResult])
}
