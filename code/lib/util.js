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
const abi = require('web3-eth-abi')
const web3utils = require('web3-utils')
const elliptic = require('elliptic')

const utils = {
  hexView: (bytes) => {
    return bytes && Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join('')
  },

  hexString: (bytes) => {
    return '0x' + utils.hexView(bytes)
  },

  sha256,

  // input bytes are divided into units of `unitSize`, each consecutive `window` number of units will be hashed and provided in the output
  // e.g. for unit size = 2, window size = 3, the input [a1, a2, a3, a4, a5, a6, a7, a8] where each a represents a byte, will produce output
  // [sha256(a1 . a2 . a3 . a4 . a5 . a6), sha256(a3 . a4 . a5 . a6 . a7. a8)]
  sha256Interlaced: (input, { progressObserver, unitSize = 4, window = 6 } = {}) => {
    const n = input.length / unitSize - window + 1
    const output = new Uint8Array(n * 32)
    for (let i = 0; i < n; i++) {
      const r = sha256(input.subarray(i * unitSize, i * unitSize + window * unitSize))
      output.set(r, i * 32)
      if (progressObserver) {
        progressObserver(i, n)
      }
    }
    return output
  },

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

  stringToBytes: str => {
    return new TextEncoder().encode(str)
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
        throw new Error('otpSeed must be either string (Base32 encoded without padding) or Uint8Array')
      }
      const bn = base32.decode.asBytes(seed)
      seed = new Uint8Array(bn)
    }
    seed = seed.slice(0, 32)
    return seed
  },
  base32Decode: (str, asStr) => {
    const decoded = base32.decode(str)
    if (!asStr) {
      return utils.stringToBytes(decoded)
    }
    return decoded
  },
  base32Encode: (otpSeed) => {
    const encoded = base32.encode(otpSeed)
    let len
    for (len = encoded.length - 1; len >= 0; len--) {
      if (encoded[len] !== '=') {
        break
      }
    }
    return encoded.substr(0, len + 1)
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
    if (majorVersion <= 7) {
      return { randomness: 0, hasher: 'sha256' }
    }
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

  abi,

  // WARNING: returns string-encoded bytes (0x....), unlike other functions provided in this package
  encodeCalldata: (method, values = []) => {
    if (!method) {
      return '0x'
    }
    const selector = abi.encodeFunctionSignature(method)
    const m = method.match(/.+\((.*)\)/)
    if (!m) {
      return null
    }
    const params = m[1] ? m[1].split(',') : []
    const encodedParameters = abi.encodeParameters(params, values)
    return selector + encodedParameters.slice(2)
  },

  // WARNING: returns string-encoded bytes (0x....), unlike other functions provided in this package
  encodeMultiCall: (calls) => {
    const dests = []
    const amounts = []
    const encoded = []
    for (let i = 0; i < calls.length; i++) {
      const { amount, dest, method, values } = calls[i]
      amounts.push(amount || 0)
      dests.push(dest)
      encoded.push(utils.encodeCalldata(method, values))
    }
    return abi.encodeParameters(['address[]', 'uint256[]', 'bytes[]'], [dests, amounts, encoded])
  },

  bytesConcat: (...args) => {
    let len = 0
    args.forEach(e => {
      len += e.length
    })
    const buf = new Uint8Array(len)
    let n = 0
    args.forEach(e => {
      buf.set(e, n)
      n += e.length
    })
    return buf
  },

  ethMessage: (message) => {
    return '\x19Ethereum Signed Message:\n' + message.length.toString() + message
  },

  decodeMethodParameters: (signature, bytes, headerless = false) => {
    const m = signature.match(/.+\((.*)\)/)
    if (!m) {
      return null
    }
    if (!headerless) {
      bytes = bytes.slice(10)
    }
    const params = m[1] ? m[1].split(',') : []
    const decoded = abi.decodeParameters(params, bytes)
    const r = []
    for (let i = 0; i < params.length; i++) {
      r.push({ name: params[i], value: decoded[i] })
    }
    return r
  },

  // seed: Uint8Array[32]
  getIdentificationKey: (seed, str) => {
    // eslint-disable-next-line new-cap
    const ec = new elliptic.ec('secp256k1')
    const key = ec.keyFromPrivate(seed)
    try {
      const publicKey = new Uint8Array(key.getPublic().encode().slice(1))
      if (str) {
        return utils.hexString(publicKey)
      }
      return publicKey
    } catch (ex) {
      console.error(ex)
      return null
    }
  },

  // uint256 spendingLimit; // current maximum amount of wei allowed to be spent per interval
  // uint256 spentAmount; // amount spent for the current time interval
  // uint32 lastSpendingInterval; // last time interval when spending of ONE occurred (block.timestamp / spendingInterval)
  // uint32 spendingInterval; // number of seconds per interval of spending, e.g. when this equals 86400, the spending limit represents a daily spending limit
  // uint32 lastLimitAdjustmentTime; // last time when spend limit was adjusted
  // uint256 highestSpendingLimit; // the highest spending limit the wallet ever got. Should be set to equal `spendingLimit` initially (by the client)

  getDefaultSpendingState: (limit, interval) => {
    return {
      spendingLimit: new BN(limit).toString(),
      spentAmount: 0,
      lastSpendingInterval: 0,
      spendingInterval: interval,
      lastLimitAdjustmentTime: 0,
      highestSpendingLimit: new BN(limit).toString(),
    }
  },

  predictAddress: ({ seed, identificationKey, deployerAddress, code }) => {
    const bytes = new Uint8Array(1 + 20 + 32 + 32) // bytes.concat(bytes1(0xff), bytes20(address(this)), bytes32(salt), keccak256(code));
    if (!identificationKey) {
      identificationKey = utils.getIdentificationKey(seed)
      if (!identificationKey) {
        return null
      }
    }
    bytes.set(new Uint8Array([255]))
    bytes.set(utils.hexStringToBytes(deployerAddress), 1)
    bytes.set(utils.keccak(utils.hexStringToBytes(identificationKey)), 21)
    bytes.set(utils.keccak(code), 53)
    const hash = utils.keccak(bytes)
    return web3utils.toChecksumAddress(utils.hexString(hash.slice(12)))
  },

  makeInnerCores: ({ innerTrees, effectiveTime, duration, interval = 30000, slotSize = 1 }) => {
    const innerCores = []
    for (let innerTree of innerTrees) {
      const { root: innerRoot, layers: innerLayers } = innerTree
      const innerInterval = interval * 6
      const innerLifespan = Math.floor(duration / innerInterval)
      const innerT0 = Math.floor(effectiveTime / innerInterval)
      innerCores.push([utils.hexString(innerRoot), innerLayers.length, innerInterval / 1000, innerT0, innerLifespan, slotSize])

      if (!innerRoot) {
        throw new Error(`inner core has empty root: ${JSON.stringify(innerTree)}`)
      }
    }
    return innerCores
  },

  web3utils
}
module.exports = utils
