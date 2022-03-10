## `CommitManager`

we will slowly move commit-reveal related stuff from ONEWallet to here




### `getNumCommits(struct CommitManager.CommitState cs) → uint32` (public)





### `_getCommitHashes(struct CommitManager.CommitState cs, uint32 numCommits) → bytes32[]` (internal)





### `_getCommitParamHashes(struct CommitManager.CommitState cs, uint32 numCommits) → bytes32[]` (internal)





### `_getVerificationHashes(struct CommitManager.CommitState cs, uint32 numCommits) → bytes32[]` (internal)





### `_getTimestamps(struct CommitManager.CommitState cs, uint32 numCommits) → uint32[]` (internal)





### `_getCompletionStatus(struct CommitManager.CommitState cs, uint32 numCommits) → bool[]` (internal)





### `getAllCommits(struct CommitManager.CommitState cs) → bytes32[], bytes32[], bytes32[], uint32[], bool[]` (public)





### `lookupCommit(struct CommitManager.CommitState cs, bytes32 hash) → bytes32[], bytes32[], bytes32[], uint32[], bool[]` (external)





### `cleanupCommits(struct CommitManager.CommitState commitState)` (public)

Remove old commits from storage, where the commit's timestamp is older than block.timestamp - REVEAL_MAX_DELAY. The purpose is to remove dangling data from blockchain, and prevent commits grow unbounded. This is executed at commit time. The committer pays for the gas of this cleanup. Therefore, any attacker who intend to spam commits would be disincentivized. The attacker would not succeed in preventing any normal operation by the user.



### `getNonce(struct CommitManager.CommitState cs, uint8 interval) → uint8` (external)





### `incrementNonce(struct CommitManager.CommitState cs, uint32 index)` (external)





### `cleanupNonces(struct CommitManager.CommitState cs, uint8 interval)` (external)

This function removes all tracked nonce values correspond to interval blocks that are older than block.timestamp - REVEAL_MAX_DELAY. In doing so, extraneous data in the blockchain is removed, and both nonces and nonceTracker are bounded in size.



### `commit(struct CommitManager.CommitState cs, bytes32 hash, bytes32 paramsHash, bytes32 verificationHash)` (public)







### `Commit`


bytes32 paramsHash


bytes32 verificationHash


uint32 timestamp


bool completed


### `CommitState`


mapping(bytes32 => struct CommitManager.Commit[]) commitLocker


bytes32[] commits


mapping(uint32 => uint8) nonces


uint32[] nonceTracker



