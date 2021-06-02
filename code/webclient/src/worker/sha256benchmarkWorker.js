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
    for (let j = 0; j < r.length; j++) {
      workerResultView[i * 32 + j] = r[j]
    }
  }
  postMessage({ id }, [workerData, workerResult])
}

