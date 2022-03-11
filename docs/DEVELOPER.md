# Developer Notes

## Quickstart

### Smart Contracts

### Local Relayer

### Client

## Debugging

Verbosity can be set using the `VERBOSE` environment variable.


This flag used in debugging and read via `config` this is set in the `.env` file 
* on `VERBOSE=true`
* off `VERBOSE=false`


You can also turn on debugging locally by including it in the command line for example
* `VERBOSE=true truffle test --network=dev --compile-none`



# Smart Contract Overview

Solidity Contract documentation can be found under the solidity folder. To generate this documentation run the following command from the `code` directory.
```
yarn soldoc
```

## Contract Inheritance graph
![Contracts Inhereitance Graph](./slither/inheritance-graph.png)

## Factory
* ONEWalletFactory
  * ONEWalletFactoryHelper(IONEWalletFactoryHelper)
* WalletGraph

## ONE Wallet Token Management
* ONEWallet(IONEWallet)
  * AbstractONEWallet
  * TokenManager
    * IERC721Receiver
    * IERC1155Receiver(IERC165)
      * IERC165
    * Forwardable
* TokenTracker

## Transaction Management
* Executor
* CommitManager
* Reveal
* SignatureManager
* ENS

## Registration Functionality
* Registrar(IRegistrar)
* ReverseRegistrar (IReverseRegistrar)
* DomainManager

## Spending Limit Functionality
* SpendingManager

## Additional Utilities
* Address
* IDefaultReverseResolver
* Strings
* CoreManager
* Resolver
* Recovery
* Enums

## Testing Utilities
* TestERC20(IERC20)
* TestERC20Decimals9(IERC20)
  * ERC20
  * IERC20Metadata
  * Context
* TestERC721(IERC721)
  * IERC721
  * IERC721Metadata
  * Context
  * ERC165
* TestERC1155(IERC1155)
  * ERC1155

# Testing

## Lib Testing
### Client Testing: `client.js`
Tests the client can generate consistent recoverable randomness with both double one time passwords (OTP) and argon2.

This relies on the `lib/onewallet.js` to calculate the merkle trees and `lib/util.js` to makeInnerCores.

### One Time Password: `otp.js`
Tests the generation of one time passwords(OTPs) ussing a known seed key and displays the value to be checked against google authenticator.
### Password Validity `innerCores.js`
Checks one time passwords are valid over different time frames and after being displaced.
## Smart Contract Testing

The approach to smart contract testing is
1. Build general purpose utilites for building deploying and constructing contracts `util.js`
2. Build helper functions for checking contracts public functions and variables `checkUtil.js`
3. Review functional areas and create test scripts for each area (e.g. `factory.js`)
4. Read Functionality includes testing for all public functions and variables
5. Update Functionality includes reviewing all events to ensure they are tested (e.g. TransferError)
6. Reviewing all update functions to ensure they have been tested.
7. Negative use case testing for scenarios that may be reverted.

* `util.js` utilites used by testing compone
### Factory Testing: `factory.js`
Tests the OneWalletFactory

**Smart Contracts Tested**

* ONEWalletFactory
* ONEWalletFactoryHelper(IONEWalletFactoryHelper)

### ONE Wallet native transfers: `basic.js`
Test basic functionality including native token transfer and simple spending limit check.

**Smart Contracts Tested**

ONE Wallet Token Management
* ONEWallet(IONEWallet)
  * AbstractONEWallet
  * TokenManager
    * IERC721Receiver
    * IERC1155Receiver(IERC165)
      * IERC165
    * Forwardable
* TokenTracker

Transaction Management
* Executor
* CommitManager
* Reveal
* SignatureManager
* ENS


### One Wallet Spending Limits: `spendlimit.js`
Test management of spending limits and time based spending thresholds

**Smart Contracts Tested**

* SpendingManager



## Testing TODO

### Token Transactions: `tokens.js`
* Wallet Testing (Native)

* Wallet Tesing (Tokens)

* Wallet Testing (NFTs)

* Wallet Testing (ENS Domains)

### Registration: `register.js`

* Wallet Testing (ENS Domains)



