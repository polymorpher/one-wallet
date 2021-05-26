// const W3 = require('web3');
const web3utils = require('web3-utils')
function h (a) { return web3utils.soliditySha3({ v: a, t: 'bytes', encoding: 'hex' }).substring(0, 34) }

function reduceMT (layer) {
  if (layer.length === 1) return layer[0]
  // console.log(`Tree Dump  ${layer.length}`, layer);
  const reducedLayer = []
  for (let i = 0; i <= (layer.length / 2) - 1; i++) {
    reducedLayer[i] = h(concatB32(layer[2 * i], layer[2 * i + 1]))
  }
  // console.log("layer", reducedLayer)
  return reduceMT(reducedLayer)
}

function reduceMTByOneStep (layer) {
  const reducedLayer = []
  for (let i = 0; i <= (layer.length / 2) - 1; i++) {
    reducedLayer[i] = h(concatB32(layer[2 * i], layer[2 * i + 1]))
  }
  return reducedLayer
}

function concatB32 (a, b) {
  if (typeof (a) !== 'string' || typeof (b) !== 'string' || a.substr(0, 2) !== '0x' || b.substr(0, 2) !== '0x') {
    console.log('a, b = ', a, b)
    throw new Error('ConcatB32 supports only hex string arguments')
  }
  a = hexToBytes(a)
  b = hexToBytes(b)
  const res = []
  if (a.length !== b.length || a.length !== 16 || b.length !== 16) { throw new Error('ConcatB32 supports only equally-long (16B) arguments.') }

  for (let i = 0; i < a.length; i++) {
    res.push(a[i])
  }
  for (let i = 0; i < b.length; i++) {
    res.push(b[i])
  }
  return bytesToHex(res)
}

// Convert a hex string to a byte array
function hexToBytes (hex) {
  const bytes = []
  for (let c = 2; c < hex.length; c += 2) { bytes.push(parseInt(hex.substr(c, 2), 16)) }
  return bytes
}

// Convert a byte array to a hex string
function bytesToHex (bytes) {
  const hex = []
  for (let i = 0; i < bytes.length; i++) {
    hex.push((bytes[i] >>> 4).toString(16))
    hex.push((bytes[i] & 0xF).toString(16))
  }
  // console.log("0x" + hex.join(""));
  return '0x' + hex.join('')
}

const MT_LEFT_SIDE = '00'
const MT_RIGHT_SIDE = '01'
// const MT_STUB_SIDE = 'FF'

function getProof (leaves, idx, data) {
  const height = Math.log2(leaves.length)
  // console.log("height=", height);
  const ret = [data]
  let retSides = '0x'
  let hashesOfCurLayer = leaves
  let idxInCurLayer = idx

  // proceed from bottom to top
  for (let layer = 0; layer < height; layer++) {
    const siblingIdx = (idxInCurLayer % 2 === 0) ? idxInCurLayer + 1 : idxInCurLayer - 1
    ret.push(hashesOfCurLayer[siblingIdx])
    retSides += (idxInCurLayer % 2 === 0) ? MT_LEFT_SIDE : MT_RIGHT_SIDE
    hashesOfCurLayer = reduceMTByOneStep(hashesOfCurLayer)
    idxInCurLayer = Math.floor(idxInCurLayer / 2)
  }
  return [ret, retSides]
}

module.exports = {
  reduceMT,
  getProof
}

// const res = reduceMT(["0x00000000000000000000000000000000","0x00000000000000000000000000000000"])
// console.log(res);
// console.log(concatB32("0x00000000000000000000000000000000","0x00000000000000000000000000000000"))
