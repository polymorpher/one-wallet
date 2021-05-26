const commons = require('./commons.js')

const DURATION = 300
const time = Math.floor((Date.now() / 1000))
const timeOffset = time - (time % 300)

contract('Guardians', accounts => {
  it('should add guardian', async () => {
    const tmpWallet = web3.eth.accounts.create()
    const { leaves, wallet } = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address)
    const proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)
    await wallet.addGuardian(tmpWallet.address, proof[0], proof[1])
    const guardians = await wallet.getGuardians()
    console.log(guardians)
    assert.equal(guardians.length, 1)
  })

  it('should remove guardian', async () => {
    const tmpWallet = web3.eth.accounts.create()
    const { leaves, wallet } = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address)
    const proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)
    await wallet.addGuardian(tmpWallet.address, proof[0], proof[1])
    await wallet.revokeGuardian(tmpWallet.address, proof[0], proof[1])

    const guardians = await wallet.getGuardians()
    console.log(guardians)
    assert.equal(guardians[0], '0x0000000000000000000000000000000000000000')
  })
})
