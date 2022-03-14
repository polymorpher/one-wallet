// const TestUtil = require('./util')

// get OneWallet state
const getONEWalletState = async (wallet) => {
  // console.log(`wallet address: ${wallet.address}`)
  // console.log(`wallet identificationKey: ${await wallet.identificationKey()}`)
  // console.log(`wallet identificationKey: ${await wallet.identificationKey()}`)
  // console.log(`wallet getIdentificationKeys: ${await wallet.getIdentificationKeys()}`)
  // console.log(`wallet getForwardAddress: ${await wallet.getForwardAddress()}`)
  // console.log(`wallet getInfo: ${await wallet.getInfo()}`)
  // console.log(`wallet getOldInfos: ${await wallet.getOldInfos()}`)
  // console.log(`wallet getInnerCores: ${await wallet.getInnerCores()}`)
  // console.log(`wallet getRootKey: ${await wallet.getRootKey()}`)
  // console.log(`wallet getVersion: ${await JSON.stringify(wallet.getVersion())}`)
  console.log(`wallet getSpendingState: ${JSON.stringify(await wallet.getSpendingState())}`)
  // console.log(`wallet getNonce: ${await wallet.getNonce()}`)
  // console.log(`wallet lastOperationTime: ${await wallet.lastOperationTime()}`)
  // console.log(`wallet getAllCommits: ${await wallet.getAllCommits()}`)
  // console.log(`wallet getTrackedTokens: ${await JSON.stringify(wallet.getTrackedTokens())}`)
  // console.log(`wallet lastOperationTime: ${await wallet.lastOperationTime()}`)
  // console.log(`wallet getBacklinks: ${await wallet.getBacklinks()}`)
  let state = {
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
    operationTime: await wallet.lastOperationTime(),
    allCommits: await wallet.getAllCommits(),
    trackedTokens: await wallet.getTrackedTokens(),
    lastOperationTime: await wallet.lastOperationTime(),
    backlinks: await wallet.getBacklinks(),
    // read functions with parameters
    // function lookupCommit(bytes32 hash) external view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);
    // function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external;
    // function reveal(AuthParams calldata auth, OperationParams calldata op) external;
    // function getBalance(Enums.TokenType tokenType, address contractAddress, uint256 tokenId) external view returns (uint256);
    // function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4);
    // function listSignatures(uint32 start, uint32 end) external view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, uint32[] memory);
    // function lookupSignature(bytes32 hash) external view returns (bytes32, uint32, uint32);
  }
  return state
}

// check OneWallet state
const checkONEWallet = async (wallet, state) => {
  // console.log(`wallet address: ${wallet.address}`)
  // console.log(`wallet identificationKey: ${await wallet.identificationKey()}`)
  // console.log(`wallet identificationKey: ${await wallet.identificationKey()}`)
  // console.log(`check wallet getIdentificationKeys: ${await wallet.getIdentificationKeys()}`)
  // console.log(`wallet getForwardAddress: ${await wallet.getForwardAddress()}`)
  // console.log(`wallet getInfo: ${await wallet.getInfo()}`)
  // console.log(`wallet getOldInfos: ${await wallet.getOldInfos()}`)
  // console.log(`wallet getInnerCores: ${await wallet.getInnerCores()}`)
  // console.log(`wallet getRootKey: ${await wallet.getRootKey()}`)
  // console.log(`wallet getVersion: ${await JSON.stringify(wallet.getVersion())}`)
  console.log(`wallet getSpendingState: ${JSON.stringify(await wallet.getSpendingState())}`)
  // console.log(`wallet getNonce: ${await wallet.getNonce()}`)
  // console.log(`wallet lastOperationTime: ${await wallet.lastOperationTime()}`)
  // console.log(`wallet getAllCommits: ${await wallet.getAllCommits()}`)
  // console.log(`wallet getTrackedTokens: ${await JSON.stringify(wallet.getTrackedTokens())}`)
  // console.log(`wallet lastOperationTime: ${await wallet.lastOperationTime()}`)
  // console.log(`wallet getBacklinks: ${await wallet.getBacklinks()}`)
  assert.equal(wallet.address, state.address, 'wallet.address is incorrect')
  assert.equal(await wallet.identificationKey(), state.identificationKey, 'wallet.identificationKey is incorrect')
  assert.deepStrictEqual(await wallet.getIdentificationKeys(), state.identificationKeys, 'wallet.identificationKeys is incorrect')
  assert.equal(await wallet.getForwardAddress(), state.forwardAddress, 'wallet.forwardAddress is incorrect')
  assert.deepStrictEqual(await wallet.getInfo(), state.info, 'wallet.info is incorrect')
  assert.deepStrictEqual(await wallet.getOldInfos(), state.oldInfos, 'wallet.oldInfos is incorrect')
  assert.deepStrictEqual(await wallet.getInnerCores(), state.innerCores, 'wallet.innerCores is incorrect')
  assert.equal(await wallet.getRootKey(), state.rootKey, 'wallet.rootKey is incorrect')
  assert.deepStrictEqual(await wallet.getVersion(), state.version, 'wallet.version is incorrect')
  assert.deepStrictEqual(await wallet.getSpendingState(), state.spendingState, 'wallet.spendingState is incorrect')
  assert.equal(await wallet.getNonce(), state.nonce, 'wallet.nonce is incorrect')
  assert.equal(await wallet.lastOperationTime(), state.lastOperationTime, 'wallet.lastOperationTime is incorrect')
  assert.deepStrictEqual(await wallet.getAllCommits(), state.allCommits, 'wallet.allCommits is incorrect')
  assert.deepStrictEqual(await wallet.getTrackedTokens(), state.trackedTokens, 'wallet.trackedTokens is incorrect')
  assert.deepStrictEqual(await wallet.getBacklinks(), state.backlinks, 'wallet.backlinks is incorrect')

  // read functions with parameters
  // function lookupCommit(bytes32 hash) external view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);
  // function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external;
  // function reveal(AuthParams calldata auth, OperationParams calldata op) external;
  // function getBalance(Enums.TokenType tokenType, address contractAddress, uint256 tokenId) external view returns (uint256);
  // function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4);
  // function listSignatures(uint32 start, uint32 end) external view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, uint32[] memory);
  // function lookupSignature(bytes32 hash) external view returns (bytes32, uint32, uint32);
}


module.exports = {
  getONEWalletState,
  checkONEWallet
}
