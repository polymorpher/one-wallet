// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

library Version{
    uint32 constant majorVersion = 0xf; // a change would require client to migrate
    uint32 constant minorVersion = 0x1; // a change would not require the client to migrate
}
