## `ONEWallet`






### `initialize(struct IONEWallet.InitParams initParams)` (external)





### `identificationKey() → bytes` (external)





### `getIdentificationKeys() → bytes[]` (external)





### `_getForwardAddress() → address payable` (internal)





### `getForwardAddress() → address payable` (external)





### `_forwardPayment()` (internal)





### `receive()` (external)





### `retire() → bool` (external)





### `getInfo() → bytes32, uint8, uint8, uint32, uint32, uint8, address, uint256` (external)





### `getOldInfos() → struct IONEWallet.CoreSetting[]` (external)





### `getInnerCores() → struct IONEWallet.CoreSetting[]` (external)





### `getRootKey() → bytes32` (external)





### `getVersion() → uint32, uint32` (external)





### `getSpendingState() → struct SpendingManager.SpendingState` (external)





### `getNonce() → uint8` (external)





### `getTrackedTokens() → enum Enums.TokenType[], address[], uint256[]` (external)





### `getBalance(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId) → uint256` (external)





### `getAllCommits() → bytes32[], bytes32[], bytes32[], uint32[], bool[]` (external)





### `lookupCommit(bytes32 hash) → bytes32[], bytes32[], bytes32[], uint32[], bool[]` (external)





### `commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash)` (external)





### `_forward(address payable dest)` (internal)

require approval using recovery cores, unless recovery address is set



### `_drain() → bool` (internal)

This function sends all remaining funds and tokens in the wallet to `recoveryAddress`. The caller should verify that `recoveryAddress` is not null.



### `_transfer(address payable dest, uint256 amount) → bool` (internal)





### `_recover() → bool` (internal)

To initiate recovery, client should submit leaf_{-1} as eotp, where leaf_{-1} is the last leaf in OTP Merkle Tree. Note that leaf_0 = hasher(hseed . nonce . OTP . randomness) where hasher is either sha256 or argon2, depending on client's security parameters. The definition of leaf_{-1} ensures attackers cannot use widespread miners to brute-force for seed or hseed, even if keccak256(leaf_{i}) for any i is known. It has been considered that leaf_0 should be used instead of leaf_{-1}, because leaf_0 is extremely unlikely to be used for any wallet operation. It is only used if the user performs any operation within the first 60 seconds of seed generation (when QR code is displayed). Regardless of which leaf is used to trigger recovery, this mechanism ensures hseed remains secret at the client. Even when the leaf becomes public (on blockchain), it is no longer useful because the wallet would already be deprecated (all assets transferred out). It can be used to repeatedly trigger recovery on this deprecated wallet, but that would cause no harm.



### `_overrideRecoveryAddress()` (internal)





### `_setRecoveryAddress(address payable recoveryAddress_)` (internal)





### `_batch(bytes data)` (internal)





### `reveal(struct IONEWallet.AuthParams auth, struct IONEWallet.OperationParams op)` (external)





### `_execute(struct IONEWallet.OperationParams op)` (internal)





### `getBacklinks() → contract IONEWallet[]` (external)





### `_callContract(address contractAddress, uint256 amount, bytes encodedWithSignature)` (internal)





### `_multiCall(bytes data)` (internal)





### `supportsInterface(bytes4 interfaceId) → bool` (public)





### `isValidSignature(bytes32 hash, bytes signatureBytes) → bytes4` (public)





### `listSignatures(uint32 start, uint32 end) → bytes32[], bytes32[], uint32[], uint32[]` (external)





### `lookupSignature(bytes32 hash) → bytes32, uint32, uint32` (external)








