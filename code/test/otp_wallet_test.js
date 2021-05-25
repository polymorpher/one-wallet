
const truffleAssert = require("truffle-assertions");
const ethers = require("ethers");
const merkle = require("../lib/merkle.js");
const commons = require("./commons.js");

const DURATION = 300;
const time = Math.floor((Date.now() / 1000));
const timeOffset = time - (time% 300);        

contract("OTPWallet", accounts => {

    it("should transfer & drain", async () => {
        //const leaves = [h16(padNumber('0x1')),h16(padNumber('0x2')),h16(padNumber('0x3')),h16(padNumber('0x4'))];
 
        var tmpWallet = web3.eth.accounts.create();
        var {startCounter, root, leaves, wallet} = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address);
        console.log("root="+ root);
        //console.log("leaves=", leaves);


        // var receipt = await wallet._reduceConfirmMaterial(proof[0], proof[1]);
        await web3.eth.sendTransaction({from: accounts[0], to: wallet.address, value: web3.utils.toWei("1", "ether")});

        var proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION);
        await wallet.makeTransfer(tmpWallet.address, web3.utils.toWei("0.01", "ether"), proof[0], proof[1]);
        var newBalance = await web3.eth.getBalance(tmpWallet.address);
        console.log("Balance=", newBalance);
        assert.equal(newBalance, web3.utils.toWei(".01", "ether"), "withdraw amount is correct");
        
        proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION);
        await wallet.drain(proof[0], proof[1])
        var newBalance = await web3.eth.getBalance(tmpWallet.address);
        console.log("Balance=", newBalance);
        assert.equal(newBalance, web3.utils.toWei("1", "ether"), "withdraw amount is correct");

    })
    it("checks for remaing token", async () => {
        var tmpWallet = web3.eth.accounts.create();
        var {startCounter, root, leaves, wallet} = await commons.createWallet(timeOffset - (Math.pow(2, 2) * DURATION),  DURATION, 2, tmpWallet.address);
        var hasTokens = await wallet.remainingTokens();
        console.log("counter=", (await wallet.getCurrentCounter()).toString());
        console.log(hasTokens);
        assert.isTrue(hasTokens > 0);               
    })
});