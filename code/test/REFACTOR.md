# Refactor Design Doc

## Overview

This document is to capture items and discussion points to ensure an optimal design for the test strategy. 

**Before Merging [Pull Reqeuest 263](https://github.com/polymorpher/one-wallet/pull/263) this document should be removed as changes are implemented or an issue created for ongoing refactoring and enhancements**

## Discussion Points

Following are some discussion points

* [backlinkAddresses and randomSeed should not be an argument of a general function?](https://github.com/polymorpher/one-wallet/pull/263#discussion_r835748423)
* [transactionExecute](https://github.com/polymorpher/one-wallet/pull/263#discussion_r835748509)suggest breaking down this function and only let it handle general, frequently occurring cases. Transaction execution functions for infrequent operations, if needed, can live in their own files. People testing individual functions shouldn't need to come to this centralized function and going over the entire thing to understand what's needed
* 


## Existing Codebase Notes

### Backlinking
Encompasess the Following operations and parameters in Executor.sol
* BACKLINK_ADD: `_backlinkAdd(backlinkAddresses, op.data)`
* BACKLINK_DELETE: `_backlinkDelete(backlinkAddresses, op.data)`
* BACKLINK_OVERRIDE: `_backlinkOverride(backlinkAddresses, op.data)`

This interacts with `WalletGraph.sol` with the following parameters
* `function backlinkAdd(IONEWallet[] storage backlinkAddresses, address[] memory addresses)`
* `function backlinkDelete(IONEWallet[] storage backlinkAddresses, address[] memory addresses)`
* `function backlinkOverride(IONEWallet[] storage backlinkAddresses, address[] memory addresses)`

**Current Logic**

Populating Data
* backlinkAddresses : Populated with an array of ONEWallet instances
* op.data: populated with an array of ONEWallet address

**Test** 
`general.ts`
Populates the data as follows
```
   let backlinkAddresses = [carol.wallet]
    let hexData = ONEUtil.abi.encodeParameters(['address[]'], [[carol.wallet.address]])
    let data = ONEUtil.hexStringToBytes(hexData)
```
and executes
```
    await TestUtil.executeStandardTransaction(
      {
        walletInfo: alice,
        operationType: ONEConstants.OperationType.BACKLINK_ADD,
        backlinkAddresses,
        data,
        testTime
      }
    )
```
**transactionExecute**
`util.js`
Populates the commit and reveal parameters and instructs CommitReveal to use `computeDataHash` 

```
    case ONEConstants.OperationType.BACKLINK_OVERRIDE:
      paramsHash = ONEWallet.computeDataHash
      commitParams = { operationType, backlinkAddresses, data }
      revealParams = { operationType, backlinkAddresses, data }
      break
```

and calls commit reveal as follows
```
  let { tx, authParams, revealParams: returnedRevealParams } = await commitReveal({
    Debugger,
    layers: walletInfo.layers,
    index,
    eotp,
    paramsHash,
    commitParams,
    revealParams,
    wallet: walletInfo.wallet
  })
```

**CommitReveal**
`util.js`
Uses the passed commit and reveal parameters as well as the paramHash to process the backlink Update


**Feedback/Improvements**
* [backlinkAddresses and randomSeed should not be an argument of a general function?](https://github.com/polymorpher/one-wallet/pull/263#discussion_r835748423)
* [transactionExecute](https://github.com/polymorpher/one-wallet/pull/263#discussion_r835748509) suggest breaking down this function and only let it handle general, frequently occurring cases. Transaction execution functions for infrequent operations, if needed, can live in their own files. People testing individual functions shouldn't need to come to this centralized function and going over the entire thing to understand what's needed
* [should use a general operation ](https://github.com/polymorpher/one-wallet/pull/263#discussion_r835748554)

## Design Approach


## Development Action Items


