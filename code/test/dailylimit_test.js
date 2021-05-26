
const truffleAssert = require('truffle-assertions')
const commons = require('./commons.js')

const DURATION = 300
const time = Math.floor((Date.now() / 1000))
const timeOffset = time - (time % 300)

contract('DailyLimit', accounts => {
  it('should test for daily limit', async () => {
    const tmpWallet = web3.eth.accounts.create()
    const { leaves, wallet } = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address)
    const proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)

    await web3.eth.sendTransaction({ from: accounts[0], to: wallet.address, value: web3.utils.toWei('1', 'ether') })
    await wallet.makeTransfer(tmpWallet.address, web3.utils.toWei('0.01', 'ether'), proof[0], proof[1])
    // const newBalance = await web3.eth.getBalance(tmpWallet.address)
    // console.log(newBalance);

    const overLimit = wallet.makeTransfer(tmpWallet.address, web3.utils.toWei('0.01', 'ether'), proof[0], proof[1])
    await truffleAssert.reverts(overLimit, 'over withdrawal limit')
  })
})
