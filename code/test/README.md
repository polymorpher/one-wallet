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
| 6   | RECOVER	                     | *PASS    | Core     |                                                            |
| 7   | DISPLACE	                   | PASS     | Security |                                                            |
| 8   | FORWARD                      | PASS     | Upgrade  |                                                            |
| 9   | RECOVER_SELECTED_TOKENS      | PASS     | Token    |                                                            |
| 10  | BUY_DOMAIN                   | Phase 2  | Domain   |                                                            |
| 11  | COMMAND                      | *WIP     | Upgrade    | More tests needed for different commands                   |
| 12  | BACKLINK_ADD                 | PASS     | Upgrade  |                                                            |
| 13  | BACKLINK_DELETE              | PASS     | Upgrade  |                                                            |
| 14  | BACKLINK_OVERRIDE            | PASS     | Upgrade  |                                                            |
| 15  | RENEW_DOMAIN	               | Phase 2  | Domain   |                                                            |
| 16  | TRANSFER_DOMAIN	             | Phase 2  | Domain   |                                                            |
| 17  | RECLAIM_REVERSE_DOMAIN       | Phase 2  | Domain   |                                                            |
| 18  | RECLAIM_DOMAIN_FROM_BACKLINK | Phase 2  | Domain   |                                                            |
| 19  | SIGN	                       | PASS     | App      |                                                            |
| 20  | REVOKE                       | PASS     | App      |                                                            |
| 21  | CALL                         | TODO     | App      |                                                            |
| 22  | BATCH                        | TODO     | App      |                                                            |
| 23  | NOOP                         | N/A      | N/A      | This is reserved as a default value and for error checking |
| 24  | CHANGE_SPENDING_LIMIT        | PASS     | Security |                                                            |
| 25  | JUMP_SPENDING_LIMIT          | PASS     | Security |                                                            |
| 26  | DELEGATE                     | Phase 1  | Staking  |                                                            |
| 27  | UNDELEGATE                   | Phase 1  | Staking  |                                                            |
| 28  | COLLECT_REWARD               | Phase 1  | Staking  |                                                            |
| 29  | CREATE                       | RESERVED | App      |                                                            |
| 30  | UPGRADE                      | RESERVED | Upgrade  |                                                            | 
