const TestUtil = require('./util')
const unit = require('ethjs-unit')
const ONEUtil = require('../lib/util')
const ONEConstants = require('../lib/constants')
const ONE_CENT = unit.toWei('0.01', 'ether')
const HALF_DIME = unit.toWei('0.05', 'ether')
const ONE_DIME = unit.toWei('0.1', 'ether')
const HALF_ETH = unit.toWei('0.5', 'ether')
// const ONE_ETH = unit.toWei('1', 'ether')
// const TWO_ETH = unit.toWei('2', 'ether')
const THREE_ETH = unit.toWei('3', 'ether')
const FOUR_ETH = unit.toWei('4', 'ether')
const INTERVAL = 30000 // 30 second Intervals
const DURATION = INTERVAL * 2 * 60 * 24 * 1 // 1 day wallet duration
// const SLOT_SIZE = 1 // 1 transaction per interval
const EFFECTIVE_TIME = Math.floor(Date.now() / INTERVAL / 6) * INTERVAL * 6 - DURATION / 2

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

  // ====== TRACK ======
  // Test tacking of an ERC20 token
  // Expected result the token is now tracked
  it('OPERATION 0 TRACK: must be able to track tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP0-0', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: aliceCurrentState } = await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )

    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== UNTRACK ======
  // Test untracking of an ERC20 token
  // Expected result the token is no longer tracked
  it('OPERATION 1 UNTRACK: must be able to untrack tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP0-0', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })

    // Begin Tests
    let testTime = Date.now()

    // Need to track a token before untracking
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let { currentState: aliceCurrentState } = await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )
    // Update alice current State
    aliceOldState = aliceCurrentState

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // eslint-disable-next-line no-lone-blocks
    { ({ currentState: aliceCurrentState } = await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.UNTRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )) }

    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState, validateNonce: false })
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    // console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0].length, 0, 'alice.wallet.trackedTokens not tracking tokens of type ERC20')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== TRANSFER_TOKEN ======
  // Test transferring a token
  // Expected result the token is now tracked and alices balance has decreased and bobs increased
  it('OPERATION 2 TRANSFER_TOKEN: must be able to transfer assets', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP2-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TG-OP2-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    // fund Tokens
    let testTime = Date.now()
    await TestUtil.fundTokens({
      funder: accounts[0],
      receiver: alice.wallet.address,
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [1000]
    })
    // create wallets and token contracts used througout the tests
    let aliceBalanceERC20
    let aliceWalletBalanceERC20
    let bobBalanceERC20
    let bobWalletBalanceERC20
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(1000, aliceWalletBalanceERC20, 'Transfer of 1000 ERC20 tokens to alice.wallet checked via wallet succesful')

    // Begin Tests
    testTime = await TestUtil.bumpTestTime(testTime, 60)

    // TODO investigate how to combine populating objects that already exist
    // eslint-disable-next-line no-lone-blocks
    { ({ currentState: aliceCurrentState } = await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER_TOKEN,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: bob.wallet.address,
        amount: 100,
        testTime
      }
    )) }
    // check alice and bobs balance
    aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    bobBalanceERC20 = await testerc20.balanceOf(bob.wallet.address)
    bobWalletBalanceERC20 = await bob.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, bobBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful')
    assert.equal(100, bobWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to bob.wallet succesful and wallet balance updated')
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC20 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ====== OVERRIDE_TRACK ======
  // Test overriding all of Alices Token Tracking information
  // Expected result: Alice will now track testerc20v2 instead of testerc20
  it('OPERATION 3 OVERRIDE_TRACK: must be able to override tracked tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP3-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    const { testerc20: testerc20v2 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })

    // Begin Tests
    let testTime = Date.now()

    // First track testerc20
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: alice.wallet.address,
        amount: 1,
        testTime
      }
    )
    // Update alice current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceOldState = aliceCurrentState

    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    let newTrackedTokens = await alice.wallet.getTrackedTokens()
    newTrackedTokens[1] = [testerc20v2.address]
    let hexData = ONEUtil.abi.encodeParameters(['uint256[]', 'address[]', 'uint256[]'], [newTrackedTokens[0], newTrackedTokens[1], newTrackedTokens[2]])
    let data = ONEUtil.hexStringToBytes(hexData)
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.OVERRIDE_TRACK,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState, validateNonce: false })
    // tracked tokens
    let trackedTokens = await alice.wallet.getTrackedTokens()
    assert.notDeepEqual(trackedTokens, aliceOldState.trackedTokens, 'alice.wallet.trackedTokens should have been updated')
    assert.equal(trackedTokens[0][0].toString(), ONEConstants.TokenType.ERC20.toString(), 'alice.wallet.trackedTokens tracking tokens of type ERC20')
    assert.deepEqual(trackedTokens[1][0], testerc20v2.address, 'alice.wallet.trackedTokens tracking testerc20')
    assert.deepEqual(trackedTokens[2].length, 1, 'alice.wallet.trackedTokens two tokens are now tracked')
    assert.deepEqual([ trackedTokens[2][0].toString() ], ['0'], 'alice.wallet.trackedTokens tokens 0 (ERC29 has no NFT id) is now tracked')
    aliceOldState.trackedTokens = trackedTokens
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ========= TRANSFER =========
  // Test transferring of Native Currency from alice to bob
  // Expected result: Alices balance will decrease bobs will increase, alice spendingState is updated
  it('OPERATION 4 TRANSFER : must be able to transfer native assets', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState, initialBalance: aliceInitialBalance } = await TestUtil.makeWallet({ salt: 'TG-OP4-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: bob, initialBalance: bobInitialBalance } = await TestUtil.makeWallet({ salt: 'TG-OP4-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice tranfers ONE CENT to bob
    let transferAmount = (ONE_CENT / 2)
    let { currentState: aliceCurrentState } = await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRANSFER,
        dest: bob.wallet.address,
        amount: transferAmount,
        testTime
      }
    )

    // validateBalanceUpdate
    // Alice Items that have changed - balance, nonce, lastOperationTime, commits, spendingState
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: (aliceInitialBalance - transferAmount) })
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    aliceOldState = await TestUtil.validateSpendingState({ wallet: alice.wallet, oldState: aliceOldState, spentAmount: transferAmount })
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    // Bob Items that have changed - balance
    // Note when adding need to ensure the values are number (by using the Number function)
    await TestUtil.validateBalance({ address: bob.wallet.address, amount: (Number(bobInitialBalance) + Number(transferAmount)) })
  })

  // ==== SET_RECOVERY_ADDRESS =====
  // Test setting of alices recovery address
  // Expected result: alices lastResortAddress will change to bobs last Resort address
  // Notes: Cannot set this to zero address, the same address or the treasury address
  // Fails to update if you have create alice wallet with `setLastResortAddress: true` as an address already set.
  it('OPERATION 5 SET_RECOVERY_ADDRESS: must be able to set recovery address', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP5-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION, setLastResortAddress: false })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'TG-OP5-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)

    let aliceGetInfoInitial = await alice.wallet.getInfo()
    console.log(`Alice Initial last resort address: ${aliceGetInfoInitial[6].toString()}`)

    // alice tranfers ONE CENT to bob
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        dest: carol.wallet.address,
        testTime
      }
    )
    // Update alice and bob's current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, recoveryAddress, commits
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // recoveryAddress
    let aliceGetInfo = await alice.wallet.getInfo()
    assert.notDeepEqual(aliceGetInfo, aliceOldState.info, 'alice wallet.getInfo recoveryAddress should have been changed')
    assert.equal(aliceGetInfo[6].toString(), carol.wallet.address, 'alice wallet.getInfo recoveryAddress should equal carol.wallet.address')
    aliceOldState.info.recoveryAddress = aliceGetInfo[6].toString()
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== RECOVER =====
  // Test recover all funds and tokens from alices wallet
  // Expected result: will be transferred to her last resort address (currently bob's last resort address)
  it('OPERATION 6 RECOVER: must be able to recover assets', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP6-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    await TestUtil.validateBalance({ address: alice.wallet.address, amount: HALF_ETH })
    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // recover Alices wallet
    //
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.RECOVER,
        testTime
      }
    )
    // Update alice current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: (0.5) })
    // Alice Items that have changed - nonce, lastOperationTime, recoveryAddress, commits
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== DISPLACE =====
  // Test must allow displace operation using 6x6 otps for different durations
  // Expected result: can authenticate otp from new core after displacement
  // Note: this is currently tested in innerCores.js
  it('OPERATION 7 DISPLACE : must allow displace operation using 6x6 otps for different durations authenticate otp from new core after displacement', async () => {
    assert.equal(0, 1, 'Please test displace using innerCores.js')
  })

  // ==== FORWARD =====
  // Test Can forward alices wallet to Carols wallet
  // Expected result: Funds will now be available in Carols Wallet
  it('OPERATION 8 FORWARD : must be able to forward to a different wallet', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP8-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'TG-OP8-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // forward Alices wallet to Carol
    //
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.FORWARD,
        dest: carol.wallet.address,
        testTime
      }
    )
    // Update alice current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, recoveryAddress, commits
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== RECOVER_SELECTED_TOKENS =====
  // Test : Recovery of Selected Tokens
  // Expected result: Alice will recover her tokens to her last resort address
  it('OPERATION 9 RECOVER_SELECTED_TOKENS: must be able to recover selected tokens', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP9-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'TG-OP9-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    // fund Tokens
    await TestUtil.fundTokens({
      funder: accounts[0],
      receiver: alice.wallet.address,
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [1000]
    })
    // Begin Tests
    let testTime = Date.now()

    // Before we can recover we need to track testERC20
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.TRACK,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        testTime
      }
    )
    let trackedTokens = await alice.wallet.getTrackedTokens()
    console.log(`trackedTokens: ${JSON.stringify(trackedTokens)}`)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Recover test taokens takes an array of uint32 which are the indices of the tracked tokens to recover
    let hexData = ONEUtil.abi.encodeParameters(['uint32[]'], [[0]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.RECOVER_SELECTED_TOKENS,
        dest: carol.wallet.address,
        data,
        testTime
      }
    )
    // ERC20 tokens should be recovered to carols.wallet.address
    let aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    assert.equal(0, aliceBalanceERC20, 'Alice shoud have 0 ERC20 tokens in alice.wallet ')
    let aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(0, aliceWalletBalanceERC20, 'Alice shoud have 0 ERC20 tokens in checked via wallet')
    let carolBalanceERC20 = await testerc20.balanceOf(carol.wallet.address)
    assert.equal(1000, carolBalanceERC20, 'Carol should have 1000 ERC20 tokens in carol.wallet recovered from Alice')
    let carolWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(0, carolWalletBalanceERC20, 'Carol should have 1000 ERC20 tokens in carol.wallet recovered from Alice checked via wallet succesful')

    // Update alices current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - lastOperationTime, commits
    // lastOperationTime
    let lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // commits
    let allCommits = await alice.wallet.getAllCommits()
    assert.notDeepEqual(allCommits, aliceOldState.allCommits, 'alice wallet.allCommits should have been updated')
    aliceOldState.allCommits = allCommits
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BUY_DOMAIN ====
  // Test Buy a harmony domain and link it to the wallet address
  // Expected result: Domain is linked to wallet
  // Note: Will not be implemented as part of phase 2 testing
  it('OPERATION 10 BUY_DOMAIN : must be able to buy a domain', async () => {
    assert.equal(0, 1, 'OPERATION 10 BUY_DOMAIN will be implemented as part of phase 2 testing ')
  })

  // ==== COMMAND =====
  // Test executing a transfer of some ERC20 tokens to a backlinked wallet
  // Expected result: command will transfer tokens from Alice's wallet to the backlinked Carol's wallet
  it('OPERATION 11 COMMAND: must be able to execute a command', async () => {
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP11-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'TG-OP11-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    // fund Tokens
    await TestUtil.fundTokens({
      funder: accounts[0],
      receiver: alice.wallet.address,
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [1000]
    })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Call
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.COMMAND,
        data,
        tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: carol.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice and carols's current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // check alice and carols balance
    let aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    let aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    let carolBalanceERC20 = await testerc20.balanceOf(carol.wallet.address)
    let carolWalletBalanceERC20 = await carol.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, carolBalanceERC20, 'Transfer of 100 ERC20 tokens to carol.wallet succesful')
    assert.equal(100, carolWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to carol.wallet succesful and wallet balance updated')
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BACKLINK_ADD =====
  // Test add a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will be backlinked to Carols
  it('OPERATION 12 BACKLINK_ADD: must be able to backlink to another ONEWallet', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP12-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'TG-OP12-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.deepEqual(backlinks[0].toString(), carol.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal carol.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BACKLINK_DELETE =====
  // Test remove a backlink from Alices wallet to Carols
  // Expected result: Alices wallet will not be backlinked to Carols
  it('OPERATION 13 BACKLINK_DELETE: must be able to delete backlink to another wallet', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP13-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'TG-OP13-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    // create wallets and token contracts used througout the tests

    // Begin Tests
    let testTime = Date.now()

    // Add a backlink from Alice to Carol
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    aliceOldState = aliceCurrentState

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Remove the backlink from Alice to Carol
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_DELETE,
        data,
        testTime
      }
    )
    // Update alice and bob's current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState, validateNonce: false })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.equal(backlinks.length, 0, 'alice.wallet.backlinkedAddresses should be empty')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== BACKLINK_OVERRIDE =====
  // Test override a backlink from Alices wallet to Carols with Alices Wallet to Doras
  // Expected result: Alices wallet will be backlinked to Doras
  it('OPERATION 14 BACKLINK_OVERRIDE: must be able to override a backlink to andother wallet', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP14-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: carol } = await TestUtil.makeWallet({ salt: 'TG-OP14-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: dora } = await TestUtil.makeWallet({ salt: 'TG-OP14-3', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    // First Link Alice to Carol
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        data,
        testTime
      }
    )
    // Now overwride link to Carol with link to Dora
    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // Get alices current tracked tokens and override the address from testerc20 to testerc20v2
    hexData = ONEUtil.abi.encodeParameters(['address[]'], [[dora.wallet.address]])
    data = ONEUtil.hexStringToBytes(hexData)
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_OVERRIDE,
        data,
        testTime
      }
    )
    // Update alice current State
    aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, backlinkedAddresses
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // backlinkedAddresses
    let backlinks = await alice.wallet.getBacklinks()
    assert.notDeepEqual(backlinks, aliceOldState.backlinkedAddresses, 'alice.wallet.backlinkedAddresses should have been updated')
    assert.deepEqual(backlinks[0].toString(), dora.wallet.address.toString(), 'alice.wallet.backlinkedAddresses should equal dora.wallet.address')
    aliceOldState.backlinks = backlinks
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== RENEW_DOMAIN =====
  // Test renew a domain already associated with wallet address
  // Expected result: domain is renewed
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 15 RENEW_DOMAIN: must be able to renew a domain', async () => {
    assert.equal(0, 1, 'OPERATION 15 RENEW_DOMAIN will be implemented as part of phase 2 testing ')
  })

  // ==== TRANSFER_DOMAIN =====
  // Test transfer a domain from alices wallet to carols wallet
  // Expected result: carol's wallet is now associated with the domain
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 16 TRANSFER_DOMAIN: must be able to transfer a domain', async () => {
    assert.equal(0, 1, 'OPERATION 16 TRANSFER_DOMAIN: will be implemented as part of phase 2 testing ')
  })

  // ==== RECLAIM_REVERSE_DOMAIN =====
  // Test reclam a domain previously associated with a wallet
  // Expected result: domain is reassoicated with the wallet
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 17 RECLAIM_REVERSE_DOMAIN: must be able to reclaim a domain from a wallet', async () => {
    assert.equal(0, 1, 'OPERATION 17 RECLAIM_REVERSE_DOMAIN will be implemented as part of phase 2 testing ')
  })

  // ==== RECLAIM_DOMAIN_FROM_BACKLINK =====
  // Test reclaim a domain associated with a backlinked wallet
  // Expected result: carol's wallet has a backlink to alice which owns the domain,
  // carol reclaims the domain and it is now associated with her wallet.
  // Note: Will not be implemented as part of phase1 testing
  it('OPERATION 18 RECLAIM_DOMAIN_FROM_BACKLINK: must be able to reclaim a domain from a backlinked wallet', async () => {
    assert.equal(0, 1, 'OPERATION 18 RECLAIM_DOMAIN_FROM_BACKLINK will be implemented as part of phase 2 testing ')
  })

  // ==== SIGN =====
  // Test Sign a transaction to authorize spending of a token by another wallet
  // Expected result: Alice will sign a transaction to enable ernie to spend 100 tokens
  it('OPERATION 19 SIGN: must be able to sign a transaction', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP19-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: ernie } = await TestUtil.makeWallet({ salt: 'TG-OP19-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    // fund Tokens
    await TestUtil.fundTokens({
      funder: accounts[0],
      receiver: alice.wallet.address,
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [1000]
    })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.SIGN,
        // tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: ernie.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // check alice and bobs balance
    let aliceBalanceERC20 = await testerc20.balanceOf(alice.wallet.address)
    let aliceWalletBalanceERC20 = await alice.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    let ernieBalanceERC20 = await testerc20.balanceOf(ernie.wallet.address)
    let ernieWalletBalanceERC20 = await ernie.wallet.getBalance(ONEConstants.TokenType.ERC20, testerc20.address, 0)
    assert.equal(900, aliceBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful')
    assert.equal(900, aliceWalletBalanceERC20, 'Transfer of 100 ERC20 tokens from alice.wallet succesful and wallet balance updated')
    assert.equal(100, ernieBalanceERC20, 'Transfer of 100 ERC20 tokens to ernie.wallet succesful')
    assert.equal(100, ernieWalletBalanceERC20, 'Transfer of 100 ERC20 tokens to ernie.wallet succesful and wallet balance updated')
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== REVOKE =====
  // Test Revoke authorization for spending of a token by another wallet
  // Expected result: Alice will revoke the ability to spend by Ernie
  it('OPERATION 20 REVOKE: must be able to revoke authorizations', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP20-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: ernie } = await TestUtil.makeWallet({ salt: 'TG-OP20-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // make Tokens
    const { testerc20 } = await TestUtil.makeTokens({ deployer: accounts[0], makeERC20: true, makeERC721: false, makeERC1155: false })
    // fund Tokens
    await TestUtil.fundTokens({
      funder: accounts[0],
      receiver: alice.wallet.address,
      tokenTypes: [ONEConstants.TokenType.ERC20],
      tokenContracts: [testerc20],
      tokenAmounts: [1000]
    })

    // Begin Tests
    let testTime = Date.now()

    // TODO Add an authorization (needed if we are going to REVOKE it)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.REVOKE,
        // tokenType: ONEConstants.TokenType.ERC20,
        contractAddress: testerc20.address,
        tokenId: 1,
        dest: ernie.wallet.address,
        amount: 100,
        testTime
      }
    )
    // Update alice current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== CALL =====
  // Test Create a signed transaction for a contract and then CALL this contract to execute it
  // Expected result: Alice will sign a transfer for 100 ERC20 tokens to Bob the CALL will execute and alice and bobs ERC20 balances will be updated
  it('OPERATION 21 CALL: must be able to call signed transactions', async () => {
    assert.equal(0, 1, 'OPERATION 21 CALL is still to be implemented and is dependant on SIGN working ')
  })

  // ==== BATCH =====
  // Test batch a number of transactions and ensure they have all been processed
  // Expected result: Alice will do two transfers to Bob and validate balances have been updated
  it('OPERATION 22 BATCH : must be able to batch operations', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP22-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })
    let { walletInfo: bob } = await TestUtil.makeWallet({ salt: 'TG-OP22-2', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    let aliceInitialBalance = await web3.eth.getBalance(alice.wallet.address)

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    const calls = []
    // set up transfer and destination for the batch
    let transferAmount = ONE_CENT + HALF_DIME + ONE_DIME
    // alice tranfers ONE CENT to bob
    let callObject = {
      ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
      operationType: ONEConstants.OperationType.TRANSFER,
      dest: bob.wallet.address,
      amount: ONE_CENT
    }
    let callArray = Object.values(callObject)
    calls.push(callArray)
    // alice tranfers ONE HALF_DIME to bob
    callArray[5] = HALF_DIME
    calls.push(callArray)
    // alice tranfers ONE DIME to bob
    callArray[5] = ONE_DIME.toString()
    calls.push(callArray)
    let hexData = ONEUtil.abi.encodeParameters(['tuple(uint256,uint256,address,uint256,address,uint256,bytes)[]'], [calls])
    // move the batch information into data
    let data = ONEUtil.hexStringToBytes(hexData)

    await TestUtil.executeStandardTransaction(
      {
        ...ONEConstants.NullOperationParams, // Default all fields to Null values than override
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BATCH,
        data,
        testTime
      }
    )
    // Update alice current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - balance, nonce, lastOperationTime, commits, spendingState
    await TestUtil.validateBalance({ address: alice.wallet.address, amount: (aliceInitialBalance - transferAmount) })
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    aliceOldState = await TestUtil.validateSpendingState({ wallet: alice.wallet, oldState: aliceOldState, spentAmount: transferAmount })
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== NOOP =====
  it('OPERATION 23 NOOP : this is for nulloperationparameter', async () => {
  })

  // ==== CHANGE_SPENDING_LIMIT =====
  // Test : Increase the spending limit
  // Expected result: Will Increase Alices Spending Limit from ONE_ETH TO THREE_ETH
  it('OPERATION 24 CHANGE_SPENDING_LIMIT: must be able to change spending limit', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP24-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice changes the spending limit
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT,
        amount: THREE_ETH,
        testTime
      }
    )
    // Update alice and bob's current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - nonce, lastOperationTime, commits, spendingState
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // aliceOldState = await TestUtil.validateSpendingState({ wallet: alice.wallet, oldState: aliceOldState, spentAmount: 0 })
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.notEqual(spendingState.highestSpendingLimit, aliceOldState.spendingState.highestSpendingLimit, 'alice wallet.highestSpendingLimit should have been changed')
    assert.equal(spendingState.highestSpendingLimit, THREE_ETH.toString(), 'alice wallet.highestSpendingLimit should be THREE_ETH')
    aliceOldState.spendingState.highestSpendingLimit = spendingState.highestSpendingLimit
    assert.notEqual(spendingState.lastLimitAdjustmentTime, aliceOldState.spendingState.lastLimitAdjustmentTime, 'alice wallet.lastLimitAdjustmentTime should have been changed')
    aliceOldState.spendingState.lastLimitAdjustmentTime = spendingState.lastLimitAdjustmentTime
    assert.notEqual(spendingState.spendingLimit, aliceOldState.spendingState.spendingLimit, 'alice wallet.spendingLimit should have been changed')
    assert.equal(spendingState.spendingLimit, THREE_ETH.toString(), 'alice wallet.spendingLimit should be THREE_ETH')
    aliceOldState.spendingState.spendingLimit = spendingState.spendingLimit
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // ==== JUMP_SPENDING_LIMIT =====
  // Test jump alices spending limit jump cannot be higher than highestSpendingLimit and does not update lastLimitAdjustmentTime
  // Expected result: will jump alices spending limit from THREE_ETH to TWO_ETH
  it('OPERATION 25 JUMP_SPENDING_LIMIT: must be able to jump spending limit', async () => {
    // create wallets and token contracts used througout the tests
    let { walletInfo: alice, walletOldState: aliceOldState } = await TestUtil.makeWallet({ salt: 'TG-OP25-1', deployer: accounts[0], effectiveTime: EFFECTIVE_TIME, duration: DURATION })

    // Begin Tests
    let testTime = Date.now()

    testTime = await TestUtil.bumpTestTime(testTime, 60)
    // alice jumps the spending limit
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.JUMP_SPENDING_LIMIT,
        amount: FOUR_ETH,
        testTime
      }
    )
    // Update alice and bob's current State
    let aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)
    // Alice Items that have changed - balance, nonce, lastOperationTime, commits, spendingState
    aliceOldState = await TestUtil.validateUpdateTransaction({ wallet: alice.wallet, oldState: aliceOldState })
    // aliceOldState = await TestUtil.validateSpendingState({ wallet: alice.wallet, oldState: aliceOldState, spentAmount: 0 })
    // spendingState
    let spendingState = await alice.wallet.getSpendingState()
    assert.notEqual(spendingState.highestSpendingLimit, aliceOldState.spendingState.highestSpendingLimit, 'alice wallet.highestSpendingLimit should have been changed')
    assert.equal(spendingState.highestSpendingLimit, FOUR_ETH.toString(), 'alice wallet.highestSpendingLimit should be FOUR_ETH')
    aliceOldState.spendingState.highestSpendingLimit = spendingState.highestSpendingLimit
    assert.notEqual(spendingState.lastLimitAdjustmentTime, aliceOldState.spendingState.lastLimitAdjustmentTime, 'alice wallet.lastLimitAdjustmentTime should have been changed')
    aliceOldState.spendingState.lastLimitAdjustmentTime = spendingState.lastLimitAdjustmentTime
    assert.notEqual(spendingState.spendingLimit, aliceOldState.spendingState.spendingLimit, 'alice wallet.spendingLimit should have been changed')
    assert.equal(spendingState.spendingLimit, FOUR_ETH.toString(), 'alice wallet.spendingLimit should be FOUR_ETH')
    aliceOldState.spendingState.spendingLimit = spendingState.spendingLimit
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
  })

  // Test all ONEWallet operations
  it('General: must be able to run all ONEWallet operations', async () => {
  })
})
