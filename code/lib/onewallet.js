const JSSHA = require('jssha')
const fastSHA256 = require('fast-sha256')
const base32 = require('hi-base32')
const { hexView } = require('./util')

const genOTP = ({ seed, counter = Math.floor(Date.now() / 30000), n = 1, progressObserver }) => {
  const reportInterval = Math.floor(n / 100)
  const jssha = new JSSHA('SHA-1', 'UINT8ARRAY')
  jssha.setHMACKey(seed)
  const codes = new Uint8Array(n * 4)
  const v = new DataView(codes.buffer)
  const b = new DataView(new ArrayBuffer(8))
  for (let i = 0; i < n; i += 1) {
    const t = counter + i
    b.setUint32(4, t, false)
    jssha.update(new Uint8Array(b.buffer))
    const h = jssha.getHMAC('UINT8ARRAY')
    const p = h[h.length - 1] & 0x0f
    const x1 = (h[p] & 0x7f) << 24
    const x2 = (h[p + 1] & 0xff) << 16
    const x3 = (h[p + 2] & 0xff) << 8
    const x4 = (h[p + 3] & 0xff)
    const c = x1 | x2 | x3 | x4
    const r = c % 1000000
    v.setUint32(i * 4, r, false)
    if (progressObserver) {
      if (i % reportInterval === 0) {
        progressObserver(i, n, 0)
      }
    }
  }
  return codes
}

const computeMerkleTree = ({ otpSeed, effectiveTime = Date.now(), duration = 3600 * 1000 * 24 * 365, progressObserver, otpInterval = 30000 }) => {
  const height = Math.ceil(Math.log2(duration / otpInterval))
  const n = Math.pow(2, height)
  const reportInterval = Math.floor(n / 100)
  const counter = effectiveTime / otpInterval
  let seed = otpSeed
  if (seed.constructor.name !== 'Uint8Array') {
    if (typeof seed !== 'string') {
      throw new Error('otpSeed must be either string (Base32 encoded) or Uint8Array')
    }
    const bn = base32.decode.asBytes(seed)
    seed = new Uint8Array(bn)
  }
  seed = seed.slice(0, 20)
  console.log('Generating Wallet with parameters', { seed, height, otpInterval, effectiveTime })
  const otps = genOTP({ seed: otpSeed, counter, n, progressObserver })
  const hseed = fastSHA256(seed).slice(0, 28)
  const leaves = new Uint8Array(n * 32)
  const buffer = new Uint8Array(32)
  const layers = []
  // TODO: parallelize this
  for (let i = 0; i < n; i++) {
    buffer.set(hseed)
    const otp = otps.subarray(i * 4, i * 4 + 4)
    buffer.set(otp, hseed.length)
    const h = fastSHA256(buffer)
    const hh = fastSHA256(h)
    leaves.set(hh, i * 32)
    if (progressObserver) {
      if (i % reportInterval === 0) {
        progressObserver(i, n, 1)
      }
    }
  }
  layers.push(leaves)
  for (let j = 1; j <= height; j += 1) {
    const layer = new Uint8Array(n / (2 ** j))
    const lastLayer = layers[j - 1]
    for (let i = 0; i < n / (2 ** j); i += 1) {
      const d = lastLayer.subarray(2 * i * 32, 64)
      const h = fastSHA256(d)
      layer.set(h, i * 32)
    }
    layers.push(layer)
  }
  const root = layers[height]
  console.log(`root: 0x${hexView(root)} tree height: ${layers.length}; leaves length: ${leaves.length}`)
  return {
    leaves, // =layers[0]
    root, // =layers[height]
    layers,
  }
}

const computeMerklePathByLeafIndex = ({ layers, index }) => {
  const path = []
  const indices = []
  let j = 0
  while (index > 0) {
    const neighbor = index % 2 === 0 ? index + 1 : index - 1
    const n = layers[j].subarray(neighbor * 32, neighbor * 32 + 32).slice()
    path.push(n)
    indices.push(neighbor)
    index >>= 2
  }
  return { path, indices }
}

const selectMerklePath = ({ layers, timestamp = Date.now(), effectiveTime, otpInterval = 30000 }) => {
  if (!layers) {
    throw new Error('Merkle Tree must be provided as [layers]')
  }
  effectiveTime = Math.floor(effectiveTime / otpInterval) * otpInterval
  const index = Math.floor((timestamp - effectiveTime) / otpInterval)
  return computeMerklePathByLeafIndex({ layers, index })
}

module.exports = {
  computeMerkleTree,
  selectMerklePath

}
