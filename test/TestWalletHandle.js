const WalletHandle = artifacts.require('./WalletHandle.sol')
// const { assert } = require('assert').strict
function h (a) { return web3.utils.soliditySha3({ v: a, t: 'bytes', encoding: 'hex' }).substring(0, 34) }

const ac = require('../lib/auth_config.js') // Config of unit test authenticator
const AuthenticatorMT = require('../lib/authenticator.js')

let auth = new AuthenticatorMT(ac.PARENT_NUMBER_OF_LEAFS, ac.CHILD_NUMBER_OF_LEAFS, ac.CHILD_DEPTH_OF_CACHED_LAYER, ac.HASH_CHAIN_LEN, ac.MNEM_WORDS, 0, null, true)
// let daysFromPrevTestSuites = 0 // previously increased time of EVM by other tests - not used except for debugging tests

const OperationTypeEnum = Object.freeze({ 'TRANSFER': 0,
  'SET_DAILY_LIMIT': 1,
  'SET_LAST_RESORT_ADDRESS': 2,
  'SET_LAST_RESORT_TIMEOUT': 3,
  'DESTRUCT_WALLET': 4,
  'NOP': 5
})

const DO_TREE_DEPLETION = true
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

if (DO_TREE_DEPLETION && ac.HASH_CHAIN_LEN <= 1) {
  throw new Error('When doing tree depletion, you have to adjust hash chain length (../lib/auth_config.js) to values > 1 in order to check invalidation of iteration layers.')
}
if (ac.CHILD_NUMBER_OF_LEAFS < Math.pow(2, 2)) {
  throw new Error('Minimum number of leaves in subtree for these unit tests is 4.')
}

// eslint-disable-next-line no-extend-native
BigInt.prototype.toJSON = function () { return this.toString() }

// describe.skip("Skipped ", function(){

contract('WalletHandle - TEST SUITE 1 [Initial checks and a transfer]', function (accounts) {
  it('Zero Balance', function () {
    return WalletHandle.deployed()
      .then(function (instance) {
      // console.log(instance.contract.address);
        return web3.eth.getBalance(instance.contract._address)
      })
      .then(function (result) {
        assert.equal(0, result)
      })
  })

  it('Contract owner is account[0]', function () {
    return WalletHandle.deployed()
      .then(function (instance) {
        return instance.contract.methods.owner().call()
      })
      .then(function (owner) {
        assert.equal(accounts[0], owner)
      })
  })

  it('Send money to Contract', function () {
    let contract
    return WalletHandle.deployed()
      .then(function (instance) {
        contract = instance

        return web3.eth.sendTransaction({
          from: accounts[0],
          to: instance.address,
          value: web3.utils.toWei('5', 'ether'),
        })
      })
      .then(function (receipt) {
        console.log('receipt', receipt)
        return web3.eth.getBalance(contract.address)
      })
      .then(function (balance) {
        const contrBalance = balance
        console.log('\t Current balance of contract is', web3.utils.fromWei(contrBalance.toString(), 'ether'), 'Ethers.')
        assert.equal(contrBalance, web3.utils.toWei('5', 'ether'))
        return web3.eth.getBalance(accounts[0])
      })
      .then(function (balance) {
      // console.log("balance = ", balance);
        assert.ok(balance < web3.utils.toWei('95', 'ether')) // && senderBalance >  web3.utils.toWei('94', 'ether')
      })
  })

  it('Init transfer of funds', async () => {
    const owner = accounts[0]
    const receiver = accounts[1]
    const amount2Send = web3.utils.toWei('1', 'ether')
    const contract = await WalletHandle.deployed()

    const receipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
    console.log('\t \\/== Gas used:', receipt.receipt.gasUsed)
    // console.log("\t receipt", receipt.logs[0].args);

    const tokenID = await contract.getCurrentOtpID.call()
    assert.equal(1, tokenID)

    const newOper = await contract.pendingOpers.call(0) // 0 is the index of actual Oper
    // console.log("\t", newOper); // struct is returned as tuple / object in JS
    assert.equal(newOper[0], receiver) // address of receiver
    assert.equal(newOper[1], amount2Send) // amount
    assert.equal(newOper[2], true) // is pending == true
    assert.equal(newOper[3], OperationTypeEnum.TRANSFER) // is operType == TRANSFER
  })

  it('Confirm transfer of funds', async () => {
    const owner = accounts[0]
    const receiver = accounts[1]
    const amount2Send = web3.utils.toWei('1', 'ether')
    const recvBalanceBefore = await web3.eth.getBalance(receiver)
    const tokenID = 0 // the 1st operation ever
    const contract = await WalletHandle.deployed()

    const secMatWithSides = auth.getConfirmMaterial(tokenID)
    console.log(`\t Secret material of token ${tokenID} is`, secMatWithSides[0], hexToBytes(secMatWithSides[1]))
    const receipt = await contract.confirmOper(...auth.getConfirmMaterial(tokenID), tokenID, { from: owner })
    console.log('\t \\/== Gas used:', receipt.receipt.gasUsed)
    // console.log(receipt.logs[0].args);
    // console.log(receipt.logs[1].args);

    const firstOperInBuf = await contract.pendingOpers.call(tokenID)
    assert.equal(firstOperInBuf[0], receiver)
    assert.equal(firstOperInBuf[1], amount2Send)
    assert.equal(firstOperInBuf[2], false)
    assert.equal(firstOperInBuf[3], OperationTypeEnum.TRANSFER)
    const recvBalanceAfter = await web3.eth.getBalance(receiver)
    assert.equal(BigInt(recvBalanceBefore) + BigInt(amount2Send), BigInt(recvBalanceAfter))
  })

  it('Try to init TRANSFER and confirm by wrong token', async () => {
    const contract = await WalletHandle.deployed()
    const receiver = accounts[1]
    const idxOfTx = 1 // 2nd one
    const amount2Send = web3.utils.toWei('0.1', 'ether')
    const owner = accounts[0]

    const tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID = await contract.getCurrentOtpID.call()
    assert.equal(idxOfTx + 1, parseInt(currentOTPID))

    const operation = await contract.pendingOpers.call(idxOfTx)
    assert(operation[2]) // is pending == true
    assert.equal(amount2Send, operation[1])

    try {
      const wrongTokenId = idxOfTx + 1
      // console.log("\t Secret material is", ...auth.getConfirmMaterial(wrongTokenId));
      const receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(wrongTokenId), idxOfTx, { from: owner })
      console.log(receipt1)
      assert.fail('Expected revert not received')
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0
      assert(revertFound, `Expected "revert", got ${error} instead`)
    }

    const currentOTPID2 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfTx + 1, parseInt(currentOTPID2))
    const executedOper = await contract.pendingOpers.call(idxOfTx)
    assert(executedOper[2]) // pending == true
  })
})

