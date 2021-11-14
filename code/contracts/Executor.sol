// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./IONEWallet.sol";
import "./CommitManager.sol";
import "./TokenManager.sol";
import "./DomainManager.sol";
import "./WalletGraph.sol";
import "./SignatureManager.sol";
import "./TokenTracker.sol";
import "./SpendingManager.sol";

library Executor {
    using WalletGraph for IONEWallet[];
    using TokenTracker for TokenTracker.TokenTrackerState;
    using SignatureManager for SignatureManager.SignatureTracker;
    using SpendingManager for SpendingManager.SpendingState;
    function execute(IONEWallet.OperationParams memory op, TokenTracker.TokenTrackerState storage tokenTrackerState, IONEWallet[] storage backlinkAddresses, SignatureManager.SignatureTracker storage signatures, SpendingManager.SpendingState storage spendingState) public {
        // No revert should occur below this point
        if (op.operationType == Enums.OperationType.TRACK) {
            if (op.data.length > 0) {
                tokenTrackerState.multiTrack(op.data);
            } else {
                tokenTrackerState.trackToken(op.tokenType, op.contractAddress, op.tokenId);
            }
        } else if (op.operationType == Enums.OperationType.UNTRACK) {
            if (op.data.length > 0) {
                tokenTrackerState.untrackToken(op.tokenType, op.contractAddress, op.tokenId);
            } else {
                tokenTrackerState.multiUntrack(op.data);
            }
        } else if (op.operationType == Enums.OperationType.TRANSFER_TOKEN) {
            tokenTrackerState.transferToken(op.tokenType, op.contractAddress, op.tokenId, op.dest, op.amount, op.data);
        } else if (op.operationType == Enums.OperationType.OVERRIDE_TRACK) {
            tokenTrackerState.overrideTrackWithBytes(op.data);
        } else if (op.operationType == Enums.OperationType.BUY_DOMAIN) {
            DomainManager.buyDomainEncoded(op.data, op.amount, uint8(op.tokenId), op.contractAddress, op.dest);
        } else if (op.operationType == Enums.OperationType.TRANSFER_DOMAIN) {
            _transferDomain(IRegistrar(op.contractAddress), address(bytes20(bytes32(op.tokenId))), bytes32(op.amount), op.dest);
        } else if (op.operationType == Enums.OperationType.RENEW_DOMAIN) {
            DomainManager.renewDomain(IRegistrar(op.contractAddress), bytes32(op.tokenId), string(op.data), op.amount);
        } else if (op.operationType == Enums.OperationType.RECLAIM_REVERSE_DOMAIN) {
            DomainManager.reclaimReverseDomain(op.contractAddress, string(op.data));
        } else if (op.operationType == Enums.OperationType.RECLAIM_DOMAIN_FROM_BACKLINK) {
            backlinkAddresses.reclaimDomainFromBacklink(uint32(op.amount), IRegistrar(op.contractAddress), IReverseRegistrar(op.dest), op.data);
        } else if (op.operationType == Enums.OperationType.RECOVER_SELECTED_TOKENS) {
            tokenTrackerState.recoverSelectedTokensEncoded(op.dest, op.data);
        } else if (op.operationType == Enums.OperationType.COMMAND) {
            backlinkAddresses.command(op.tokenType, op.contractAddress, op.tokenId, op.dest, op.amount, op.data);
        } else if (op.operationType == Enums.OperationType.BACKLINK_ADD) {
            _backlinkAdd(backlinkAddresses, op.data);
        } else if (op.operationType == Enums.OperationType.BACKLINK_DELETE) {
            _backlinkDelete(backlinkAddresses, op.data);
        } else if (op.operationType == Enums.OperationType.BACKLINK_OVERRIDE) {
            _backlinkOverride(backlinkAddresses, op.data);
        } else if (op.operationType == Enums.OperationType.SIGN) {
            signatures.authorizeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
        } else if (op.operationType == Enums.OperationType.REVOKE) {
            signatures.revokeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
        } else if (op.operationType == Enums.OperationType.CHANGE_SPENDING_LIMIT) {
            spendingState.changeSpendLimit(op.amount);
        } else if (op.operationType == Enums.OperationType.JUMP_SPENDING_LIMIT) {
            spendingState.jumpSpendLimit(op.amount);
        }
    }

    function _transferDomain(IRegistrar reg, address resolver, bytes32 subnode, address payable dest) internal {
        try DomainManager.transferDomain(reg, resolver, subnode, dest){

        } catch Error(string memory reason){
            emit DomainManager.DomainTransferFailed(reason);
        } catch {
            emit DomainManager.DomainTransferFailed("");
        }
    }

    function _backlinkAdd(IONEWallet[] storage backlinkAddresses, bytes memory data) internal {
        address[] memory addresses = abi.decode(data, (address[]));
        backlinkAddresses.backlinkAdd(addresses);
    }

    function _backlinkDelete(IONEWallet[] storage backlinkAddresses, bytes memory data) internal {
        address[] memory addresses = abi.decode(data, (address[]));
        backlinkAddresses.backlinkDelete(addresses);
    }

    function _backlinkOverride(IONEWallet[] storage backlinkAddresses, bytes memory data) internal {
        address[] memory addresses = abi.decode(data, (address[]));
        backlinkAddresses.backlinkOverride(addresses);
    }

}
