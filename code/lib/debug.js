const util = require('./util')
const fastSHA256 = require('fast-sha256')
const DefaultLogger = {
  debug: (...args) => console.log(...args)
}
module.exports = (logger = DefaultLogger) => {
  return {
    debugProof: ({ neighbors, height, index, eotp, root }) => {
      logger.debug(`Received:`, { eotp: util.hexString(eotp), height, root: util.hexString(root) })
      logger.debug(`Neighbors:`, neighbors.map(n => util.hexString(n)))
      let hash = fastSHA256(eotp)
      const buffer = new Uint8Array(64)
      for (let i = 0; i < height - 1; i += 1) {
        let left, right
        if ((index & 0x1) === 0x1) {
          left = neighbors[i].slice()
          right = hash.slice()
        } else {
          left = hash.slice()
          right = neighbors[i].slice()
        }
        buffer.set(left)
        buffer.set(right, 32)
        hash = fastSHA256(buffer)
        logger.debug({
          i,
          bit: index & 0x1,
          left: util.hexString(left),
          right: util.hexString(right),
          hash: util.hexString(hash)
        })
        index >>= 1
      }
      logger.debug(`Final result`, { hash: util.hexString(hash), root: util.hexString(root) })
    },
    printLayers: ({ layers }) => {
      for (let i = 0; i < layers.length; i += 1) {
        logger.debug(`layer=${i}`)
        const len = layers[i].length / 32
        const hexes = []
        for (let j = 0; j < len; j += 1) {
          const v = layers[i].subarray(j * 32, j * 32 + 32)
          hexes.push(util.hexString(v))
        }
        logger.debug(hexes)
      }
    }
  }
}
