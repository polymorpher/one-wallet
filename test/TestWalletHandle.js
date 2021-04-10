var WalletHandle = artifacts.require("./WalletHandle.sol");
var Web3 = require('web3');
var W3 = new Web3();
function h(a) { return W3.utils.soliditySha3({v: a, t: "bytes", encoding: 'hex' }).substring(0, 34); }

var ac = require("../lib/auth_config.js") // Config of unit test authenticator
var AuthenticatorMT = require("../lib/authenticator.js");
var auth = new AuthenticatorMT(ac.PARENT_NUMBER_OF_LEAFS, ac.CHILD_NUMBER_OF_LEAFS, ac.CHILD_DEPTH_OF_CACHED_LAYER, ac.HASH_CHAIN_LEN, ac.MNEM_WORDS, 0, null, true);

var OperationTypeEnum = Object.freeze({"TRANSFER": 0,  "SET_DAILY_LIMIT" : 1, "SET_LAST_RESORT_ADDRESS" : 2, "SET_LAST_RESORT_TIMEOUT" : 3,
  "DESTRUCT_WALLET" : 4, "NOP" : 5
});
var daysFromPrevTestSuites = 0; // previously increased time of EVM by other tests

const DO_TREE_DEPLETION = true;
const NULL_ADDRESS = "0x0000000000000000000000000000000000000000";

if(DO_TREE_DEPLETION && ac.HASH_CHAIN_LEN <= 1){
  throw "When doing tree depletion, you have to adjust hash chain length (../lib/auth_config.js) to values > 1 in order to check invalidation of iteration layers.";
}
if(ac.CHILD_NUMBER_OF_LEAFS < Math.pow(2, 2)){
  throw "Minimum number of leaves in subtree for these unit tests is 4."
}


// describe.skip("Skipped ", function(){

contract('WaletHandle - TEST SUITE 1 [Initial checks and a transfer]', function(accounts) {

  it("Zero Ballance", function(){
    return WalletHandle.deployed()
    .then(function(instance) {
      // console.log(instance.contract.address);
      return web3.eth.getBalance(instance.contract._address);
    })
    .then(function(result) {
      assert.equal(0, result);
    });
  });

  it("Contract owner is account[0]", function(){
    return WalletHandle.deployed()
    .then(function(instance) {
      owner = instance.contract.methods.owner().call();
      return owner;
    })
    .then(function(owner) {
      assert.equal(accounts[0], owner);
    });
  });

  it("Send money to Contract", function(){
    var contract;
    return WalletHandle.deployed()
    .then(function(instance) {
      contract = instance;

      return web3.eth.sendTransaction({
        from: accounts[0],
        to: instance.address,
        value: W3.utils.toWei('5', 'ether'),
      });
    })
    .then(function(receipt){
      // console.log(receipt);
      return web3.eth.getBalance(contract.address)
    })
    .then(function(balance){
      var contrBalance = balance;
      console.log("\t Current balance of contract is", W3.utils.fromWei(contrBalance.toString(), 'ether'), 'Ethers.');
      assert.equal(contrBalance, W3.utils.toWei('5', 'ether'));
      return web3.eth.getBalance(accounts[0]);
    })
    .then(function(balance){
      // console.log("balance = ", balance);
      var senderBalance = balance;
      assert.ok(senderBalance <  W3.utils.toWei('95', 'ether')); //&& senderBalance >  W3.utils.toWei('94', 'ether')
    });
  });

  it("Init transfer of funds", async () => {
    var owner = accounts[0];
    var receiver = accounts[1];
    var amount2Send = W3.utils.toWei('1', 'ether');
    var contract;

    var contract = await WalletHandle.deployed()

    var receipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
    console.log("\t \\/== Gas used:", receipt.receipt.gasUsed);
    // console.log("\t receipt", receipt.logs[0].args);

    var tokenID = await contract.getCurrentOtpID.call();
    assert.equal(1, tokenID);

    var newOper = await contract.pendingOpers.call(0); // 0 is the index of actual Oper
    // console.log("\t", newOper); // struct is returned as tuple / object in JS
    assert.equal(newOper[0], receiver);  // address of receiver
    assert.equal(newOper[1], amount2Send);  // amount
    assert.equal(newOper[2], true); // is pending == true
    assert.equal(newOper[3], OperationTypeEnum.TRANSFER); // is operType == TRANSFER
  });

  it("Confirm transfer of funds", async () => {
    var owner = accounts[0];
    var receiver = accounts[1];
    var amount2Send = W3.utils.toWei('1', 'ether');
    var recvBalanceBefore = await web3.eth.getBalance(receiver);
    var contract;

    var tokenID = 0; // the 1st operation ever
    var contract = await WalletHandle.deployed();

    var secMatWithSides = auth.getConfirmMaterial(tokenID);
    console.log(`\t Secret material of token ${tokenID} is`, secMatWithSides[0], hexToBytes(secMatWithSides[1]));
    var receipt = await contract.confirmOper(...auth.getConfirmMaterial(tokenID), tokenID, {from: owner});
    console.log("\t \\/== Gas used:", receipt.receipt.gasUsed);
    // console.log(receipt.logs[0].args);
    // console.log(receipt.logs[1].args);

    firstOperInBuf = await contract.pendingOpers.call(tokenID);
    assert.equal(firstOperInBuf[0], receiver);
    assert.equal(firstOperInBuf[1], amount2Send);
    assert.equal(firstOperInBuf[2], false);
    assert.equal(firstOperInBuf[3], OperationTypeEnum.TRANSFER);
    bal = await web3.eth.getBalance(receiver);
    recvBalanceAfter = bal;
    assert.equal(BigInt(recvBalanceBefore) + BigInt(amount2Send), BigInt(recvBalanceAfter));
  });

  it("Try to init TRANSFER and confirm by wrong token", async () => {
    var contract = await WalletHandle.deployed();
    var receiver = accounts[1];
    var idxOfTx = 1; // 2nd one
    var amount2Send = W3.utils.toWei('0.1', 'ether');
    var owner = accounts[0];

    var tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed);

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfTx + 1, parseInt(currentOTPID));

    var operation = await contract.pendingOpers.call(idxOfTx);
    assert(operation[2]); // is pending == true
    assert.equal(amount2Send, operation[1]);

    try {
      var wrongTokenId = idxOfTx + 1;
      // console.log("\t Secret material is", ...auth.getConfirmMaterial(wrongTokenId));
      var receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(wrongTokenId), idxOfTx, {from: owner});
      console.log(receipt1);
      assert.fail('Expected revert not received');
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0;
      assert(revertFound, `Expected "revert", got ${error} instead`);
    }

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfTx + 1, parseInt(currentOTPID));
    var executedOper = await contract.pendingOpers.call(idxOfTx);
    assert(executedOper[2]); // pending == true
  });

});

