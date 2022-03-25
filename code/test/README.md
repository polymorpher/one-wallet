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

| File | Function |
| --- | --- | 
| basic.js | Basic smart contract testing useful for checking your testing enviroment works|
| client.js | Client functionality tests around the generation and encryption of One Time Passwords (OTP's)
| factory.js | Factory testing to ensure that the factory generates new ONEWallets as expected|
| general.js | Smart contract testing by Operation code goal is to provide complete Operation coverage |
| spendlimit.js | Spending Limit functionality testing validating spending limits can be updated and are adhered to |
| tokens.js | Token Functionality testing around transferring and tracking of tokens |
| util.js | Utility and Helper functions |