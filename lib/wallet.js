var merkle = require("./merkle.js");
const totp = require("./totp.js");
var web3 = require("web3");

console.log(totp)

function h16(a) { return web3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }).substring(0, 34); }
function h16a(a) { return web3.utils.soliditySha3(a).substring(0, 34); }
function padNumber(x) { return web3.utils.padRight(x, 32); }
function getTOTP(secret, counter, duration) { return totp.getToken(secret, {period: duration, counter: counter}); }

const TIMEOFFSET_DEFAULT = 1609459200;
const DURATION = 300;

function generateWallet(secret, depth, duration, timeOffset) {
    var leafs = [];
    console.log("!!", secret)
    var startCounter =  timeOffset / duration;
    console.log("Start counter=", startCounter);

    for ( var i=0; i < Math.pow(2, depth); i++) {
        leafs.push(h16(padNumber(web3.utils.toHex(getTOTP(secret, startCounter+i, duration)))));
    }

    const root = merkle.reduceMT(leafs);
    console.log("root="+ root);

    return {
        leafs: leafs,
        root: root
    }
}

function getProofWithOTP(currentOTP, leafs, timeOffset , duration) {
    var currentCounter = Math.floor(((Date.now() / 1000) - timeOffset) / duration);
    console.log("CurrentCounter=", currentCounter, currentOTP);
    var proof = merkle.getProof(leafs, currentCounter, padNumber(web3.utils.toHex(currentOTP)))

    console.log(proof)
    //console.log("counter=", (await this.testWallet.getCurrentCounter()).toString());
    return proof;
}

module.exports = {
    generateWallet,
    getProofWithOTP
}