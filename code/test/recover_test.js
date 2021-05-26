
const truffleAssert = require('truffle-assertions')
const ethers = require('ethers')
const merkle = require('../lib/merkle.js')
const commons = require('./commons.js')

const DURATION = 300
const time = Math.floor((Date.now() / 1000))
const timeOffset = time - (time % 300)

contract('Recovery', accounts => {
  it('should start recovery', async () => {
    var wrongWallet = web3.eth.accounts.create()
    var tmpWallet = web3.eth.accounts.create()
    var { startCounter, root, leaves, wallet } = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address)
    var proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)
    await wallet.addGuardian(tmpWallet.address, proof[0], proof[1])
    var guardians = await wallet.getGuardians()
    assert.equal(guardians.length, 1)

    const newRoot = commons.getLeavesAndRoot(timeOffset, DURATION, 10)

    // good signature
    var sigs = await commons.signRecoveryOffchain([tmpWallet], newRoot.root, 10, DURATION, timeOffset)
    await wallet.startRecovery(newRoot.root, 10, DURATION, timeOffset, sigs)
    var isRecovering = await wallet.isRecovering()
    assert.equal(isRecovering, true)

    // try with a bad hash , 12 when it should be 10
    sigs = await commons.signRecoveryOffchain([tmpWallet], newRoot.root, 12, DURATION, timeOffset)
    await truffleAssert.reverts(wallet.startRecovery(newRoot.root, 10, DURATION, timeOffset, sigs), 'Invalid signatures')

    // try with the wrong address
    sigs = await commons.signRecoveryOffchain([wrongWallet], newRoot.root, 10, DURATION, timeOffset)
    await truffleAssert.reverts(wallet.startRecovery(newRoot.root, 10, DURATION, timeOffset, sigs), 'Invalid signatures')

    await truffleAssert.reverts(wallet.finalizeRecovery(), 'ongoing recovery period')

    await commons.increaseTime(86500)
    await wallet.finalizeRecovery()
  })
})