// });//

// describe.skip("Skipped ", function(){

contract('WalletHandle - TEST SUITE 2 [Deplete child tree OTPs, init new child tree ; deplete parent OTPs ; new parent tree]:', function (accounts) {
  const owner = accounts[0]
  const amount2Send = web3.utils.toWei('0.1', 'ether')
  const receiver = accounts[1]
  let contract
  it('Bootstrap / send 5 Eth at contract', async () => {
    const sender = accounts[5]
    const initialAmount = web3.utils.toWei('5', 'ether')
    const senderBalanceBefore = BigInt(await web3.eth.getBalance(sender))
    contract = await WalletHandle.deployed()

    let txreceipt = await web3.eth.sendTransaction({ from: sender, to: contract.address, value: initialAmount })
    // throw Error("...");
    const txHash = txreceipt.transactionHash

    const tx = await web3.eth.getTransaction(txHash)
    txreceipt = await web3.eth.getTransactionReceipt(txHash)

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt.gasUsed)
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed)

    const expectedBallance = BigInt(initialAmount)
    assert.equal(BigInt(await web3.eth.getBalance(contract.address)), expectedBallance)

    const senderBalanceAfter = BigInt(await web3.eth.getBalance(sender))
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    )
  })

  it('Try to initialize new child tree operation prematurely. ', async () => {
    const curChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
    const newChildTreeIdx = parseInt(curChildTreeIdx)
    const curOTPID = parseInt(await contract.getCurrentOtpID.call())

    try {
      await contract.adjustNewChildTree(
        auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(newChildTreeIdx),
        ...auth.getAuthPath4ChildTree(newChildTreeIdx), ...auth.getConfirmMaterial(curOTPID), { from: owner }
      )
      assert.fail('Expected revert not received')
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0
      assert(revertFound, `Expected "revert", got ${error} instead`)
    }
  })

  it('Deplete child tree OTPs by TRANSFER operations', async () => {
    if (DO_TREE_DEPLETION) {
      let currentOtpID = parseInt(await contract.getCurrentOtpID.call())
      assert.equal(0, currentOtpID)

      const sizeOfChildTree = parseInt(await contract.MT_child_numberOfOTPs.call())

      for (let i = 0; i < sizeOfChildTree - 1; i += 1) {
        const tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
        console.log(`\t \\/== Gas used in init TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed)

        // confirm operations as well
        const tmpReceipt2 = await contract.confirmOper(...auth.getConfirmMaterial(currentOtpID), currentOtpID, { from: owner })
        console.log(`\t \\/== Gas used in confirm TRANSFER[${i}] = `, tmpReceipt2.receipt.gasUsed)
        console.log('\t log', tmpReceipt2.logs[0])
        console.log('\t receipt', BigInt(tmpReceipt2.logs[0].args[1]))
        currentOtpID += 1
      }

      // init one more transaction - the last OTP in child tree can be used only for a new child tree operation
      try {
        await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
        assert.fail('Expected revert not received')
      } catch (error) {
        const revertFound = error.message.search('revert') >= 0
        assert(revertFound, `Expected "revert", got ${error} instead`)

        const curTokID = await contract.getCurrentOtpID.call()
        assert.equal(sizeOfChildTree, parseInt(curTokID) + 1)
      }
    } else {
      console.log('\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false')
    }
  })

  it('Try to confirm OTP from invalid iteration layer. ', async () => {
    if (DO_TREE_DEPLETION) {
      try {
        const receipt = await contract.confirmOper(...auth.getConfirmMaterial(0), 0, { from: owner })
        console.log(`\t \\/== Receipt = `, receipt.receipt)
        assert.fail('Expected revert not received')
      } catch (error) {
        const revertFound = error.message.search('revert') >= 0
        assert(revertFound, `Expected "revert", got ${error} instead`)
      }
    } else {
      console.log('\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false')
    }
  })

  it('Initialize a new child tree when child tree OTPs are depleted. ', async () => {
    if (DO_TREE_DEPLETION) {
      const curChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      const newChildTreeIdx = parseInt(curChildTreeIdx) + 1
      const curOTPID = await contract.getCurrentOtpID.call()
      assert.equal(parseInt(curOTPID), auth.MT_child_numberOfOTPs * newChildTreeIdx - 1)

      await contract.adjustNewChildTree(
        auth.MT_child_depthOfCachedLayer,
        auth.getChildCachedLayer(newChildTreeIdx),
        ...auth.getAuthPath4ChildTree(newChildTreeIdx),
        ...auth.getConfirmMaterial(parseInt(curOTPID)),
        { from: owner }
      )

      const realNewChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      assert.equal(parseInt(realNewChildTreeIdx), newChildTreeIdx)
      const newOTPID = await contract.getCurrentOtpID.call()
      assert.equal(parseInt(newOTPID), parseInt(curOTPID) + 1)

      const nopOper = await contract.pendingOpers.call(parseInt(curOTPID))
      assert(!nopOper[2]) // pending == false
      assert.equal(OperationTypeEnum.NOP, nopOper[3]) // operation type == NOP

      const newRoot = await contract.MT_child_rootHash.call()
      const authPath = auth.getAuthPath4ChildTree(newChildTreeIdx)
      assert.equal(newRoot, authPath[0][0])
    } else {
      console.log('\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false')
    }
  })

  it('Init 3 TRANSFER operations and confirm the 2nd one', async () => {
    await init3TransfersAndConfirm2nd(auth.MT_child_numberOfOTPs)
  })

  it('Deplete all parent tree OTPs.', async () => {
    await depleteOTPs()
  })

  it('Try to init a new opearation when all parent OTPs are depleted.', async () => {
    if (DO_TREE_DEPLETION) {
      const currentOtpID = await contract.getCurrentOtpID.call()
      assert.equal(auth.MT_parent_numberOfOTPs - 1, parseInt(currentOtpID))

      // init one more transaction - the last OTP in child tree can be used only for a new child tree operation
      try {
        await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
        assert.fail('Expected revert not received')
      } catch (error) {
        const revertFound = error.message.search('revert') >= 0
        assert(revertFound, `Expected "revert", got ${error} instead`)

        const currentOtpID2 = await contract.getCurrentOtpID.call()
        assert.equal(auth.MT_parent_numberOfOTPs - 1, parseInt(currentOtpID2))
      }
    } else {
      console.log('\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false')
    }
  })

  it('Adjust a new parent tree.', async () => {
    if (DO_TREE_DEPLETION) {
      let currentOtpID = await contract.getCurrentOtpID.call()
      assert.equal(auth.MT_parent_numberOfOTPs - 1, parseInt(currentOtpID))
      const oldChildRoot = await contract.MT_child_rootHash.call()
      const sizeOfstage1Buf = await contract.getSizeOfNPT_stage1Buf.call()
      const sizeOfstage2Buf = await contract.getSizeOfNPT_stage2Buf.call()
      assert.equal(0, parseInt(sizeOfstage1Buf))
      assert.equal(0, parseInt(sizeOfstage2Buf))

      const cmAndSides = auth.getConfirmMaterial(parseInt(currentOtpID))
      const otp = cmAndSides[0][0]
      const parentRootBefore = auth._MT_parent_rootHash
      console.log('parent root hash before update = ', parentRootBefore)
      auth.generateNextParentTree(ac.MNEM_WORDS) // this regenerates new parent tree and updates authenticator
      assert(parentRootBefore !== auth.MT_parent_rootHash)

      // stage 1 - put h(root || otp) into 1st stage buffer
      const maliciousHashOfRootAndOTP = h(concatB32(oldChildRoot, cmAndSides[0][1]))
      const hashOfRootAndOTP = h(concatB32(auth.MT_parent_rootHash, otp))
      await contract.adjustNewParentTree_stage1(maliciousHashOfRootAndOTP, { from: owner })
      await contract.adjustNewParentTree_stage1(hashOfRootAndOTP, { from: owner })

      // stage 2 - put root into 2nd stage buffer
      await contract.adjustNewParentTree_stage2(oldChildRoot, { from: owner }) // malicious
      await contract.adjustNewParentTree_stage2(oldChildRoot, { from: owner }) // malicious
      await contract.adjustNewParentTree_stage2(auth.MT_parent_rootHash, { from: owner }) // legitimate
      console.log('puting new parent root hash into buffer of stage 2 = ', auth.MT_parent_rootHash)

      // stage 3 - provide otp
      await contract.adjustNewParentTree_stage3(cmAndSides[0], cmAndSides[1],
        auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(0), ...auth.getAuthPath4ChildTree(0)
      )
      // auth.dumpAllOTPs()
      // auth.dumpAllChildRootHashes()

      const newParentRoot = await contract.MT_parent_rootHash.call()
      assert.equal(newParentRoot, auth.MT_parent_rootHash)
      const newChildRoot = await contract.MT_child_rootHash.call()
      assert.equal(newChildRoot, auth.getAuthPath4ChildTree(0)[0][0])
      const curChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      assert.equal(parseInt(curChildTreeIdx), 0)
      currentOtpID = await contract.getCurrentOtpID.call()
      assert.equal(0, parseInt(currentOtpID))
    } else {
      console.log('\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false')
    }
  })

  it('Do some operations from the 2nd parent tree', async () => {
    await init3TransfersAndConfirm2nd(0)
  })

  it('Deplete all parent tree OTPs again', async () => {
    await depleteOTPs()
  })

  const init3TransfersAndConfirm2nd = async (startOTPIdx) => {
    if (DO_TREE_DEPLETION) {
      const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))
      let currentOtpID = await contract.getCurrentOtpID.call()
      assert.equal(startOTPIdx, parseInt(currentOtpID))
      const OPER_CNT = 3

      for (let i = parseInt(currentOtpID); i < parseInt(currentOtpID) + OPER_CNT; i += 1) {
        const tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
        console.log(`\t \\/== Gas used in init TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed)
      }
      currentOtpID = await contract.getCurrentOtpID.call()
      assert.equal(startOTPIdx + OPER_CNT, parseInt(currentOtpID))

      const idxOfTx = startOTPIdx + 1 // 2nd initialized operation
      const operation = await contract.pendingOpers.call(idxOfTx)
      assert(operation[2]) // is pending == true
      assert.equal(amount2Send, operation[1])

      const receipt = await contract.confirmOper(...auth.getConfirmMaterial(idxOfTx), idxOfTx, { from: owner })
      console.log(`\t \\/== Gas used in CONFIRM TRANSFER: `, receipt.receipt.gasUsed)

      const executedOper = await contract.pendingOpers.call(idxOfTx)
      assert(!executedOper[2]) // pending == false
      const tx = await web3.eth.getTransaction(receipt.receipt.transactionHash)

      const gasCost = BigInt(BigInt(tx.gasPrice) * BigInt(receipt.receipt.gasUsed))
      console.log('\t \\/== Gas cost was: ', web3.utils.fromWei(gasCost.toString(), 'ether'), ' Eth')
      const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
      assert.equal(balanceBefore - BigInt(amount2Send), balanceAfter)
    } else {
      console.log('\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false')
    }
  }

  const depleteOTPs = async () => {
    if (DO_TREE_DEPLETION) {
      let childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      let currentOtpID = await contract.getCurrentOtpID.call()
      const allChildTrees = Math.floor(auth.MT_parent_numberOfOTPs / auth.MT_child_numberOfOTPs)
      for (let t = parseInt(childTreeIdx); t < allChildTrees; t++) { // iterate over remaining child trees
        // iterate over remaining child leaves
        for (let i = parseInt(currentOtpID); i < ((t + 1) * auth._MT_child_numberOfOTPs) - 1; i += 1) {
          let tmpReceipt = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
          console.log(`\t \\/== Gas used in init TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed)

          // confirm operations as well
          tmpReceipt = await contract.confirmOper(...auth.getConfirmMaterial(currentOtpID), currentOtpID, { from: owner })
          console.log(`\t \\/== Gas used in confirm TRANSFER[${i}] = `, tmpReceipt.receipt.gasUsed)
          // console.log("\t receipt", BigInt(tmpReceipt.logs[0].args[1]) );
          currentOtpID += 1
        }

        // bootstrap a new child tree (normally / at the end of all OTPs)
        currentOtpID = await contract.getCurrentOtpID.call()
        if (t < allChildTrees - 1) { // normal adjustment
          const tmpReceipt = await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(t + 1),
            ...auth.getAuthPath4ChildTree(t + 1), ...auth.getConfirmMaterial(parseInt(currentOtpID)), { from: owner }
          )
          console.log(`\t New child tree adjusted [${t + 1}]`)
          console.log(`\t \\/== New child tree adjusted [${t + 1}] | Gas usage = `, tmpReceipt.receipt.gasUsed)
          const newChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
          assert.equal(parseInt(newChildTreeIdx), t + 1)
        } else { // adjustment after the end of all OTPs of the last child tree should make an exception
          try {
            await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(0),
              ...auth.getAuthPath4ChildTree(0), ...auth.getConfirmMaterial(parseInt(currentOtpID)), { from: owner }
            )
            assert.fail('Expected revert not received')
          } catch (error) {
            const revertFound = error.message.search('revert') >= 0
            assert(revertFound, `Expected "revert", got ${error} instead`)
          }
        }
        currentOtpID = await contract.getCurrentOtpID.call()
        childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
      }
      assert.equal(parseInt(currentOtpID), auth.MT_parent_numberOfOTPs - 1)
      assert.equal(parseInt(childTreeIdx), allChildTrees - 1)
    } else {
      console.log('\t \\/== Skipped due the setting of DO_TREE_DEPLETION == false')
    }
  }

  it('Epilogue => reset authenticator to initial state', async () => {
    if (DO_TREE_DEPLETION) {
      auth = new AuthenticatorMT(ac.PARENT_NUMBER_OF_LEAFS, ac.CHILD_NUMBER_OF_LEAFS, ac.CHILD_DEPTH_OF_CACHED_LAYER, ac.HASH_CHAIN_LEN, ac.MNEM_WORDS, 0, null, true)
      console.log(`AuthenticatorMT reset complete.`)
    }
  })
})

// });//

// describe.skip("Skipped ", function(){

contract('WalletHandle - TEST SUITE 3 [Playing with daily limits]:', function (accounts) {
  console.log('accounts', accounts)
  const owner = accounts[0]
  const tooBigAmount2Send = web3.utils.toWei('10', 'ether')
  const newDailyLimit = web3.utils.toWei('0.5', 'ether')
  const newIncreasedDailyLimit = web3.utils.toWei('0.6', 'ether')
  const amountOutOfDailyLimit = web3.utils.toWei('0.51', 'ether')
  const nextSmallAmount = web3.utils.toWei('0.1', 'ether')
  const receiver = accounts[1]
  let contract
  console.log('Starting daily limit tests...')

  it('Bootstrap / send 1 Eth at contract', async () => {
    const sender = accounts[1]
    const initialAmount = web3.utils.toWei('1', 'ether')
    const senderBalanceBefore = BigInt(await web3.eth.getBalance(sender))
    contract = await WalletHandle.deployed()

    let txreceipt = await web3.eth.sendTransaction({ from: sender, to: contract.address, value: initialAmount })
    // throw Error("...");
    const txHash = txreceipt.transactionHash

    const tx = await web3.eth.getTransaction(txHash)
    txreceipt = await web3.eth.getTransactionReceipt(txHash)

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt.gasUsed)
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed)

    const expectedBallance = BigInt(initialAmount)
    assert.equal(BigInt(await web3.eth.getBalance(contract.address)), expectedBallance)

    const senderBalanceAfter = BigInt(await web3.eth.getBalance(sender))
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    )
  })

  it('Try to send more than balance and generate 1 unconfirmed transfer', async () => {
    const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))
    const currentOtpID = await contract.getCurrentOtpID.call()
    assert.equal(0, parseInt(currentOtpID))
    const idxOfTx = 0 // 1st one

    const tmpReceipt = await contract.initNewOper(receiver, tooBigAmount2Send, OperationTypeEnum.TRANSFER, { from: owner })
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID = await contract.getCurrentOtpID.call()
    const operation = await contract.pendingOpers.call(idxOfTx)
    const confirmedTokenId = parseInt(currentOTPID) - 1
    assert(operation[2]) // is pending == true
    assert.equal(BigInt(tooBigAmount2Send), operation[1])

    try {
      const receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(confirmedTokenId), confirmedTokenId, { from: owner })
      assert.fail(`Expected revert not received. receipt: ${receipt1}`)
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0
      assert(revertFound, `Expected "revert", got ${error} instead`)
    }
    const executedOper = await contract.pendingOpers.call(idxOfTx)
    assert(executedOper[2]) // pending == true

    // txHash = "???????"; // TODO: Need to figure out how to get hash of failed transaction.
    // const tx = await web3.eth.getTransaction(txHash);
    // const receipt = await web3.eth.getTransactionReceipt(txHash)

    // const gasCost = tx.gasPrice.mul(receipt.gasUsed));
    // console.log(`\t \\/== Gas used in failed CONFIRM TRANSFER: `, receipt.gasUsed);
    // console.log("\t \\/== Gas cost was: ", web3.utils.fromWei(gasCost.toString(), 'ether'), " Eth");
    const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore, balanceAfter)
  })

  it('Adjust daily limit', async () => {
    const idxOfTx = 1 // 2nd one in buffer

    const dailyLimBefore = await contract.dailyLimits.call()
    assert.equal(0, BigInt(dailyLimBefore[0])) // dailyLimit == 0
    assert.equal(0, BigInt(dailyLimBefore[1])) // dailyAlreadySpent == 0
    assert.equal(Math.floor(Date.now() / (24 * 3600 * 1000)), BigInt(dailyLimBefore[2])) // relatedDay is today

    console.log('owner = ', owner, typeof owner)
    const tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newDailyLimit, OperationTypeEnum.SET_DAILY_LIMIT, { from: owner })
    console.log(`\t \\/== Gas used in init SET_DAILY_LIMIT:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID = await contract.getCurrentOtpID.call()
    const confirmedTokenId = parseInt(currentOTPID) - 1
    console.log('confirmedTokenId = ', confirmedTokenId)
    const receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(confirmedTokenId), confirmedTokenId, { from: owner })
    console.log(`\t \\/== Gas used in confirm SET_DAILY_LIMIT:`, receipt1.receipt.gasUsed)
    // console.log("\t receipt", receipt1.logs[0].args);
    // console.log("\t receipt", receipt1.logs[1].args);

    const executedOper = await contract.pendingOpers.call(idxOfTx)
    assert(!executedOper[2]) // pending == false

    const dailyLimAfter = await contract.dailyLimits.call()
    assert.equal(BigInt(newDailyLimit), BigInt(dailyLimAfter[0])) // dailyLimit == newDailyLimit
  })

  it('Exceed the new daily limit and generate 1 unconfirmed transfer in buffer', async () => {
    const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))
    const currentOTPID = await contract.getCurrentOtpID.call()
    const idxOfTx = parseInt(currentOTPID)

    const tmpReceipt = await contract.initNewOper(receiver, amountOutOfDailyLimit, OperationTypeEnum.TRANSFER, { from: owner })
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID2 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfTx + 1, parseInt(currentOTPID2))
    const operation = await contract.pendingOpers.call(idxOfTx)
    const confirmedTokenId = parseInt(currentOTPID2) - 1
    assert(operation[2]) // is pending == true
    assert.equal(BigInt(amountOutOfDailyLimit), operation[1])

    try {
      const receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(confirmedTokenId), confirmedTokenId, { from: owner })
      assert.fail(`Expected revert not received. Receipt: ${receipt1}`)
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0
      assert(revertFound, `Expected "revert", got ${error} instead`)
    }

    const currentOTPID3 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfTx + 1, parseInt(currentOTPID3))
    const executedOper = await contract.pendingOpers.call(idxOfTx)
    assert(executedOper[2]) // pending == true
    const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore, balanceAfter)
  })

  it('Increase daily limits and confirm the last transfer', async () => {
    const idxOfTx = await contract.getCurrentOtpID.call()
    const idxOfTxBefore = parseInt(idxOfTx) - 1
    const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))

    const tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newIncreasedDailyLimit, OperationTypeEnum.SET_DAILY_LIMIT, { from: owner })
    console.log(`\t \\/== Gas used in init SET_DAILY_LIMIT:`, tmpReceipt.receipt.gasUsed)

    const receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(parseInt(idxOfTx)), parseInt(idxOfTx), { from: owner })
    console.log(`\t \\/== Gas used in confirm SET_DAILY_LIMIT:`, receipt1.receipt.gasUsed)

    const currentOtpID = await contract.getCurrentOtpID.call()
    assert.equal(parseInt(idxOfTx) + 1, parseInt(currentOtpID))

    const receipt2 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfTxBefore), idxOfTxBefore, { from: owner })
    console.log(`\t \\/== Gas used in confirm TRANSFER:`, receipt2.receipt.gasUsed)

    const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal((balanceBefore - BigInt(amountOutOfDailyLimit)).toString(), balanceAfter.toString())
  })

  it('Exceed new daily limit by new accumulated transfer', async () => {
    const idxOfTx = 4
    const currentOTPID = await contract.getCurrentOtpID.call()
    assert.equal(parseInt(currentOTPID), 4)

    const tmpReceipt = await contract.initNewOper(receiver, nextSmallAmount, OperationTypeEnum.TRANSFER, { from: owner })
    console.log(`\t \\/== Gas used in init TRANSFER:`, tmpReceipt.receipt.gasUsed)

    const operation = await contract.pendingOpers.call(idxOfTx)

    assert(operation[2]) // is pending == true
    assert.equal(BigInt(nextSmallAmount), operation[1])

    try {
      await contract.confirmOper(...auth.getConfirmMaterial(idxOfTx), idxOfTx, { from: owner })
      assert.fail('Expected revert not received')
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0
      assert(revertFound, `Expected "revert", got ${error} instead`)
    }

    const currentTokenIDAfter = await contract.getCurrentOtpID.call()
    assert.equal(parseInt(currentOTPID) + 1, parseInt(currentTokenIDAfter))
  })

  it('Confirm previous transfer in a next day - considering accumulated daily limit is reset', async () => {
    const idxOfTx = 4
    const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))
    const currentOtpID = await contract.getCurrentOtpID.call()
    assert.equal(5, parseInt(currentOtpID))

    // console.log(web3.eth.getBlock(web3.eth.blockNumber).timestamp);
    const operation = await contract.pendingOpers.call(idxOfTx)
    assert(operation[2]) // is pending == true
    assert.equal(BigInt(nextSmallAmount), operation[1])

    await increaseTime(24 * 3600)
    // daysFromPrevTestSuites += 1
    const receipt1 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfTx), idxOfTx, { from: owner }) // date: Date.now()
    await decreaseTime(24 * 3600)
    console.log(`\t \\/== Gas used in confirm TRANSFER:`, receipt1.receipt.gasUsed)

    const currentOtpID2 = await contract.getCurrentOtpID.call()
    assert.equal(5, parseInt(currentOtpID2))
    const operation2 = await contract.pendingOpers.call(idxOfTx)
    assert(!operation2[2], `Expected is Pending == true, got ${operation2}`) // is pending == true

    const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore - BigInt(nextSmallAmount), balanceAfter)
  })
})

