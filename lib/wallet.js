var merkle = require("./merkle.js");
const totp = require("./totp.js");
var web3 = require("web3");
const ethers = require("ethers");
const ethAbi = require("web3-eth-abi");

console.log(totp)

function h16(a) { return web3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }).substring(0, 34); }
function h16a(a) { return web3.utils.soliditySha3(a).substring(0, 34); }
function padNumber(x) { return web3.utils.padRight(x, 32); }
function getTOTP(secret, counter, duration) { return totp(secret, {period: duration, counter: counter}); }

function generateWallet(secret, depth, duration, timeOffset) {
    var leafs = [];
    console.log("!!", secret, depth, duration, timeOffset)
    var startCounter =  timeOffset / duration;
    console.log("Start counter=", startCounter);

    for ( var i=0; i < Math.pow(2, depth); i++) {
        leafs.push(h16(padNumber(web3.utils.toHex(getTOTP(secret, startCounter+i, duration)))));
        console.log(i, getTOTP(secret, startCounter+i, duration), leafs[leafs.length-1])
    }

    const root = merkle.reduceMT(leafs);
    console.log("root="+ root);

    return {
        leafs: leafs,
        root: root
    }
}

function getProofWithOTP(currentOTP, leafs, timeOffset , duration) {
    var startCounter = timeOffset / duration;
    var currentCounter = Math.floor(((Date.now() / 1000) - timeOffset) / duration);
    console.log("CurrentCounter=", currentCounter, currentOTP);
    var proof = merkle.getProof(leafs, currentCounter, padNumber(web3.utils.toHex(currentOTP)))

    console.log(proof)
    //console.log("counter=", (await this.testWallet.getCurrentCounter()).toString());
    return proof;
}


async function signRecoveryOffchain(signers, rootHash, merkelHeight, timePeriod, timeOffset) {
    const messageHash = getMessageHash(rootHash, merkelHeight, timePeriod, timeOffset);
    const signatures = await Promise.all(
      signers.map(async (signer) => {
        const sig = await signMessage(messageHash, signer);
        return sig.slice(2);
      })
    );
    const joinedSignatures = `0x${signatures.join("")}`;
    //console.log("sigs", joinedSignatures);

    return joinedSignatures;
  }

function getMessageHash(rootHash, merkelHeight, timePeriod, timeOffset) {
    const TYPE_STR = "startRecovery(bytes16, uint8, uint, uint)";
    const TYPE_HASH = ethers.utils.keccak256(Buffer.from(TYPE_STR));

    //console.log(rootHash, merkelHeight, timePeriod, timeOffset, TYPE_HASH);

    const encodedRequest = ethAbi.encodeParameters(
        ["bytes32", "bytes16", "uint8", "uint", "uint"],
        [TYPE_HASH, rootHash, merkelHeight, timePeriod, timeOffset]
      );

    const messageHash = ethers.utils.keccak256(encodedRequest);
    return messageHash;
}

async function signMessage(message, signer) {
    console.log(signer)
    const sig = await window.web3.eth.personal.sign(message, signer);
    //console.log(message, sig);
    let v = parseInt(sig.substring(130, 132), 16);
    if (v < 27) v += 27;
    const normalizedSig = `${sig.substring(0, 130)}${v.toString(16)}`;
    return normalizedSig;
}

function sortWalletByAddress(wallets) {
    return wallets.sort((s1, s2) => {
        const bn1 = ethers.BigNumber.from(s1);
        const bn2 = ethers.BigNumber.from(s2);
        if (bn1.lt(bn2)) return -1;
        if (bn1.gt(bn2)) return 1;
        return 0;
    })
}


module.exports = {
    generateWallet,
    getProofWithOTP,
    signRecoveryOffchain
}