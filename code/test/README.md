# Smart Contract Testing Guide

## Overview

Tests in this folder are exclusively for smart contracts (under `code/contracts`) and some core library functions related to small contracts (under `code/lib`). 

Tests for other components, such as the relayer, the client, and the core library, are provided at separate locations.

### Running the tests

It is recommended that you run tests against a local Ganache instance. Please refer to the documentation at [`code/env/README.md`](https://github.com/polymorpher/one-wallet/tree/master/code/env).

The tests have deep logging functionality controlled by the `VERBOSE` flag

* `VERBOSE=1` or `VERBOSE=true` turns on debugging logging
* `VERBOSE=0` or `VERBOSE=false` runs in a quieter mode


To run the complete set of tests use
```
yarn test
```

To run a specific suite of tests in a file use
```
VERBOSE=1 truffle test test/general.js --network=dev
```

To run an individual test use
```
VERBOSE=0 truffle test --network=ganache --compile-none --grep 'AD-WALLET-1'
```
## Test Data Overview
Before each test, some wallets are automatically deployed. They are encapsulated in a test data object. See `deployTestData` and `init` functions in `util.js` for more details. A breakdown of the test data object is given below.

### Test Users
All users are funded with HALF_ETH (half the native token) and initially have a SpendingLimit of ONE_ETH (one native token). The test users are:

* alice: primary user funded with 1000 TestERC20, 2 TestERC721 tokens with id 2 and 3, and 50 TestERC1155 tokens with 20 of token 2, and 30 of token 3.
* bob: used for testing token transfers from alice and tracking tokens
* carol: used for testing backlinks and forwarding operations involving alice
* dora: used for testing overriding backlinks
* ernie: general purpose testing user

The following token contracts are deployed using the first account available in the environment:
* testerc20: ERC20 contract (TestERC20) with 10000000 minted supply, of which 1000 tokens are given to alice.
* testerc721: ERC721 contract (TestERC721) with 10 different tokens [0,1,2,3,4,5,6,7,8,9]. Token [2,3] are given to alice.
* testerc1155: ERC1155 contract (TestERC1155) with 10 types of tokens [0,1,2,3,4,5,6,7,8,9]. They have corresponding supply of [10,20,30,40,50,66,70,80,90,100], which are minted ahead of time. Here, 50 TestERC1155 tokens with 20 of token 2 and 30 of token 3 are given to alice.

The following contracts are also deployed to provide additional helpers for tests. Note that no initial transfer were made from these contracts. The tokens and amounts minted ahead of the time are the same.
* testerc20v2 (ERC20)
* testerc721v2 (ERC721)
* testerc1155v2 (ERC1155)

## Tests Areas

Following is a summary of each testing area:

| File          | Function                                                                                                                                                                                                                               |
|---------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| admin.js      | (Not Implemented Yet) Administrative functions around recovery, linkage of wallets, signing and revoking                                                                                                                               |
| basic.js      | Basic smart contract testing, reflecting some limited operations supported by a very early version of the wallet (create, transfer (native asset), recovery, spending limit). It is useful for checking your testing enviroment works. |
| client.js     | Client-side functionalities related to OTP generation, use of double OTPs, and hash functions for creating EOTP (argon2, sha256)                                                                                                       |
| events.js     | (Not Implemented Yet) Event parsing and special emissions                                                                                                                                                                              |
| factory.js    | Using smart contract factory to deploy a new wallets that has a predictable address based on identification keys                                                                                                                       |
| command.js    | Commanding a backlinked wallet to perform various operations                                                                                                                                                                           |
| spendLimit.js | Operations changing the spend limit of the wallet, and the correctness of the spend limit functionalities. Some operations may require more secure authentications                                                                     |
| innerCores.js | Operations affecting the security settings of the wallet, such as adding (displacing) new auth codes. They require more secure authentications (6x6 codes)                                                                             |
| tokens.js     | Operations related to tokens (ERC-20, ERC-721, ERC-1155), such as autoamted and manual tracking tokens of each type, and token transfers                                                                                               |
| util.js       | Utility and helper functions                                                                                                                                                                                                           |

### Writing Smart Contract Tests

Below is an overview of writing tests for a new operation or new test area. For tests extending an existing area, please follow the code conventions and structures in the corresponding file.

**First Postive Use Case** 

First, create a new file and write out how you expect a successful operation to play out. Please feel free to refer to examples in `tokens.js` and others.

* **Test and Expected Result:** Place this in comments at the top of the test

* **Test Name:** Uniquely identify the test and state what the test is for e.g. `TN-BASIC-0 TRACK: must be able to track ERC20 tokens`. Here the test identifier `TN-BASIC-0` helps another person to run this test individually.

* **Initialization and Setup:** Here you create and fund your wallets and create any tokens that may be needed for the test. Note there are a nuumber of utility functions such as `makeWallet` and `makeTokens` which simplify the process. Also note that when populating the seed for the wallet, ensure that it is unique accross all the tests by using a naming convention similar to `<test identifier>-1` e.g. `TN-BASIC-0-1`

* **Executing the Transactions** You may use functions such as `commitReveal` to simplify the execution, which wraps around the two-phase commit-reveal process required by the wallet. Please also check `executeTokenTransaction` in `token.js` which provides an example of how to simplify the execution even further. When you need to execute multiple transactions within a short amount of time, please use `bumpTestTime`, which artificially increase the time on the blockchain so you can bypass the default limitation of 1 operation per (30-second) interval for the wallet.

* **Validating Wallet State:** After completing the operation, you may validate the state of the wallet to ensure that the expected items have changed. Individual tests and assertions are used to compare the state of the wallet before the operation to the state after. `getState` is a helper function which you may use to take a snapshot of the wallet's state. A common pattern is to get the wallet's state prior to a transaction, execute the transaction, manually change part of the snapshot, then compare the latest snapshot with the modified state using `assertStateEqual`. See `TN-BASIC-0` in `token.js` for an example.
 
**Event Testing:** After ensuring you have a basic positive test for the operation, you may expand on the testing coverage checking event emissions. See `events.js` for some example. The structure is similar to that of operational testing, but here we leverage events emitted by the wallet, and we add multiple scenarios for each operation.

**Functional Testing:** provides composability and scenario testing for use cases that occur in practice. These tests are written for each functional area. This is yet to be implemented. More details will be added soon.

### Appendix A: Operation Testing Status Overview

| ID  | Operation                    | Status   | Area     | Notes                                                      |
|-----|------------------------------|----------|----------|------------------------------------------------------------|
| 0   | TRACK                        | PASS     | Token    |                                                            |
| 1   | UNTRACK                      | PASS     | Token    |                                                            |
| 2   | TRANSFER_TOKEN               | PASS     | Token    |                                                            |
| 3   | OVERRIDE_TRACK               | PASS     | Token    |                                                            |
| 4   | TRANSFER                     | PASS     | Core     |                                                            |
| 5   | SET_RECOVERY_ADDRESS         | PASS     | Core     |                                                            |
| 6   | RECOVER	                     | PASS     | Core     |                                                            |
| 7   | DISPLACE	                    | PASS     | Security |                                                            |
| 8   | FORWARD                      | PASS     | Upgrade  |                                                            |
| 9   | RECOVER_SELECTED_TOKENS      | PASS     | Token    |                                                            |
| 10  | BUY_DOMAIN                   | Phase 2  | Domain   |                                                            |
| 11  | COMMAND                      | PASS     | Upgrade  |                                                            |
| 12  | BACKLINK_ADD                 | PASS     | Upgrade  |                                                            |
| 13  | BACKLINK_DELETE              | PASS     | Upgrade  |                                                            |
| 14  | BACKLINK_OVERRIDE            | PASS     | Upgrade  |                                                            |
| 15  | RENEW_DOMAIN	                | Phase 2  | Domain   |                                                            |
| 16  | TRANSFER_DOMAIN	             | Phase 2  | Domain   |                                                            |
| 17  | RECLAIM_REVERSE_DOMAIN       | Phase 2  | Domain   |                                                            |
| 18  | RECLAIM_DOMAIN_FROM_BACKLINK | Phase 2  | Domain   |                                                            |
| 19  | SIGN	                        | PASS     | App      |                                                            |
| 20  | REVOKE                       | PASS     | App      |                                                            |
| 21  | CALL                         | PASS     | App      |                                                            |
| 22  | BATCH                        | PASS     | App      |                                                            |
| 23  | NOOP                         | N/A      | N/A      | This is reserved as a default value and for error checking |
| 24  | CHANGE_SPENDING_LIMIT        | PASS     | Security |                                                            |
| 25  | JUMP_SPENDING_LIMIT          | PASS     | Security |                                                            |
| 26  | DELEGATE                     | Phase 1  | Staking  |                                                            |
| 27  | UNDELEGATE                   | Phase 1  | Staking  |                                                            |
| 28  | COLLECT_REWARD               | Phase 1  | Staking  |                                                            |
| 29  | CREATE                       | RESERVED | App      |                                                            |
| 30  | UPGRADE                      | RESERVED | Upgrade  |                                                            | 

### Appendix B: EVENT Testing Status Overview

| Contract            | Event                            | Status  | Sample Operation        | Notes             |
|---------------------|----------------------------------|---------|-------------------------|-------------------|
| CoreManager         | CoreDisplaced                    | PASS    | DISPLACE                |                   |
| CoreManager         | CoreDisplacementFailed           | PASS    | DISPLACE                |                   |
| DomainManager       | DomainRegistered                 | Phase 2 |                         |                   |
| DomainManager       | ReverseDomainClaimed             | Phase 2 |                         |                   |
| DomainManager       | ReverseDomainClaimError          | Phase 2 |                         |                   |
| DomainManager       | InvalidFQDN                      | Phase 2 |                         |                   |
| DomainManager       | DomainRegistrationFailed         | Phase 2 |                         |                   |
| DomainManager       | AttemptRegistration              | Phase 2 |                         |                   |
| DomainManager       | DomainTransferFailed             | Phase 2 |                         |                   |
| DomainManager       | AttemptRenewal                   | Phase 2 |                         |                   |
| DomainManager       | DomainRenewalFailed              | Phase 2 |                         |                   |
| DomainManager       | DomainTransferred                | Phase 2 |                         |                   |
| DomainManager       | DomainRenewed                    | Phase 2 |                         |                   |
| ONEWalletCodeHelper | ONEWalletDeployFailed            | TODO    |                         | FactoryHelper.sol |
| ONEWalletCodeHelper | ONEWalletDeploySuccess           | TODO    |                         | FactoryHelper.sol |
| IONEWallet          | TransferError                    | *TODO   | TRANSFER                |                   |
| IONEWallet          | LastResortAddressNotSet          | *TODO   | RECOVER                 |                   |
| IONEWallet          | RecoveryAddressUpdated           | PASS    | SET_RECOVERY_ADDRESS    |                   |
| IONEWallet          | PaymentReceived                  | N/A     |                         | event not emitted |
| IONEWallet          | PaymentSent                      | PASS    | TRANSFER                |                   |
| IONEWallet          | PaymentForwarded                 | PASS    | TRANSFER                |                   |
| IONEWallet          | AutoRecoveryTriggered            | TODO    |                         |                   |
| IONEWallet          | AutoRecoveryTriggeredPrematurely | TODO    |                         |                   |
| IONEWallet          | RecoveryFailure                  | TODO    |                         |                   |
| IONEWallet          | RecoveryTriggered                | PASS    |  RECOVER                |                   |
| IONEWallet          | Retired                          | TODO    |                         |                   |
| IONEWallet          | ForwardedBalance                 | TODO    |                         |                   |
| IONEWallet          | ForwardAddressUpdated            | PASS    | FORWARD                 |                   |
| IONEWallet          | ForwardAddressAlreadySet         | TODO    |                         |                   |
| IONEWallet          | ForwardAddressInvalid            | TODO    |                         |                   |
| IONEWallet          | ExternalCallCompleted            | PASS    | CALL                    |                   |
| IONEWallet          | ExternalCallFailed               | TODO    |                         |                   |
| IONEWallet          | TransferError                    | TODO    |                         |                   |
| SignatureManager    | SignatureMismatch                | PASS    | SIGN                    |                   |
| SignatureManager    | SignatureNotExist                | PASS    | REVOKE                  |                   |
| SignatureManager    | SignatureAlreadyExist            | PASS    | SIGN                    |                   |
| SignatureManager    | SignatureAuthorized              | PASS    | SIGN                    |                   |
| SignatureManager    | SignatureRevoked                 | PASS    | REVOKE                  |                   |
| SignatureManager    | SignatureExpired                 | N/A     |                         | event not emitted |
| SpendingManager     | ExceedSpendingLimit              | *TODO   | TRANSFER                |                   |
| SpendingManager     | InsufficientFund                 | *TODO   | TRANSFER                |                   |
| SpendingManager     | SpendingLimitChanged             | PASS    | CHANGE_SPENDING_LIMIT   |                   |
| SpendingManager     | HighestSpendingLimitChanged      | PASS    | CHANGE_SPENDING_LIMIT   |                   |
| SpendingManager     | SpendingLimitChangeFailed        | *TODO   | CHANGE_SPENDING_LIMIT   |                   |
| SpendingManager     | SpendingLimitJumped              | PASS    | JUMP_SPENDING_LIMIT     |                   |
| Staking             | StakingSuccess                   | TODO    |                         |                   |
| Staking             | StakingFailure                   | TODO    |                         |                   |
| TokenManager        | ReceivedToken                    | TODO    |                         |                   |
| TokenManager        | ForwardedToken                   | TODO    |                         |                   |
| TokenTracker        | TokenTransferFailed              | TODO    |                         |                   |
| TokenTracker        | TokenTransferError               | TODO    |                         |                   |
| TokenTracker        | TokenTransferSucceeded           | PASS    | TRANSFER_TOKEN          |                   |
| TokenTracker        | TokenRecovered                   | PASS    | RECOVER_SELECTED_TOKENS |                   |
| TokenTracker        | BalanceRetrievalError            | TODO    |                         |                   |
| TokenTracker        | TokenTracked                     | PASS    | TRACK                   |                   |
| TokenTracker        | TokenUntracked                   | PASS    | UNTRACK                 |                   |
| TokenTracker        | TokenNotFound                    | TODO    |                         |                   |
| WalletGraph         | BackLinkAltered                  | PASS    | BACKLINK_ADD            |                   |
| WalletGraph         | InvalidBackLinkIndex             | TODO    |                         |                   |
| WalletGraph         | CommandDispatched                | TODO    |                         |                   |
| WalletGraph         | CommandFailed                    | TODO    |                         |                   |
| WalletGraph         | BackLinkUpdated                  | TODO    |                         |                   |
| WalletGraph         | BackLinkUpdateError              | TODO    |                         |                   |

### Appendix C: Positive Use Case Testing Status Overview

| Functionality | Positive Use Cases  | Status | Notes                   |
|---------------|---------------------|--------|-------------------------|
| Application   | BASIC               | PASS   |                         |
| Application   | REVOKE BY DATE      | PASS   |                         |
| Application   | REVOKE BY SIGNATURE | PASS   |                         |
| Application   | CALL WITH PAYMENT   | TODO   | See samples in Swap.jsx |
| Application   | MULTICALL           | PASS   |                         |
| Core          | BASIC               | PASS   |                         |
| Security      | BASIC               | PASS   |                         |
| Token         | BASIC               | PASS   |                         |
| Token         | ERC20               | PASS   |                         |
| Token         | ERC721              | PASS   |                         |
| Token         | ERC1155             | PASS   |                         |
| Upgrade       | BASIC               | PASS   |                         |

### Appendix D: Complex Scenario Testing Status Overview

| Area     | Scenario                                                                                            | Status | Notes                                                                        |
|----------|-----------------------------------------------------------------------------------------------------|--------|------------------------------------------------------------------------------|
| App      | CALL must be able to call multiple transactions                                                     | PASS   |                                                                              |
| Security | complex spending_limit rule testing                                                                 | PASS   |                                                                              |
| Security | must allow displace operation using 6x6 otps for different durations                                | PASS   |
| Security | must authenticate otp from new core after displacement                                              | *TODO  |                                                                              |
| Token    | TokenTracker Testing  multiple token types                                                          | PASS   |                                                                              |
| Token    | Must be able to recover selected tokens                                                             | PASS   |                                                                              |
| Upgrade  | Must be able to sign a transaction with a backlinked wallet                                         | PASS   |                                                                              |
| Upgrade  | must be able to forward all assets to another wallet                                                | *PASS  | Forwards Native Asset and Tracked Tokens (does not forward untracked tokens) |
| Upgrade  | when a wallet is backlinked, native assets sent to the original wallet gets forwarded automatically | PASS   |                                                                              |
| Upgrade  | when a wallet is backlinked, tokens sent to the original wallet gets forwarded automatically        | *PASS  | Forwards Native Asset and Tracked Tokens (does not forward untracked tokens) |



### Appendix E: Reversion Testing

| Contract | Revert             | Status | Contract Function      | Notes                                                                                                                      |
|----------|--------------------|--------|------------------------|----------------------------------------------------------------------------------------------------------------------------|
| Reveal   | Bad recovery proof | TODO   | isCorrectRecoveryProof | WARNING: Clients should not use eotps that *may* be used for recovery. The time slots should be manually excluded for use. |
| Reveal   | Proof is incorrect | TODO   | isCorrectProof         | `require(auth.neighbors.length == core.height - 1, "Bad neighbors size");`                                                 |
| Reveal   | Proof is incorrect | TODO   | isCorrectProof         | `require(auth.neighbors.length == oldCores[i].height - 1, "Bad old neighbors size");`                                      |
| Reveal   | No commit          | TODO   | verifyReveal           | `require(cc.length > 0, "No commit found")`                                                                                |
| Reveal   | No commit          | TODO   | verifyReveal           | `require(c.paramsHash == paramsHash, "Param mismatch");`                                                                   |
| Reveal   | No commit          | TODO   | verifyReveal           | `require(t == index \                                                                                                      |\| t - 1 == index, "Time mismatch")` |
| Reveal   | No commit          | TODO   | verifyReveal           | `require(nonce >= expectedNonce, "Nonce too low")`                                                                         |
| Reveal   | No commit          | TODO   | verifyReveal           | `require(!c.completed, "Commit already done")`                                                                             |
| Reveal   | No commit          | TODO   | verifyReveal           | `require(uint32(block.timestamp) - c.timestamp < CommitManager.REVEAL_MAX_DELAY, "Too late"`                               |