// });//

// describe.skip("Skipped ", function(){

contract('WalletHandle - TEST SUITE 4 [Playing with last resort stuff]:', function (accounts) {
  const owner = accounts[0]
  const anybody = accounts[3]
  const receiverOfLastResortFunds = accounts[5]
  const initialFunds = BigInt(web3.utils.toWei('1', 'ether'))
  let contract
  it('Bootstrap / send 1 Eth at contract', async () => {
    const sender = accounts[1]
    const initialAmount = web3.utils.toWei('1', 'ether')
    const senderBalanceBefore = BigInt(await web3.eth.getBalance(sender))
    contract = await WalletHandle.deployed()

    let txreceipt = await web3.eth.sendTransaction({ from: sender, to: contract.address, value: initialAmount })
    // throw Error("...");
    const txHash = txreceipt.transactionHash

    const tx = await web3.eth.getTransaction(txHash)
    txreceipt = await web3.eth.getTransactionReceipt(txHash)

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt.gasUsed)
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt.gasUsed)

    const expectedBallance = BigInt(initialAmount)
    assert.equal(BigInt(await web3.eth.getBalance(contract.address)), expectedBallance)

    const senderBalanceAfter = BigInt(await web3.eth.getBalance(sender))
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    )
  })

  it('Check last resort is off && receiver of last resort is account[5] && last active day is today', async () => {
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds) // addr == account[5]
    assert.equal(parseInt(BigInt(lastResortInfo[1]).valueOf()), Math.floor(Date.now() / (24 * 3600 * 1000))) // lastActiveDay == today
    assert.equal(parseInt(BigInt(lastResortInfo[2])), 0) // timeoutDays == 0
  })

  it('Check last resort is not set by calling send sendFundsToLastResortAddress (assuming deploy with timeout 0)', async () => {
    const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore, initialFunds)

    const tmpReceipt = await contract.sendFundsToLastResortAddress({ from: anybody })
    console.log(`\t \\/== Gas used in disabled sendFundsToLastResortAddress invocation:`, tmpReceipt.receipt.gasUsed)

    const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore, balanceAfter)
  })

  it('Change last resort timeout to 5 days', async () => {
    const newTimeout = 5 // days
    const idxOfOper = 0
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(BigInt(lastResortInfo[2]), 0) // timeoutDays == 0

    const currentOTPID = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper, parseInt(currentOTPID))

    const tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newTimeout, OperationTypeEnum.SET_LAST_RESORT_TIMEOUT, { from: owner })
    console.log(`\t \\/== Gas used in init SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed)

    // const currentOTPID2 = await contract.getCurrentOtpID.call()
    await contract.getCurrentOtpID.call()
    const operation = await contract.pendingOpers.call(idxOfOper)

    assert(operation[2]) // is pending == true
    assert.equal(newTimeout, operation[1])

    const tmpReceipt2 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, { from: owner })
    console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_TIMEOUT:`, tmpReceipt2.receipt.gasUsed)

    const currentOtpID3 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper + 1, parseInt(currentOtpID3))

    const lastResortInfoAfter = await contract.lastResort.call()
    assert.equal(BigInt(lastResortInfoAfter[2]), 5) // timeoutDays == 5
  })

  it('Try to invoke sendFundsToLastResortAddress early', async () => {
    const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore, initialFunds)

    try {
      const tmpReceipt = await contract.sendFundsToLastResortAddress({ from: anybody })
      assert.fail(`Expected revert not received. Receipt: ${tmpReceipt}`)
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0
      assert(revertFound, `Expected "revert", got ${error} instead`)
    }

    const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore, balanceAfter)
  })

  it('Try to invoke sendFundsToLastResortAddress after expired timeout', async () => {
    const balanceOfReceiverBefore = BigInt(await web3.eth.getBalance(receiverOfLastResortFunds))
    const balanceBefore = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(balanceBefore, initialFunds)

    await increaseTime(3600 * 24 * 6) // shift time forward
    // daysFromPrevTestSuites += 6
    const tmpReceipt = await contract.sendFundsToLastResortAddress({ from: anybody })
    console.log(`\t \\/== Gas used in sendFundsToLastResortAddress:`, tmpReceipt.receipt.gasUsed)
    // console.log("tmpReceipt = ", tmpReceipt);
    // decreaseTime(3600 * 24 * 6); // shift time backward

    const balanceAfter = BigInt(await web3.eth.getBalance(contract.address))
    assert.equal(0, balanceAfter) // contract funds are empty

    const balanceOfReceiverAfter = BigInt(await web3.eth.getBalance(receiverOfLastResortFunds))
    assert.equal(balanceOfReceiverAfter, balanceOfReceiverBefore + initialFunds)
  })

  it('Test that contract was destroyed', async () => {
    try {
      const o = await contract.owner.call()
      console.log('owner = ', o)
      assert.fail('Expected error not received')
    } catch (error) {
      // console.log("error.message = ", error.message);
      const revertFound = error.message.search(`Returned values aren't valid`) >= 0
      assert(revertFound, `Expected "Returned values aren't valid", got error: ${error}`)
    }
  })
})

