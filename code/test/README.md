# Contributors Testing Guide

## Overview
Testing is designed to provide complete coverage of all ONEWallet components including the client, relayer and smart contracts.

### Running the tests
It is recommended that you run tests against a local ganache instance. To do this in a separate window run the following command
```
ganache --port 7545
```

Also the tests have deep logging functionality controlled by the `VERBOSE` flag
* `VERBOSE=1` or `VERBOSE=true` turns on debugging logging
* `VERBOSE=0` or `VERBOSE=false` runs in a quieter mode


To run the complete set of tests use
```
yarn test
```

To run a specific suite of tests in a file use
```
VERBOSE=1 truffle test test/general.js --network=ganache
```

To run an individual test use
```
VERBOSE=0 truffle test --network=ganache --compile-none --grep 'OPERATION 12 '
```

## Testing Component Overview

Following is a brief overview of each component and its functionality

| File          | Function |
| --------------| -------- | 
| admin.js      | Administrative functions around recovery, linkage of wallets, signing and revoking authorizations |
| basic.js      | Basic smart contract testing useful for checking your testing enviroment works|
| client.js     | Client functionality tests around the generation and encryption of One Time Passwords (OTP's)
| domains.js    | ENS Domain Management |
| events.js     | Event and Negative Use case testing |
| examples.js   | Examples for each of the operations |
| factory.js    | Factory testing to ensure that the factory generates new ONEWallets as expected |
| general.js    | Smart contract testing by Operation code goal is to provide complete Operation coverage |
| native.js     | Native asset transfers and validating spending limits can be updated and are adhered to |
| tokens.js     | Token Functionality testing around transferring and tracking of tokens |
| util.js       | Utility and Helper functions |

## Smart Contract Testing Coverage

### Writing Smart Contract Tests

Below is an overview of writing tests for a new operation, if enhancing an existing operation focus on event and functional testing.

**First Postive Use Case** 
First you need to ensure the contract is working tests for all operations can be found in `general.js`. It is recommended you follow an example such as `TRANSFER` below is the high level structure of an Operational Test

* **Test and Expected Result:** Place this in comments at the top of the test

* **Test Name:** Uniquely Identify the test with the OperationId and Name and state what the test is for e.g. `OPERATION 4 TRANSFER : must be able to transfer native assets`

* **Initialization and Setup:** Here you create and fund your wallets and create any tokens that may be needed for the test. Note there are a nuumber of utility functions such as `makeWallet` and `makeTokens` which simplify the process. Also note that when populating the seed for the wallet, ensure that it is unique accross all the tests by using a naming convention as follows
TT-SUBTEST-WALLETID e.g. `TG-OP4-1`

* **Executing the Transactions** There are two utilty helper functions which simplify this process `bumpTestTime` and  `transferExecute`. `bumpTestTime` is used to increase the testTime which in turns increases the Wallets Interval enabling transactions to be processed in each interval. `transferExecute` is a general utility for all ONEWallet transactions supporting the two phase commit reveal process that ONEWallet leverages.

* **Validating the ONEWallet State:** After completing the operation, you validate the state of the wallet to ensure that the expected items have changed. Individual tests and assertions are used to compare the state of the wallet before the operation to the state after. `getONEWalletState` is a utility helper function which should be used to set the state before the operation e.g. ` let aliceOldState = await TestUtil.getONEWalletState(alice.wallet)` and again after the transaction e.g. `aliceCurrentState = await TestUtil.getONEWalletState(alice.wallet)`. Individual tests are done by retrieving values from the wallet itself and comparing against oldState. Any discrepencies should then update the OldState with the final check being a comparison of the modified oldState with the CurrentState to ensure all changes have been identified. e.g.
  * ```
    // Alice Items that have changed - nonce, lastOperationTime, commits, trackedTokens
    // nonce
    let nonce = await alice.wallet.getNonce()
    assert.notEqual(nonce, aliceOldState.nonce, 'alice wallet.nonce should have been changed')
    assert.equal(nonce.toNumber(), aliceOldState.nonce + 1, 'alice wallet.nonce should have been changed')
    aliceOldState.nonce = nonce.toNumber()
    // lastOperationTime
    let lastOperationTime = await alice.wallet.lastOperationTime()
    assert.notStrictEqual(lastOperationTime, aliceOldState.lastOperationTime, 'alice wallet.lastOperationTime should have been updated')
    aliceOldState.lastOperationTime = lastOperationTime.toNumber()
    // == testing of more components here ==
    // check alice
    await TestUtil.checkONEWalletStateChange(aliceOldState, aliceCurrentState)
**Event Testing:** After ensuring you have a basic positive test for the operation we then expand on the testing coverage by testing both postive and negative use cases in `events.js` The structure is similar to that of operational testing however we leverage events and add multiple scenarios for each operation.

**Functional Testing:** provides composability and scenario testing for functional use cases. These tests are written for each functional area. It is recommended that you review `upgrade.js` to gain an understanding of how functional tests are written.
### Appendix A: Operation Testing Status Overview

| ID | Operation                    | Status  | Area     | Notes |
| -- | ---------------------------- | ------- | -------- | ----- | 
| 0  | TRACK                        | PASS    | Token    |
| 1  | UNTRACK                      | PASS    | Token    |
| 2  | TRANSFER_TOKEN               | PASS    | Token    |
| 3  | OVERRIDE_TRACK               | PASS    | Token    |
| 4  | TRANSFER                     | PASS    | Native   | 
| 5  | SET_RECOVERY_ADDRESS         | PASS    | Wallet   |
| 6  | RECOVER	                    | TBD*    | Wallet   | additional authentication needed
| 7  | DISPLACE	                    | PASS*   | Wallet   | Currently tested in innerCores.js
| 8  | FORWARD                      | PASS    | Wallet   |
| 9  | RECOVER_SELECTED_TOKENS      | TBD     | Wallet   |
| 10 | BUY_DOMAIN                   | Phase 2 | Domain   |
| 11 | COMMAND                      | TBD     | Wallet   |
| 12 | BACKLINK_ADD                 | PASS    | Wallet   |
| 13 | BACKLINK_DELETE              | PASS    | Wallet   |
| 14 | BACKLINK_OVERRIDE            | PASS    | Wallet   |
| 15 | RENEW_DOMAIN	                | Phase 2 | Domain   |
| 16 | TRANSFER_DOMAIN	            | Phase 2 | Domain   |
| 17 | RECLAIM_REVERSE_DOMAIN       | Phase 2 | Domain   |
| 18 | RECLAIM_DOMAIN_FROM_BACKLINK | Phase 2 | Domain   |
| 19 | SIGN	                        | TBD     | App      |
| 20 | REVOKE                       | TBD     | App      |
| 21 | CALL                         | PASS*   | App      | Currently tested in WA.COMPLEX.8.0 FORWARD.COMMAND:
| 22 | BATCH                        | TBD     | App      |
| 23 | NOOP                         | N/A     | N/A      | this is for nulloperationparameter
| 24 | CHANGE_SPENDING_LIMIT        | PASS    | Native   |
| 25 | JUMP_SPENDING_LIMIT          | TBD*    | Native   | additional authentication needs review
| 26 | DELEGATE                     | TBD     | Staking  |
| 27 | UNDELEGATE                   | TBD     | Staking  |
| 28 | COLLECT_REWARD               | TBD     | Staking  |
| 29 | CREATE                       | TBD     | App      |
| 30 | UPGRADE                      | TBD     | Wallet   |




