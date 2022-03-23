const TestUtil = require('./util')
const CheckUtil = require('./checkUtil')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const BN = require('bn.js')
const ONE = require('../lib/onewallet')
const ONEWallet = require('../lib/onewallet')
const ONEDebugger = require('../lib/debug')
const Logger = TestUtil.Logger
const Debugger = ONEDebugger(Logger)

const ONE_CENT = unit.toWei('0.01', 'ether')
// const HALF_DIME = unit.toWei('0.05', 'ether')
// const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 2 * 60 * 24 * 1 // 1 day wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const DUMMY_HEX = ONEUtil.hexString('5') // Dummy Hex string for 5 i.e. 0x05
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

// assetTransfer commits and reveals a wallet transaction
const transactionExecute = async ({ wallet, operationType, tokenType, contractAddress, tokenId, dest, amount, data, address, testTime }) => {
  Debugger.printLayers({ layers: wallet.layers })
  if (testTime === undefined) { testTime = Date.now() }
  // // calculate counter from testTime
  const counter = Math.floor(testTime / INTERVAL)
  const otp = ONEUtil.genOTP({ seed: wallet.seed, counter })
  // // calculate wallets effectiveTime (creation time) from t0
  const info = await wallet.wallet.getInfo()
  const t0 = new BN(info[3]).toNumber()
  const walletEffectiveTime = t0 * INTERVAL
  const index = ONEUtil.timeToIndex({ effectiveTime: walletEffectiveTime, time: testTime })
  const eotp = await ONE.computeEOTP({ otp, hseed: wallet.hseed })

  // Format commit and revealParams based on tokenType
  let commitParams
  let revealParams
  let paramsHash
  console.log(`operationType: ${operationType}`)
  switch (operationType) {
    case ONEConstants.OperationType.TRACK:
    case ONEConstants.OperationType.UNTRACK:
      paramsHash = ONEWallet.computeGeneralOperationHash
      commitParams = { operationType, tokenType, contractAddress, dest }
      revealParams = { operationType, tokenType, contractAddress, dest }
      break
    case ONEConstants.OperationType.OVERRIDE_TRACK:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, data }
      revealParams = { operationType, data }
      break
    case ONEConstants.OperationType.SET_RECOVERY_ADDRESS:
      paramsHash = ONEWallet.computeSetRecoveryAddressHash
      commitParams = { operationType, address }
      revealParams = { operationType, address }
      break
    case ONEConstants.OperationType.TRANSFER_TOKEN:
      paramsHash = ONEWallet.computeGeneralOperationHash
      switch (tokenType) {
        case ONEConstants.TokenType.ERC20:
          commitParams = { operationType, tokenType, contractAddress, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, dest, amount }
          break
        case ONEConstants.TokenType.ERC721:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest }
          break
        case ONEConstants.TokenType.ERC1155:
          commitParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          revealParams = { operationType, tokenType, contractAddress, tokenId, dest, amount }
          break
        default:
          console.log(`TODO: add in Token error handling for TRANSFER_TOKEN`)
          return
      }
      break
    case ONEConstants.OperationType.TRANSFER:
      paramsHash = ONEWallet.computeTransferHash
      commitParams = { operationType, dest, amount }
      revealParams = { operationType, dest, amount }
      break
    default:
      console.log(`TODO: add in error handling`)
      return
  }
  await TestUtil.commitReveal({
    Debugger,
    layers: wallet.layers,
    index,
    eotp,
    paramsHash,
    commitParams,
    revealParams,
    wallet: wallet.wallet
  })
}

contract('ONEWallet', (accounts) => {
  // Wallets effective time is the current time minus half the duration (3 minutes ago)
  let snapshotId
  beforeEach(async function () {
    snapshotId = await TestUtil.snapshot()
    await TestUtil.init()
  })
  afterEach(async function () {
    await TestUtil.revert(snapshotId)
  })

  // Test COMMAND function
  // } else if (op.operationType == Enums.OperationType.COMMAND) {
  //   backlinkAddresses.command(op.tokenType, op.contractAddress, op.tokenId, op.dest, op.amount, op.data);
  it('Wallet_Command: must be able to run a command', async () => {
    let alice = await CheckUtil.makeWallet('TT-ERC20-1', accounts[0], EFFECTIVE_TIME, DURATION)
    let bob = await CheckUtil.makeWallet('TT-ERC20-2', accounts[0], EFFECTIVE_TIME, DURATION)
    let aliceOldState = await CheckUtil.getONEWalletState(alice.wallet)
    let aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    let bobOldState = await CheckUtil.getONEWalletState(bob.wallet)
    let bobCurrentState = await CheckUtil.getONEWalletState(bob.wallet)
    const { testerc20 } = await CheckUtil.makeTokens(accounts[0])
    const { testerc20: testerc20v2 } = await CheckUtil.makeTokens(accounts[0])
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    // transfer ERC20 tokens from accounts[0] (which owns the tokens) to alices wallet
    await testerc20.transfer(alice.wallet.address, 1000, { from: accounts[0] })
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(1000, aliceBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet succesful')
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')
    console.log('Funded ERC20')

    // Begin Tests
    let testTime = Date.now()

    // ====== TRACK ======
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: alice.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    // nonce
    let nonce = await alice.wallet.getNonce()
    assert.notEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), aliceOldState.nonce + 1, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()
    // lastOperationTime
    let lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    // console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END TRACK ==== 

    // ====== UNTRACK ======
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.UNTRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: alice.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    // console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0].length, 0, 'alice.wallet.trackedTokens not tracking tokens of type ERC20')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END UNTRACK ==== 

    // ====== TRANSFER_TOKEN ======
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: bob.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END TRANSFER_TOKEN ====


    // ====== OVERRIDE_TRACK ======
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    // uint256[] memory tokenTypes, address[] memory contractAddresses, uint256[] memory tokenIds
    let data = await alice.wallet.getTrackedTokens()
    data[1] = [testerc20v2.address]

    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        // tokenType: ONEConstants.TokenType.ERC20,
        // contractAddress: testerc20.address,
        // tokenId: 1,
        // dest: bob.wallet.address,
        // amount: 1,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // tracked tokens
    trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ==== END OVERRIDE_TRACK ====

    // ========= TRANSFER =========
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    // alice tranfers ONE CENT to bob
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: (ONE_CENT / 2),
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ======= END TRANSFER =======

    // ==== SET_RECOVERY_ADDRESS =====
    testTime = await TestUtil.bumpTestTime(testTime, 45)
    // alice tranfers ONE CENT to bob
    await transactionExecute(
      {
        wallet: alice,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        address: bob.lastResortAddress,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await CheckUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    // lastOperationTime
    lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // spendingState
    spendingState = await alice.wallet.getSpendingState()
    assert.equal(spendingState.spentAmount, (ONE_CENT / 2).toString(), 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.spentAmount = spendingState.spentAmount
    assert.notEqual(spendingState.lastSpendingInterval, '0', 'alice wallet.spentAmount should have been changed')
    aliceOldState.spendingState.lastSpendingInterval = spendingState.lastSpendingInterval
    // commits
    allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await CheckUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // ===== SET_RECOVERY_ADDRESS =====
  })
})
