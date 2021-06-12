const fastSHA256 = require('fast-sha256')
const base32 = require('hi-base32')
const { hexView, genOTP, hexStringToBytes, keccak } = require('./util')
const BN = require('bn.js')

const computeMerkleTree = ({ otpSeed, effectiveTime = Date.now(), duration = 3600 * 1000 * 24 * 365, progressObserver, otpInterval = 30000, maxOperationsPerInterval = 1 }) => {
  maxOperationsPerInterval = 2 ** Math.ceil(Math.log2(maxOperationsPerInterval))
  maxOperationsPerInterval = Math.min(16, maxOperationsPerInterval)
  const height = Math.ceil(Math.log2(duration / otpInterval)) + 1
  const n = Math.pow(2, height - 1)
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
  const otps = genOTP({ seed, counter, n, progressObserver })
  // 4 bytes for OTP, 2 bytes for nonce, 26 bytes for seed hash
  const hseed = fastSHA256(seed).slice(0, 26)
  const leaves = new Uint8Array(n * 32)
  const buffer = new Uint8Array(32)
  const nonceBuffer = new Uint16Array(1)
  const layers = []
  // TODO: parallelize this
  for (let i = 0; i < n * maxOperationsPerInterval; i++) {
    const nonce = i % maxOperationsPerInterval
    nonceBuffer[0] = nonce
    buffer.set(hseed)
    buffer.set(nonceBuffer, hseed.length)
    const otp = otps.subarray(i * 4, i * 4 + 4)
    buffer.set(otp, hseed.length + 2)
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
  for (let j = 1; j < height; j += 1) {
    const layer = new Uint8Array(n / (2 ** j) * 32)
    const lastLayer = layers[j - 1]
    for (let i = 0; i < n / (2 ** j); i += 1) {
      const d = lastLayer.subarray(2 * i * 32, 64)
      const h = fastSHA256(d)
      console.log(`layer=${j}, index=${i}`)
      layer.set(h, i * 32)
    }
    layers.push(layer)
  }
  const root = layers[height - 1]
  console.log(`root: 0x${hexView(root)} tree height: ${layers.length}; leaves length: ${leaves.length}`)
  return {
    seed,
    leaves, // =layers[0]
    root, // =layers[height - 1]
    layers,
    maxOperationsPerInterval,
  }
}

const _computeMerkleNeighbors = ({ layers, index, nonce, maxOperationsPerInterval }) => {
  const neighbors = []
  index = index * maxOperationsPerInterval + nonce
  let j = 0
  while (index > 0) {
    const neighbor = index % 2 === 0 ? index + 1 : index - 1
    const n = layers[j].subarray(neighbor * 32, neighbor * 32 + 32).slice()
    neighbors.push(n)
    index >>= 2
  }
  return neighbors
}

const computeMerkleNeighbors = ({
  layers, timestamp = Date.now(),
  effectiveTime, otpInterval = 30000,
  maxOperationsPerInterval,
  nonce = 0,
}) => {
  if (!layers) {
    throw new Error('Merkle Tree must be provided as [layers]')
  }
  effectiveTime = Math.floor(effectiveTime / otpInterval) * otpInterval
  const index = Math.floor((timestamp - effectiveTime) / otpInterval)
  const neighbors = _computeMerkleNeighbors({ layers, index, nonce, maxOperationsPerInterval })
  return { neighbors, index }
}
// leaf, uint8array, 32
// indexWithNonce, int
// eotp, uint8array, 32
// dest, hex string
// amount, BN
const computeTransferHash = ({ leaf, indexWithNonce, eotp, dest, amount }) => {
  const destBytes = hexStringToBytes(dest, 32)
  const amountBytes = amount.toArrayLike(Uint8Array, 'be', 32)
  const indexWithNonceBytes = new BN(indexWithNonce, 10).toArrayLike(Uint8Array, 'be', 32)
  const input = new Uint8Array(160)
  input.set(leaf)
  input.set(indexWithNonceBytes, 32)
  input.set(eotp, 64)
  input.set(destBytes, 96)
  input.set(amountBytes, 128)
  return keccak(input)
}

const computeRecoveryHash = ({ leaf, indexWithNonce, eotp }) => {
  const indexWithNonceBytes = new BN(indexWithNonce, 10).toArrayLike(Uint8Array, 'be', 32)
  const input = new Uint8Array(96)
  input.set(leaf)
  input.set(indexWithNonceBytes, 32)
  input.set(eotp, 64)
  return keccak(input)
}

module.exports = {
  computeMerkleTree,
  computeMerkleNeighbors,
  computeTransferHash,
  computeRecoveryHash
}
