# WARNING: this folder is no longer maintained. It is kept for historical references only.

## SmartOTP Code

This folder contains a (partially) cleaned up version of the source code copied from [SmartOTP](https://github.com/ivan-homoliak-sutd/SmartOTPs), transformed and reconfigured specifically for testing on Harmony's blockchain. 

### What's Changed

Most javascript code is rewritten using ES2020 syntax. ESLint is added for auto formatting, syntax verification, and linting.

I also improved on the usage Truffle and Solidity and upgraded the versions to the latest versions whenever possible. One major change is the wallet provider, which is changed to Harmony JS SDK's HD Wallet Provider that also supports private-key based initialization. The current version (0.157) of Harmony JS SDK has several bugs and issues:

https://github.com/harmony-one/sdk/issues/85

https://github.com/harmony-one/sdk/issues/86

https://github.com/harmony-one/sdk/issues/87

https://github.com/harmony-one/sdk/issues/88

Which are addressed by my PR (https://github.com/harmony-one/sdk/pull/84). Until Harmony JS SDK releases a new version (0.158), you would need to manually replicate these changes in my PR in your `node_modules` directory, to successfully run the tests here.

### Current Test Status

There are 49 tests in the original SmartOTP code. Here, we have to disable (and skip) 6 of them that are based on time-manipulation. Time manipulation is achieved in original SmartOTP code by using custom RPC calls `evm_increaseTime` and `evm_decreaseTime` provided by [Ganache](https://github.com/trufflesuite/ganache-cli). Ganache does not support Harmony blockchain at this time, and equivalent tool is not yet implemented on Harmony. 

I verified that all other 43 tests are passed.

## Test Instructions

### Local Dev Net

To run the tests on local dev net, you need to copy `.envSample` to `.env` and configure `LOCAL_PRIVATE_KEYS` variables with 6 valid private keys, separated by comma `,`. The private keys should have some funds (~50 ONES) available so that various test operations can be performed on each of these accounts. 

#### Launching local dev net

The dev net can be started following the instructions at https://github.com/harmony-one/harmony (written in Go). You may use the provided docker image, but if you want to debug in-depth (such as setting interrupts and break points inside certain RPC calls and observe how the backend behaves, or to print debug information of some variables), I would recommend to compile from the source code and launch your own binary if possible. 

### Test Net and Main Net

To run the tests on main net or test net, you need to configure `PRIVATE_KEY` (for test net) or `MAIN_PRIVATE_KEY` (for main net) accordingly.
