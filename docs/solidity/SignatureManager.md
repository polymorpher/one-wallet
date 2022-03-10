## `SignatureManager`






### `authorize(struct SignatureManager.SignatureTracker st, bytes32 hash, bytes32 signature, uint32 expireAt) → bool` (public)





### `revoke(struct SignatureManager.SignatureTracker st, bytes32 hash, bytes32 signature) → bool` (public)





### `revokeBefore(struct SignatureManager.SignatureTracker st, uint32 beforeTime)` (public)





### `revokeExpired(struct SignatureManager.SignatureTracker st)` (public)





### `revokeAll(struct SignatureManager.SignatureTracker st)` (public)





### `revokeHandler(struct SignatureManager.SignatureTracker st, address contractAddress, uint256 tokenId, address payable dest, uint256 amount)` (public)

to handle ONEWallet general parameters



### `authorizeHandler(struct SignatureManager.SignatureTracker st, address contractAddress, uint256 tokenId, address payable dest, uint256 amount)` (public)

to handle ONEWallet general parameters



### `validate(struct SignatureManager.SignatureTracker st, bytes32 hash, bytes32 signature) → bool` (public)





### `lookup(struct SignatureManager.SignatureTracker st, bytes32 hash) → bytes32, uint32, uint32` (public)





### `list(struct SignatureManager.SignatureTracker st, uint32 start, uint32 end) → bytes32[], bytes32[], uint32[], uint32[]` (public)





### `isValidSignature(struct SignatureManager.SignatureTracker st, bytes32 hash, bytes signatureBytes) → bytes4` (public)






### `SignatureMismatch(bytes32 hash, bytes32 newSignature, bytes32 existingSignature)`





### `SignatureNotExist(bytes32 hash)`





### `SignatureAlreadyExist(bytes32 hash, bytes32 signature)`





### `SignatureAuthorized(bytes32 hash, bytes32 signature)`





### `SignatureRevoked(bytes32 hash, bytes32 signature)`





### `SignatureExpired(bytes32 hash, bytes32 signature)`






### `Signature`


uint32 timestamp


uint32 expireAt


bytes32 signature


bytes32 hash


### `SignatureTracker`


bytes32[] hashes


mapping(bytes32 => struct SignatureManager.Signature) signatureLocker


mapping(bytes32 => uint32) positions



