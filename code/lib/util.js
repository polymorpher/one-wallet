const JSSHA = require('jssha')
const createKeccakHash = require('keccak')
const Conversion = require('ethjs-unit')
const sha256 = require('fast-sha256')
const BN = require('bn.js')
const argon2 = require('argon2-browser')
const base32 = require('hi-base32')
const securityParams = require('./params')
const STANDARD_DECIMAL = 18
const PERMIT_DEPRECATED_METHOD = process.env.PERMIT_DEPRECATED_METHOD
const uts46 = require('idna-uts46')

const utils = {
  hexView: (bytes) => {
    return bytes && Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join('')
  },

  hexString: (bytes) => {
    return '0x' + utils.hexView(bytes)
  },

  sha256,

  // batched sha256
  sha256b: async (input, { progressObserver, batchSize = 32 } = {}) => {
    const n = input.length / batchSize
    const output = new Uint8Array(n * 32)
    for (let i = 0; i < n; i += 1) {
      output.set(sha256(input.subarray(i * batchSize, i * batchSize + batchSize)), i * 32)
      if (progressObserver) {
        progressObserver(i, n)
      }
    }
    return output
  },

  hexToBytes: (hex, length, padRight) => {
    if (!hex) {
      return
    }
    length = length || hex.length / 2
    const ar = new Uint8Array(length)
    for (let i = 0; i < hex.length / 2; i += 1) {
      let j = i
      if (padRight) {
        j = length - hex.length + i
      }
      ar[j] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return ar
  },

  // assume Buffer is poly-filled or loaded from https://github.com/feross/buffer
  // accepts string as well
  keccak: (bytes) => {
    const k = createKeccakHash('keccak256')
    // assume Buffer is poly-filled or loaded from https://github.com/feross/buffer
    const hash = k.update(Buffer.from(bytes)).digest()
    return new Uint8Array(hash)
  },

  hexStringToBytes: (hexStr, length) => {
    return hexStr.startsWith('0x') ? utils.hexToBytes(hexStr.slice(2), length) : utils.hexToBytes(hexStr, length)
  },

  bytesEqual: (b1, b2) => {
    if (b1.byteLength !== b2.byteLength) return false
    for (let i = 0; i < b1.byteLength; i++) {
      if (b1[i] !== b2[i]) return false
    }
    return true
  },

  timeToIndex: ({
    effectiveTime,
    time = Date.now(),
    interval = 30000,
    nonce = 0,
    maxOperationsPerInterval = 1
  }) => {
    effectiveTime = Math.floor(effectiveTime / interval) * interval
    const index = Math.floor((time - effectiveTime) / interval)
    const indexWithNonce = index * maxOperationsPerInterval + nonce
    return indexWithNonce
  },

  processOtpSeed: (seed) => {
    if (seed.constructor.name !== 'Uint8Array') {
      if (typeof seed !== 'string') {
        throw new Error('otpSeed must be either string (Base32 encoded) or Uint8Array')
      }
      const bn = base32.decode.asBytes(seed)
      seed = new Uint8Array(bn)
    }
    seed = seed.slice(0, 20)
    return seed
  },

  genOTP: ({ seed, interval = 30000, counter = Math.floor(Date.now() / interval), n = 1, progressObserver }) => {
    const codes = new Uint8Array(n * 4)
    const v = new DataView(codes.buffer)
    const b = new DataView(new ArrayBuffer(8))
    for (let i = 0; i < n; i += 1) {
      const t = counter + i
      b.setUint32(0, 0, false)
      b.setUint32(4, t, false)
      const jssha = new JSSHA('SHA-1', 'UINT8ARRAY')
      jssha.setHMACKey(seed, 'UINT8ARRAY')
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
        progressObserver(i, n)
      }
    }
    return codes
  },

  encodeNumericalOtp: (otp) => {
    const b = new DataView(new ArrayBuffer(4))
    b.setUint32(0, otp, false)
    return new Uint8Array(b.buffer)
  },

  decodeOtp: (otp) => {
    return new DataView(otp.buffer).getUint32(0, false)
  },

  toFraction: (ones, unit, decimals) => {
    const v = Conversion.toWei(ones, unit || 'ether')
    const diff = STANDARD_DECIMAL - (decimals || STANDARD_DECIMAL)
    const denominator = new BN(10).pow(new BN(diff))
    return v.div(denominator)
  },

  toOne: (fractions, unit, decimals) => {
    const diff = STANDARD_DECIMAL - (decimals || STANDARD_DECIMAL)
    const multiplier = new BN(10).pow(new BN(diff))
    const bfractions = new BN(fractions).mul(multiplier)
    const v = Conversion.fromWei(bfractions, unit || 'ether')
    return v
  },

  argon2: async (input, { salt = new Uint8Array(8), progressObserver, batchSize = 32 } = {}) => {
    const { result } = await argon2.hash({ pass: input, batchSize, salt, progressObserver })
    return result
  },

  getHasher: (hasher) => {
    if (hasher === 'argon2') {
      return utils.argon2
    }
    return utils.sha256b
  },

  DEPRECATED: () => {
    if (!PERMIT_DEPRECATED_METHOD) {
      throw new Error('Deprecated')
    }
  },

  getVersion: ({ majorVersion, minorVersion }) => `${majorVersion}.${minorVersion}`,

  securityParameters: ({ majorVersion, minorVersion }) => {
    const keys = Object.keys(securityParams)
    const v = utils.getVersion({ majorVersion, minorVersion })
    for (let k of keys) {
      const m = v.match(new RegExp(k))
      if (m) {
        const { hasher, baseRandomness, randomnessDamping, argon2Damping } = securityParams[k]
        let r = baseRandomness - randomnessDamping
        if (hasher === 'argon2') {
          r -= argon2Damping
        }
        return { randomness: r, hasher }
      }
    }
    throw new Error(`No security parameter for version ${v}`)
  },

  normalizeDomain: e => {
    return uts46.toAscii(e, { useStd3ASCII: true })
  },

  namehash: (name) => {
    name = utils.normalizeDomain(name)
    const parts = name.split('.')
    const empty = new Uint8Array(32)
    if (!name) {
      return empty
    }
    let hash = empty
    for (let i = parts.length - 1; i >= 0; i--) {
      const joined = new Uint8Array(64)
      joined.set(hash)
      joined.set(utils.keccak(parts[i]), 32)
      hash = utils.keccak(joined)
    }
    return hash
  },
}
module.exports = utils
