// TODO: change this file to ES2015 format, e.g. use classes, objects, lambas, etc.
const bip39 = require('bip39')
const ENGLISH_WORDLIST = require('../app/src/wordlists/english.json')
const web3utils = require('web3-utils')
// const PRF_FUNC = Object.freeze({"AES_CTR" : 0, "SHA3" : 1});
// const CUR_PRF = PRF_FUNC.SHA3

function h (a) { return web3utils.soliditySha3({ v: a, t: 'bytes', encoding: 'hex' }).substring(0, 34) }
// function hashB32(a) { return web3utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }); }

const MT_LEFT_SIDE = '00'
const MT_RIGHT_SIDE = '01'
const MT_STUB_SIDE = 'FF'

// if leavesData is null than initialize from seed, else use leavesData
const AuthenticatorMT = function (parentLeaves, childLeaves, childDephtOfCachedLayer, hashChainLen, mnemHex, idxOfParrentTree, leavesData, is4UnitTests = false, displayOTPs = false) {
  this._MT_child_depthOfCachedLayer = childDephtOfCachedLayer
  this._MT_child_numberOfOTPs = childLeaves * hashChainLen
  this._MT_child_numberOfLeafs = childLeaves
  this._MT_child_height = Math.log2(this._MT_child_numberOfLeafs)
  this._MT_parent_numberOfOTPs = parentLeaves * hashChainLen
  this._MT_parent_numberOfLeafs = parentLeaves
  this._MT_parent_height = Math.log2(this._MT_parent_numberOfLeafs)
  this._MT_parent_storageOfLeafs = [] // represents publicly disclosable storage
  this._sequenceNoOfParentTree = idxOfParrentTree // indicates the order of parent tree that was used in this auth instance
  this._hashchain_len = hashChainLen
  this._is_4_unit_tests = is4UnitTests // NOTE: Decides whether to store secrets or delete them
  this._display_otps = displayOTPs
  this.doChecks()

  // const a = "0x0000000000000000000000000000000000000000000000000000000000000000";
  // console.log("h(0x0000000000000000000000000000000000000000000000000000000000000000) = ", web3utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }));
  // console.log("h(0x0000000000000000000000000000000000000000000000000000000000000000)[16:31] = ", h(a));
  // throw new Exception("...");

  if (is4UnitTests && mnemHex.length > 34) { // if in testing mode are words provided, transform them to HEX
    console.log('mnemonic words of seed are: ', mnemHex)
    mnemHex = bip39.mnemonicToEntropy(mnemHex.toLowerCase(), ENGLISH_WORDLIST)
    console.log('Seed in hex is: ', '0x' + mnemHex)
  }
  this.generateNextParentTree(mnemHex, leavesData)
}

Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_height', {
  get: function () {
    return this._MT_parent_height
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_height', {
  get: function () {
    return this._MT_child_height
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_rootHash', {
  get: function () {
    return this._MT_parent_rootHash
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_depthOfCachedLayer', {
  get: function () {
    return this._MT_child_depthOfCachedLayer
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_storageOfLeafs', {
  get: function () {
    return this._MT_parent_storageOfLeafs
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_secrets', {
  get: function () {
    return this._MT_parent_secrets_raw
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_numberOfOTPs', {
  get: function () {
    return this._MT_parent_numberOfOTPs
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_numberOfOTPs', {
  get: function () {
    return this._MT_child_numberOfOTPs
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_layerOfChildRootHashes', {
  get: function () {
    return this._MT_parent_layerOfChildRootHashes
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'Hashchain_len', {
  get: function () {
    return this._hashchain_len
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_numberOfLeafs', {
  get: function () {
    return this._MT_child_numberOfLeafs
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_numberOfLeafs', {
  get: function () {
    return this._MT_parent_numberOfLeafs
  }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_tree_idx', {
  get: function () {
    return this._sequenceNoOfParentTree - 1
  }
})

AuthenticatorMT.prototype.buildClientStorageSHA3 = function (mnemHex) {
  this._MT_parent_secrets_raw = [] // Leaves of parent trees
  this._MT_parent_storageOfLeafs = [] // represents publicly disclosable storage

  for (let i = 0; i < this.MT_parent_numberOfLeafs; i++) {
    const iAsBytes = hexPadLeft(i + this.MT_parent_numberOfLeafs * this._sequenceNoOfParentTree, 16) // aligh the index i to 8B
    const leaf = web3utils.soliditySha3({
      t: 'bytes32',
      v: mnemHex + web3utils.soliditySha3({ t: 'bytes8', v: iAsBytes }).substr(2, 32)
    }).substr(0, 34)

    if (this._is_4_unit_tests) {
      this._MT_parent_secrets_raw.push(leaf)
    }
    this._MT_parent_storageOfLeafs.push(
      h(
        hChainDS(leaf, this.Hashchain_len - 1)
      ) // run one more hash to get h(OTP)
    )
  }
}

// Use either "mnemHex" or "leavesData", based on null value of "leavesData" and "this._is_4_unit_tests"
AuthenticatorMT.prototype.generateNextParentTree = function (mnemHex, leavesData) {
  if (mnemHex == null && leavesData == null) {
    throw new Error(`Invalid state in generateNextParentTree: both mnemHex (${mnemHex}) and leavesData (${leavesData}) are nulls.`)
  }

  if (this._is_4_unit_tests && mnemHex.length > 34) { // if in testing mode are words provided, transform them to HEX
    mnemHex = bip39.mnemonicToEntropy(mnemHex.toLowerCase(), ENGLISH_WORDLIST)
  }

  if (leavesData == null) {
    this.buildClientStorageSHA3(mnemHex)
  } else {
    if (this._is_4_unit_tests) {
      this.buildClientStorageSHA3(mnemHex) // ignore leavesData in NO authentication mode
    } else {
      this._MT_parent_secrets_raw = []
      this._MT_parent_storageOfLeafs = cloneArray(leavesData)
    }
  }
  if (this._is_4_unit_tests && this._display_otps) {
    this.dumpAllOTPs()
    // for (let i = 0; i < this._MT_parent_secrets_raw.length; i++) {
    //     console.log(`\tOTP mnemonic ${i + 1} is: ${bip39.entropyToMnemonic(this._MT_parent_secrets_raw[i].substr(2, 34), ENGLISH_WORDLIST)} `)
    // }
  }

  this._MT_parent_layerOfChildRootHashes = this.computeLayerOfChildRootHashes()
  this._MT_parent_rootHash = this.reduceMT(this._MT_parent_layerOfChildRootHashes)
  this._sequenceNoOfParentTree += 1
}
AuthenticatorMT.prototype.doChecks = function () {
  if (this._hashchain_len < 1) {
    throw new Error('The length of hash chain must be higher than 0. ')
  }
  if (this._MT_parent_numberOfLeafs !== 2 ** this._MT_parent_height) {
    throw new Error(`The number of parent leafs (${this._MT_parent_numberOfLeafs}) does not correspond to its height (${this._MT_parent_height}).`)
  }
  if (this._MT_child_numberOfLeafs !== 2 ** this._MT_child_height) {
    throw new Error('The number of child leafs does not correspond to its height. ')
  }
  if (this._MT_parent_height < this._MT_child_height) {
    throw new Error('The height of parent tree must be greater orequal to the height of child tree.')
  }
  if (this._MT_child_depthOfCachedLayer > this._MT_child_height || this._MT_child_depthOfCachedLayer < 0) {
    throw new Error('The requested child depth of cached layer does not fit boundaries of tree. Child height = ' +
            String(this._MT_child_height) + '; depth = ' + String(this._MT_child_depthOfCachedLayer)
    )
  }
}
AuthenticatorMT.prototype.computeLayerOfChildRootHashes = function () {
  // start from the very bottom of the parent tree and go upwards to the layer of child root hashes
  let hashesOfCurLayer = cloneArray(this._MT_parent_storageOfLeafs) // copy hashes of all secrets

  for (let i = 0; i < this.MT_child_height; i++) { // create a layer of all child root hashes
    hashesOfCurLayer = this.reduceMTByOneStep(hashesOfCurLayer)
  }
  return hashesOfCurLayer
}
AuthenticatorMT.prototype.getChildCachedLayer = function (childIdxInParentTree) {
  let childCachedLayerMT = []

  if (childIdxInParentTree * this._MT_child_numberOfLeafs >= this._MT_parent_numberOfLeafs) {
    throw new Error('Child tree index is out of range.')
  }

  for (let i = 0; i < this._MT_child_numberOfLeafs; i++) {
    childCachedLayerMT.push(this._MT_parent_storageOfLeafs[this._MT_child_numberOfLeafs * childIdxInParentTree + i])
  }
  for (let i = 0; i < (this._MT_child_height - this._MT_child_depthOfCachedLayer); i++) {
    childCachedLayerMT = this.reduceMTByOneStep(childCachedLayerMT)
  }
  return childCachedLayerMT
}
AuthenticatorMT.prototype.getConfirmMaterial = function (idx, default_otp = null) {
  if (idx >= this.MT_parent_numberOfLeafs * this._hashchain_len) {
    throw new Error('Index of OTP is out of range! Max index is: ' + String(this.MT_parent_numberOfLeafs * this._hashchain_len - 1))
  }
  const ret = []
  let retSides = '0x' // create side indications of the confirmation material items to enable reconstruct the root
  ret.push(this.fetchOTP(idx, default_otp)) // put OTP as the 1st and then all hashes of compact proof
  if (this._display_otps) {
    console.log(`\tOTP mnemonic is: ${bip39.entropyToMnemonic(ret[0].substr(2, 34), ENGLISH_WORDLIST)} `)
  }

  if (this.MT_child_height - this.MT_child_depthOfCachedLayer === 0) {
    retSides += MT_STUB_SIDE // this helps to resolve problems with solidity when retSides would be empty
  }

  const requestedChildTreeIdx = Math.floor((idx / this._hashchain_len) / this._MT_child_numberOfLeafs)
  let hashesOfCurLayer = []
  for (let i = 0; i < this._MT_child_numberOfLeafs; i++) {
    // copy all child tree leafs
    hashesOfCurLayer.push(this.MT_parent_storageOfLeafs[this._MT_child_numberOfLeafs * requestedChildTreeIdx + i])
  }

  let idxInCurLayer = idx % this._MT_child_numberOfLeafs
  // proceed from bottom to top
  for (let layer = 0; layer < (this.MT_child_height - this.MT_child_depthOfCachedLayer); layer++) {
    const siblingIdx = (idxInCurLayer % 2 === 0) ? idxInCurLayer + 1 : idxInCurLayer - 1
    ret.push(hashesOfCurLayer[siblingIdx])
    retSides += (idxInCurLayer % 2 === 0) ? MT_LEFT_SIDE : MT_RIGHT_SIDE
    hashesOfCurLayer = this.reduceMTByOneStep(hashesOfCurLayer)
    idxInCurLayer = Math.floor(idxInCurLayer / 2)
  }
  return [ret, retSides]
}
AuthenticatorMT.prototype.fetchOTP = function (idx, defaultOtp = null) { // Resolves hash chains and indexing of parent secrets
  // OTP was provided by HW authenticator
  if (defaultOtp !== null) {
    return defaultOtp
  }

  // ~alpha = P - floor( (i % N_S) / (N_S/P) ) - 1
  const alpha = this._hashchain_len - Math.floor((idx % this._MT_child_numberOfOTPs) / this._MT_child_numberOfLeafs) - 1

  // ~beta = floor(i/N_S) * N_S/P + (i % N_S/P)
  const beta = Math.floor(idx / this._MT_child_numberOfOTPs) * this._MT_child_numberOfLeafs + (idx % this._MT_child_numberOfLeafs)

  // console.log("\t\t Alpha = " + alpha + " Beta = " + beta)
  // console.log("\t\t MT_parent_secrets[beta] = ", this.MT_parent_secrets[beta])
  // console.log("\t\t hChainDS(MT_parent_secrets[beta], alpha) = ", hChainDS(this.MT_parent_secrets[beta], alpha))
  return hChainDS(this.MT_parent_secrets[beta], alpha)
}
AuthenticatorMT.prototype.dumpAllChildRootHashes = function () {
  console.log('Dumping all child root hashes:')
  for (let i = 0; i < this.MT_parent_layerOfChildRootHashes.length; i++) {
    console.log(`\t Child root hash[${i}] = ${this.MT_parent_layerOfChildRootHashes[i]}`)
  }
}
AuthenticatorMT.prototype.dumpAllOTPs = function () {
  const childOneLayer = []
  console.log('Dumping OTPs')
  if (this._MT_parent_numberOfOTPs * this._hashchain_len > Math.pow(2, 12)) {
    return
  }

  for (let i = 0; i < this._MT_parent_numberOfOTPs; i++) {
    if (i % this._MT_child_numberOfOTPs === 0) {
      console.log('\t [Child ' + Math.floor(i / this._MT_child_numberOfOTPs) + ']:')
    }

    // childOneLayer.push( this.fetchOTP(i));
    childOneLayer.push('(' + bip39.entropyToMnemonic(this.fetchOTP(i).substr(2), ENGLISH_WORDLIST) + ') ')
    if (childOneLayer.length === this._MT_child_numberOfLeafs) {
      let idxLayer = Math.floor((i % this._MT_child_numberOfOTPs) / this._MT_child_numberOfLeafs)
      console.log('\t\t [Layer ' + idxLayer + ' ]: \t\t' + childOneLayer + '\n')
      childOneLayer.splice(0)
    }
  }
}
AuthenticatorMT.prototype.getAuthPath4ChildTree = function (idxOfChild) {
  if (idxOfChild >= this._MT_parent_numberOfLeafs / this._MT_child_numberOfLeafs) {
    throw new Error('Index of child tree is out of range!')
  }
  const ret = []
  let retSides = '0x' // create side indications of the confirmation material items to enable reconstruct the root

  // copy a layer of all child root hashes
  let hashesOfCurLayer = cloneArray(this.MT_parent_layerOfChildRootHashes)

  ret.push(hashesOfCurLayer[idxOfChild]) // put new child root hash as the 1st
  if (this.MT_parent_height - this.MT_child_height === 0) {
    retSides += MT_STUB_SIDE // this helps to resolve problems with solidity when retSides would be empty
  }

  let idxInCurLayer = idxOfChild
  // proceed from bottom to top
  for (let layer = 0; layer < (this.MT_parent_height - this.MT_child_height); layer++) {
    const siblingIdx = (idxInCurLayer % 2 === 0) ? idxInCurLayer + 1 : idxInCurLayer - 1
    ret.push(hashesOfCurLayer[siblingIdx])
    retSides += (idxInCurLayer % 2 === 0) ? MT_LEFT_SIDE : MT_RIGHT_SIDE
    hashesOfCurLayer = this.reduceMTByOneStep(hashesOfCurLayer)
    idxInCurLayer = Math.floor(idxInCurLayer / 2)
  }
  return [ret, retSides]
}
AuthenticatorMT.prototype.reduceMT = function reduceMT (layer) {
  if (layer.length === 1) return layer[0]

  // console.log(`Tree Dump  ${layer.length}`, layer);
  const reducedLayer = []
  for (let i = 0; i <= (layer.length / 2) - 1; i++) {
    reducedLayer[i] = h(concatB32(layer[2 * i], layer[2 * i + 1]))
  }
  return this.reduceMT(reducedLayer)
}
AuthenticatorMT.prototype.reduceMTByOneStep = function reduceMTByOneStep (layer) {
  const reducedLayer = []
  for (let i = 0; i <= (layer.length / 2) - 1; i++) {
    reducedLayer[i] = h(concatB32(layer[2 * i], layer[2 * i + 1]))
  }
  return reducedLayer
}

/// // AUX Functions /////

// function hChain(arg, cnt) {
//     const ret = arg;
//     for (const i = 0; i < cnt; i++) {
//         ret = h(ret)
//     }
//     return ret
// }

function hChainDS (arg, cnt) {
  if (cnt < 0) { throw new Error(`cnt >= 0 while ${cnt} was provided`) }

  let ret = arg
  // compute hash chain with domain separation until the OTP in first iteration layer
  for (let i = 0; i < cnt; i++) {
    console.log('ret = ', ret, ' i = ', i, 'padded', hexPadLeft(i + 1, 8))
    ret = h(concatB20('0x' + hexPadLeft(i + 1, 8), ret)) // align value used for domain separation to 4B (i.e., max hChain len = 2^32)
    console.log(`h(${i} || a)= `, ret)
    // throw new Error("efr");
  }
  // return OTP from the 1st iteration layer
  return ret
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

function concatB20 (a, b) { // NOTE: a should have 4B and b should have 16B
  if (typeof (a) !== 'string' || typeof (b) !== 'string' || a.substr(0, 2) !== '0x' || b.substr(0, 2) !== '0x') {
    console.log('a, b = ', a, b)
    throw new Error('ConcatB20 supports only hex string arguments')
  }
  a = hexToBytes(a)
  b = hexToBytes(b)
  const res = []
  if (a.length !== 4 || b.length !== 16) { throw new Error(`ConcatB20 supports only (4B and 16B) arguments. Got ${a.length}, ${b.length} (a=${a} | b=${b})`) }

  for (let i = 0; i < a.length; i++) {
    res.push(a[i])
  }
  for (let i = 0; i < b.length; i++) {
    res.push(b[i])
  }
  return bytesToHex(res)
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

// Convert a hex string to a byte array
function hexToBytes (hex) {
  const bytes = []
  for (let c = 2; c < hex.length; c += 2) { bytes.push(parseInt(hex.substr(c, 2), 16)) }
  return bytes
}

function cloneArray (arr) {
  const ret = []
  for (let i = 0; i < arr.length; i++) {
    ret.push(arr[i])
  }
  return ret
}

function hexPadLeft (num, size) {
  let s = num.toString(16)
  while (s.length < (size || 2)) {
    s = '0' + s
  }
  return s
}

module.exports = AuthenticatorMT
