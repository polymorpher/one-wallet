pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

library Core {
    struct GuardianInfo {
        bool exists;
        uint128 index;
    }   

    struct RecoveryInfo {
        bytes16 rootHash;
        uint8 merkelHeight;
        uint timePeriod; 
        uint timeOffset;
        uint expiration;
    }

    struct Wallet { 
        bytes16 rootHash;
        uint8 merkelHeight;
        uint timePeriod; 
        uint timeOffset;
        address payable drainAddr;

        // the list of guardians
        address[] guardians;
        // the info about guardians
        mapping (address => GuardianInfo) info;
        
        
        // daily limit
        uint dailyLimit;
        uint lastDay;
        uint spentToday;

        // recovery
        RecoveryInfo recovery;
    }
}
