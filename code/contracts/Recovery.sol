// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

library Recovery {
    address constant ONE_WALLET_TREASURY = 0x7534978F9fa903150eD429C486D1f42B7fDB7a61;
    uint256 public constant AUTO_RECOVERY_TRIGGER_AMOUNT = 1 ether;
    uint256 public constant AUTO_RECOVERY_MANDATORY_WAIT_TIME = 14 days;

    function isRecoveryAddressSet(address recoveryAddress) internal pure returns (bool) {
        return recoveryAddress != address(0) && recoveryAddress != ONE_WALLET_TREASURY;
    }
}
