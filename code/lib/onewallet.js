const { sha256: fastSHA256, sha256b, processOtpSeed } = require('./util')
// eslint-disable-next-line no-unused-vars
const { hexView, genOTP, hexStringToBytes, keccak, bytesEqual } = require('./util')
const BN = require('bn.js')
const AES = require('aes-js')

const computeMerkleTree = async ({
  otpSeed,
  otpSeed2, // can be null
  effectiveTime = Date.now(),
  duration = 3600 * 1000 * 24 * 365,
  progressObserver, otpInterval = 30000,
  maxOperationsPerInterval = 1,
  randomness = 0, // number of bits for Controlled Randomness. 17 bits is recommended for the best balance between user experience and security. It maps to 2^17 = 131072 possibilities.
  hasher = sha256b // must be a batch hasher

}) => {
  maxOperationsPerInterval = 2 ** Math.ceil(Math.log2(maxOperationsPerInterval))
  maxOperationsPerInterval = Math.min(16, maxOperationsPerInterval)
  const height = Math.ceil(Math.log2(duration / otpInterval * maxOperationsPerInterval)) + 1
  const n = Math.pow(2, height - 1)
  const reportInterval = Math.floor(n / 100)
  const counter = Math.floor(effectiveTime / otpInterval)
  const seed = processOtpSeed(otpSeed)
  const seed2 = otpSeed2 && processOtpSeed(otpSeed2)
  // console.log('Generating Wallet with parameters', { seed, height, otpInterval, effectiveTime })
  const buildProgressObserver = (max) => (i, n) => i % reportInterval === 0 && progressObserver(i, max || n, 0)
  const otps = genOTP({ seed, counter, n, progressObserver: buildProgressObserver(seed2 ? n * 2 : n) })
  const otps2 = seed2 && genOTP({ seed: seed2, counter, n, progressObserver: buildProgressObserver(seed2 ? n * 2 : n) })
  // legacy mode: no randomness, no seed2: 26 bytes for seed hash, 2 bytes for nonce, 4 bytes for OTP
  // single otp mode: 22 bytes for seed hash, 2 bytes for nonce, 4 bytes for OTP, 4 bytes for randomness
  // double otp mode: 18 bytes for seed hash, 2 bytes for nonce, 4 bytes for OTP, 4 bytes for second OTP, 4 bytes for randomness
  const hseedLength = otpSeed2 ? 18 : (randomness > 0 ? 22 : 26)
  const hseed = new Uint8Array(hseedLength)
  if (seed2) {
    hseed.set(fastSHA256(seed).slice(0, hseedLength / 2))
    hseed.set(fastSHA256(seed2).slice(0, hseedLength / 2))
  } else {
    hseed.set(fastSHA256(seed).slice(0, hseedLength))
  }
  let aes; let aesInput; let rbuffer; let rview; let randomnessResults = []
  if (randomness > 0) {
    // eslint-disable-next-line new-cap
    aes = new AES.ModeOfOperation.ctr(seed.slice(0, 16))
    aesInput = new Uint8Array(new Uint32Array([counter]).buffer)
    rbuffer = new Uint8Array(4)
    rview = new DataView(rbuffer.buffer)
  }

  const input = new Uint8Array(n * 32)
  const nonceBuffer = new Uint16Array(1)
  for (let i = 0; i < n * maxOperationsPerInterval; i++) {
    const offset = i * 32
    input.set(hseed, offset)
    const nonce = i % maxOperationsPerInterval
    nonceBuffer[0] = nonce
    input.set(nonceBuffer, offset + hseedLength)
    const otp = otps.subarray(i * 4, i * 4 + 4)
    input.set(otp, offset + hseedLength + 2)
    if (otps2) {
      const otp2 = otps2.subarray(i * 4, i * 4 + 4)
      input.set(otp2, offset + hseedLength + 6)
    }
    if (randomness > 0) {
      const r = aes.encrypt(aesInput)
      const z = (r[0] << 24 | r[1] << 16 | r[2] << 8 | r[3]) >>> (32 - randomness)
      randomnessResults.push(z)
      rview.setUint32(0, z, false)
      input.set(rbuffer, offset + 28)
    }
  }
  // TODO: parallelize this
  const eotps = await hasher(input, { progressObserver: buildProgressObserver() })
  const leaves = await sha256b(eotps, { progressObserver: buildProgressObserver() })
  const layers = []
  layers.push(leaves)
  for (let j = 1; j < height; j += 1) {
    const layer = new Uint8Array(n / (2 ** j) * 32)
    const lastLayer = layers[j - 1]
    for (let i = 0; i < n / (2 ** j); i += 1) {
      const d = lastLayer.subarray(2 * i * 32, 2 * i * 32 + 64)
      const h = fastSHA256(d)
      // console.log(`layer=${j}, index=${i}`)
      layer.set(h, i * 32)
    }
    layers.push(layer)
  }
  const root = layers[height - 1]
  if (progressObserver) {
    progressObserver(1, 1, 2)
  }
  // console.log(`root: 0x${hexView(root)} tree height: ${layers.length}; leaves length: ${leaves.length}`)
  return {
    seed, // discard
    seed2, // discard
    randomnessResults, // discard
    hseed,
    counter, // base time
    leaves, // = layers[0]
    root, // = layers[height - 1]
    layers,
    maxOperationsPerInterval,
  }
}

