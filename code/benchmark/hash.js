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
const fs = IS_NODE && require('fs')
const path = require('path')
const openAndResetDB = async (dbName) => {
  dbName = dbName || 'ONEWalletBenchmarkDB'
  if (IS_NODE) {
    const files = fs.readdirSync(dbName)
    files.forEach(f => {
      if (f.endsWith('bin')) {
        fs.unlinkSync(path.join(dbName, f))
      }
    })
    return dbName
  }
  return new Promise((resolve, reject) => {
    const storage = self.indexedDB
    const deleteRequest = storage.deleteDatabase(dbName)
    deleteRequest.onerror = (e) => reject(e.target)
    deleteRequest.onsuccess = () => {
      const r = storage.open(dbName)
      r.onerror = (event) => reject(event.target)
      r.onupgradeneeded = (e2) => {
        const db = e2.target.result
        const s = db.createObjectStore('OTPLeaves')
        s.onsuccess = () => resolve(dbName)
        s.onerror = (e) => reject(e.target)
      }
    }
  })
}

const store = async ({ data, dbName = 'ONEWalletBenchmarkDB', key }) => {
  if (IS_NODE) {
    return new Promise((resolve, reject) => {
      const r = key || Math.random().toString(26).slice(2)
      const f = path.join(dbName, `tmp.${r}.bin`)
      // console.log(data.constructor.name, data.length)
      fs.writeFile(f, data, (err) => {
        err ? reject(err) : resolve(f)
      })
    })
  } else {
    return new Promise((resolve, reject) => {
      const storage = self.indexedDB
      const openRequest = storage.open(dbName)
      openRequest.onerror = (event) => reject(event.target)
      openRequest.onsuccess = (e) => {
        const db = e.target.result
        const tx = db.transaction(['OTPLeaves'], 'readwrite')
        const s = tx.objectStore('OTPLeaves')
        const storeRequest = s.add(data, key)
        storeRequest.onsuccess = (e2) => resolve(e2.target)
        storeRequest.onerror = (e2) => resolve(e2.target)
      }
    })
  }
}

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

