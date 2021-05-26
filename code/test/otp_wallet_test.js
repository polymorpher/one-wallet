const commons = require('./commons.js')
const BN = require('bn.js')

const DURATION = 300
const time = Math.floor((Date.now() / 1000))
const timeOffset = time - (time % 300)

contract('OTPWallet', accounts => {
  it('should transfer & drain', async () => {
    // const leaves = [h16(padNumber('0x1')),h16(padNumber('0x2')),h16(padNumber('0x3')),h16(padNumber('0x4'))];

    const tmpWallet = web3.eth.accounts.create()
    const { root, leaves, wallet } = await commons.createWallet(timeOffset, DURATION, 16, tmpWallet.address)
    console.log('root=' + root)
    // console.log("leaves=", leaves);

    // const receipt = await wallet._reduceConfirmMaterial(proof[0], proof[1]);
    await web3.eth.sendTransaction({ from: accounts[0], to: wallet.address, value: web3.utils.toWei('1', 'ether') })

    let proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)
    await wallet.makeTransfer(tmpWallet.address, web3.utils.toWei('0.01', 'ether'), proof[0], proof[1])
    let newBalance = await web3.eth.getBalance(tmpWallet.address)
    console.log('Balance=', newBalance)
    assert.equal(newBalance, web3.utils.toWei('.01', 'ether'), 'withdraw amount is correct')

    proof = await commons.getTOTPAndProof(leaves, timeOffset, DURATION)
    await wallet.drain(proof[0], proof[1])
    newBalance = await web3.eth.getBalance(tmpWallet.address)
    console.log('Balance=', newBalance)
    assert.equal(newBalance, web3.utils.toWei('1', 'ether'), 'withdraw amount is correct')
  })
  it('checks for remaining token', async () => {
    const tmpWallet = web3.eth.accounts.create()
    const { wallet } = await commons.createWallet(timeOffset - (Math.pow(2, 2) * DURATION), DURATION, 2, tmpWallet.address)
    const numTokensLeft = await wallet.remainingTokens()
    const counter = await wallet.getCurrentCounter().then(e => e.toString())
    console.log(`counter=${counter} | numTokensLeft=${numTokensLeft.toString()}`)
    // const w = await wallet.wallet.call()
    // console.log('merkelHeight', w.merkelHeight.toString())
    assert.isTrue(numTokensLeft.eq(new BN(0)))
  })
})
