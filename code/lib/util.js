const JSSHA = require('jssha')
const createKeccakHash = require('keccak')
const utils = {
  hexView: (bytes) => {
    return bytes && Array.from(bytes).map(x => x.toString(16).padStart(2, '0')).join('')
  },

  hexString: (bytes) => {
    return '0x' + utils.hexView(bytes)
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
  keccak: (bytes) => {
    const k = createKeccakHash('keccak256')
    // assume Buffer is poly-filled or loaded from https://github.com/feross/buffer
    const hash = k.update(Buffer.from(bytes)).digest()
    return new Uint8Array(hash)
  },

  hexStringToBytes: (hexStr, length) => {
    return hexStr.startsWith('0x') ? utils.hexToBytes(hexStr.slice(2), length) : utils.hexToBytes(hexStr, length)
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

  genOTP: ({ seed, counter = Math.floor(Date.now() / 30000), n = 1, progressObserver }) => {
    const reportInterval = Math.floor(n / 100)
    const jssha = new JSSHA('SHA-1', 'UINT8ARRAY')
    jssha.setHMACKey(seed, 'UINT8ARRAY')
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
  },
}
module.exports = utils
