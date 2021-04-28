const TOTPWallet = artifacts.require("TOTPWallet");
const ethers = require("ethers");
var merkle = require("../lib/merkle.js");
var BN = web3.utils.BN;
const totp = require("../lib/totp.js");

// const truffleAssert = require("truffle-assertions");
var DURATION = 300;
function h16(a) { return web3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }).substring(0, 34); }
function h16a(a) { return web3.utils.soliditySha3(a).substring(0, 34); }
function padNumber(x) { return web3.utils.padRight(x, 32); }
function getTOTP(counter) { return totp("JBSWY3DPEHPK3PXP", {period: DURATION, counter: counter}); }
const timeOffset = 1609459200;

contract("OTPWallet", accounts => {

    async function createWallet(depth, drainAddr) {
        var leaves = [];
        // 1year / 300 ~= 105120
        // 2^17 = 131072
        // 1609459200 is 2021-01-01 00:00:00 -- 
        // to save space, we're going to start from counter above!
        var startCounter = timeOffset / DURATION;
        console.log("Start counter=", startCounter);

        for ( var i=0; i < Math.pow(2, depth); i++) {
            //console.log(i, web3.utils.padRight(getTOTP(startCounter+i),6));
            leaves.push(h16(padNumber(web3.utils.toHex(getTOTP(startCounter+i)))));
        }
        const root = merkle.reduceMT(leaves);
        var wallet = await TOTPWallet.new(root, depth, DURATION, timeOffset, drainAddr);

        return {
            startCounter,
            root,
            leaves,
            wallet
        }
    }
    it("should transfer & drain", async () => {
        //const leaves = [h16(padNumber('0x1')),h16(padNumber('0x2')),h16(padNumber('0x3')),h16(padNumber('0x4'))];
 
        var tmpWallet = web3.eth.accounts.create();

        var {startCounter, root, leaves, wallet} = await createWallet(16, tmpWallet.address);
        console.log("root="+ root);
        //console.log("leaves=", leaves);

        var currentCounter = Math.floor(((Date.now() / 1000) - timeOffset) / DURATION);
        var currentOTP = getTOTP(startCounter + currentCounter);

        console.log("CurrentCounter=", currentCounter, currentOTP);

        var proof = merkle.getProof(leaves, currentCounter, padNumber(web3.utils.toHex(currentOTP)))
        console.log(proof)
        console.log("counter=", (await wallet.getCurrentCounter()).toString());

        var receipt = await wallet._reduceConfirmMaterial(proof[0], proof[1]);

        await web3.eth.sendTransaction({from: accounts[0], to: wallet.address, value: web3.utils.toWei("1", "ether")});

        await wallet.makeTransfer(tmpWallet.address, 100000000, proof[0], proof[1]);
        var newBalance = await web3.eth.getBalance(tmpWallet.address);
        console.log("Balance=", newBalance);
        assert.equal(newBalance, 100000000, "withdraw amount is correct");
        
        currentCounter = Math.floor(((Date.now() / 1000) - timeOffset) / DURATION);
        currentOTP = getTOTP(startCounter + currentCounter);
        console.log("CurrentCounter=", currentCounter, currentOTP);
        proof = merkle.getProof(leaves, currentCounter, padNumber(web3.utils.toHex(currentOTP)))
        await wallet.drain(proof[0], proof[1])
        var newBalance = await web3.eth.getBalance(tmpWallet.address);
        console.log("Balance=", newBalance);
        assert.equal(newBalance, web3.utils.toWei("1", "ether"), "withdraw amount is correct");

    })
    it("should drain properly", async () => {

    })
});