## `Reveal`






### `isDataOnlyOperation(enum Enums.OperationType op) → bool` (internal)





### `isDestOnlyOperation(enum Enums.OperationType op) → bool` (internal)





### `isAmountOnlyOperation(enum Enums.OperationType op) → bool` (internal)





### `getRevealHash(struct IONEWallet.AuthParams auth, struct IONEWallet.OperationParams op) → bytes32, bytes32` (public)

Provides commitHash, paramsHash, and verificationHash given the parameters



### `isCorrectRecoveryProof(struct IONEWallet.CoreSetting core, struct IONEWallet.CoreSetting[] oldCores, struct IONEWallet.AuthParams auth) → uint32` (public)

WARNING: Clients should not use eotps that *may* be used for recovery. The time slots should be manually excluded for use.



### `isNonRecoveryLeaf(struct IONEWallet.CoreSetting latestCore, struct IONEWallet.CoreSetting[] oldCores, uint32 position, uint32 coreIndex)` (public)

check the current position is not used by *any* core as a recovery slot



### `isCorrectProof(struct IONEWallet.CoreSetting core, struct IONEWallet.CoreSetting[] oldCores, struct IONEWallet.AuthParams auth) → uint32` (public)

This is just a wrapper around a modifier previously called `isCorrectProof`, to avoid "Stack too deep" error. Duh.



### `verifyReveal(struct IONEWallet.CoreSetting core, struct CommitManager.CommitState commitState, bytes32 hash, uint32 indexWithNonce, bytes32 paramsHash, bytes32 eotp, bool skipIndexVerification, bool skipNonceVerification) → uint32` (public)

This function verifies that the first valid entry with respect to the given `eotp` in `commitState.commitLocker[hash]` matches the provided `paramsHash` and `verificationHash`. An entry is valid with respect to `eotp` iff `h3(entry.paramsHash . eotp)` equals `entry.verificationHash`. It returns the index of first valid entry in the array of commits, with respect to the commit hash



### `completeReveal(struct IONEWallet.CoreSetting core, struct CommitManager.CommitState commitState, bytes32 commitHash, uint32 commitIndex, bool skipNonceVerification)` (public)





### `authenticate(struct IONEWallet.CoreSetting core, struct IONEWallet.CoreSetting[] oldCores, struct IONEWallet.CoreSetting[] innerCores, address payable recoveryAddress, struct CommitManager.CommitState commitState, struct IONEWallet.AuthParams auth, struct IONEWallet.OperationParams op)` (public)





### `authenticateCores(struct IONEWallet.CoreSetting core, struct IONEWallet.CoreSetting[] oldCores, struct CommitManager.CommitState commitState, struct IONEWallet.AuthParams auth, struct IONEWallet.OperationParams op, bool skipIndexVerification, bool skipNonceVerification)` (public)

Validate `auth` is correct based on settings in `core` (plus `oldCores`, for reocvery operations) and the given operation `op`. Revert if `auth` is not correct. Modify wallet's commit state based on `auth` (increment nonce, mark commit as completed, etc.) if `auth` is correct.






