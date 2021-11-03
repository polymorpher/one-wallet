// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./IONEWallet.sol";
import "./CommitManager.sol";

library Reveal {
    using CommitManager for CommitManager.CommitState;
    /// Provides commitHash, paramsHash, and verificationHash given the parameters
    function getRevealHash(IONEWallet.AuthParams memory auth, IONEWallet.OperationParams memory op) pure public returns (bytes32, bytes32) {
        bytes32 hash = keccak256(bytes.concat(auth.neighbors[0], bytes32(bytes4(auth.indexWithNonce)), auth.eotp));
        bytes32 paramsHash = bytes32(0);
        // Perhaps a better way to do this is simply using the general paramsHash (in else branch) to handle all cases. We are holding off from doing that because that would be a drastic change and it would result in a lot of work for backward compatibility reasons.
        if (op.operationType == Enums.OperationType.TRANSFER) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(op.dest))), bytes32(op.amount)));
        } else if (op.operationType == Enums.OperationType.RECOVER) {
            paramsHash = keccak256(op.data);
        } else if (op.operationType == Enums.OperationType.SET_RECOVERY_ADDRESS) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(op.dest)))));
        } else if (op.operationType == Enums.OperationType.FORWARD) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(op.dest)))));
        } else if (op.operationType == Enums.OperationType.BACKLINK_ADD || op.operationType == Enums.OperationType.BACKLINK_DELETE || op.operationType == Enums.OperationType.BACKLINK_OVERRIDE) {
            paramsHash = keccak256(op.data);
        } else if (op.operationType == Enums.OperationType.DISPLACE) {
            paramsHash = keccak256(op.data);
        } else if (op.operationType == Enums.OperationType.RECOVER_SELECTED_TOKENS) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(op.dest))), op.data));
        } else {
            // TRACK, UNTRACK, TRANSFER_TOKEN, OVERRIDE_TRACK, BUY_DOMAIN, RENEW_DOMAIN, TRANSFER_DOMAIN, COMMAND
            paramsHash = keccak256(bytes.concat(
                    bytes32(uint256(op.operationType)),
                    bytes32(uint256(op.tokenType)),
                    bytes32(bytes20(op.contractAddress)),
                    bytes32(op.tokenId),
                    bytes32(bytes20(address(op.dest))),
                    bytes32(op.amount),
                    op.data
                ));
        }
        return (hash, paramsHash);
    }

    /// WARNING: Clients should not use eotps that *may* be used for recovery. The time slots should be manually excluded for use.
    function isCorrectRecoveryProof(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, IONEWallet.AuthParams memory auth) view public {
        bytes32 h = auth.eotp;
        uint32 position = auth.indexWithNonce;
        for (uint8 i = 0; i < auth.neighbors.length; i++) {
            if ((position & 0x01) == 0x01) {
                h = sha256(bytes.concat(auth.neighbors[i], h));
            } else {
                h = sha256(bytes.concat(h, auth.neighbors[i]));
            }
            position >>= 1;
        }
        if (core.root == h) {
            require(auth.neighbors.length == core.height - 1, "Bad neighbors size");
            require(auth.indexWithNonce == (uint32(2 ** (core.height - 1))) - 1, "Need recovery leaf");
            return;
        }
        // check old cores
        for (uint32 i = 0; i < oldCores.length; i++) {
            if (oldCores[i].root == h) {
                require(auth.neighbors.length == oldCores[i].height - 1, "Bad old neighbors size");
                require(auth.indexWithNonce == uint32(2 ** (oldCores[i].height - 1)) - 1, "Need old recovery leaf");
                return;
            }
        }
        revert("Bad recovery proof");
    }

    /// check the current position is not used by *any* core as a recovery slot
    function isNonRecoveryLeaf(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, uint32 position) view public {
        require(position != (uint32(2 ** (core.height - 1))) - 1, "reserved");
        for (uint32 i = 0; i < oldCores.length; i++) {
            uint32 recoveryPosition = oldCores[i].t0 + uint32(2 ** (oldCores[i].height - 1)) - 1;
            require(core.t0 + position != recoveryPosition, "Reserved before");
        }
    }

    /// This is just a wrapper around a modifier previously called `isCorrectProof`, to avoid "Stack too deep" error. Duh.
    function isCorrectProof(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, IONEWallet.AuthParams memory auth) view public {
        uint32 position = auth.indexWithNonce;
        bytes32 h = sha256(bytes.concat(auth.eotp));
        for (uint8 i = 0; i < auth.neighbors.length; i++) {
            if ((position & 0x01) == 0x01) {
                h = sha256(bytes.concat(auth.neighbors[i], h));
            } else {
                h = sha256(bytes.concat(h, auth.neighbors[i]));
            }
            position >>= 1;
        }
        if (core.root == h) {
            require(auth.neighbors.length == core.height - 1, "Bad neighbors size");
            return;
        }
        for (uint32 i = 0; i < oldCores.length; i++) {
            if (oldCores[i].root == h) {
                require(auth.neighbors.length == oldCores[i].height - 1, "Bad old neighbors size");
                return;
            }
        }
        revert("Proof is incorrect");
    }


    /// This function verifies that the first valid entry with respect to the given `eotp` in `commitState.commitLocker[hash]` matches the provided `paramsHash` and `verificationHash`. An entry is valid with respect to `eotp` iff `h3(entry.paramsHash . eotp)` equals `entry.verificationHash`. It returns the index of first valid entry in the array of commits, with respect to the commit hash
    function verifyReveal(IONEWallet.CoreSetting storage core, CommitManager.CommitState storage commitState, bytes32 hash, uint32 indexWithNonce, bytes32 paramsHash, bytes32 eotp, Enums.OperationType operationType) view public returns (uint32)
    {
        uint32 index = indexWithNonce / core.maxOperationsPerInterval;
        uint8 nonce = uint8(indexWithNonce % core.maxOperationsPerInterval);
        CommitManager.Commit[] storage cc = commitState.commitLocker[hash];
        require(cc.length > 0, "No commit found");
        for (uint32 i = 0; i < cc.length; i++) {
            CommitManager.Commit storage c = cc[i];
            bytes32 expectedVerificationHash = keccak256(bytes.concat(c.paramsHash, eotp));
            if (c.verificationHash != expectedVerificationHash) {
                // Invalid entry. Ignore
                continue;
            }
            require(c.paramsHash == paramsHash, "Param mismatch");
            if (operationType != Enums.OperationType.RECOVER) {
                uint32 counter = c.timestamp / core.interval;
                uint32 t = counter - core.t0;
                require(t == index || t - 1 == index, "Time mismatch");
                uint8 expectedNonce = commitState.nonces[counter];
                require(nonce >= expectedNonce, "Nonce too low");
            }
            require(!c.completed, "Commit already done");
            // This normally should not happen, but when the network is congested (regardless of whether due to an attacker's malicious acts or not), the legitimate reveal may become untimely. This may happen before the old commit is cleaned up by another fresh commit. We enforce this restriction so that the attacker would not have a lot of time to reverse-engineer a single EOTP or leaf using an old commit.
            require(uint32(block.timestamp) - c.timestamp < CommitManager.REVEAL_MAX_DELAY, "Too late");
            return i;
        }
        revert("No commit");
    }

    function completeReveal(IONEWallet.CoreSetting storage core, CommitManager.CommitState storage commitState, bytes32 commitHash, uint32 commitIndex, Enums.OperationType operationType) public {
        CommitManager.Commit[] storage cc = commitState.commitLocker[commitHash];
        assert(cc.length > 0);
        assert(cc.length > commitIndex);
        CommitManager.Commit storage c = cc[commitIndex];
        assert(c.timestamp > 0);
        if (operationType != Enums.OperationType.RECOVER) {
            uint32 index = uint32(c.timestamp) / core.interval;
            commitState.incrementNonce(index);
            commitState.cleanupNonces(core.interval);
        }
        c.completed = true;
    }

    /// Validate `auth` is correct based on settings in `core` (plus `oldCores`, for reocvery operations) and the given operation `op`. Revert if `auth` is not correct. Modify wallet's commit state based on `auth` (increment nonce, mark commit as completed, etc.) if `auth` is correct.
    function authenticate(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, CommitManager.CommitState storage commitState, IONEWallet.AuthParams memory auth, IONEWallet.OperationParams memory op) public {
        if (op.operationType == Enums.OperationType.RECOVER) {
            isCorrectRecoveryProof(core, oldCores, auth);
        } else {
            isNonRecoveryLeaf(core, oldCores, auth.indexWithNonce);
            isCorrectProof(core, auth);
        }
        (bytes32 commitHash, bytes32 paramsHash) = getRevealHash(auth, op);
        uint32 commitIndex = verifyReveal(core, commitState, commitHash, auth.indexWithNonce, paramsHash, auth.eotp, op.operationType);
        completeReveal(core, commitState, commitHash, commitIndex, op.operationType);
    }
}
