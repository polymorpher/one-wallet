# Refactor Design Doc

## Overview

This document is to capture items and discussion points to ensure an optimal design for the test strategy. 

**Before Merging [Pull Reqeuest 263](https://github.com/polymorpher/one-wallet/pull/263) this document should be removed as changes are implemented or an issue created for ongoing refactoring and enhancements**

## Discussion Points

Following are some discussion points

* [backlinkAddresses and randomSeed should not be an argument of a general function?](https://github.com/polymorpher/one-wallet/pull/263#discussion_r835748423)
* [transactionExecute](https://github.com/polymorpher/one-wallet/pull/263#discussion_r835748509)suggest breaking down this function and only let it handle general, frequently occurring cases. Transaction execution functions for infrequent operations, if needed, can live in their own files. People testing individual functions shouldn't need to come to this centralized function and going over the entire thing to understand what's needed
* 


## Design Approach


## Development Action Items


