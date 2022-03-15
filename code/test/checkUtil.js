// get OneWallet state
const getONEWalletState = async (wallet) => {
  let state = {}
  state = {
    address: wallet.address,
    identificationKey: await wallet.identificationKey(),
    identificationKeys: await wallet.getIdentificationKeys(),
    forwardAddress: await wallet.getForwardAddress(),
    info: await wallet.getInfo(),
    oldInfos: await wallet.getOldInfos(),
    innerCores: await wallet.getInnerCores(),
    rootKey: await wallet.getRootKey(),
    version: await wallet.getVersion(),
    spendingState: await wallet.getSpendingState(),
    nonce: await wallet.getNonce(),
    lastOperationTime: await wallet.lastOperationTime(),
    allCommits: await wallet.getAllCommits(),
    trackedTokens: await wallet.getTrackedTokens(),
    backlinks: await wallet.getBacklinks(),
  }
  return state
}

// check OneWallet state
const checkONEWallet = async (wallet, state) => {
  assert.deepStrictEqual(await wallet.identificationKey(), state.identificationKey, 'wallet.identificationKey is incorrect')
  assert.deepStrictEqual(await wallet.getIdentificationKeys(), state.identificationKeys, 'wallet.identificationKeys is incorrect')
  assert.deepStrictEqual(await wallet.getForwardAddress(), state.forwardAddress, 'wallet.forwardAddress is incorrect')
  assert.deepStrictEqual(await wallet.getInfo(), state.info, 'wallet.info is incorrect')
  assert.deepStrictEqual(await wallet.getOldInfos(), state.oldInfos, 'wallet.oldInfos is incorrect')
  assert.deepStrictEqual(await wallet.getInnerCores(), state.innerCores, 'wallet.innerCores is incorrect')
  assert.deepStrictEqual(await wallet.getRootKey(), state.rootKey, 'wallet.rootKey is incorrect')
  assert.deepStrictEqual(await wallet.getVersion(), state.version, 'wallet.version is incorrect')
  assert.deepStrictEqual(await wallet.getSpendingState(), state.spendingState, 'wallet.spendingState is incorrect')
  assert.deepStrictEqual(await wallet.getNonce(), state.nonce, 'wallet.nonce is incorrect')
  assert.deepStrictEqual(await wallet.lastOperationTime(), state.lastOperationTime, 'wallet.lastOperationTime is incorrect')
  assert.deepStrictEqual(await wallet.getAllCommits(), state.allCommits, 'wallet.allCommits is incorrect')
  assert.deepStrictEqual(await wallet.getTrackedTokens(), state.trackedTokens, 'wallet.trackedTokens is incorrect')
  assert.deepStrictEqual(await wallet.getBacklinks(), state.backlinks, 'wallet.backlinks is incorrect')
}

module.exports = {
  getONEWalletState,
  checkONEWallet
}
