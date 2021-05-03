
const truffleAssert = require("truffle-assertions");
const ethers = require("ethers");
const merkle = require("../lib/merkle.js");
const commons = require("./commons.js");

const DURATION = 300;
const time = Math.floor((Date.now() / 1000));
const timeOffset = time - (time% 300);        

contract("DailyLimit", accounts => {

    it("should test for daily limit", async () => {
        var tmpWallet = web3.eth.accounts.create();
        var {startCounter, root, leaves, wallet} = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address);
        var proof = commons.getTOTPAndProof(leaves, timeOffset, DURATION);

        await web3.eth.sendTransaction({from: accounts[0], to: wallet.address, value: web3.utils.toWei("1", "ether")});
        await wallet.makeTransfer(tmpWallet.address, web3.utils.toWei("0.01", "ether"), proof[0], proof[1]);
        var newBalance = await web3.eth.getBalance(tmpWallet.address);
        //console.log(newBalance);

        var overLimit = wallet.makeTransfer(tmpWallet.address, web3.utils.toWei("0.01", "ether"), proof[0], proof[1]);
        await truffleAssert.reverts(overLimit, "over withdrawal limit");
    })

})