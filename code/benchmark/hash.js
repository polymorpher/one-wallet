const { soliditySha3, padRight } = require('web3-utils')
const ethers = require('ethers')
const fastSHA256 = require('fast-sha256')
const createKeccakHash = require('keccak')
const { Keccak: SHA3Keccak } = require('sha3')

const timer = (key, func, reporter) => {
  const t0 = Date.now()
  console.time(key)
  func()
  console.timeEnd(key)
  const t1 = Date.now()
  if (reporter) {
    reporter(key, t1 - t0)
  }
  return t1 - t0
}
const runBenchmark = async (size, onUpdate) => {
  const data = []
  const rawData = []
  for (let i = 0; i < size; i++) {
    const d = padRight(`${i}`, 32)
    rawData.push(d)
    data.push(Buffer.from(d))
  }
  const result = new Array(size)

  timer('fastSHA256', () => {
    for (let i = 0; i < size; i++) {
      result[i] = fastSHA256(data[i])
    }
  }, onUpdate)

  timer('ethers.sha256', () => {
    for (let i = 0; i < size; i++) {
      result[i] = ethers.utils.sha256(data[i])
    }
  }, onUpdate)

  // timer('ethers.ripemd160', () => {
  //   for (let i = 0; i < size; i++) {
  //     result[i] = ethers.utils.ripemd160(data[i])
  //   }
  // }, onUpdate)

  timer('ethers.keccak256', () => {
    for (let i = 0; i < size; i++) {
      result[i] = ethers.utils.keccak256(data[i])
    }
  }, onUpdate)

  timer('soliditySha3', () => {
    for (let i = 0; i < size; i++) {
      result[i] = soliditySha3({ v: rawData[i], t: 'bytes' })
    }
  }, onUpdate)

  timer('keccak', () => {
    for (let i = 0; i < size; i++) {
      const keccakInstace = createKeccakHash('keccak256')
      result[i] = keccakInstace.update(data[i]).digest('hex')
    }
  }, onUpdate)

  timer('SHA3Keccak', () => {
    const hash = new SHA3Keccak(256)
    for (let i = 0; i < size; i++) {
      result[i] = hash.update(data[i]).digest('hex')
    }
  }, onUpdate)
}

module.exports = { runBenchmark }
