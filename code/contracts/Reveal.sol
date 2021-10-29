// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./IONEWallet.sol";

library Reveal {

    /// Provides commitHash, paramsHash, and verificationHash given the parameters
    function getRevealHash(bytes32 neighbor, uint32 indexWithNonce, bytes32 eotp,
        OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes calldata data) pure external returns (bytes32, bytes32) {
        bytes32 hash = keccak256(bytes.concat(neighbor, bytes32(bytes4(indexWithNonce)), eotp));
        bytes32 paramsHash = bytes32(0);
        if (operationType == OperationType.TRANSFER) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(dest))), bytes32(amount)));
        } else if (operationType == OperationType.RECOVER) {
            paramsHash = keccak256(data);
        } else if (operationType == OperationType.SET_RECOVERY_ADDRESS) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(dest)))));
        } else if (operationType == OperationType.FORWARD) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(dest)))));
        } else if (operationType == OperationType.BACKLINK_ADD || operationType == OperationType.BACKLINK_DELETE || operationType == OperationType.BACKLINK_OVERRIDE) {
            paramsHash = keccak256(data);
        } else if (operationType == OperationType.REPLACE) {
            paramsHash = keccak256(data);
        } else if (operationType == OperationType.RECOVER_SELECTED_TOKENS) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(dest))), data));
        } else {
            // TRACK, UNTRACK, TRANSFER_TOKEN, OVERRIDE_TRACK, BUY_DOMAIN, RENEW_DOMAIN, TRANSFER_DOMAIN, COMMAND
            paramsHash = keccak256(bytes.concat(
                    bytes32(uint256(operationType)),
                    bytes32(uint256(tokenType)),
                    bytes32(bytes20(contractAddress)),
                    bytes32(tokenId),
                    bytes32(bytes20(dest)),
                    bytes32(amount),
                    data
                ));
        }
        return (hash, paramsHash);
    }

    /// WARNING: Clients should not use eotps that *may* be used for recovery. The time slots should be manually excluded for use.
    function isCorrectRecoveryProof(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, bytes32[] calldata neighbors, uint32 position, bytes32 eotp) view external {
        bytes32 h = eotp;
        for (uint8 i = 0; i < neighbors.length; i++) {
            if ((position & 0x01) == 0x01) {
                h = sha256(bytes.concat(neighbors[i], h));
            } else {
                h = sha256(bytes.concat(h, neighbors[i]));
            }
            position >>= 1;
        }
        if (core.root == h) {
            require(neighbors.length == core.height - 1, "Bad neighbors size");
            require(position == (uint32(2 ** (core.height - 1))) - 1, "Need recovery leaf");
            return;
        }
        // check old cores
        for (uint8 i = 0; i < oldCores.length; i++) {
            if (oldCores[i].root == h) {
                require(neighbors.length == oldCores[i].height - 1, "Bad old neighbors size");
                require(position == uint32(2 ** (oldCores[i].height - 1)) - 1, "Need old recovery leaf");
                return;
            }
        }
        revert("Bad recovery proof");
    }

    /// check the current position is not used by *any* core as a recovery slot
    function isNonRecoveryLeaf(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, uint32 position) view external {
        require(position != (uint32(2 ** (core.height - 1))) - 1, "reserved");
        for (uint8 i = 0; i < oldCores.length; i++) {
            uint32 recoveryPosition = oldCores[i].t0 + uint32(2 ** (oldCores[i].height - 1)) - 1;
            require(core.t0 + position != recoveryPosition, "Reserved before");
        }
    }

    /// This is just a wrapper around a modifier previously called `isCorrectProof`, to avoid "Stack too deep" error. Duh.
    function isCorrectProof(IONEWallet.CoreSetting storage core, bytes32[] calldata neighbors, uint32 position, bytes32 eotp) view external {
        require(neighbors.length == core.height - 1, "Bad neighbors");
        bytes32 h = sha256(bytes.concat(eotp));
        for (uint8 i = 0; i < core.height - 1; i++) {
            if ((position & 0x01) == 0x01) {
                h = sha256(bytes.concat(neighbors[i], h));
            } else {
                h = sha256(bytes.concat(h, neighbors[i]));
            }
            position >>= 1;
        }
        require(core.root == h, "Proof is incorrect");
        return;
    }

}
