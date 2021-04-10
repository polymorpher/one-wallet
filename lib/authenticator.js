var bip39 = require('bip39')
var W3 = require('web3');
var ENGLISH_WORDLIST = require("../app/src/wordlists/english.json")
// var PRF_FUNC = Object.freeze({"AES_CTR" : 0, "SHA3" : 1});
// var CUR_PRF = PRF_FUNC.SHA3

function h(a) { return W3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }).substring(0, 34); }
// function hashB32(a) { return W3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }); }

MT_LEFT_SIDE = "00";
MT_RIGHT_SIDE = "01";
MT_STUB_SIDE = "FF";

// if leavesData is null than initialize from seed, else use leavesData
var AuthenticatorMT = function (parent_leaves, child_leaves, child_depht_of_cached_layer, hash_chain_len, mnemHex, idxOfParrentTree, leavesData, is4UnitTests = false, displayOTPs = false) {
    this._MT_child_depthOfCachedLayer = child_depht_of_cached_layer;
    this._MT_child_numberOfOTPs = child_leaves * hash_chain_len;
    this._MT_child_numberOfLeafs = child_leaves;
    this._MT_child_height = Math.log2(this._MT_child_numberOfLeafs);
    this._MT_parent_numberOfOTPs = parent_leaves * hash_chain_len;
    this._MT_parent_numberOfLeafs = parent_leaves;
    this._MT_parent_height = Math.log2(this._MT_parent_numberOfLeafs);
    this._MT_parent_storageOfLeafs = []; // represents publicly disclosable storage
    this._sequenceNoOfParentTree = idxOfParrentTree; // indicates the order of parent tree that was used in this auth instance
    this._hashchain_len = hash_chain_len;
    this._is_4_unit_tests = is4UnitTests // NOTE: Decides whether to store secrets or delete them
    this._display_otps = displayOTPs
    this.doChecks()

    // var a = "0x0000000000000000000000000000000000000000000000000000000000000000";
    // console.log("h(0x0000000000000000000000000000000000000000000000000000000000000000) = ", W3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }));
    // console.log("h(0x0000000000000000000000000000000000000000000000000000000000000000)[16:31] = ", h(a));
    // throw new Exception("...");

    if(is4UnitTests && mnemHex.length > 34){ // if in testing mode are words provided, transform them to HEX
        console.log("mnemonic words of seed are: ", mnemHex);
        mnemHex = bip39.mnemonicToEntropy(mnemHex.toLowerCase(), ENGLISH_WORDLIST);
        console.log("Seed in hex is: ", "0x" + mnemHex);
    }
    this.generateNextParentTree(mnemHex, leavesData)
}

Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_height', {
    get: function () {
      return this._MT_parent_height;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_height', {
    get: function () {
      return this._MT_child_height;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_rootHash', {
    get: function () {
      return this._MT_parent_rootHash;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_depthOfCachedLayer', {
    get: function () {
      return this._MT_child_depthOfCachedLayer;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_storageOfLeafs', {
    get: function () {
      return this._MT_parent_storageOfLeafs;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_secrets', {
    get: function () {
      return this._MT_parent_secrets_raw;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_numberOfOTPs', {
    get: function () {
      return this._MT_parent_numberOfOTPs;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_numberOfOTPs', {
    get: function () {
      return this._MT_child_numberOfOTPs;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_layerOfChildRootHashes', {
    get: function () {
      return this._MT_parent_layerOfChildRootHashes;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'Hashchain_len', {
    get: function () {
      return this._hashchain_len;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_child_numberOfLeafs', {
    get: function () {
      return this._MT_child_numberOfLeafs;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_numberOfLeafs', {
    get: function () {
      return this._MT_parent_numberOfLeafs;
    }
})
Object.defineProperty(AuthenticatorMT.prototype, 'MT_parent_tree_idx', {
    get: function () {
      return this._sequenceNoOfParentTree - 1;
    }
})

AuthenticatorMT.prototype.buildClientStorageSHA3 = function(mnemHex){
    this._MT_parent_secrets_raw = [] // Leaves of parent trees
    this._MT_parent_storageOfLeafs = []; // represents publicly disclosable storage

    for (let i = 0 ; i < this.MT_parent_numberOfLeafs ; i++){
      var iAsBytes = (i + this.MT_parent_numberOfLeafs * this._sequenceNoOfParentTree).padLeft(16); // aligh the index i to 8B
      var leaf = W3.utils.soliditySha3({
          t:'bytes32',
          v: mnemHex + W3.utils.soliditySha3({t: 'bytes8', v: iAsBytes}).substr(2, 32)
      }).substr(0, 34)

      if(this._is_4_unit_tests){
          this._MT_parent_secrets_raw.push(leaf)
      }
      this._MT_parent_storageOfLeafs.push(
        h(
            hChainDS(leaf, this.Hashchain_len - 1)
        ) // run one more hash to get h(OTP)
      );
    }
  }

// Use either "mnemHex" or "leavesData", based on null value of "leavesData" and "this._is_4_unit_tests"
AuthenticatorMT.prototype.generateNextParentTree = function (mnemHex, leavesData) {

    if(null == mnemHex && null == leavesData){
        throw `Invalid state in generateNextParentTree: both mnemHex (${mnemHex}) and leavesData (${leavesData}) are nulls.`
    }

    if(this._is_4_unit_tests && mnemHex.length > 34){ // if in testing mode are words provided, transform them to HEX
        mnemHex = bip39.mnemonicToEntropy(mnemHex.toLowerCase(), ENGLISH_WORDLIST);
    }

    if(null == leavesData){
        this.buildClientStorageSHA3(mnemHex)
    }else{
        if(this._is_4_unit_tests){
            this.buildClientStorageSHA3(mnemHex) // ignore leavesData in NO authentication mode
        } else{
            this._MT_parent_secrets_raw = []
            this._MT_parent_storageOfLeafs = cloneArray(leavesData)
        }
    }
    if(this._is_4_unit_tests && this._display_otps){
        this.dumpAllOTPs();
        // for (let i = 0; i < this._MT_parent_secrets_raw.length; i++) {
        //     console.log(`\tOTP mnemonic ${i + 1} is: ${bip39.entropyToMnemonic(this._MT_parent_secrets_raw[i].substr(2, 34), ENGLISH_WORDLIST)} `)
        // }
    }

    this._MT_parent_layerOfChildRootHashes = this.computeLayerOfChildRootHashes();
    this._MT_parent_rootHash = this.reduceMT(this._MT_parent_layerOfChildRootHashes);
    this._sequenceNoOfParentTree += 1;
}
AuthenticatorMT.prototype.doChecks = function () {
    if (this._hashchain_len < 1) {
        throw new Error("The length of hash chain must be higher than 0. ");
    }
    if(this._MT_parent_numberOfLeafs != 2 **  this._MT_parent_height){
        throw new Error(`The number of parent leafs (${this._MT_parent_numberOfLeafs}) does not correspond to its height (${this._MT_parent_height}).`);
    }
    if(this._MT_child_numberOfLeafs != 2 **  this._MT_child_height){
        throw new Error("The number of child leafs does not correspond to its height. ");
    }
    if(this._MT_parent_height <  this._MT_child_height){
        throw new Error("The height of parent tree must be greater orequal to the height of child tree.");
    }
    if(this._MT_child_depthOfCachedLayer > this._MT_child_height || this._MT_child_depthOfCachedLayer < 0){
        throw new Error("The requested child depth of cached layer does not fit boundaries of tree. Child height = "
            + String(this._MT_child_height) + "; depth = " + String(this._MT_child_depthOfCachedLayer)
        );
    }
}
AuthenticatorMT.prototype.computeLayerOfChildRootHashes = function () {
    // start from the very bottom of the parent tree and go upwards to the layer of child root hashes
    var hashesOfCurLayer = cloneArray(this._MT_parent_storageOfLeafs) //copy hashes of all secrets

    for (let i = 0; i < this.MT_child_height ; i++){ // create a layer of all child root hashes
        hashesOfCurLayer = this.reduceMTByOneStep(hashesOfCurLayer);
    }
    return hashesOfCurLayer;
}
AuthenticatorMT.prototype.getChildCachedLayer = function (childIdxInParentTree) {
    var child_cachedLayerMT = [];

    if(childIdxInParentTree * this._MT_child_numberOfLeafs >= this._MT_parent_numberOfLeafs){
        throw new Error("Child tree index is out of range.");
    }

    for (let i = 0 ; i < this._MT_child_numberOfLeafs ; i++){
        child_cachedLayerMT.push(this._MT_parent_storageOfLeafs[this._MT_child_numberOfLeafs * childIdxInParentTree +  i]);
    }
    for (let i = 0; i < (this._MT_child_height - this._MT_child_depthOfCachedLayer); i++){
        child_cachedLayerMT = this.reduceMTByOneStep(child_cachedLayerMT);
    }
    return child_cachedLayerMT
}
AuthenticatorMT.prototype.getConfirmMaterial = function (idx, default_otp = null) {
    if(idx >= this.MT_parent_numberOfLeafs * this._hashchain_len){
        throw new Error('Index of OTP is out of range! Max index is: ' + String(this.MT_parent_numberOfLeafs * this._hashchain_len - 1));
    }
    var ret = [];
    var retSides = "0x"; // create side indications of the confirmation material items to enable reconstruct the root
    ret.push(this.fetchOTP(idx, default_otp)); // put OTP as the 1st and then all hashes of compact proof
    if(this._display_otps){
        console.log(`\tOTP mnemonic is: ${bip39.entropyToMnemonic(ret[0].substr(2, 34), ENGLISH_WORDLIST)} `)
    }

    if (0 == this.MT_child_height - this.MT_child_depthOfCachedLayer) {
        retSides += MT_STUB_SIDE; // this helps to resolve problems with solidity when retSides would be empty
    }

    var requestedChildTreeIdx = Math.floor((idx / this._hashchain_len) / this._MT_child_numberOfLeafs);
    var hashesOfCurLayer = [];
    for (let i = 0 ; i < this._MT_child_numberOfLeafs ; i++) // copy all child tree leafs
        hashesOfCurLayer.push(this.MT_parent_storageOfLeafs[this._MT_child_numberOfLeafs * requestedChildTreeIdx + i]);

    var idxInCurLayer = idx % this._MT_child_numberOfLeafs;
    // proceed from bottom to top
    for (let layer = 0; layer < (this.MT_child_height - this.MT_child_depthOfCachedLayer) ; layer++){
        var siblingIdx = (0 == idxInCurLayer % 2) ?  idxInCurLayer + 1 : idxInCurLayer - 1;
        ret.push(hashesOfCurLayer[siblingIdx]);
        retSides += (0 == idxInCurLayer % 2) ?  MT_LEFT_SIDE : MT_RIGHT_SIDE;
        hashesOfCurLayer = this.reduceMTByOneStep(hashesOfCurLayer);
        idxInCurLayer = Math.floor(idxInCurLayer / 2);
    }
    return [ret, retSides];
}
AuthenticatorMT.prototype.fetchOTP = function (idx, default_otp = null) { // Resolves hash chains and indexing of parent secrets

    // OTP was provided by HW authenticator
    if (null !== default_otp){
        return default_otp
    }

    // ~alpha = P - floor( (i % N_S) / (N_S/P) ) - 1
    var alpha = this._hashchain_len - Math.floor((idx % this._MT_child_numberOfOTPs) / this._MT_child_numberOfLeafs) - 1;

    // ~beta = floor(i/N_S) * N_S/P + (i % N_S/P)
    var beta = Math.floor(idx / this._MT_child_numberOfOTPs) * this._MT_child_numberOfLeafs + (idx % this._MT_child_numberOfLeafs)

     // console.log("\t\t Alpha = " + alpha + " Beta = " + beta)
     // console.log("\t\t MT_parent_secrets[beta] = ", this.MT_parent_secrets[beta])
     // console.log("\t\t hChainDS(MT_parent_secrets[beta], alpha) = ", hChainDS(this.MT_parent_secrets[beta], alpha))
    return hChainDS(this.MT_parent_secrets[beta], alpha)
}
AuthenticatorMT.prototype.dumpAllChildRootHashes = function () {
    console.log("Dumping all child root hashes:")
    for (let i = 0; i < this.MT_parent_layerOfChildRootHashes.length; i++) {
       console.log(`\t Child root hash[${i}] = ${this.MT_parent_layerOfChildRootHashes[i]}`)
    }
}
AuthenticatorMT.prototype.dumpAllOTPs = function () {
    childOneLayer = []
    console.log("Dumping OTPs")
    if (this._MT_parent_numberOfOTPs * this._hashchain_len > Math.pow(2, 12)) {
        return
    }

    for (let i = 0; i < this._MT_parent_numberOfOTPs; i++) {

        if(i % this._MT_child_numberOfOTPs  == 0){
            console.log("\t [Child " + Math.floor(i / this._MT_child_numberOfOTPs) + "]:" )
        }

        // childOneLayer.push( this.fetchOTP(i));
        childOneLayer.push("(" + bip39.entropyToMnemonic(this.fetchOTP(i).substr(2), ENGLISH_WORDLIST) + ") ");
        if(childOneLayer.length == this._MT_child_numberOfLeafs){
            let idx_layer = Math.floor((i % this._MT_child_numberOfOTPs) / this._MT_child_numberOfLeafs)
            console.log("\t\t [Layer " + idx_layer  + " ]: \t\t" + childOneLayer + "\n")
            childOneLayer = []
        }
    }
}
AuthenticatorMT.prototype.getAuthPath4ChildTree = function (idxOfChild) {
    if(idxOfChild >= this._MT_parent_numberOfLeafs / this._MT_child_numberOfLeafs){
        throw new Error('Index of child tree is out of range!');
    }
    var ret = [];
    var retSides = "0x"; // create side indications of the confirmation material items to enable reconstruct the root

    // copy a layer of all child root hashes
    var hashesOfCurLayer = cloneArray(this.MT_parent_layerOfChildRootHashes)

    ret.push(hashesOfCurLayer[idxOfChild]); // put new child root hash as the 1st
    if (0 == this.MT_parent_height - this.MT_child_height) {
        retSides += MT_STUB_SIDE; // this helps to resolve problems with solidity when retSides would be empty
    }

    var idxInCurLayer = idxOfChild;
    // proceed from bottom to top
    for (let layer = 0; layer < (this.MT_parent_height - this.MT_child_height) ; layer++){
        var siblingIdx = (0 == idxInCurLayer % 2) ?  idxInCurLayer + 1 : idxInCurLayer - 1;
        ret.push(hashesOfCurLayer[siblingIdx]);
        retSides += (0 == idxInCurLayer % 2) ?  MT_LEFT_SIDE : MT_RIGHT_SIDE;
        hashesOfCurLayer = this.reduceMTByOneStep(hashesOfCurLayer);
        idxInCurLayer = Math.floor(idxInCurLayer / 2);
    }
    return [ret, retSides];
}
AuthenticatorMT.prototype.reduceMT = function reduceMT (layer) {
    if (1 == layer.length) return layer[0];

    // console.log(`Tree Dump  ${layer.length}`, layer);
    var reducedLayer = [];
    for (var i = 0; i <= (layer.length / 2) - 1; i++) {
        reducedLayer[i] = h(concatB32(layer[2 * i], layer[2 * i + 1]));
    }
    return this.reduceMT(reducedLayer);
}
AuthenticatorMT.prototype.reduceMTByOneStep = function reduceMTByOneStep(layer) {
    var reducedLayer = [];
    for (var i = 0; i <= (layer.length / 2) - 1; i++) {
        reducedLayer[i] = h(concatB32(layer[2 * i], layer[2 * i + 1]));
    }
    return reducedLayer;
}


///// AUX Functions /////

// function hChain(arg, cnt) {
//     var ret = arg;
//     for (var i = 0; i < cnt; i++) {
//         ret = h(ret)
//     }
//     return ret
// }

function hChainDS(arg, cnt) {
    if(cnt < 0)
        throw new Error(`cnt >= 0 while ${cnt} was provided`);

    var ret = arg;
    // compute hash chain with domain separation until the OTP in first iteration layer
    for (var i = 0; i < cnt; i++) {
        // console.log("a = ", ret, " i = ", i);
        ret = h(
            concatB20("0x" + (i + 1).padLeft(8),  ret) // align value used for domain separation to 4B (i.e., max hChain len = 2^32)
        );
        // console.log(`h(${i} || a)= `, ret);
        // throw new Error("efr");
    }
    // return OTP from the 1st iteration layer
    return ret
}

function concatB32(a, b) {
    if (typeof(a) != 'string' || typeof(b) != 'string' || a.substr(0, 2) != '0x' || b.substr(0, 2) != '0x') {
        console.log("a, b = ", a, b)
        throw new Error("ConcatB32 supports only hex string arguments");
    }
    a = hexToBytes(a);
    b = hexToBytes(b);
    var res = []
    if (a.length != b.length || a.length != 16 || b.length != 16 )
        throw new Error("ConcatB32 supports only equally-long (16B) arguments.");

    for (var i = 0; i < a.length; i++) {
        res.push(a[i])
    }
    for (var i = 0; i < b.length; i++) {
        res.push(b[i])
    }
   return bytesToHex(res);
}

function concatB20(a, b) { // NOTE: a should have 4B and b should have 16B
    if (typeof(a) != 'string' || typeof(b) != 'string' || a.substr(0, 2) != '0x' || b.substr(0, 2) != '0x') {
        console.log("a, b = ", a, b)
        throw new Error("ConcatB20 supports only hex string arguments");
    }
    a = hexToBytes(a);
    b = hexToBytes(b);
    var res = []
    if (a.length != 4 || b.length != 16 )
        throw new Error("ConcatB20 supports only (4B and 16B) arguments.");

    for (var i = 0; i < a.length; i++) {
        res.push(a[i])
    }
    for (var i = 0; i < b.length; i++) {
        res.push(b[i])
    }
    return bytesToHex(res);
}

// Convert a byte array to a hex string
function bytesToHex(bytes) {
    var hex = [];
    for (i = 0; i < bytes.length; i++) {
        hex.push((bytes[i] >>> 4).toString(16));
        hex.push((bytes[i] & 0xF).toString(16));
    }
    // console.log("0x" + hex.join(""));
    return "0x" + hex.join("");
}

// Convert a hex string to a byte array
function hexToBytes(hex) {
    var bytes = [];
    for (c = 2; c < hex.length; c += 2)
        bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

function cloneArray(arr) {
    ret = []
    for (let i = 0; i < arr.length; i++) {
        ret.push(arr[i])
    }
    return ret
}

Number.prototype.padLeft = function(size) {
    var s = this.toString(16)
    while (s.length < (size || 2)) {
      s = "0" + s;
    }
    return s;
  }


module.exports = AuthenticatorMT;
