const TOTPWallet = artifacts.require("TOTPWallet");
const Guardians = artifacts.require("Guardians");
const totp = require("../lib/totp.js");
const merkle = require("../lib/merkle.js");

function h16(a) { return web3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }).substring(0, 34); }
function h16a(a) { return web3.utils.soliditySha3(a).substring(0, 34); }
function padNumber(x) { return web3.utils.padRight(x, 32); }
function getTOTP(counter, duration) { return totp("JBSWY3DPEHPK3PXP", {period: duration, counter: counter}); }

async function createWallet(timeOffset, duration, depth, drainAddr) {
    var leaves = [];
    // 1year / 300 ~= 105120
    // 2^17 = 131072
    // 1609459200 is 2021-01-01 00:00:00 -- 
    // to save space, we're going to start from counter above!
    var startCounter = timeOffset / duration;
    //console.log("Start counter=", startCounter);

    for ( var i=0; i < Math.pow(2, depth); i++) {
        //console.log(i, web3.utils.padRight(getTOTP(startCounter+i),6));
        leaves.push(h16(padNumber(web3.utils.toHex(getTOTP(startCounter+i, duration)))));
    }
    const root = merkle.reduceMT(leaves);
    const guardians = await Guardians.new();
    await TOTPWallet.link("Guardians", guardians.address);
    var wallet = await TOTPWallet.new(root, depth, duration, timeOffset, drainAddr, web3.utils.toWei("0.01", "ether"));

    return {
        startCounter,
        root,
        leaves,
        wallet
    }
}

function getTOTPAndProof(leaves, timeOffset, duration) {
    var startCounter = timeOffset / duration;
    var currentCounter = Math.floor(((Date.now() / 1000) - timeOffset) / duration);
    var currentOTP = getTOTP(startCounter + currentCounter, duration);
    var proof = merkle.getProof(leaves, currentCounter, padNumber(web3.utils.toHex(currentOTP)))
    return proof;
}

module.exports = {
    h16,
    h16a,
    padNumber,
    getTOTP,
    createWallet,
    getTOTPAndProof
}