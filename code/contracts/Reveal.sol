// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./IONEWallet.sol";
import "./CommitManager.sol";
import "./Recovery.sol";

library Reveal {
    using CommitManager for CommitManager.CommitState;

    function isDataOnlyOperation(Enums.OperationType op) pure internal returns (bool){
        return op == Enums.OperationType.BACKLINK_ADD ||
        op == Enums.OperationType.BACKLINK_DELETE ||
        op == Enums.OperationType.BACKLINK_OVERRIDE ||
        op == Enums.OperationType.DISPLACE ||
        // Data does not contain parameters for below operations. It is used for privacy reasons
        op == Enums.OperationType.RECOVER ||
        op == Enums.OperationType.COLLECT_REWARD;
    }

    function isDestAmountOnlyOperation(Enums.OperationType op) pure internal returns (bool){
        return op == Enums.OperationType.TRANSFER ||
        op == Enums.OperationType.DELEGATE ||
        op == Enums.OperationType.UNDELEGATE;
    }

    function isDestOnlyOperation(Enums.OperationType op) pure internal returns (bool){
        return op == Enums.OperationType.SET_RECOVERY_ADDRESS ||
        op == Enums.OperationType.FORWARD;
    }

    function isAmountOnlyOperation(Enums.OperationType op) pure internal returns (bool){
        return op == Enums.OperationType.CHANGE_SPENDING_LIMIT ||
        op == Enums.OperationType.JUMP_SPENDING_LIMIT;
    }

    /// Provides commitHash, paramsHash, and verificationHash given the parameters
    function getRevealHash(IONEWallet.AuthParams memory auth, IONEWallet.OperationParams memory op) pure public returns (bytes32, bytes32) {
        bytes32 hash = keccak256(bytes.concat(auth.neighbors[0], bytes32(bytes4(auth.indexWithNonce)), auth.eotp));
        bytes32 paramsHash = bytes32(0);
        // Perhaps a better way to do this is simply using the general paramsHash (in else branch) to handle all cases. We are holding off from doing that because that would be a drastic change and it would result in a lot of work for backward compatibility reasons.
        if (isDestAmountOnlyOperation(op.operationType)) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(op.dest))), bytes32(op.amount)));
        } else if (isAmountOnlyOperation(op.operationType)) {
            paramsHash = keccak256(bytes.concat(bytes32(op.amount)));
        } else if (isDataOnlyOperation(op.operationType)) {
            paramsHash = keccak256(op.data);
        } else if (isDestOnlyOperation(op.operationType)) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(op.dest)))));
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
    function isCorrectRecoveryProof(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, IONEWallet.AuthParams memory auth) view public returns (uint32) {
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
            return 0;
        }
        // check old cores
        for (uint32 i = 0; i < oldCores.length; i++) {
            if (oldCores[i].root == h) {
                require(auth.neighbors.length == oldCores[i].height - 1, "Bad old neighbors size");
                require(auth.indexWithNonce == uint32(2 ** (oldCores[i].height - 1)) - 1, "Need old recovery leaf");
                return i + 1;
            }
        }
        revert("Bad recovery proof");
    }

    /// check the current position is not used by *any* core as a recovery slot
    function isNonRecoveryLeaf(IONEWallet.CoreSetting storage latestCore, IONEWallet.CoreSetting[] storage oldCores, uint32 position, uint32 coreIndex) view public {
        IONEWallet.CoreSetting storage coreUsed = coreIndex == 0 ? latestCore : oldCores[coreIndex - 1];
        uint32 absolutePosition = coreUsed.t0 + position;
        require(absolutePosition != (latestCore.t0 + (uint32(2 ** (latestCore.height - 1))) - 1), "reserved");
        for (uint32 i = 0; i < oldCores.length; i++) {
            uint32 absoluteRecoveryPosition = oldCores[i].t0 + uint32(2 ** (oldCores[i].height - 1)) - 1;
            require(absolutePosition != absoluteRecoveryPosition, "Reserved before");
        }
    }

    /// This is just a wrapper around a modifier previously called `isCorrectProof`, to avoid "Stack too deep" error. Duh.
    function isCorrectProof(IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting[] storage oldCores, IONEWallet.AuthParams memory auth) view public returns (uint32) {
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
            return 0;
        }
        for (uint32 i = 0; i < oldCores.length; i++) {
            if (oldCores[i].root == h) {
                require(auth.neighbors.length == oldCores[i].height - 1, "Bad old neighbors size");
                return i + 1;
            }
        }
        revert("Proof is incorrect");
    }


    /// This function verifies that the first valid entry with respect to the given `eotp` in `commitState.commitLocker[hash]` matches the provided `paramsHash` and `verificationHash`. An entry is valid with respect to `eotp` iff `h3(entry.paramsHash . eotp)` equals `entry.verificationHash`. It returns the index of first valid entry in the array of commits, with respect to the commit hash
    function verifyReveal(IONEWallet.CoreSetting storage core, CommitManager.CommitState storage commitState, bytes32 hash, uint32 indexWithNonce, bytes32 paramsHash, bytes32 eotp,
        bool skipIndexVerification, bool skipNonceVerification) view public returns (uint32)
    {
        CommitManager.Commit[] storage cc = commitState.commitLocker[hash];
        require(cc.length > 0, "No commit found");
        for (uint32 i = 0; i < cc.length; i++) {
            CommitManager.Commit storage c = cc[i];
            if (c.verificationHash != keccak256(bytes.concat(c.paramsHash, eotp))) {
                // Invalid entry. Ignore
                continue;
            }
            require(c.paramsHash == paramsHash, "Param mismatch");
            uint32 counter = 0;
            if (!skipIndexVerification) {
                uint32 index = indexWithNonce / core.maxOperationsPerInterval;
                counter = c.timestamp / core.interval;
                uint32 t = counter - core.t0;
                require(t == index || t - 1 == index, "Time mismatch");
            }
            if (!skipNonceVerification) {
                uint8 nonce = uint8(indexWithNonce % core.maxOperationsPerInterval);
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

    function completeReveal(IONEWallet.CoreSetting storage core, CommitManager.CommitState storage commitState, bytes32 commitHash, uint32 commitIndex, bool skipNonceVerification) public {
        CommitManager.Commit[] storage cc = commitState.commitLocker[commitHash];
        assert(cc.length > 0);
        assert(cc.length > commitIndex);
        CommitManager.Commit storage c = cc[commitIndex];
        assert(c.timestamp > 0);
        if (!skipNonceVerification) {
            uint32 absoluteIndex = uint32(c.timestamp) / core.interval;
            commitState.incrementNonce(absoluteIndex);
            commitState.cleanupNonces(core.interval);
        }
        c.completed = true;
    }

    function authenticate(
        IONEWallet.CoreSetting storage core,
        IONEWallet.CoreSetting[] storage oldCores,
        IONEWallet.CoreSetting[] storage innerCores,
        address payable recoveryAddress,
        CommitManager.CommitState storage commitState,
        IONEWallet.AuthParams memory auth,
        IONEWallet.OperationParams memory op
    ) public {
        // first, we check whether the operation requires high-security
        if (op.operationType == Enums.OperationType.FORWARD) {
            if (!Recovery.isRecoveryAddressSet(recoveryAddress)) {
                // if innerCores are empty, this operation (in this case) is doomed to fail. Client should check for innerCores first before allowing the user to do this.
                authenticateCores(innerCores[0], innerCores, commitState, auth, op, false, true);
            } else {
                authenticateCores(core, oldCores, commitState, auth, op, false, false);
            }
        } else if (op.operationType == Enums.OperationType.DISPLACE) {
            if (innerCores.length == 0) {
                // authorize this operation using low security setting (only one core). After this operation is done, innerCores will no longer be empty
                authenticateCores(core, oldCores, commitState, auth, op, false, false);
            } else {
                authenticateCores(innerCores[0], innerCores, commitState, auth, op, false, true);
            }
        } else if (op.operationType == Enums.OperationType.RECOVER) {
            authenticateCores(core, oldCores, commitState, auth, op, true, true);
        } else if (op.operationType == Enums.OperationType.JUMP_SPENDING_LIMIT) {
            // if innerCores are empty, this operation (in this case) is doomed to fail. This is intended. Client should warn the user not to lower the limit too much if the wallet has no innerCores (use Extend to set first innerCores). Client should also advise the user the use Recovery feature to get their assets out, if they are stuck with very low limit and do not want to wait to double them each spendInterval.
            authenticateCores(innerCores[0], innerCores, commitState, auth, op, false, true);
        } else {
            authenticateCores(core, oldCores, commitState, auth, op, false, false);
        }
    }

    /// Validate `auth` is correct based on settings in `core` (plus `oldCores`, for reocvery operations) and the given operation `op`. Revert if `auth` is not correct. Modify wallet's commit state based on `auth` (increment nonce, mark commit as completed, etc.) if `auth` is correct.
    function authenticateCores(
        IONEWallet.CoreSetting storage core,
        IONEWallet.CoreSetting[] storage oldCores,
        CommitManager.CommitState storage commitState,
        IONEWallet.AuthParams memory auth,
        IONEWallet.OperationParams memory op,
        bool skipIndexVerification,
        bool skipNonceVerification
    ) public {
        uint32 coreIndex = 0;
        if (op.operationType == Enums.OperationType.RECOVER) {
            coreIndex = isCorrectRecoveryProof(core, oldCores, auth);
        } else {
            coreIndex = isCorrectProof(core, oldCores, auth);
            // isNonRecoveryLeaf is not necessary, since
            // - normal operations would occupy a different commitHash slot (eotp is used instead of leaf)
            // - nonce is not incremented by recovery operation
            // - the last slot's leaf is used in recovery, but the same leaf is not used for an operation at the last slot, instead its neighbor's leaf is used
            // - doesn't help much with security anyway, since the data is already expoed even if the transaction is reverted
            // isNonRecoveryLeaf(core, oldCores, auth.indexWithNonce, coreIndex);
            // TODO: use a separate hash to authenticate recovery operations, instead of relying on last leaf of the tree.
            // v15 note: On a second thought, using leaf is not a bad idea since it makes implementation much simpler and more unified (making everything go through `authenticate`). But instead of last leaf, the first leaf seems a better choice. I added comments under `function _recover()` in `ONEWallet.sol`
        }
        IONEWallet.CoreSetting storage coreUsed = coreIndex == 0 ? core : oldCores[coreIndex - 1];
        (bytes32 commitHash, bytes32 paramsHash) = getRevealHash(auth, op);
        uint32 commitIndex = verifyReveal(coreUsed, commitState, commitHash, auth.indexWithNonce, paramsHash, auth.eotp, skipIndexVerification, skipNonceVerification);
        completeReveal(coreUsed, commitState, commitHash, commitIndex, skipNonceVerification);
    }
}