// });//

// describe.skip("Skipped ", function(){

contract('WalletHandle - TEST SUITE 5 [Further playing with last resort stuff - changing address, shifting time ]:', function (accounts) {
  const owner = accounts[0]
  const anybody = accounts[3]
  const receiverOfLastResortFunds = accounts[5]
  const newReceiverOfLastResortFunds = accounts[7]
  const initialFunds = BigInt(web3.utils.toWei('1', 'ether'))
  const newDailyLimit = BigInt(web3.utils.toWei('7', 'ether'))
  let contract

  it('Bootstrap / send 1 Eth at contract', async () => {
    const sender = accounts[1]
    const initialAmount = web3.utils.toWei('1', 'ether')
    const senderBalanceBefore = BigInt(await web3.eth.getBalance(sender))
    contract = await WalletHandle.deployed()

    const txreceipt = await web3.eth.sendTransaction({ from: sender, to: contract.address, value: initialAmount })
    // throw Error("...");
    const txHash = txreceipt.transactionHash

    const tx = await web3.eth.getTransaction(txHash)
    const txreceipt2 = await web3.eth.getTransactionReceipt(txHash)

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt2.gasUsed)
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt2.gasUsed)

    const expectedBallance = BigInt(initialAmount)
    assert.equal(BigInt(await web3.eth.getBalance(contract.address)), expectedBallance)

    const senderBalanceAfter = BigInt(await web3.eth.getBalance(sender))
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    )
  })

  it('Check last resort is off && receiver of last resort is account[5] && last active day is today', async () => {
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds) // addr == account[5]
    assert.equal(BigInt(lastResortInfo[1]), Math.floor(Date.now() / (24 * 3600 * 1000))) // lastActiveDay == today
    assert.equal(BigInt(lastResortInfo[2]), 0) // timeoutDays == 0
  })

  it('Change last resort timeout to 3 days first', async () => {
    const newTimeout = 3 // days
    const idxOfOper = 0
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(BigInt(lastResortInfo[2]), 0) // timeoutDays == 0

    const currentOTPID = await contract.getCurrentOtpID.call()
    assert.equal(0, parseInt(currentOTPID))

    const tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newTimeout, OperationTypeEnum.SET_LAST_RESORT_TIMEOUT, { from: owner })
    console.log(`\t \\/== Gas used in init SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID2 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper + 1, currentOTPID2)

    const operation = await contract.pendingOpers.call(idxOfOper)
    assert(operation[2]) // is pending == true
    assert.equal(newTimeout, operation[1])

    const tmpReceipt2 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, { from: owner })
    console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_TIMEOUT:`, tmpReceipt2.receipt.gasUsed)

    const currentOtpID = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper + 1, parseInt(currentOtpID))

    const lastResortInfoAfter = await contract.lastResort.call()
    assert.equal(BigInt(lastResortInfoAfter[2]), 3) // timeoutDays == 3
  })

  it('Change last resort timeout to 5 days', async () => {
    const newTimeout = 5 // days
    const idxOfOper = 1

    const currentOTPID = await contract.getCurrentOtpID.call()
    assert.equal(1, parseInt(currentOTPID))

    const currentOtpID2 = await contract.getCurrentOtpID.call()
    assert.equal(1, parseInt(currentOtpID2))

    const tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newTimeout, OperationTypeEnum.SET_LAST_RESORT_TIMEOUT, { from: owner })
    console.log(`\t \\/== Gas used in init SET_LAST_RESORT_TIMEOUT:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID3 = await contract.getCurrentOtpID.call()
    console.log('currentOTPID3', currentOTPID3)
    const operation = await contract.pendingOpers.call(idxOfOper)
    assert(operation[2]) // is pending == true
    assert.equal(newTimeout, operation[1])

    const tmpReceipt2 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, { from: owner })
    console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_TIMEOUT:`, tmpReceipt2.receipt.gasUsed)

    const currentOtpID4 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper + 1, parseInt(currentOtpID4))

    const lastResortInfoAfter = await contract.lastResort.call()
    assert.equal(BigInt(lastResortInfoAfter[2]), 5) // timeoutDays == 5
  })

  it('Change last resort address to account[7]', async () => {
    const idxOfOper = 2
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds) // addr == old receiver

    const currentOTPID = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper, parseInt(currentOTPID))

    const tmpReceipt = await contract.initNewOper(newReceiverOfLastResortFunds, 0, OperationTypeEnum.SET_LAST_RESORT_ADDRESS, { from: owner })
    console.log(`\t \\/== Gas used in init SET_LAST_RESORT_ADDRESS:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID2 = await contract.getCurrentOtpID.call()
    console.log('currentOTPID2', currentOTPID2)
    const operation = await contract.pendingOpers.call(idxOfOper)
    assert(operation[2]) // is pending == true
    assert.equal(newReceiverOfLastResortFunds, operation[0]) // addr == newReceiverOfLastResortFunds

    const tmpReceipt2 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, { from: owner })
    console.log(`\t \\/== Gas used in confirm SET_LAST_RESORT_ADDRESS:`, tmpReceipt2.receipt.gasUsed)

    const currentOtpID3 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper + 1, parseInt(currentOtpID3))

    const lastResortInfoAfter = await contract.lastResort.call()
    assert.equal(lastResortInfoAfter[0], newReceiverOfLastResortFunds) // addr == newReceiverOfLastResortFunds
  })

  it('Check last resort activity is updated after 4 days && sendFundsToLastResortAddress will not work in next 4 days', async () => {
    const idxOfOper = 3
    const timeShift = 4 * 24 * 3600 // 4 days
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(lastResortInfo[0], newReceiverOfLastResortFunds) // addr == new one

    const currentOTPID = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper, parseInt(currentOTPID))

    const tmpReceipt = await contract.initNewOper(NULL_ADDRESS, newDailyLimit.toString(), OperationTypeEnum.SET_DAILY_LIMIT, { from: owner })
    console.log(`\t \\/== Gas used in init SET_DAILY_LIMIT:`, tmpReceipt.receipt.gasUsed)

    const currentOTPID2 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper + 1, parseInt(currentOTPID2))

    const operation = await contract.pendingOpers.call(idxOfOper)
    assert(operation[2]) // is pending == true
    assert.equal(newDailyLimit, operation[1])

    await increaseTime(timeShift) // shift time forward + 4 days
    const tmpReceipt2 = await contract.confirmOper(...auth.getConfirmMaterial(idxOfOper), idxOfOper, { from: owner })
    console.log(`\t \\/== Gas used in confirm SET_DAILY_LIMIT:`, tmpReceipt2.receipt.gasUsed)

    const currentOtpID3 = await contract.getCurrentOtpID.call()
    assert.equal(idxOfOper + 1, parseInt(currentOtpID3))

    await increaseTime(timeShift) // shift time forward + next 4 days
    try {
      const tmpReceipt = await contract.sendFundsToLastResortAddress({ from: anybody })
      assert.fail(`Expected revert not received: ${tmpReceipt}`)
    } catch (error) {
      const revertFound = error.message.search('revert') >= 0
      assert(revertFound, `Expected "revert", got ${error} instead`)
    }

    const lastResortInfoAfter = await contract.lastResort.call()
    assert.equal(lastResortInfoAfter[1].toString(), (Math.floor((Date.now() / (24 * 3600 * 1000))) + 4).toString()) // lastActiveDay == now + 4 days
  })

  it('Check sendFundsToLastResortAddress will work in next 1 day && contract was destroyed', async () => {
    await increaseTime(24 * 3600)
    const balanceOfReceiverBefore = BigInt(await web3.eth.getBalance(newReceiverOfLastResortFunds))
    await contract.sendFundsToLastResortAddress({ from: anybody })
    const balanceOfReceiverAfter = BigInt(await web3.eth.getBalance(newReceiverOfLastResortFunds))
    assert.equal(balanceOfReceiverAfter, balanceOfReceiverBefore + initialFunds)

    try {
      const o = await contract.owner.call()
      assert.fail(`Expected error not received: owner=${o}`)
    } catch (error) {
      // console.log("error.message = ", error.message);
      const revertFound = error.message.search('Returned values are not valid') >= 0
      assert(revertFound, `Expected "Returned values are not valid", got "${error}" instead`)
    }
  })

  it('Test that contract was destroyed', async () => {
    try {
      const o = await contract.owner.call()
      assert.fail(`Expected error not received: owner=${o}`)
    } catch (error) {
      // console.log("error.message = ", error.message);
      const revertFound = error.message.search('Returned values aren\'t valid') >= 0
      assert(revertFound, `Expected "Returned values are not valid", got "${error}" instead`)
    }
  })
})

// });//

// describe.skip("Skipped ", function(){

contract('WalletHandle - TEST SUITE 6 [Token depletion + immediate send to last resort address]:', function (accounts) {
  const owner = accounts[0]
  // const anybody = accounts[3]
  const receiverOfLastResortFunds = accounts[5]
  // const initialFunds = BigInt(web3.utils.toWei('5', 'ether'))
  const amount2Send = web3.utils.toWei('0.000001', 'ether')
  let contract

  it('Bootstrap / send 1 Eth at contract', async () => {
    const sender = accounts[1]
    const initialAmount = web3.utils.toWei('1', 'ether')
    const senderBalanceBefore = BigInt(await web3.eth.getBalance(sender))
    contract = await WalletHandle.deployed()

    const txreceipt = await web3.eth.sendTransaction({ from: sender, to: contract.address, value: initialAmount })
    // throw Error("...");
    const txHash = txreceipt.transactionHash

    const tx = await web3.eth.getTransaction(txHash)
    const txreceipt2 = await web3.eth.getTransactionReceipt(txHash)

    // console.log(`\t \\/== tx: `, tx);
    console.log(`\t \\/== Gas used: `, txreceipt2.gasUsed)
    const gasCost = BigInt(tx.gasPrice) * BigInt(txreceipt2.gasUsed)

    const expectedBallance = BigInt(initialAmount)
    assert.equal(BigInt(await web3.eth.getBalance(contract.address)), expectedBallance)

    const senderBalanceAfter = BigInt(await web3.eth.getBalance(sender))
    assert.equal(
      senderBalanceBefore,
      senderBalanceAfter + gasCost + BigInt(initialAmount)
    )
  })

  it('Check last resort is off && receiver of last resort is account[5] && last active day is today', async () => {
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds) // addr == account[5]
    assert.equal(BigInt(lastResortInfo[1]), Math.floor(Date.now() / (24 * 3600 * 1000))) // lastActiveDay == today
    assert.equal(BigInt(lastResortInfo[2]), 0) // timeoutDays == 0
  })

  it('Deplete tokens and measure gas consumption per a Transfer operation', async () => {
    const receiver = accounts[4]
    const lastResortInfo = await contract.lastResort.call()
    assert.equal(lastResortInfo[0], receiverOfLastResortFunds) // addr == receiverOfLastResortFunds

    const currentOtpID = await contract.getCurrentOtpID.call()
    assert.equal(0, currentOtpID)

    const gasOfConfirm = []
    let childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
    const currentOtpID2 = await contract.getCurrentOtpID.call()
    const allChildTrees = Math.floor(auth.MT_parent_numberOfOTPs / auth.MT_child_numberOfOTPs)
    for (let t = parseInt(childTreeIdx); t < allChildTrees; t++) { // iterate over remaining child trees
      // iterate over remaining child leaves
      for (let i = parseInt(currentOtpID2); i < ((t + 1) * auth._MT_child_numberOfOTPs) - 1; i++) {
        const tmpReceiptInit = await contract.initNewOper(receiver, amount2Send, OperationTypeEnum.TRANSFER, { from: owner })
        const tmpReceiptConf = await contract.confirmOper(...auth.getConfirmMaterial(i), i, { from: owner })
        console.log(`\t \\/== Gas used in init & confirm TRANSFER[${i}/${auth.MT_parent_numberOfOTPs}] = `, tmpReceiptInit.receipt.gasUsed, ' | ', tmpReceiptConf.receipt.gasUsed)

        gasOfConfirm.push(tmpReceiptConf.receipt.gasUsed)
        if (i % 100 === 0) {
          console.log('\t \\/== \tIntermediary average gas consumption of confirm is: ', round(arr.mean(gasOfConfirm)), ' +-', round(arr.stddev(gasOfConfirm)))
        }
      }
      console.log(`\t \\/== Last child tree: AVERAGE gas used in confirm TRANSFER:`, arr.mean(gasOfConfirm))
      console.log(`\t \\/== Last child tree: STDDEV of gas used in confirm TRANSFER:`, arr.stddev(gasOfConfirm))

      // bootstrap a new child tree (normally / at the end of all OTPs)
      const currentOtpID3 = await contract.getCurrentOtpID.call()
      if (t < allChildTrees - 1) { // normal adjustment
        const receiptChildTree = await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(t + 1),
          ...auth.getAuthPath4ChildTree(t + 1), ...auth.getConfirmMaterial(parseInt(currentOtpID3)), { from: owner }
        )
        console.log(`\t New child tree adjusted [${t + 1}] with price = `, receiptChildTree.receipt.gasUsed)
        const newChildTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
        assert.equal(parseInt(newChildTreeIdx), t + 1)
      } else { // adjustment after the end of all OTPs of the last child tree should make an exception
        try {
          await contract.adjustNewChildTree(auth.MT_child_depthOfCachedLayer, auth.getChildCachedLayer(0),
            ...auth.getAuthPath4ChildTree(0), ...auth.getConfirmMaterial(parseInt(currentOtpID3)), { from: owner }
          )
          assert.fail('Expected revert not received')
        } catch (error) {
          const revertFound = error.message.search('revert') >= 0
          assert(revertFound, `Expected "revert", got ${error} instead`)
        }
      }
      const currentOtpID4 = await contract.getCurrentOtpID.call()
      console.log(`currentOtpID4: ${currentOtpID4}`)
      childTreeIdx = await contract.MT_parent_currentChildTreeIdx.call()
    }
    assert.equal(parseInt(currentOtpID), auth.MT_parent_numberOfOTPs - 1)
    assert.equal(parseInt(childTreeIdx), allChildTrees - 1)

    console.log(`\n\t \\/== AVERAGE gas used in confirm TRANSFER:`, arr.mean(gasOfConfirm))
    console.log(`\t \\/== STDDEV of gas used in confirm TRANSFER:`, arr.stddev(gasOfConfirm))
  })
})

// });//

/// // AUX Functions /////

const increaseTime = async time => {
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

const decreaseTime = async time => {
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

const arr = {
  variance: function (array) {
    const mean = arr.mean(array)
    return arr.mean(array.map(function (num) {
      return Math.pow(num - mean, 2)
    }))
  },

  stddev: function (array) {
    return Math.sqrt(arr.variance(array))
  },

  mean: function (array) {
    return arr.sum(array) / array.length
  },

  sum: function (array) {
    let num = 0
    for (let i = 0, l = array.length; i < l; i++) num += array[i]
    return num
  },
}

function hexToBytes (hex) { // Convert a hex string to a byte array
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

function round (x) {
  return Number.parseFloat(x).toFixed(2)
}

function concatB32 (a, b) {
  if (typeof (a) !== 'string' || typeof (b) !== 'string' || a.substr(0, 2) !== '0x' || b.substr(0, 2) !== '0x') {
    console.log('a, b = ', a, b)
    throw new Error('ConcatB32 supports only hex string arguments')
  }
  a = hexToBytes(a)
  b = hexToBytes(b)
  const res = []
  if (a.length !== b.length || a.length !== 16 || b.length !== 16) {
    throw new Error('ConcatB32 supports only equally-long (16B) arguments.')
  } else {
    for (let i = 0; i < a.length; i++) {
      res.push(a[i])
    }
    for (let i = 0; i < b.length; i++) {
      res.push(b[i])
    }
  }
  return bytesToHex(res)
}
