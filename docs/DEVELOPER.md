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

Solidity Contract documentation can be found under the solidity folder

## Contract Inheritence graph
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
## Testing Overview
* Factory Testing
  * ONEWalletFactory
  * ONEWalletFactoryHelper(IONEWalletFactoryHelper)

* Wallet Testing (Native)

* Wallet Tesing (Tokens)

* Wallet Testing (NFTs)

* Wallet Testing (ENS Domains)

* Test Utilities
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
    * 



## Functional Coverage

## Test Coverage

### util.js


### checkutil.js

### basic.js

### client.js

### factory.js

### innerCores.js

### otp.js

### spendingLimit.js




