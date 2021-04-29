pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

library Core {
    struct GuardianInfo {
        bool exists;
        uint128 index;
    }   

    struct Wallet { 
        // the list of guardians
        address[] guardians;
        // the info about guardians
        mapping (address => GuardianInfo) info;    
    }
}
