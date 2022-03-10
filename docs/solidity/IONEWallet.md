## `IONEWallet`






### `identificationKey() → bytes` (external)





### `getIdentificationKeys() → bytes[]` (external)





### `initialize(struct IONEWallet.InitParams initParams)` (external)





### `getForwardAddress() → address payable` (external)





### `retire() → bool` (external)





### `getInfo() → bytes32, uint8, uint8, uint32, uint32, uint8, address, uint256` (external)





### `getOldInfos() → struct IONEWallet.CoreSetting[]` (external)





### `getInnerCores() → struct IONEWallet.CoreSetting[]` (external)





### `getRootKey() → bytes32` (external)





### `getVersion() → uint32, uint32` (external)





### `getCurrentSpending() → uint256, uint256` (external)





### `getCurrentSpendingState() → uint256, uint256, uint32, uint32` (external)





### `getSpendingState() → struct SpendingManager.SpendingState` (external)





### `getNonce() → uint8` (external)





### `lastOperationTime() → uint256` (external)





### `getCommits() → bytes32[], bytes32[], uint32[], bool[]` (external)

DEPRECATED



### `getAllCommits() → bytes32[], bytes32[], bytes32[], uint32[], bool[]` (external)





### `findCommit(bytes32) → bytes32, bytes32, uint32, bool` (external)

DEPRECATED



### `lookupCommit(bytes32 hash) → bytes32[], bytes32[], bytes32[], uint32[], bool[]` (external)





### `commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash)` (external)





### `reveal(bytes32[] neighbors, uint32 indexWithNonce, bytes32 eotp, enum Enums.OperationType operationType, enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes data)` (external)





### `reveal(struct IONEWallet.AuthParams auth, struct IONEWallet.OperationParams op)` (external)





### `getTrackedTokens() → enum Enums.TokenType[], address[], uint256[]` (external)





### `getBalance(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId) → uint256` (external)





### `getBacklinks() → contract IONEWallet[]` (external)





### `isValidSignature(bytes32 hash, bytes signature) → bytes4` (external)

https://eips.ethereum.org/EIPS/eip-1271



### `listSignatures(uint32 start, uint32 end) → bytes32[], bytes32[], uint32[], uint32[]` (external)





### `lookupSignature(bytes32 hash) → bytes32, uint32, uint32` (external)






### `TransferError(address dest, bytes error)`





### `LastResortAddressNotSet()`





### `RecoveryAddressUpdated(address dest)`





### `PaymentReceived(uint256 amount, address from)`





### `PaymentSent(uint256 amount, address dest)`





### `PaymentForwarded(uint256 amount, address dest)`





### `AutoRecoveryTriggered(address from)`





### `AutoRecoveryTriggeredPrematurely(address from, uint256 requiredTime)`





### `RecoveryFailure()`





### `RecoveryTriggered()`





### `Retired()`





### `ForwardedBalance(bool success)`





### `ForwardAddressUpdated(address dest)`





### `ForwardAddressAlreadySet(address dest)`





### `ForwardAddressInvalid(address dest)`





### `ExternalCallCompleted(address contractAddress, uint256 amount, bytes data, bytes ret)`





### `ExternalCallFailed(address contractAddress, uint256 amount, bytes data, bytes ret)`






### `CoreSetting`


bytes32 root


uint8 height


uint8 interval


uint32 t0


uint32 lifespan


uint8 maxOperationsPerInterval


### `AuthParams`


bytes32[] neighbors


uint32 indexWithNonce


bytes32 eotp


### `OperationParams`


enum Enums.OperationType operationType


enum Enums.TokenType tokenType


address contractAddress


uint256 tokenId


address payable dest


uint256 amount


bytes data


### `InitParams`


struct IONEWallet.CoreSetting core


struct SpendingManager.SpendingState spendingState


address payable recoveryAddress


contract IONEWallet[] backlinkAddresses


struct IONEWallet.CoreSetting[] oldCores


struct IONEWallet.CoreSetting[] innerCores


bytes[] identificationKeys



