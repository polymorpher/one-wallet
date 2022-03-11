// const TestUtil = require('./util')

const checkOneWallet = async (wallet) => {
  console.log(`wallet address: ${wallet.address}`)
  console.log(`wallet identificationKey: ${await wallet.identificationKey()}`)
  console.log(`wallet identificationKey: ${await wallet.identificationKey()}`)
  console.log(`wallet getIdentificationKeys: ${await wallet.getIdentificationKeys()}`)
  console.log(`wallet getForwardAddress: ${await wallet.getForwardAddress()}`)
  console.log(`wallet getInfo: ${await wallet.getInfo()}`)
  console.log(`wallet getOldInfos: ${await wallet.getOldInfos()}`)
  console.log(`wallet getInnerCores: ${await wallet.getInnerCores()}`)
  console.log(`wallet getRootKey: ${await wallet.getRootKey()}`)
  console.log(`wallet getVersion: ${await JSON.stringify(wallet.getVersion())}`)
  console.log(`wallet getSpendingState: ${await wallet.getSpendingState()}`)
  console.log(`wallet getNonce: ${await wallet.getNonce()}`)
  console.log(`wallet lastOperationTime: ${await wallet.lastOperationTime()}`)
  console.log(`wallet getAllCommits: ${await wallet.getAllCommits()}`)
  console.log(`wallet getTrackedTokens: ${await JSON.stringify(wallet.getTrackedTokens())}`)
  console.log(`wallet lastOperationTime: ${await wallet.lastOperationTime()}`)
  console.log(`wallet getBacklinks: ${await wallet.getBacklinks()}`)
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
  checkOneWallet
}