const selectMerkleNeighbors = ({
  layers, // layers or slices of the layers; layer 0 are the leaves; if they are slices, layerOffsets must contain the offsets of each slice
  layerOffsets = new Array(layers.length), // if only a slice of each layer is provided (to save memory), provide the starting position of each slice
  index // with nonce; to get the correct index, use util.timeToIndex
}) => {
  const r = []
  let j = 0
  while (j < layers.length - 1) {
    const i = index % 2 === 0 ? index + 1 : index - 1
    const p = i - (layerOffsets[j] || 0)
    const n = layers[j].subarray(p * 32, p * 32 + 32).slice()
    // console.log(`selectMerkleNeighbors`, { currentIndex: index,
    //   layer: j,
    //   indexAtLayer: i,
    //   indexAtSlice: p,
    //   node: hexView(n),
    //   offset: layerOffsets[j] || 0 })
    r.push(n)
    index >>= 1
    j += 1
  }
  return r
}

const computeCommitHash = ({ neighbor, index, eotp }) => {
  const indexBytes = new BN(index, 10).toArrayLike(Uint8Array, 'be', 4)
  const input = new Uint8Array(96)
  input.set(neighbor)
  input.set(indexBytes, 32)
  input.set(eotp, 64)
  return { hash: keccak(input), bytes: input }
}

// dest, hex string
// amount, BN or number-string
const computeTransferHash = ({ dest, amount }) => {
  const destBytes = hexStringToBytes(dest, 32)
  const amountBytes = new BN(amount, 10).toArrayLike(Uint8Array, 'be', 32)
  const input = new Uint8Array(64)
  input.set(destBytes)
  input.set(amountBytes, 32)
  return { hash: keccak(input), bytes: input }
}

// address, hex string
const computeSetRecoveryAddressHash = ({ address }) => {
  const addressBytes = hexStringToBytes(address, 32)
  const input = new Uint8Array(32)
  input.set(addressBytes)
  return { hash: keccak(input), bytes: input }
}

// otp, uint8array, 4
// hseed, uint8array, 26, sha256 hash of the otp seed
// nonce, positive integer (within 15-bit)
const computeEOTP = ({ otp, hseed, nonce = 0 }) => {
  const buffer = new Uint8Array(32)
  const nb = new Uint16Array([nonce])
  buffer.set(hseed.slice(0, 26))
  buffer.set(nb, 26)
  buffer.set(otp, 28)
  return fastSHA256(buffer)
}

const computeRecoveryHash = () => {
  const input = new Uint8Array(32)
  return { hash: input, bytes: input }
}

/**
 * WARNING: This shall be removed after Client Security is implemented. https://github.com/polymorpher/one-wallet/wiki/Client-Security
 * @param hseed
 * @param nonce
 * @param leaf
 * @returns {{eotp: Uint8Array, otp: number}|{}}
 */
