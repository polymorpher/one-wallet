const { soliditySha3, padRight } = require('web3-utils')
const ethers = require('ethers')
const fastSHA256 = require('fast-sha256')
const createKeccakHash = require('keccak')
const { Keccak: SHA3Keccak } = require('sha3')
const RIPEMD160 = require('ripemd160')

const IS_NODE = (typeof navigator === 'undefined')
const os = IS_NODE && require('os')
const { Worker } = IS_NODE ? require('worker_threads') : {}
const util = IS_NODE && require('util')

const timer = async (key, func, reporter) => {
  const t0 = Date.now()
  console.time(key)
  await func()
  console.timeEnd(key)
  const t1 = Date.now()
  if (reporter) {
    reporter(key, t1 - t0)
  }
  return t1 - t0
}
const asyncWrapper = (f) => {
  return new Promise((resolve, reject) => {
    try {
      f()
      resolve()
    } catch (ex) {
      reject(ex)
    }
  })
}

const runParallelFastSHA256 = async (data, result, workers) => {
  const numWorkers = workers.length
  const workerResults = new Array(numWorkers)
  const workerDatas = new Array(numWorkers)
  const size = data.length / 32
  for (let i = 0; i < numWorkers; i += 1) {
    const sliceSize = Math.ceil(size / numWorkers)
    const beginIndex = i * sliceSize
    const endIndex = Math.min((i + 1) * sliceSize, size)
    const workerResult = result.subarray(beginIndex * 32, endIndex * 32).slice().buffer
    const workerData = data.subarray(beginIndex * 32, endIndex * 32).slice().buffer
    workerDatas[i] = workerData
    workerResults[i] = workerResult
  }
  console.time('parallelFastSHA256.inner')
  for (let i = 0; i < numWorkers; i += 1) {
    const sliceSize = Math.ceil(size / numWorkers)
    const beginIndex = i * sliceSize
    const endIndex = Math.min((i + 1) * sliceSize, size)
    workers[i].postMessage({
      id: i,
      beginIndex,
      endIndex,
      workerData: workerDatas[i],
      workerResult: workerResults[i]
    }, [workerDatas[i], workerResults[i]])
  }
}

const runNodeParallelFastSHA256 = async (data, result) => {
  let counter = 0 // thread-safe because this is accessed in main thread only
  const numWorkers = os.cpus().length

  // Shared data model. Since 25% of users use browsers which don't support this, we are not going to test it for now. This should only affect setup time anyway.
  // const sharedBuffer = new SharedArrayBuffer(data.length)
  // const sharedData = new Uint8Array(sharedBuffer)
  // sharedData.set(data)
  const workers = new Array(numWorkers)
  return new Promise((resolve, reject) => {
    for (let i = 0; i < numWorkers; i += 1) {
      workers[i] = new Worker(__dirname + '/nodeWorker.js')
      workers[i].on('message', ({ id }) => {
        // console.log(`received result from worker ${id}`)
        counter += 1
        if (counter === numWorkers) {
          console.timeEnd('parallelFastSHA256.inner')
          resolve()
        }
      })
    }
    runParallelFastSHA256(data, result, workers)
  })
}

const runBrowserParallelSHA256 = (data, result, workers) => {
  let counter = 0 // thread-safe because this is accessed in main thread only
  const numWorkers = navigator.hardwareConcurrency
  const size = data.length / 32
  return new Promise((resolve, reject) => {
    for (let i = 0; i < numWorkers; i += 1) {
      workers[i].onmessage = (event) => {
        const { id } = event.data
        // console.log(`received result from worker ${id}`)
        counter += 1
        if (counter === numWorkers) {
          console.timeEnd('parallelFastSHA256.inner')
          resolve()
        }
      }
    }
    runParallelFastSHA256(data, result, workers)
  })
}

const runBenchmark = async (size, onUpdate, workers) => {
  const rawData = new ArrayBuffer(size * 32)
  const data = new Uint8Array(rawData)
  const encoder = new TextEncoder()
  for (let i = 0; i < size; i++) {
    const d = padRight(`${i}`, 32)
    const a = encoder.encode(d)
    // console.log(a.length, a.constructor.name)
    for (let j = 0; j < a.length; j++) {
      data[i * 32 + j] = a[j]
    }
  }

  const result = new Uint8Array(new ArrayBuffer(size * 32))

  await timer('parallelFastSHA256', async () => {
    if (typeof navigator === 'undefined') {
      // node.js
      await runNodeParallelFastSHA256(data, result)
    } else {
      await runBrowserParallelSHA256(data, result, workers)
      // throw new Error('Not supported')
    }
  }, onUpdate)

  await timer('fastSHA256', async () => {
    return asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const r = fastSHA256(data.subarray(i * 32, i * 32 + 32).slice())
        result.set(r, i * 32)
      }
    })
  }, onUpdate)
  //
  await timer('ethers.sha256', () => {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < size; i++) {
        const r = ethers.utils.sha256(Buffer.from(data.subarray(i * 32, i * 32 + 32).slice()))
        result.set(Buffer.from(r.slice(2), 'hex'), i * 32)
      }
      resolve()
    })
  }, onUpdate)
  // //
  await timer('ripemd160', () => {
    return asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const ripemd160 = new RIPEMD160()
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = ripemd160.update(Buffer.from(d)).digest()
        result.set(r, i * 32)
      }
    })
  })
  //
  await timer('ethers.keccak256', () => {
    return asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = ethers.utils.keccak256(Buffer.from(d))
        result.set(Buffer.from(r.slice(2), 'hex'), i * 32)
      }
    })
  }, onUpdate)
  // //
  console.log(IS_NODE)
  const decoder = IS_NODE ? new util.TextDecoder() : new TextDecoder()
  await timer('soliditySha3', () => {
    return asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = soliditySha3({ v: decoder.decode(d), t: 'bytes' })
        result.set(Buffer.from(r.slice(2), 'hex'), i * 32)
      }
    })
  }, onUpdate)
  // //
  await timer('keccak', () => {
    return asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const keccakInstace = createKeccakHash('keccak256')
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = keccakInstace.update(Buffer.from(d)).digest()
        result.set(r, i * 32)
      }
    })
  }, onUpdate)
  // //
  await timer('SHA3Keccak', () => {
    return asyncWrapper(() => {
      const hash = new SHA3Keccak(256)
      for (let i = 0; i < size; i++) {
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = hash.update(Buffer.from(d)).digest()
        result.set(r, i * 32)
      }
    })
  }, onUpdate)
}

module.exports = { runBenchmark }
