
const truffleAssert = require('truffle-assertions')
const ethers = require('ethers')
const merkle = require('../lib/merkle.js')
const commons = require('./commons.js')

const DURATION = 300
const time = Math.floor((Date.now() / 1000))
const timeOffset = time - (time % 300)

contract('Guardians', accounts => {
  it('should add guardian', async () => {
    var tmpWallet = web3.eth.accounts.create()
    var { startCounter, root, leaves, wallet } = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address)
    var proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)
    await wallet.addGuardian(tmpWallet.address, proof[0], proof[1])
    var guardians = await wallet.getGuardians()
    console.log(guardians)
    assert.equal(guardians.length, 1)
  })

  it('should remove guardian', async () => {
    var tmpWallet = web3.eth.accounts.create()
    var { startCounter, root, leaves, wallet } = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address)
    var proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)
    await wallet.addGuardian(tmpWallet.address, proof[0], proof[1])
    await wallet.revokeGuardian(tmpWallet.address, proof[0], proof[1])

    var guardians = await wallet.getGuardians()
    console.log(guardians)
    assert.equal(guardians[0], '0x0000000000000000000000000000000000000000')
  })
})