const bruteforceEOTP = ({ hseed, nonce = 0, leaf }) => {
  const nonceBuffer = new Uint16Array([nonce])
  const buffer = new Uint8Array(32)
  const otpBuffer = new DataView(new ArrayBuffer(4))
  for (let i = 0; i < 1000000; i += 1) {
    otpBuffer.setUint32(0, i, false)
    buffer.set(hseed)
    buffer.set(nonceBuffer, hseed.length)
    buffer.set(new Uint8Array(otpBuffer.buffer), hseed.length + 2)
    const h = fastSHA256(buffer)
    const hh = fastSHA256(h)
    if (bytesEqual(hh, leaf)) {
      return { eotp: h, otp: i }
    }
  }
  return { }
}

const recoverRandomness = async ({ hseed, otp, otp2, nonce = 0, leaf, randomness = 17, hasher = sha256b }) => {
  const nonceBuffer = new Uint16Array([nonce])
  const ub = 2 ** randomness
  const buffer = new Uint8Array(ub * 32)
  const rb = new Uint8Array(4)
  const rv = new DataView(rb.buffer)
  for (let i = 0; i < ub; i++) {
    const offset = i * 32
    buffer.set(hseed, offset)
    buffer.set(nonceBuffer, offset + hseed.length)
    buffer.set(otp, offset + hseed.length + 2)
    if (otp2) {
      buffer.set(otp2, offset + hseed.length + 6)
    }
    rv.setUint32(0, i, false)
    buffer.set(rb, offset + 28)
  }
  const eotps = await hasher(buffer)
  const output = await sha256b(eotps)
  for (let i = 0; i < ub; i++) {
    const b = output.subarray(i * 32, i * 32 + 32)
    if (bytesEqual(b, leaf)) {
      return i
    }
  }
  return null
}

const computeTokenKey = ({ tokenType, contractAddress, tokenId }) => {
  const buf = new Uint8Array(96)
  const s1 = new BN(tokenType, 10).toArrayLike(Uint8Array, 'be', 32)
  const s2 = hexStringToBytes(contractAddress, 32)
  const s3 = new BN(tokenId, 10).toArrayLike(Uint8Array, 'be', 32)
  buf.set(s1)
  buf.set(s2, 32)
  buf.set(s3, 64)
  return { hash: keccak(buf), bytes: buf }
}

//   bytes32(uint256(operationType)),
//   bytes32(uint256(tokenType)),
//   bytes32(bytes20(contractAddress)),
//   bytes32(tokenId),
//   bytes32(bytes20(dest)),
//   bytes32(amount),
//   data
const computeTokenOperationHash = ({ operationType, tokenType, contractAddress, tokenId, dest, amount, data = new Uint8Array() }) => {
  const operationTypeBytes = new BN(operationType, 10).toArrayLike(Uint8Array, 'be', 32)
  const tokenTypeBytes = new BN(tokenType, 10).toArrayLike(Uint8Array, 'be', 32)
  const contractAddressBytes = hexStringToBytes(contractAddress, 32)
  const tokenIdBytes = new BN(tokenId, 10).toArrayLike(Uint8Array, 'be', 32)
  const destBytes = hexStringToBytes(dest, 32)
  const amountBytes = new BN(amount, 10).toArrayLike(Uint8Array, 'be', 32)
  const input = new Uint8Array(192 + data.length)
  input.set(operationTypeBytes)
  input.set(tokenTypeBytes, 32)
  input.set(contractAddressBytes, 64)
  input.set(tokenIdBytes, 96)
  input.set(destBytes, 128)
  input.set(amountBytes, 160)
  if (data.length > 0) {
    input.set(data, 192)
  }
  return { hash: keccak(input), bytes: input }
}

// address, hex string
const computeVerificationHash = ({ paramsHash, eotp }) => {
  const input = new Uint8Array(64)
  input.set(paramsHash)
  input.set(eotp, 32)
  return { hash: keccak(input), bytes: input }
}

module.exports = {
  computeCommitHash,
  computeMerkleTree,
  computeTransferHash,
  computeRecoveryHash,
  computeSetRecoveryAddressHash,
  selectMerkleNeighbors,
  computeEOTP,
  bruteforceEOTP,
  computeTokenKey,
  computeTokenOperationHash,
  computeVerificationHash,

  recoverRandomness
}
