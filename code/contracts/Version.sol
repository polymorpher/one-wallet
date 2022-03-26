// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

// does not need to be deployed
library Version{
    uint32 constant majorVersion = 0x10; // a change would require client to migrate
    uint32 constant minorVersion = 0x0; // a change would not require the client to migrate
}