// });//

// describe.skip("Skipped ", function(){

contract('WaletHandle - TEST SUITE 2 [Deplete child tree OTPs, init new child tree ; deplete parent OTPs ; new parent tree]:', function(accounts) {
  var owner = accounts[0];
  var amount2Send = W3.utils.toWei('0.1', 'ether');
  var receiver = accounts[1];
  var contract;

  it("Bootstrap / send 50 Eth at contract", async () => {
    sender = accounts[5];
    var initialAmount = W3.utils.toWei('20', 'ether');
    var senderBalanceBefore = BigInt(await web3.eth.getBalance(sender));
    contract = await WalletHandle.deployed();

    var txreceipt = await web3.eth.sendTransaction({from: sender, to: contract.address, value: initialAmount});
    // throw Error("...");
    txHash = txreceipt.transactionHash;

    const tx = await web3.eth.getTransaction(txHash);
    txreceipt = await web3.eth.getTransactionReceipt(txHash);

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt.gasUsed);
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed);

    var expectedBallance = BigInt(initialAmount);
    assert.equal( BigInt(await web3.eth.getBalance(contract.address)), expectedBallance);

    var senderBalanceAfter = BigInt(await web3.eth.getBalance(sender));
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    );
  });

  it("Try to initialize new child tree operation prematurely. ", async () => {

    var curChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
    var newChildTreeIdx = parseInt(curChildTreeIdx)
    var curOTPID = parseInt(await contract.getCurrentOtpID.call());

    try {
      await contract.adjustNewChildTree(
        auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(newChildTreeIdx),
        ...auth.getAuthPath4ChildTree(newChildTreeIdx), ...auth.getConfirmMaterial(curOTPID), {from: owner}
      );
      assert.fail('Expected revert not received');
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0;
      assert(revertFound, `Expected "revert", got ${error} instead`);
    }
  });

  it("Deplete child tree OTPs by TRANSFER operations", async () => {
    if(DO_TREE_DEPLETION){
      currentOtpID = parseInt(await contract.getCurrentOtpID.call());
      assert.equal(0, currentOtpID);

      var sizeOfChildTree = parseInt(await contract.MT_child_numberOfOTPs.call());

      for (var i = 0; i < sizeOfChildTree - 1 ; i++) {
        tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
        console.log(`\t \\/== Gas used in init TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed);

        // confirm operations as well
        tmpReceipt = await contract.confirmOper(...auth.getConfirmMaterial(currentOtpID), currentOtpID, {from: owner});
        console.log(`\t \\/== Gas used in confirm TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed);
        console.log("\t receipt", BigInt(tmpReceipt.logs[0].args[1]) );
        currentOtpID++;
      }

      // init one more transaction - the last OTP in child tree can be used only for a new child tree operation
      try {
        await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
        assert.fail('Expected revert not received');
      } catch (error) {
        const revertFound = error.message.search('revert') >= 0;
        assert(revertFound, `Expected "revert", got ${error} instead`);

        curTokID = await contract.getCurrentOtpID.call();
        assert.equal(parseInt(sizeOfChildTree), parseInt(curTokID) + 1);
      }
    } else {
      console.log("\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false")
    }
  });

  it("Try to confirm OTP from invalid iteration layer. ", async () => {
    if(DO_TREE_DEPLETION){
      try {
        var receipt = await contract.confirmOper(...auth.getConfirmMaterial(0), 0, {from: owner});
        console.log(`\t \\/== Receipt = `, receipt.receipt);
        assert.fail('Expected revert not received');
      } catch (error) {
        const revertFound = error.message.search('revert') >= 0;
        assert(revertFound, `Expected "revert", got ${error} instead`);
      }
    } else {
      console.log("\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false")
    }
  });

  it("Initialize a new child tree when child tree OTPs are depleted. ", async () => {
    if(DO_TREE_DEPLETION){
      var curChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      var newChildTreeIdx = parseInt(curChildTreeIdx) + 1
      var curOTPID = await contract.getCurrentOtpID.call()
      assert.equal(parseInt(curOTPID), auth.MT_child_numberOfOTPs * newChildTreeIdx - 1)

      await contract.adjustNewChildTree(
        auth.MT_child_depthOfCachedLayer,
        auth.getChildCachedLayer(newChildTreeIdx),
        ...auth.getAuthPath4ChildTree(newChildTreeIdx),
        ...auth.getConfirmMaterial(parseInt(curOTPID)),
        {from: owner}
      );

      var realNewChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      assert.equal(parseInt(realNewChildTreeIdx), newChildTreeIdx)
      var newOTPID = await contract.getCurrentOtpID.call()
      assert.equal(parseInt(newOTPID), parseInt(curOTPID) + 1)

      var nopOper = await contract.pendingOpers.call(parseInt(curOTPID))
      assert(!nopOper[2]) // pending == false
      assert.equal(OperationTypeEnum.NOP, nopOper[3]) // operation type == NOP

      var newRoot = await contract.MT_child_rootHash.call()
      var authPath = auth.getAuthPath4ChildTree(newChildTreeIdx)
      assert.equal(newRoot, authPath[0][0])
    } else {
      console.log("\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false")
    }
  });

  it("Init 3 TRANSFER operations and confirm the 2nd one", async () => {
    await init3TransfersAndConfirm2nd(auth.MT_child_numberOfOTPs)
  });

  it("Deplete all parent tree OTPs.", async () => {
      await depleteOTPs()
  });

  it("Try to init a new opearation when all parent OTPs are depleted.", async () => {
    if(DO_TREE_DEPLETION){
      currentOtpID = await contract.getCurrentOtpID.call();
      assert.equal(auth.MT_parent_numberOfOTPs - 1, parseInt(currentOtpID));

      // init one more transaction - the last OTP in child tree can be used only for a new child tree operation
      try {
        await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
        assert.fail('Expected revert not received');
      } catch (error) {
        const revertFound = error.message.search('revert') >= 0;
        assert(revertFound, `Expected "revert", got ${error} instead`);

        currentOtpID = await contract.getCurrentOtpID.call();
        assert.equal(auth.MT_parent_numberOfOTPs - 1, parseInt(currentOtpID));
      }
    } else {
      console.log("\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false")
    }
  });

  it("Adjust a new parent tree.", async () => {
    if(DO_TREE_DEPLETION){
      var currentOtpID = await contract.getCurrentOtpID.call();
      assert.equal(auth.MT_parent_numberOfOTPs - 1, parseInt(currentOtpID));
      var oldChildRoot = await contract.MT_child_rootHash.call()
      var sizeOfstage1Buf = await contract.getSizeOfNPT_stage1Buf.call()
      var sizeOfstage2Buf = await contract.getSizeOfNPT_stage2Buf.call()
      assert.equal(0, parseInt(sizeOfstage1Buf))
      assert.equal(0, parseInt(sizeOfstage2Buf))

      var cmAndSides = auth.getConfirmMaterial(parseInt(currentOtpID))
      var otp = cmAndSides[0][0]
      var parentRootBefore = auth._MT_parent_rootHash
      console.log("parent root hash before update = ", parentRootBefore)
      auth.generateNextParentTree(ac.MNEM_WORDS) // this regenerates new parent tree and updates authenticator
      assert(parentRootBefore !== auth.MT_parent_rootHash)

      // stage 1 - put h(root || otp) into 1st stage buffer
      var maliciousHashOfRootAndOTP = h(concatB32(oldChildRoot, cmAndSides[0][1]))
      var hashOfRootAndOTP = h(concatB32(auth.MT_parent_rootHash, otp))
      await contract.adjustNewParentTree_stage1(maliciousHashOfRootAndOTP, {from: owner})
      await contract.adjustNewParentTree_stage1(hashOfRootAndOTP, {from: owner})

      // stage 2 - put root into 2nd stage buffer
      await contract.adjustNewParentTree_stage2(oldChildRoot, {from: owner}) // malicious
      await contract.adjustNewParentTree_stage2(oldChildRoot, {from: owner}) // malicious
      await contract.adjustNewParentTree_stage2(auth.MT_parent_rootHash, {from: owner}) // legitimate
      console.log("puting new parent root hash into buffer of stage 2 = ", auth.MT_parent_rootHash)

      // stage 3 - provide otp
      await contract.adjustNewParentTree_stage3(cmAndSides[0], cmAndSides[1],
          auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(0), ...auth.getAuthPath4ChildTree(0)
      )
      // auth.dumpAllOTPs()
      // auth.dumpAllChildRootHashes()

      var newParentRoot = await contract.MT_parent_rootHash.call()
      assert.equal(newParentRoot, auth.MT_parent_rootHash)
      var newChildRoot = await contract.MT_child_rootHash.call()
      assert.equal(newChildRoot, auth.getAuthPath4ChildTree(0)[0][0])
      var curChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      assert.equal(parseInt(curChildTreeIdx), 0)
      currentOtpID = await contract.getCurrentOtpID.call();
      assert.equal(0, parseInt(currentOtpID));

    } else {
      console.log("\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false")
    }
  });

  it("Do some operations from the 2nd parent tree", async () => {
    await init3TransfersAndConfirm2nd(0)
  });

  it("Deplete all parent tree OTPs again", async () => {
    await depleteOTPs()
  });

  var init3TransfersAndConfirm2nd = async (startOTPIdx) => {
    if(DO_TREE_DEPLETION){
      var balanceBefore = BigInt(await web3.eth.getBalance(contract.address));
      var currentOtpID = await contract.getCurrentOtpID.call();
      assert.equal(startOTPIdx, parseInt(currentOtpID));
      var OPER_CNT = 3;

      for (var i = parseInt(currentOtpID); i < parseInt(currentOtpID) + OPER_CNT; i++) {
        var tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
        console.log(`\t \\/== Gas used in init TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed);
      }
      currentOtpID = await contract.getCurrentOtpID.call();
      assert.equal(startOTPIdx + OPER_CNT, parseInt(currentOtpID));

      var idxOfTx = startOTPIdx + 1; // 2nd initialized operation
      var operation = await contract.pendingOpers.call(idxOfTx);
      assert(operation[2]); // is pending == true
      assert.equal(amount2Send, operation[1]);

      var receipt = await contract.confirmOper(...auth.getConfirmMaterial(idxOfTx), idxOfTx, {from: owner});
      console.log(`\t \\/== Gas used in CONFIRM TRANSFER: `, receipt.receipt.gasUsed);

      var executedOper = await contract.pendingOpers.call(idxOfTx)
      assert(!executedOper[2]) // pending == false
      const tx = await web3.eth.getTransaction(receipt.receipt.transactionHash);

      const gasCost = BigInt(BigInt(tx.gasPrice) * BigInt(receipt.receipt.gasUsed));
      console.log("\t \\/== Gas cost was: ", W3.utils.fromWei(gasCost.toString(), 'ether'), " Eth");
      var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
      assert.equal(balanceBefore - BigInt(amount2Send), balanceAfter);
    } else {
      console.log("\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false")
    }
  }

  var depleteOTPs = async  () => {
      if(DO_TREE_DEPLETION){
        var childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
        var currentOtpID = await contract.getCurrentOtpID.call();
        var allChildTrees = Math.floor(auth.MT_parent_numberOfOTPs / auth.MT_child_numberOfOTPs);
        for (let t = parseInt(childTreeIdx); t < allChildTrees; t++) { //iterate over remaining child trees

          // iterate over remaining child leaves
          for (var i = parseInt(currentOtpID); i < ((t + 1) * auth._MT_child_numberOfOTPs) - 1; i++) {
            var tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
            console.log(`\t \\/== Gas used in init TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed);

            // confirm operations as well
            tmpReceipt = await contract.confirmOper(...auth.getConfirmMaterial(currentOtpID), currentOtpID, {from: owner});
            console.log(`\t \\/== Gas used in confirm TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed);
            // console.log("\t receipt", BigInt(tmpReceipt.logs[0].args[1]) );
            currentOtpID++;
          }

          // bootstrap a new child tree (normally / at the end of all OTPs)
          currentOtpID = await contract.getCurrentOtpID.call();
          if(t < allChildTrees - 1){ // normal adjustment
            var tmpReceipt = await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(t + 1),
              ...auth.getAuthPath4ChildTree(t + 1), ...auth.getConfirmMaterial(parseInt(currentOtpID)), {from: owner}
            );
            `\t New child tree adjusted [${t + 1}]`
            console.log(`\t \\/== New child tree adjusted [${t + 1}] | Gas usage = `, tmpReceipt.receipt.gasUsed);
            var newChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
            assert.equal(parseInt(newChildTreeIdx), t + 1);
          } else { // adjustment after the end of all OTPs of the last child tree should make an exception
            try {
              await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(0),
                ...auth.getAuthPath4ChildTree(0), ...auth.getConfirmMaterial(parseInt(currentOtpID)), {from: owner}
              );
              assert.fail('Expected revert not received');
            } catch (error) {
              const revertFound = error.message.search('revert') >= 0;
              assert(revertFound, `Expected "revert", got ${error} instead`);
            }
          }
          currentOtpID = await contract.getCurrentOtpID.call();
          childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
        }
        assert.equal(parseInt(currentOtpID), auth.MT_parent_numberOfOTPs - 1)
        assert.equal(parseInt(childTreeIdx), allChildTrees - 1)
      } else {
        console.log("\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false")
      }
  };

  it("Epilogue => reset authenticator to initial state", async () => {
    if(DO_TREE_DEPLETION){
      auth = new AuthenticatorMT(ac.PARENT_NUMBER_OF_LEAFS, ac.CHILD_NUMBER_OF_LEAFS, ac.CHILD_DEPTH_OF_CACHED_LAYER, ac.HASH_CHAIN_LEN, ac.MNEM_WORDS, 0, null, true);
    }
  });

});

// });//

// describe.skip("Skipped ", function(){

contract('WaletHandle - TEST SUITE 3 [Playing with daily limits]:', function(accounts) {
  var owner = accounts[0];
  var tooBigAmount2Send = W3.utils.toWei('10', 'ether');
  var newDailyLimit = W3.utils.toWei('0.5', 'ether');
  var newIncreasedDailyLimit = W3.utils.toWei('0.6', 'ether');
  var amountOutOfDailyLimit = W3.utils.toWei('0.51', 'ether');
  var nextSmallAmount = W3.utils.toWei('0.1', 'ether');
  var receiver = accounts[1];
  var contract;

  it("Bootstrap / send 1 Eth at contract", async () => {
    sender = accounts[1];
    var initialAmount = W3.utils.toWei('1', 'ether');
    var senderBalanceBefore = BigInt(await web3.eth.getBalance(sender));
    contract = await WalletHandle.deployed();

    var txreceipt = await web3.eth.sendTransaction({from: sender, to: contract.address, value: initialAmount});
    // throw Error("...");
    txHash = txreceipt.transactionHash;

    const tx = await web3.eth.getTransaction(txHash);
    txreceipt = await web3.eth.getTransactionReceipt(txHash);

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt.gasUsed);
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed);

    var expectedBallance = BigInt(initialAmount);
    assert.equal( BigInt(await web3.eth.getBalance(contract.address)), expectedBallance);

    var senderBalanceAfter = BigInt(await web3.eth.getBalance(sender));
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    );
  });

  it("Try to send more than balance and generate 1 unconfirmed transfer", async () => {
    var balanceBefore = BigInt(await web3.eth.getBalance(contract.address));
    var currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(0, parseInt(currentOtpID));
    var idxOfTx = 0; // 1st one

    var tmpReceipt = await contract.initNewOper(receiver, tooBigAmount2Send, OperationTypeEnum.TRANSFER, {from: owner});
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed);

    var currentOTPID = await contract.getCurrentOtpID.call();
    var operation = await contract.pendingOpers.call(idxOfTx);
    confirmedTokenId = parseInt(currentOTPID) - 1;
    assert(operation[2]); // is pending == true
    assert.equal(BigInt(tooBigAmount2Send), operation[1]);

    try {
      var receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(confirmedTokenId), confirmedTokenId, {from: owner});
      assert.fail('Expected revert not received');
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0;
      assert(revertFound, `Expected "revert", got ${error} instead`);
    }
    var executedOper = await contract.pendingOpers.call(idxOfTx);
    assert(executedOper[2]); // pending == true

    // txHash = "???????"; // TODO: Need to figure out how to get hash of failed transaction.
    // const tx = await web3.eth.getTransaction(txHash);
    // const receipt = await web3.eth.getTransactionReceipt(txHash)

    // const gasCost = tx.gasPrice.mul(receipt.gasUsed));
    // console.log(`\t \\/== Gas used in failed CONFIRM TRANSFER: `, receipt.gasUsed);
    // console.log("\t \\/== Gas cost was: ", W3.utils.fromWei(gasCost.toString(), 'ether'), " Eth");
    var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
    assert.equal(balanceBefore, balanceAfter);
  });

  it("Adjust daily limit", async () => {
    var idxOfTx = 1; // 2nd one in buffer

    var dailyLimBefore = await contract.dailyLimits.call();
    assert.equal(0, BigInt(dailyLimBefore[0])) // dailyLimit == 0
    assert.equal(0, BigInt(dailyLimBefore[1])) // dailyAlreadySpent == 0
    assert.equal(Math.floor(Date.now() / (24 * 3600 * 1000)), BigInt(dailyLimBefore[2])) // relatedDay is today

    console.log("owner = ", owner, typeof owner)
    var tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newDailyLimit, OperationTypeEnum.SET_DAILY_LIMIT, {from: owner});
    console.log(`\t \\/== Gas used in init SET_DAILY_LIMIT:`, tmpReceipt.receipt.gasUsed);

    var currentOTPID = await contract.getCurrentOtpID.call();
    var confirmedTokenId = parseInt(currentOTPID) - 1;
    console.log("confirmedTokenId = ", confirmedTokenId);
    var receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(confirmedTokenId), confirmedTokenId, {from: owner});
    console.log(`\t \\/== Gas used in confirm SET_DAILY_LIMIT:`, receipt1.receipt.gasUsed);
    // console.log("\t receipt", receipt1.logs[0].args);
    // console.log("\t receipt", receipt1.logs[1].args);

    var executedOper = await contract.pendingOpers.call(idxOfTx);
    assert(!executedOper[2]); // pending == false

    var dailyLimAfter = await contract.dailyLimits.call();
    assert.equal(BigInt(newDailyLimit), BigInt(dailyLimAfter[0])) // dailyLimit == newDailyLimit
  });

  it("Exceed the new daily limit and generate 1 unconfirmed transfer in buffer", async () => {
    var balanceBefore = BigInt(await web3.eth.getBalance(contract.address));
    var currentOTPID = await contract.getCurrentOtpID.call();
    var idxOfTx = parseInt(currentOTPID)

    var tmpReceipt = await contract.initNewOper(receiver, amountOutOfDailyLimit, OperationTypeEnum.TRANSFER, {from: owner});
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed);

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfTx + 1, parseInt(currentOTPID));
    var operation = await contract.pendingOpers.call(idxOfTx);
    confirmedTokenId = parseInt(currentOTPID) - 1;
    assert(operation[2]); // is pending == true
    assert.equal(BigInt(amountOutOfDailyLimit), operation[1])

    try {
      var receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(confirmedTokenId), confirmedTokenId, {from: owner});
      assert.fail('Expected revert not received');
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0;
      assert(revertFound, `Expected "revert", got ${error} instead`);
    }

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfTx + 1, parseInt(currentOTPID));
    var executedOper = await contract.pendingOpers.call(idxOfTx);
    assert(executedOper[2]); // pending == true
    var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
    assert.equal(balanceBefore, balanceAfter);
  });

  it("Increase daily limits and confirm the last transfer", async () => {
    var idxOfTx = await contract.getCurrentOtpID.call();
    var idxOfTxBefore = parseInt(idxOfTx) - 1
    var balanceBefore = BigInt(await web3.eth.getBalance(contract.address));

    var tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newIncreasedDailyLimit, OperationTypeEnum.SET_DAILY_LIMIT, {from: owner});
    console.log(`\t \\/== Gas used in init SET_DAILY_LIMIT:`, tmpReceipt.receipt.gasUsed);

    var receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(parseInt(idxOfTx)), parseInt(idxOfTx), {from: owner});
    console.log(`\t \\/== Gas used in confirm SET_DAILY_LIMIT:`, receipt1.receipt.gasUsed);

    var currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(parseInt(idxOfTx) + 1, parseInt(currentOtpID));

    receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfTxBefore), idxOfTxBefore, {from: owner});
    console.log(`\t \\/== Gas used in confirm TRANSFER:`, receipt1.receipt.gasUsed);

    var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
    assert.equal(balanceBefore - BigInt(amountOutOfDailyLimit), balanceAfter);
  });

  it("Exceed new daily limit by new accumulated transfer", async () => {
    var idxOfTx = 4;
    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(parseInt(currentOTPID), 4)

    var tmpReceipt = await contract.initNewOper(receiver, nextSmallAmount, OperationTypeEnum.TRANSFER, {from: owner});
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed);

    var operation = await contract.pendingOpers.call(idxOfTx);

    assert(operation[2]); // is pending == true
    assert.equal(BigInt(nextSmallAmount), operation[1])

    try {
      await contract.confirmOper(...auth.getConfirmMaterial(idxOfTx), idxOfTx, {from: owner});
      assert.fail('Expected revert not received');
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0;
      assert(revertFound, `Expected "revert", got ${error} instead`);
    }

    var currentTokenIDAfter = await contract.getCurrentOtpID.call();
    assert.equal(parseInt(currentOTPID) + 1, parseInt(currentTokenIDAfter));
  });

  it("Confirm previous transfer in a next day - considering accumulated daily limit is reset", async () => {
    var idxOfTx = 4;
    var balanceBefore = BigInt(await web3.eth.getBalance(contract.address));
    var currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(5, parseInt(currentOtpID));

    // console.log(web3.eth.getBlock(web3.eth.blockNumber).timestamp);
    var operation = await contract.pendingOpers.call(idxOfTx);
    assert(operation[2]); // is pending == true
    assert.equal(BigInt(nextSmallAmount), operation[1])

    await increaseTime(24 * 3600);
    daysFromPrevTestSuites += 1
    var receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfTx), idxOfTx, {from: owner}); // date: Date.now()
    await decreaseTime(24 * 3600);
    console.log(`\t \\/== Gas used in confirm TRANSFER:`, receipt1.receipt.gasUsed);

    var currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(5, parseInt(currentOtpID));
    operation = await contract.pendingOpers.call(idxOfTx);
    assert(!operation[2]); // is pending == true

    var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
    assert.equal(balanceBefore - BigInt(nextSmallAmount), balanceAfter);
  });

});

// });//

// describe.skip("Skipped ", function(){

  contract('WaletHandle - TEST SUITE 4 [Playing with last resort stuff]:', function(accounts) {
    var owner = accounts[0];
    var anybody = accounts[3];
    var receiverOfLastResortFunds = accounts[5];
    var initialFunds =  BigInt(W3.utils.toWei('1', 'ether'));
    var contract;

    it("Bootstrap / send 1 Eth at contract", async () => {
      sender = accounts[1];
      var initialAmount = W3.utils.toWei('1', 'ether');
      var senderBalanceBefore = BigInt(await web3.eth.getBalance(sender));
      contract = await WalletHandle.deployed();

      var txreceipt = await web3.eth.sendTransaction({from: sender, to: contract.address, value: initialAmount});
      // throw Error("...");
      txHash = txreceipt.transactionHash;

      const tx = await web3.eth.getTransaction(txHash);
      txreceipt = await web3.eth.getTransactionReceipt(txHash);

      // console.log(`\t \\/== tx: `, tx);
      console.log(`\t \\/== Gas used: `, txreceipt.gasUsed);
      const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed);

      var expectedBallance = BigInt(initialAmount);
      assert.equal( BigInt(await web3.eth.getBalance(contract.address)), expectedBallance);

      var senderBalanceAfter = BigInt(await web3.eth.getBalance(sender));
      assert.equal(
        senderBalanceBefore,
        senderBalanceAfter + gasCost + BigInt(initialAmount)
      );
    });

    it("Check last resort is off && receiver of last resort is account[5] && last active day is today", async () => {
      var lastResortInfo = await contract.lastResort.call();
      assert.equal(lastResortInfo[0], receiverOfLastResortFunds); // addr == account[5]
      assert.equal(BigInt(lastResortInfo[1]), Math.floor(Date.now() / (24 * 3600 * 1000)) ); // lastActiveDay == today
      assert.equal(BigInt(lastResortInfo[2]), 0); // timeoutDays == 0
    });

    it("Check last resort is not set by calling send sendFundsToLastResortAddress (assuming deploy with timeout 0)", async () => {
      var balanceBefore = BigInt(await web3.eth.getBalance(contract.address));
      assert.equal(balanceBefore, initialFunds);

      var tmpReceipt = await contract.sendFundsToLastResortAddress({from: anybody});
      console.log(`\t \\/== Gas used in disabled sendFundsToLastResortAddress invokation:`, tmpReceipt.receipt.gasUsed);

      var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
      assert.equal(balanceBefore, balanceAfter);
    });

    it("Change last resort timeout to 5 days", async () => {
      var newTimeout = 5; // days
      var idxOfOper = 0;
      var lastResortInfo = await contract.lastResort.call();
      assert.equal(BigInt(lastResortInfo[2]), 0); // timeoutDays == 0

      var currentOTPID = await contract.getCurrentOtpID.call();
      assert.equal(idxOfOper, parseInt(currentOTPID));

      var tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newTimeout, OperationTypeEnum.SET_LAST_RESORT_TIMEOUT, {from: owner});
      console.log(`\t \\/== Gas used in init SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed);

      currentOTPID = await contract.getCurrentOtpID.call();
      var operation = await contract.pendingOpers.call(idxOfOper);

      assert(operation[2]); // is pending == true
      assert.equal(newTimeout, operation[1])

      tmpReceipt = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, {from: owner});
      console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed);

      currentOtpID = await contract.getCurrentOtpID.call();
      assert.equal(idxOfOper + 1, parseInt(currentOtpID));

      var lastResortInfoAfter = await contract.lastResort.call();
      assert.equal(BigInt(lastResortInfoAfter[2]), 5); // timeoutDays == 5
    });

    it("Try to invoke sendFundsToLastResortAddress early", async () => {
      var balanceBefore = BigInt( await web3.eth.getBalance(contract.address));
      assert.equal(balanceBefore, initialFunds);

      try {
        var tmpReceipt = await contract.sendFundsToLastResortAddress({from: anybody});
        assert.fail('Expected revert not received');
      } catch (error) {
        const revertFound = error.message.search('revert') >= 0;
        assert(revertFound, `Expected "revert", got ${error} instead`);
      }

      var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
      assert.equal(balanceBefore, balanceAfter);
    });

    it("Try to invoke sendFundsToLastResortAddress after expired timeout", async () => {
      var balanceOfReceiverBefore = BigInt(await web3.eth.getBalance(receiverOfLastResortFunds));
      var balanceBefore = BigInt(await web3.eth.getBalance(contract.address));
      assert.equal(balanceBefore, initialFunds);

      increaseTime(3600 * 24 * 6); // shift time forward
      daysFromPrevTestSuites += 6
      var tmpReceipt = await contract.sendFundsToLastResortAddress({from: anybody});
      console.log(`\t \\/== Gas used in sendFundsToLastResortAddress:`, tmpReceipt.receipt.gasUsed);
      // console.log("tmpReceipt = ", tmpReceipt);
      // decreaseTime(3600 * 24 * 6); // shift time backward

      var balanceAfter = BigInt(await web3.eth.getBalance(contract.address));
      assert.equal(0, balanceAfter); //contract funds are empty

      var balanceOfReceiverAfter = BigInt(await web3.eth.getBalance(receiverOfLastResortFunds));
      assert.equal(balanceOfReceiverAfter, balanceOfReceiverBefore + initialFunds);
    });

    it("Test that contract was destroyed", async () => {
      try {
        var o = await contract.owner.call();
        // console.log("owner = ", o);
        assert.fail('Expected error not received');
      } catch (error) {
        // console.log("error.message = ", error.message);
        const revertFound = error.message.search('Returned values aren\'t valid') >= 0;
        assert(revertFound, `Expected "Returned values aren\'t valid", got "${error}" instead`);
      }
    });
  });

