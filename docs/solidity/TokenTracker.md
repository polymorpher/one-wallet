## `TokenTracker`






### `trackToken(struct TokenTracker.TokenTrackerState state, enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId)` (public)





### `untrackToken(struct TokenTracker.TokenTrackerState state, enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId)` (public)





### `overrideTrack(struct TokenTracker.TokenTrackerState state, struct TokenTracker.TrackedToken[] newTrackedTokens)` (public)





### `overrideTrackWithBytes(struct TokenTracker.TokenTrackerState state, bytes data)` (public)





### `multiTrack(struct TokenTracker.TokenTrackerState state, bytes data)` (public)





### `multiUntrack(struct TokenTracker.TokenTrackerState state, bytes data)` (public)





### `transferToken(struct TokenTracker.TokenTrackerState state, enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes data)` (public)





### `getBalance(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId) → uint256, bool success, string` (public)





### `recoverToken(struct TokenTracker.TokenTrackerState state, address dest, struct TokenTracker.TrackedToken t)` (public)





### `recoverSelectedTokensEncoded(struct TokenTracker.TokenTrackerState state, address dest, bytes data)` (public)





### `recoverAllTokens(struct TokenTracker.TokenTrackerState state, address dest)` (public)





### `getTrackedTokens(struct TokenTracker.TokenTrackerState state) → enum Enums.TokenType[], address[], uint256[]` (public)






### `TokenTransferFailed(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount)`





### `TokenTransferError(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, string reason)`





### `TokenTransferSucceeded(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount)`





### `TokenRecovered(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, uint256 balance)`





### `BalanceRetrievalError(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, string reason)`





### `TokenTracked(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId)`





### `TokenUntracked(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId)`





### `TokenNotFound(enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId)`






### `TrackedToken`


enum Enums.TokenType tokenType


address contractAddress


uint256 tokenId


### `TokenTrackerState`


struct TokenTracker.TrackedToken[] trackedTokens


mapping(bytes32 => uint256[]) trackedTokenPositions