const runParallelFastSHA256 = async (data, result, workers, timer = {}) => {
  const numWorkers = workers.length
  const workerResults = new Array(numWorkers)
  const workerDatas = new Array(numWorkers)
  const size = data.length / 32
  const sliceSize = Math.ceil(size / numWorkers)
  for (let i = 0; i < numWorkers; i += 1) {
    const beginIndex = i * sliceSize
    const endIndex = Math.min((i + 1) * sliceSize, size)
    const workerResult = result.subarray(beginIndex * 32, endIndex * 32).slice().buffer
    const workerData = data.subarray(beginIndex * 32, endIndex * 32).slice().buffer
    workerDatas[i] = workerData
    workerResults[i] = workerResult
  }
  console.time('parallelFastSHA256.inner')
  timer.startTime = Date.now()
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

const runNodeParallelFastSHA256 = async (data, result, updater) => {
  let counter = 0 // thread-safe because this is accessed in main thread only
  const numWorkers = os.cpus().length
  const size = data.length / 32
  const sliceSize = Math.ceil(size / numWorkers)
  // Shared data model. Since 25% of users use browsers which don't support this, we are not going to test it for now. This should only affect setup time anyway.
  // const sharedBuffer = new SharedArrayBuffer(data.length)
  // const sharedData = new Uint8Array(sharedBuffer)
  // sharedData.set(data)
  const timer = {}
  const workers = new Array(numWorkers)
  return new Promise((resolve, reject) => {
    for (let i = 0; i < numWorkers; i += 1) {
      workers[i] = new Worker(__dirname + '/nodeWorker.js')
      workers[i].on('message', ({ id, workerResult }) => {
        // console.log(`received result from worker ${id}`)
        // This will slow things down by 30%+. In practice, we will store the results to DB from each worker, instead of aggregating at host.
        // So this should be commented out for benchmarking purposes.
        // result.set(workerResult, 32 * sliceSize * id)
        counter += 1
        if (counter === numWorkers) {
          console.timeEnd('parallelFastSHA256.inner')
          updater('parallelFastSHA256.inner', Date.now() - timer.startTime)
          resolve()
        }
      })
    }
    runParallelFastSHA256(data, result, workers, timer)
  })
}

const runBrowserParallelSHA256 = (data, result, workers, updater) => {
  let counter = 0 // thread-safe because this is accessed in main thread only
  const numWorkers = navigator.hardwareConcurrency
  const size = data.length / 32
  const sliceSize = Math.ceil(size / numWorkers)
  const timer = {}
  return new Promise((resolve, reject) => {
    for (let i = 0; i < numWorkers; i += 1) {
      workers[i].onmessage = (event) => {
        const { id, workerResult } = event.data
        // console.log(`received result from worker ${id}`)
        // This will slow things down by 30%+. In practice, we will store the results to DB from each worker, instead of aggregating at host.
        // So this should be commented out for benchmarking purposes.
        // result.set(workerResult, 32 * sliceSize * id)
        counter += 1
        if (counter === numWorkers) {
          console.timeEnd('parallelFastSHA256.inner')
          updater('parallelFastSHA256.inner', Date.now() - timer.startTime)
          resolve()
        }
      }
    }
    runParallelFastSHA256(data, result, workers, timer)
  })
}

const leftPad = (s, n, char) => {
  if (s.length >= n) {
    return s
  }
  char = char || '0'
  const l = n - s.length + 1
  return s + new Array(l).join(char)
}

const defaultEnabled = {
  parallelFastSHA256: true,
  fastSHA256: true,
  ethersSha256: true,
  ripemd160: true,
  ethersKeccak256: true,
  soliditySha3: true,
  keccak: false,
  SHA3Keccak: false,
}

const runBenchmark = async ({ size, onUpdate, workers, includeIO, seedHash, enabled = {} }) => {
  if (includeIO) {
    openAndResetDB()
  }
  enabled = Object.assign({}, defaultEnabled, enabled)
  const rawData = new ArrayBuffer(size * 32)
  const data = new Uint8Array(rawData)
  const encoder = new TextEncoder()
  seedHash = seedHash || fastSHA256(encoder.encode('123'))
  console.log('Running benchmark with following config:', { size, onUpdate, workers, includeIO, seedHash, enabled })
  onUpdate && onUpdate(`Running benchmark with following config: ${JSON.stringify({
    size,
    onUpdate,
    numWorkers: workers.length,
    includeIO,
    seedHash: '0x' + seedHash.map(x => x.toString(16).padStart(2, '0')).join(''),
    enabled
  })}`)
  const seedHashTruncated = seedHash.slice(0, 26)
  for (let i = 0; i < size; i++) {
    const paddedCode = leftPad(`${i}`, 6)
    const encodedCode = encoder.encode(paddedCode)
    const b = new Uint8Array(32)
    b.set(seedHashTruncated)
    b.set(encodedCode, seedHashTruncated.length)
    data.set(b, i * 32)
  }

  const result = new Uint8Array(new ArrayBuffer(size * 32))

  enabled.parallelFastSHA256 && await timer('parallelFastSHA256', async () => {
    if (typeof navigator === 'undefined') {
      await runNodeParallelFastSHA256(data, result, onUpdate)
    } else {
      await runBrowserParallelSHA256(data, result, workers, onUpdate)
    }
    if (includeIO) {
      await timer('parallelFastSHA256.io', async () => {
        await store({ data: result, key: 'parallelFastSHA256' })
      }, onUpdate)
    }
  }, onUpdate)

  enabled.parallelFastSHA256 && await timer('fastSHA256', async () => {
    await asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r0 = fastSHA256(d)
        const r = fastSHA256(r0)
        result.set(r, i * 32)
      }
    })
    if (includeIO) {
      await timer('fastSHA256.io', async () => {
        await store({ data: result, key: 'fastSHA256' })
      }, onUpdate)
    }
  }, onUpdate)
  //
  enabled.ethersSha256 && await timer('ethersSha256', async () => {
    await new Promise((resolve, reject) => {
      for (let i = 0; i < size; i++) {
        const r = ethers.utils.sha256(Buffer.from(data.subarray(i * 32, i * 32 + 32).slice()))
        result.set(Buffer.from(r.slice(2), 'hex'), i * 32)
      }
      resolve()
    })
    if (includeIO) {
      await timer('ethersSha256.io', async () => {
        await store({ data: result, key: 'ethersSha256' })
      }, onUpdate)
    }
  }, onUpdate)
  // // //
  enabled.ripemd160 && await timer('ripemd160', async () => {
    await asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const ripemd160 = new RIPEMD160()
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const b = Buffer.from(d)
        const r = ripemd160.update(b).digest()
        const ripemd160Step2 = new RIPEMD160()
        const r2 = ripemd160Step2.update(b).digest()
        result.set(r2, i * 32)
      }
    })
    if (includeIO) {
      await timer('ripemd160.io', async () => {
        await store({ data: result, key: 'ripemd160' })
      }, onUpdate)
    }
  }, onUpdate)
  // //
  enabled.ethersKeccak256 && await timer('ethersKeccak256', async () => {
    await asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = ethers.utils.keccak256(Buffer.from(d))
        const r2 = ethers.utils.keccak256(Buffer.from(r.slice(2), 'hex'))
        result.set(Buffer.from(r2.slice(2), 'hex'), i * 32)
      }
    })
    if (includeIO) {
      await timer('ethersKeccak256.io', async () => {
        await store({ data: result, key: 'ethersKeccak256' })
      }, onUpdate)
    }
  }, onUpdate)
  // // // //
  const decoder = IS_NODE ? new util.TextDecoder() : new TextDecoder()
  enabled.soliditySha3 && await timer('soliditySha3', async () => {
    await asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = soliditySha3({ v: decoder.decode(d), t: 'bytes' })
        const d2 = Buffer.from(r.slice(2), 'hex')
        const r2 = soliditySha3({ v: r.slice(2), t: 'bytes' })
        result.set(Buffer.from(r2.slice(2), 'hex'), i * 32)
      }
    })
    if (includeIO) {
      await timer('soliditySha3.io', async () => {
        await store({ data: result, key: 'soliditySha3' })
      }, onUpdate)
    }
  }, onUpdate)
  // // // //
  enabled.keccak && await timer('keccak', async () => {
    await asyncWrapper(() => {
      for (let i = 0; i < size; i++) {
        const keccakInstace = createKeccakHash('keccak256')
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = keccakInstace.update(Buffer.from(d)).digest()
        const keccakInstace2 = createKeccakHash('keccak256')
        const r2 = keccakInstace2.update(Buffer.from(r)).digest()
        result.set(r2, i * 32)
      }
    })
    if (includeIO) {
      await timer('keccak.io', async () => {
        await store({ data: result, key: 'keccak' })
      }, onUpdate)
    }
  }, onUpdate)
  // // // //
  enabled.SHA3Keccak && await timer('SHA3Keccak', async () => {
    await asyncWrapper(() => {
      const hash = new SHA3Keccak(256)
      for (let i = 0; i < size; i++) {
        const d = data.subarray(i * 32, i * 32 + 32).slice()
        const r = hash.update(Buffer.from(d)).digest()
        const r2 = hash.update(Buffer.from(r)).digest()
        result.set(r2, i * 32)
      }
    })
    if (includeIO) {
      await timer('SHA3Keccak.io', async () => {
        await store({ data: result, key: 'SHA3Keccak' })
      }, onUpdate)
    }
  }, onUpdate)
}

module.exports = { runBenchmark }
