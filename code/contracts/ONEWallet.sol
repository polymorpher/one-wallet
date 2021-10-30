// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./SpendingManager.sol";
import "./CommitManager.sol";
import "./TokenManager.sol";
import "./DomainManager.sol";
import "./SignatureManager.sol";
import "./Reveal.sol";
import "./WalletGraph.sol";
import "./Enums.sol";
import "./IONEWallet.sol";

contract ONEWallet is TokenManager, IONEWallet {
    using TokenTracker for TokenTracker.TokenTrackerState;
    using WalletGraph for IONEWallet[];
    using SignatureManager for SignatureManager.SignatureTracker;
    using SpendingManager for SpendingManager.SpendingState;
    using CommitManager for CommitManager.CommitState;
    using Reveal for CoreSetting;

    CoreSetting core;
    CoreSetting[] oldCores;

    /// global mutable variables
    address payable recoveryAddress; // where money will be sent during a recovery process (or when the wallet is beyond its lifespan)

    SpendingManager.SpendingState spendingState;

    uint256 public override lastOperationTime; // in seconds; record the time for the last successful reveal
    address payable forwardAddress; // a non-empty forward address assumes full control of this contract. A forward address can only be set upon a successful recovery or upgrade operation.
    IONEWallet[] backlinkAddresses; // to be set in next version - these are addresses forwarding funds and tokens to this contract AND must have their forwardAddress updated if this contract's forwardAddress is set or updated. One example of such an address is a previous version of the wallet "upgrading" to a new version. See more at https://github.com/polymorpher/one-wallet/issues/78

    // constants
    uint256 constant AUTO_RECOVERY_TRIGGER_AMOUNT = 1 ether;
    uint32 constant MAX_COMMIT_SIZE = 120;
    uint256 constant AUTO_RECOVERY_MANDATORY_WAIT_TIME = 14 days;
    address constant ONE_WALLET_TREASURY = 0x02F2cF45DD4bAcbA091D78502Dba3B2F431a54D3;

    uint32 constant majorVersion = 0xe; // a change would require client to migrate
    uint32 constant minorVersion = 0x1; // a change would not require the client to migrate

    /// commit management
    CommitManager.CommitState commitState;
    SignatureManager.SignatureTracker signatures;

    constructor(CoreSetting memory core_, SpendingManager.SpendingState memory spendingState_, address payable recoveryAddress_, IONEWallet[] memory backlinkAddresses_)
    {
        core.root = core_.root;
        core.height = core_.height;
        core.interval = core_.interval;
        core.t0 = core_.t0;
        core.lifespan = core_.lifespan;
        core.maxOperationsPerInterval = core_.maxOperationsPerInterval;

        spendingState.spendingLimit = spendingState_.spendingLimit;
        spendingState.spendingInterval = spendingState_.spendingInterval;

        recoveryAddress = recoveryAddress_;
        backlinkAddresses = backlinkAddresses_;
    }

    function _getForwardAddress() internal override view returns (address payable){
        return forwardAddress;
    }

    function getForwardAddress() external override view returns (address payable){
        return forwardAddress;
    }

    function _forwardPayment() internal {
        (bool success,) = forwardAddress.call{value : msg.value}("");
        require(success, "Forward failed");
        emit PaymentForwarded(msg.value, msg.sender);
    }

    receive() external payable {
        //        emit PaymentReceived(msg.value, msg.sender); // not quite useful - sender and amount is available in tx receipt anyway
        if (forwardAddress != address(0)) {// this wallet already has a forward address set - standard recovery process should not apply
            if (forwardAddress == recoveryAddress) {// in this case, funds should be forwarded to forwardAddress no matter what
                _forwardPayment();
                return;
            }
            if (msg.sender == recoveryAddress) {// this case requires special handling
                if (msg.value == AUTO_RECOVERY_TRIGGER_AMOUNT) {// in this case, send funds to recovery address and reclaim forwardAddress to recovery address
                    _forward(recoveryAddress);
                    _recover();
                    return;
                }
                // any other amount is deemed to authorize withdrawal of all funds to forwardAddress
                _overrideRecoveryAddress();
                _recover();
                return;
            }
            // if sender is anyone else (including self), simply forward the payment
            _forwardPayment();
            return;
        }
        if (msg.value != AUTO_RECOVERY_TRIGGER_AMOUNT) {
            return;
        }
        if (msg.sender != recoveryAddress) {
            return;
        }
        if (msg.sender == address(this)) {
            return;
        }
        if (block.timestamp < lastOperationTime + AUTO_RECOVERY_MANDATORY_WAIT_TIME) {
            emit AutoRecoveryTriggeredPrematurely(msg.sender, lastOperationTime + AUTO_RECOVERY_MANDATORY_WAIT_TIME);
            return;
        }
        emit AutoRecoveryTriggered(msg.sender);
        require(_drain());
    }

    function retire() external override returns (bool)
    {
        require(uint32(block.timestamp / core.interval) - core.t0 > core.lifespan, "Too early");
        require(_isRecoveryAddressSet(), "Recovery not set");
        require(_drain(), "Recovery failed");
        return true;
    }

    function getInfo() external override view returns (bytes32, uint8, uint8, uint32, uint32, uint8, address, uint256){
        return (core.root, core.height, core.interval, core.t0, core.lifespan, core.maxOperationsPerInterval, recoveryAddress, 0);
    }

    function getOldInfos() external override view returns (CoreSetting[] memory){
        return oldCores;
    }

    function getRootKey() external override view returns (bytes32){
        if (oldCores.length > 0) {
            return oldCores[0].root;
        }
        return core.root;
    }

    function getVersion() external override pure returns (uint32, uint32){
        return (majorVersion, minorVersion);
    }

    function getCurrentSpending() external override pure returns (uint256, uint256){
        revert();
    }

    function getCurrentSpendingState() external override view returns (uint256, uint256, uint32, uint32){
        return spendingState.getState();
    }

    function getNonce() external override view returns (uint8){
        return commitState.getNonce(core.interval);
    }

    function getTrackedTokens() external override view returns (Enums.TokenType[] memory, address[] memory, uint256[] memory){
        return TokenManager._getTrackedTokens();
    }

    function getBalance(Enums.TokenType tokenType, address contractAddress, uint256 tokenId) external override view returns (uint256){
        (uint256 balance, bool success, string memory reason) = TokenManager._getBalance(tokenType, contractAddress, tokenId);
        require(success, reason);
        return balance;
    }

    function getCommits() external override pure returns (bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        revert();
    }

    function getAllCommits() external override view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        return commitState.getAllCommits();
    }

    function findCommit(bytes32 /*hash*/) external override pure returns (bytes32, bytes32, uint32, bool){
        revert();
    }

    function lookupCommit(bytes32 hash) external override view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        return commitState.lookupCommit(hash);
    }

    function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external override {
        commitState.cleanupCommits();
        CommitManager.Commit memory nc = CommitManager.Commit(paramsHash, verificationHash, uint32(block.timestamp), false);
        require(commitState.commits.length < MAX_COMMIT_SIZE, "Too many");
        commitState.commits.push(hash);
        commitState.commitLocker[hash].push(nc);
    }

    function _forward(address payable dest) internal {
        if (address(forwardAddress) == address(this)) {
            emit ForwardAddressInvalid(dest);
            return;
        }
        if (forwardAddress != address(0)) {
            if (!_isRecoveryAddressSet() || dest != recoveryAddress) {
                emit ForwardAddressAlreadySet(dest);
                return;
            }
        }
        forwardAddress = dest;
        emit ForwardAddressUpdated(dest);
        if (!_isRecoveryAddressSet()) {
            _setRecoveryAddress(forwardAddress);
        }
        uint256 budget = spendingState.getRemainingAllowance();
        _transfer(forwardAddress, budget);
        TokenManager._recoverAllTokens(dest);
        for (uint32 i = 0; i < backlinkAddresses.length; i++) {
            try backlinkAddresses[i].reveal(AuthParams(new bytes32[](0), 0, bytes32(0)), OperationParams(Enums.OperationType.FORWARD, Enums.TokenType.NONE, address(0), 0, dest, 0, bytes(""))){
                emit BackLinkUpdated(dest, address(backlinkAddresses[i]));
            } catch Error(string memory reason){
                emit BackLinkUpdateError(dest, address(backlinkAddresses[i]), reason);
            } catch {
                emit BackLinkUpdateError(dest, address(backlinkAddresses[i]), "");
            }
        }
    }

    /// This function sends all remaining funds and tokens in the wallet to `recoveryAddress`. The caller should verify that `recoveryAddress` is not null.
    function _drain() internal returns (bool) {
        // this may be triggered after revealing the proof, and we must prevent revert in all cases
        (bool success,) = recoveryAddress.call{value : address(this).balance}("");
        if (success) {
            forwardAddress = recoveryAddress;
            TokenManager._recoverAllTokens(recoveryAddress);
        }
        return success;
    }

    function _transfer(address payable dest, uint256 amount) internal returns (bool) {
        bool canSpend = spendingState.canSpend(dest, amount);
        if (!canSpend) {
            return false;
        }
        spendingState.accountSpending(amount);
        (bool success, bytes memory ret) = dest.call{value : amount}("");
        // we do not want to revert the whole transaction if this operation fails, since EOTP is already revealed
        if (!success) {
            spendingState.spentAmount -= amount;
            emit TransferError(dest, ret);
            return false;
        }
        emit PaymentSent(amount, dest);
        return true;
    }

    function _recover() internal returns (bool){
        if (!_isRecoveryAddressSet()) {
            emit LastResortAddressNotSet();
            return false;
        }
        if (recoveryAddress == address(this)) {// this should not happen unless recoveryAddress is set at contract creation time, and is deliberately set to contract's own address
            // nothing needs to be done;
            return true;
        }
        if (!_drain()) {
            emit RecoveryFailure();
            return false;
        }
        return true;
    }

    function _overrideRecoveryAddress() internal {
        recoveryAddress = forwardAddress;
        emit RecoveryAddressUpdated(recoveryAddress);
    }

    function _setRecoveryAddress(address payable recoveryAddress_) internal {
        require(!_isRecoveryAddressSet(), "Already set");
        require(recoveryAddress_ != address(this), "Cannot be self");
        recoveryAddress = recoveryAddress_;
        emit RecoveryAddressUpdated(recoveryAddress);
    }

    function reveal(AuthParams calldata auth, OperationParams calldata op) external override {
        if (msg.sender != forwardAddress) {
            core.authenticate(oldCores, commitState, auth, op);
            lastOperationTime = block.timestamp;
        }
        _doReveal(auth, op);
    }

    function _doReveal(AuthParams calldata auth, OperationParams calldata op) internal {
        // No revert should occur below this point
        if (op.operationType == Enums.OperationType.TRACK) {
            if (op.data.length > 0) {
                TokenManager.tokenTrackerState.multiTrack(op.data);
            } else {
                TokenManager.tokenTrackerState.trackToken(op.tokenType, op.contractAddress, op.tokenId);
            }
        } else if (op.operationType == Enums.OperationType.UNTRACK) {
            if (op.data.length > 0) {
                TokenManager.tokenTrackerState.untrackToken(op.tokenType, op.contractAddress, op.tokenId);
            } else {
                TokenManager.tokenTrackerState.multiUntrack(op.data);
            }
        } else if (op.operationType == Enums.OperationType.TRANSFER_TOKEN) {
            TokenManager._transferToken(op.tokenType, op.contractAddress, op.tokenId, op.dest, op.amount, op.data);
        } else if (op.operationType == Enums.OperationType.OVERRIDE_TRACK) {
            TokenManager.tokenTrackerState.overrideTrackWithBytes(op.data);
        } else if (op.operationType == Enums.OperationType.TRANSFER) {
            _transfer(op.dest, op.amount);
        } else if (op.operationType == Enums.OperationType.RECOVER) {
            _recover();
        } else if (op.operationType == Enums.OperationType.SET_RECOVERY_ADDRESS) {
            _setRecoveryAddress(op.dest);
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
            TokenManager._recoverSelectedTokensEncoded(op.dest, op.data);
        } else if (op.operationType == Enums.OperationType.FORWARD) {
            _forward(op.dest);
        } else if (op.operationType == Enums.OperationType.COMMAND) {
            backlinkAddresses.command(op.tokenType, op.contractAddress, op.tokenId, op.dest, op.amount, op.data);
        } else if (op.operationType == Enums.OperationType.BACKLINK_ADD) {
            _backlinkAdd(op.data);
        } else if (op.operationType == Enums.OperationType.BACKLINK_DELETE) {
            _backlinkDelete(op.data);
        } else if (op.operationType == Enums.OperationType.BACKLINK_OVERRIDE) {
            _backlinkOverride(op.data);
        } else if (op.operationType == Enums.OperationType.SIGN) {
            signatures.authorizeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
        } else if (op.operationType == Enums.OperationType.REVOKE) {
            signatures.revokeHandler(op.contractAddress, op.tokenId, op.dest, op.amount);
        } else if (op.operationType == Enums.OperationType.CALL) {
            if (op.tokenId == 0) {
                _callContract(op.contractAddress, op.amount, op.data);
            } else {
                _multiCall(op.data);
            }
        } else if (op.operationType == Enums.OperationType.REPLACE) {
            _replaceCoreByBytes(op.data);
        }
    }

    function _isRecoveryAddressSet() internal view returns (bool) {
        return address(recoveryAddress) != address(0) && address(recoveryAddress) != ONE_WALLET_TREASURY;
    }

    function _backlinkAdd(bytes memory data) internal {
        address[] memory addresses = abi.decode(data, (address[]));
        backlinkAddresses.backlinkAdd(addresses);
    }

    function _backlinkDelete(bytes memory data) internal {
        address[] memory addresses = abi.decode(data, (address[]));
        backlinkAddresses.backlinkDelete(addresses);
    }

    function _backlinkOverride(bytes memory data) internal {
        address[] memory addresses = abi.decode(data, (address[]));
        backlinkAddresses.backlinkOverride(addresses);
    }

    function getBacklinks() external override view returns (IONEWallet[] memory){
        return backlinkAddresses;
    }

    function _transferDomain(IRegistrar reg, address resolver, bytes32 subnode, address payable dest) internal {
        try DomainManager.transferDomain(reg, resolver, subnode, dest){

        } catch Error(string memory reason){
            emit DomainManager.DomainTransferFailed(reason);
        } catch {
            emit DomainManager.DomainTransferFailed("");
        }
    }

    function _callContract(address contractAddress, uint256 amount, bytes memory encodedWithSignature) internal {
        bool canSpend = spendingState.canSpend(contractAddress, amount);
        if (!canSpend) {
            emit ExternalCallFailed(contractAddress, amount, encodedWithSignature, "");
            return;
        }
        spendingState.accountSpending(amount);
        (bool success, bytes memory ret) = contractAddress.call{value : amount}(encodedWithSignature);
        if (success) {
            emit ExternalCallCompleted(contractAddress, amount, encodedWithSignature, ret);
        } else {
            spendingState.spentAmount -= amount;
            emit ExternalCallFailed(contractAddress, amount, encodedWithSignature, ret);
        }
    }

    function _multiCall(bytes calldata data) internal {
        (address[] memory dest, uint256[] memory amounts, bytes[] memory encoded) = abi.decode(data, (address[], uint256[], bytes[]));
        uint256 totalAmount = 0;
        for (uint32 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        if (!spendingState.canSpend(address(0), totalAmount)) {
            return;
        }
        for (uint32 i = 0; i < dest.length; i++) {
            _callContract(dest[i], amounts[i], encoded[i]);
        }
    }

    function supportsInterface(bytes4 interfaceId) public override pure returns (bool) {
        return interfaceId == this.isValidSignature.selector || TokenManager.supportsInterface(interfaceId);
    }

    function isValidSignature(bytes32 hash, bytes calldata signatureBytes) override public view returns (bytes4){
        return signatures.isValidSignature(hash, signatureBytes);
    }

    function listSignatures(uint32 start, uint32 end) external override view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, uint32[] memory){
        return signatures.list(start, end);
    }

    function lookupSignature(bytes32 hash) external override view returns (bytes32, uint32, uint32){
        return signatures.lookup(hash);
    }

    function _replaceCoreByBytes(bytes memory data) internal {
        CoreSetting memory newCore = abi.decode(data, (CoreSetting));
        _replaceCore(newCore);
    }

    function _replaceCore(CoreSetting memory newCore) internal {
        // if recovery is already performed on this wallet, or the wallet is already upgrade to a new version, or set to forward to another address (hence is controlled by that address), its lifespan should not be extended
        require(forwardAddress == address(0));
        // we should not require the recovery address to approve this operation, since the ability of recovery address initiating an auto-triggered recovery (via sending 1.0 ONE) is unaffected after the root is replaced.
        CoreSetting memory oldCore = core;
        oldCores.push(oldCore);
        core.root = newCore.root;
        core.t0 = newCore.t0;
        core.height = newCore.height;
        core.interval = newCore.interval;
        core.lifespan = newCore.lifespan;
        core.maxOperationsPerInterval = newCore.maxOperationsPerInterval;
        emit CoreReplaced(oldCore, core);
    }
}
