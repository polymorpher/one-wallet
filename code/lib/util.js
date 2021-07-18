const JSSHA = require('jssha')
const createKeccakHash = require('keccak')
const Conversion = require('ethjs-unit')
const sha256 = require('fast-sha256')
const BN = require('BN.js')
const STANDARD_DECIMAL = 18

const utils = {
  hexView: (bytes) => {
    return bytes && Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join('')
  },

  hexString: (bytes) => {
    return '0x' + utils.hexView(bytes)
  },

  sha256,

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

  genOTP: ({ seed, interval = 30000, counter = Math.floor(Date.now() / interval), n = 1, progressObserver }) => {
    const reportInterval = Math.floor(n / 100)

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
        if (i % reportInterval === 0) {
          progressObserver(i, n, 0)
        }
      }
    }
    return codes
  },

  encodeNumericalOtp: (otp) => {
    const b = new DataView(new ArrayBuffer(4))
    b.setUint32(0, otp, false)
    return new Uint8Array(b.buffer)
  },

  toFraction: (ones, unit, decimals) => {
    const v = Conversion.toWei(ones, unit || 'ether')
    const diff = STANDARD_DECIMAL - (decimals || STANDARD_DECIMAL)
    if (diff === 0) {
      return v
    } else if (diff > 0) {
      return v.div(new BN(10).pow(new BN(diff)))
    } else {
      return v.mul(new BN(10).pow(new BN(-diff)))
    }
  },

  toOne: (fractions, unit, decimals) => {
    const v = Conversion.fromWei(fractions, unit || 'ether')
    const diff = STANDARD_DECIMAL - (decimals || STANDARD_DECIMAL)
    if (diff > 0) {
      return v + '0'.repeat(diff)
    } else {
      return v.slice(0, v.length + diff)
    }
  },

}
module.exports = utils
