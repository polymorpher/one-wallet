const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const INTERVAL = 30000
const DURATION = INTERVAL * 8
const SLOT_SIZE = 1

contract('ONEWallet', (accounts) => {
  const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL) * INTERVAL - DURATION / 2
  const ONE_ETH = unit.toWei('1', 'ether')
  it('Factory_Create: must create wallet with expected address, identificationKey, seed, and deployer address', async () => {
    const purse = web3.eth.accounts.create()
    const {
      wallet,
      identificationKeys,
      byteSeed,
      seed,
    } = await TestUtil.createWallet({
      effectiveTime: EFFECTIVE_TIME,
      duration: DURATION,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    })
    const code = await TestUtil.getFactory('ONEWalletFactoryHelper').getCode()
    const deployerAddress = (await TestUtil.getFactory('ONEWalletFactory')).address
    const factoryDeployerAddress = await TestUtil.getFactory('ONEWalletFactoryHelper').factory()
    assert.equal(deployerAddress, factoryDeployerAddress, 'deployer address must equal factory address on contract')
    assert.equal(ONEUtil.hexString(byteSeed), ONEUtil.hexString(seed), 'deployer address must equal factory address on contract')
    assert.equal(identificationKeys[0], ONEUtil.getIdentificationKey(seed, true), 'generated idKey equals key computed using seed')
    const contractIdenteificationKey = await wallet.identificationKey()
    assert.equal(identificationKeys[0], contractIdenteificationKey, 'Wallet idKey equals computed idKey')
    const predictedAddress = ONEUtil.predictAddress({
      identificationKey: identificationKeys[0],
      deployerAddress,
      code: ONEUtil.hexStringToBytes(code)
    })
    const factoryPredictedAddress = await TestUtil.getFactory('ONEWalletFactoryHelper').predict(identificationKeys[0])
    assert.equal(predictedAddress, factoryPredictedAddress, 'util predicted address must equal to factory predicted address')
  })
})