// });//


// describe.skip("Skipped ", function(){

contract('WaletHandle - TEST SUITE 5 [Further playing with last resort stuff - changing address, shifting time ]:', function(accounts) {
  var owner = accounts[0];
  var anybody = accounts[3];
  var receiverOfLastResortFunds = accounts[5];
  var newReceiverOfLastResortFunds = accounts[7];
  var initialFunds =  BigInt(W3.utils.toWei('1', 'ether'));
  var newDailyLimit =  BigInt(W3.utils.toWei('7', 'ether'));
  var contract;

  it("Bootstrap / send 1 Eth at contract", async () => {
    sender = accounts[1];
    var initialAmount = W3.utils.toWei('1', 'ether');
    var senderBalanceBefore = BigInt(await web3.eth.getBalance(sender));
    contract = await WalletHandle.deployed();

    var txreceipt = await web3.eth.sendTransaction({from: sender, to: contract.address, value: initialAmount});
    // throw Error("...");
    txHash = txreceipt.transactionHash;

    const tx = await web3.eth.getTransaction(txHash);
    txreceipt = await web3.eth.getTransactionReceipt(txHash);

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt.gasUsed);
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed);

    var expectedBallance = BigInt(initialAmount);
    assert.equal( BigInt(await web3.eth.getBalance(contract.address)), expectedBallance);

    var senderBalanceAfter = BigInt(await web3.eth.getBalance(sender));
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    );
  });

  it("Check last resort is off && receiver of last resort is account[5] && last active day is today", async () => {
    var lastResortInfo = await contract.lastResort.call();
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds); // addr == account[5]
    assert.equal(BigInt(lastResortInfo[1]), Math.floor(Date.now() / (24 * 3600 * 1000)) ); // lastActiveDay == today
    assert.equal(BigInt(lastResortInfo[2]), 0); // timeoutDays == 0
  });

  it("Change last resort timeout to 3 days first", async () => {
    var newTimeout = 3; // days
    var idxOfOper = 0;
    var lastResortInfo = await contract.lastResort.call();
    assert.equal(BigInt(lastResortInfo[2]), 0); // timeoutDays == 0

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(0, parseInt(currentOTPID));

    var tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newTimeout, OperationTypeEnum.SET_LAST_RESORT_TIMEOUT, {from: owner});
    console.log(`\t \\/== Gas used in init SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed);

    currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper + 1, currentOTPID);

    var operation = await contract.pendingOpers.call(idxOfOper);
    assert(operation[2]); // is pending == true
    assert.equal(newTimeout, operation[1])

    tmpReceipt = await contract.confirmOper( ...auth.getConfirmMaterial(idxOfOper), idxOfOper, {from: owner});
    console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed);

    currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper + 1, parseInt(currentOtpID));

    var lastResortInfoAfter = await contract.lastResort.call();
    assert.equal(BigInt(lastResortInfoAfter[2]), 3); // timeoutDays == 3
  });

  it("Change last resort timeout to 5 days", async () => {
    var newTimeout = 5; // days
    var idxOfOper = 1;

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(1, parseInt(currentOTPID));

    var currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(1, parseInt(currentOtpID));

    var tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newTimeout, OperationTypeEnum.SET_LAST_RESORT_TIMEOUT, {from: owner});
    console.log(`\t \\/== Gas used in init SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed);

    currentOTPID = await contract.getCurrentOtpID.call();
    var operation = await contract.pendingOpers.call(idxOfOper);
    assert(operation[2]); // is pending == true
    assert.equal(newTimeout, operation[1])

    tmpReceipt = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, {from: owner});
    console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed);

    currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper + 1, parseInt(currentOtpID));

    var lastResortInfoAfter = await contract.lastResort.call();
    assert.equal(BigInt(lastResortInfoAfter[2]), 5); // timeoutDays == 5
  });

  it("Change last resort address to account[7]", async () => {
    var idxOfOper = 2;
    var lastResortInfo = await contract.lastResort.call();
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds); // addr == old receiver

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper, parseInt(currentOTPID));

    var tmpReceipt = await contract.initNewOper(newReceiverOfLastResortFunds, 0, OperationTypeEnum.SET_LAST_RESORT_ADDRESS, {from: owner});
    console.log(`\t \\/== Gas used in init SET_LAST_RESORT_ADDRESS:`, tmpReceipt.receipt.gasUsed);

    currentOTPID = await contract.getCurrentOtpID.call();
    var operation = await contract.pendingOpers.call(idxOfOper);
    assert(operation[2]); // is pending == true
    assert.equal(newReceiverOfLastResortFunds, operation[0]); // addr == newReceiverOfLastResortFunds

    tmpReceipt = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, {from: owner});
    console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_ADDRESS:`, tmpReceipt.receipt.gasUsed);

    currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper + 1, parseInt(currentOtpID));

    var lastResortInfoAfter = await contract.lastResort.call();
    assert.equal(lastResortInfoAfter[0], newReceiverOfLastResortFunds); // addr == newReceiverOfLastResortFunds
  });

  it("Check last resort activity is updated after 4 days && sendFundsToLastResortAddress will not work in next 4 days", async () => {
    var idxOfOper = 3;
    var timeShift = 4 * 24 * 3600; // 4 days
    var lastResortInfo = await contract.lastResort.call();
    assert.equal(lastResortInfo[0], newReceiverOfLastResortFunds); // addr == new one

    var currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper, parseInt(currentOTPID));

    var tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newDailyLimit.toString(), OperationTypeEnum.SET_DAILY_LIMIT, {from: owner});
    console.log(`\t \\/== Gas used in init SET_DAILY_LIMIT:`, tmpReceipt.receipt.gasUsed);

    currentOTPID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper + 1, parseInt(currentOTPID));

    var operation = await contract.pendingOpers.call(idxOfOper);
    assert(operation[2]); // is pending == true
    assert.equal(newDailyLimit, operation[1])

    increaseTime(timeShift); // shift time forward + 4 days
    tmpReceipt = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, {from: owner});
    console.log(`\t \\/== Gas used in confirm SET_DAILY_LIMIT:`, tmpReceipt.receipt.gasUsed);

    currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(idxOfOper + 1, parseInt(currentOtpID));

    increaseTime(timeShift); // shift time forward + next 4 days
    try {
      var tmpReceipt = await contract.sendFundsToLastResortAddress({from: anybody});
      assert.fail('Expected revert not received');
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0;
      assert(revertFound, `Expected "revert", got ${error} instead`);
    }

    var lastResortInfoAfter = await contract.lastResort.call();
    assert.equal(lastResortInfoAfter[1].toString(), (Math.floor((Date.now() / (24 * 3600 * 1000))) + 4).toString()); // lastActiveDay == now + 4 days
  });

  it("Check sendFundsToLastResortAddress will work in next 1 day && contract was destroyed", async () => {
    increaseTime(24 * 3600);
    var balanceOfReceiverBefore = BigInt(await web3.eth.getBalance(newReceiverOfLastResortFunds));
    await contract.sendFundsToLastResortAddress({from: anybody});
    var balanceOfReceiverAfter = BigInt(await web3.eth.getBalance(newReceiverOfLastResortFunds));
    assert.equal(balanceOfReceiverAfter, balanceOfReceiverBefore + initialFunds);

    try {
      var o = await contract.owner.call();
      assert.fail('Expected error not received');
    } catch (error) {
      // console.log("error.message = ", error.message);
      const revertFound = error.message.search('Returned values aren\'t valid') >= 0;
      assert(revertFound, `Expected "Returned values aren\'t valid", got "${error}" instead`);
    }
  });

  it("Test that contract was destroyed", async () => {
    try {
      var o = await contract.owner.call();
      assert.fail('Expected error not received');
    } catch (error) {
      // console.log("error.message = ", error.message);
      const revertFound = error.message.search('Returned values aren\'t valid') >= 0;
      assert(revertFound, `Expected "Returned values aren\'t valid", got "${error}" instead`);
    }
  });

});

// });//

// describe.skip("Skipped ", function(){

contract('WaletHandle - TEST SUITE 6 [Token depletion + immediate send to last resort address]:', function(accounts) {
  var owner = accounts[0];
  var anybody = accounts[3];
  var receiverOfLastResortFunds = accounts[5];
  var initialFunds =  BigInt(W3.utils.toWei('5', 'ether'));
  var amount2Send = W3.utils.toWei('0.000001', 'ether');
  var contract;

  it("Bootstrap / send 1 Eth at contract", async () => {
    sender = accounts[1];
    var initialAmount = W3.utils.toWei('1', 'ether');
    var senderBalanceBefore = BigInt(await web3.eth.getBalance(sender));
    contract = await WalletHandle.deployed();

    var txreceipt = await web3.eth.sendTransaction({from: sender, to: contract.address, value: initialAmount});
    // throw Error("...");
    txHash = txreceipt.transactionHash;

    const tx = await web3.eth.getTransaction(txHash);
    txreceipt = await web3.eth.getTransactionReceipt(txHash);

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt.gasUsed);
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed);

    var expectedBallance = BigInt(initialAmount);
    assert.equal( BigInt(await web3.eth.getBalance(contract.address)), expectedBallance);

    var senderBalanceAfter = BigInt(await web3.eth.getBalance(sender));
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    );
  });

  it("Check last resort is off && receiver of last resort is account[5] && last active day is today", async () => {
    var lastResortInfo = await contract.lastResort.call();
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds); // addr == account[5]
    assert.equal(BigInt(lastResortInfo[1]), Math.floor(Date.now() / (24 * 3600 * 1000)) ); // lastActiveDay == today
    assert.equal(BigInt(lastResortInfo[2]), 0); // timeoutDays == 0
  });

  it("Deplete tokens and measure gas consumption per a Transfer operation", async () => {
    var receiver = accounts[4];
    var lastResortInfo = await contract.lastResort.call();
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds); // addr == receiverOfLastResortFunds

    var currentOtpID = await contract.getCurrentOtpID.call();
    assert.equal(0, currentOtpID);

    var gasOfConfirm = [];
    var childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
    var currentOtpID = await contract.getCurrentOtpID.call();
    var allChildTrees = Math.floor(auth.MT_parent_numberOfOTPs / auth.MT_child_numberOfOTPs);
    for (let t = parseInt(childTreeIdx); t < allChildTrees; t++) { //iterate over remaining child trees

      // iterate over remaining child leaves
      for (var i = parseInt(currentOtpID); i < ((t + 1) * auth._MT_child_numberOfOTPs) - 1; i++) {
        var tmpReceiptInit = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, {from: owner});
        var tmpReceiptConf = await contract.confirmOper(...auth.getConfirmMaterial(i), i, {from: owner});
        console.log(`\t \\/== Gas used in init & confirm TRANSFER[${i}/${auth.MT_parent_numberOfOTPs}] = `, tmpReceiptInit.receipt.gasUsed, " | ", tmpReceiptConf.receipt.gasUsed);

        gasOfConfirm.push(tmpReceiptConf.receipt.gasUsed);
        if(i % 100 === 0){
          console.log("\t \\/== \tIntermediary average gas consumption of confirm is: ", round(arr.mean(gasOfConfirm)), " +-", round(arr.stddev(gasOfConfirm)))
        }
      }
      console.log(`\t \\/== Last child tree: AVERAGE gas used in confirm TRANSFER:`, arr.mean(gasOfConfirm));
      console.log(`\t \\/== Last child tree: STDDEV of gas used in confirm TRANSFER:`, arr.stddev(gasOfConfirm));

      // bootstrap a new child tree (normally / at the end of all OTPs)
      currentOtpID = await contract.getCurrentOtpID.call();
      if(t < allChildTrees - 1){ // normal adjustment
        var receiptChildTree = await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(t + 1),
          ...auth.getAuthPath4ChildTree(t + 1), ...auth.getConfirmMaterial(parseInt(currentOtpID)), {from: owner}
        );
        console.log(`\t New child tree adjusted [${t + 1}] with price = `, receiptChildTree.receipt.gasUsed)
        var newChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
        assert.equal(parseInt(newChildTreeIdx), t + 1);
      } else { // adjustment after the end of all OTPs of the last child tree should make an exception
        try {
          await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(0),
            ...auth.getAuthPath4ChildTree(0), ...auth.getConfirmMaterial(parseInt(currentOtpID)), {from: owner}
          );
          assert.fail('Expected revert not received');
        } catch (error) {
          const revertFound = error.message.search('revert') >= 0;
          assert(revertFound, `Expected "revert", got ${error} instead`);
        }
      }
      currentOtpID = await contract.getCurrentOtpID.call();
      childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
    }
    assert.equal(parseInt(currentOtpID), auth.MT_parent_numberOfOTPs - 1)
    assert.equal(parseInt(childTreeIdx), allChildTrees - 1)

    console.log(`\n\t \\/== AVERAGE gas used in confirm TRANSFER:`, arr.mean(gasOfConfirm));
    console.log(`\t \\/== STDDEV of gas used in confirm TRANSFER:`, arr.stddev(gasOfConfirm));
  });

});

// });//

///// AUX Functions /////

const increaseTime = time => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_increaseTime',
      params: [time],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

const decreaseTime = time => {
  return new Promise((resolve, reject) => {
    web3.currentProvider.send({
      jsonrpc: '2.0',
      method: 'evm_decreaseTime',
      params: [time],
      id: new Date().getTime()
    }, (err, result) => {
      if (err) { return reject(err) }
      return resolve(result)
    })
  })
}

// const increaseTime = addSeconds => {
//   web3.currentProvider.send({
//       jsonrpc: "2.0",
//       method: "evm_increaseTime",
//       params: [addSeconds], id: 0
//   })
// }

// const decreaseTime = addSeconds => {
//   web3.currentProvider.send({
//       jsonrpc: "2.0",
//       method: "evm_decreaseTime",
//       params: [addSeconds], id: 0
//   })
// }

var arr = {
  variance: function(array) {
    var mean = arr.mean(array);
    return arr.mean(array.map(function(num) {
      return Math.pow(num - mean, 2);
    }));
  },

  stddev: function(array) {
    return Math.sqrt(arr.variance(array));
  },

  mean: function(array) {
    return arr.sum(array) / array.length;
  },

  sum: function(array) {
    var num = 0;
    for (var i = 0, l = array.length; i < l; i++) num += array[i];
    return num;
  },
};

function hexToBytes(hex) { // Convert a hex string to a byte array
  var bytes = [];
  for (c = 2; c < hex.length; c += 2)
      bytes.push(parseInt(hex.substr(c, 2), 16));
  return bytes;
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

function round(x) {
  return Number.parseFloat(x).toFixed(2);
}

function concatB32(a, b) {
  if (typeof(a) != 'string' || typeof(b) != 'string' || a.substr(0, 2) != '0x' || b.substr(0, 2) != '0x') {
      console.log("a, b = ", a, b)
      throw new Error("ConcatB32 supports only hex string arguments");
  }
  a = hexToBytes(a);
  b = hexToBytes(b);
  var res = []
  if (a.length != b.length || a.length != 16 || b.length != 16 ) {
      throw new Error("ConcatB32 supports only equally-long (16B) arguments.");
 } else {
      for (var i = 0; i < a.length; i++) {
          res.push(a[i])
      }
      for (var i = 0; i < b.length; i++) {
          res.push(b[i])
      }
 }
 return bytesToHex(res);
}