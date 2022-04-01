const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEDebugger = require('../lib/debug')
const ONEConstants = require('../lib/constants')
const ONEWallet = require('../lib/onewallet')
const BN = require('bn.js')

const INTERVAL = 30000
const INTERVAL6 = INTERVAL * 6
const SLOT_SIZE = 1
const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)
const NOW = Math.floor(Date.now() / (INTERVAL)) * INTERVAL - 5000

contract('ONEWallet', (accounts) => {
  Logger.debug(`Testing with ${accounts.length} accounts`)
  Logger.debug(accounts)
  const ONE_ETH = unit.toWei('1', 'ether')
  const ONE_CENT = unit.toWei('0.01', 'ether')
  const duration = INTERVAL * 2 * 60 * 24 * 4
  const effectiveTime = Math.floor(NOW / INTERVAL6) * INTERVAL6 - duration / 2
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    console.log(`Taken snapshot id=${snapshotId}`)
  })

  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  it('Wallet_Command: must be able to command linked wallets', async () => {
    const purse = web3.eth.accounts.create()

    const commonCreationArgs = {
      effectiveTime,
      duration,
      maxOperationsPerInterval: SLOT_SIZE,
      lastResortAddress: purse.address,
      spendingLimit: ONE_ETH
    }
    const { wallet: w1, seed: s1, hseed: hs1, client: { layers: l1 } } = await TestUtil.createWallet({
      salt: new BN(ONEUtil.keccak('Wallet_Command_w1').slice(24)),
      ...commonCreationArgs
    })
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: w1.address,
      value: ONE_CENT
    })
    assert.equal(await web3.eth.getBalance(w1.address), ONE_CENT, 'w1 should receive 1 cent')
    assert.equal(await web3.eth.getBalance(purse.address), '0', 'purse should be empty')

    const { wallet: w2, seed: s2, hseed: hs2, client: { layers: l2 } } = await TestUtil.createWallet({
      salt: new BN(ONEUtil.keccak('Wallet_Command_w2').slice(24)),
      ...commonCreationArgs
    })
    const { eotp: e1, index: i1 } = await TestUtil.getEOTP({ seed: s1, hseed: hs1, effectiveTime })
    const { tx: tx1 } = await TestUtil.commitReveal({
      Debugger,
      layers: l1,
      index: i1,
      eotp: e1,
      paramsHash: ONEWallet.computeForwardHash,
      commitParams: { address: w2.address },
      revealParams: { dest: w2.address, operationType: ONEConstants.OperationType.FORWARD },
      wallet: w1
    })
    Logger.debug(tx1)

    const forwardAddress = await w1.getForwardAddress()
    Logger.debug(forwardAddress)
    assert.equal(w2.address, forwardAddress, 'forward address should equal to second wallet')

    const { eotp: e2, index: i2 } = await TestUtil.getEOTP({ seed: s2, hseed: hs2, effectiveTime })
    const hexData = ONEUtil.abi.encodeParameters(['address', 'uint16', 'bytes'], [w1.address, ONEConstants.OperationType.SIGN, '0x'])
    const messageHash = ONEUtil.keccak('hello world')
    const signature = ONEUtil.keccak('awesome signature')
    const expiryAtBytes = new BN(0xffffffff).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    const data = ONEUtil.hexToBytes(hexData)
    const execParams = {
      operationType: ONEConstants.OperationType.COMMAND,
      tokenType: ONEConstants.TokenType.NONE,
      contractAddress: ONEConstants.EmptyAddress,
      tokenId: new BN(messageHash).toString(),
      dest: ONEUtil.hexString(encodedExpiryAt),
      amount: new BN(signature).toString(),
      data,
    }
    assert.equal(await web3.eth.getBalance(w2.address), ONE_CENT, 'w2 should receive 1 cent forwarded from w1')
    const { tx: tx2 } = await TestUtil.commitReveal({
      Debugger,
      layers: l2,
      index: i2,
      eotp: e2,
      paramsHash: ONEWallet.computeGeneralOperationHash,
      commitParams: { ...execParams },
      revealParams: { ...execParams },
      wallet: w2
    })
    Logger.debug(tx2)
    const v = await w1.isValidSignature(ONEUtil.hexToBytes(messageHash), ONEUtil.hexToBytes(signature))
    assert.equal(v, true, `signature ${ONEUtil.hexToBytes(signature)} should be valid`)
    const v1 = await w1.isValidSignature(ONEUtil.hexToBytes(messageHash), '0xabcd')
    assert.equal(v1, false, `signature 0xabcd should be valid`)
  })
})
