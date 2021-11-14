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
import "./AbstractONEWallet.sol";
import "./CoreManager.sol";
import "./Executor.sol";

contract ONEWallet is TokenManager, AbstractONEWallet {
    using TokenTracker for TokenTracker.TokenTrackerState;
    using WalletGraph for IONEWallet[];
    using SignatureManager for SignatureManager.SignatureTracker;
    using SpendingManager for SpendingManager.SpendingState;
    using CommitManager for CommitManager.CommitState;
    using Reveal for CoreSetting;

    CoreSetting core;
    CoreSetting[] oldCores;
    CoreSetting[] recoveryCores;

    /// global mutable variables
    address payable recoveryAddress; // where money will be sent during a recovery process (or when the wallet is beyond its lifespan)
    bytes32 public override identificationHash;

    SpendingManager.SpendingState spendingState;

    uint256 public override lastOperationTime; // in seconds; record the time for the last successful reveal
    address payable forwardAddress; // a non-empty forward address assumes full control of this contract. A forward address can only be set upon a successful recovery or upgrade operation.
    IONEWallet[] backlinkAddresses; // to be set in next version - these are addresses forwarding funds and tokens to this contract AND must have their forwardAddress updated if this contract's forwardAddress is set or updated. One example of such an address is a previous version of the wallet "upgrading" to a new version. See more at https://github.com/polymorpher/one-wallet/issues/78

    // constants
    uint256 constant AUTO_RECOVERY_TRIGGER_AMOUNT = 1 ether;
    uint256 constant AUTO_RECOVERY_MANDATORY_WAIT_TIME = 14 days;
    address constant ONE_WALLET_TREASURY = 0x7534978F9fa903150eD429C486D1f42B7fDB7a61;

    uint32 constant majorVersion = 0xf; // a change would require client to migrate
    uint32 constant minorVersion = 0x1; // a change would not require the client to migrate

    /// commit management
    CommitManager.CommitState commitState;
    SignatureManager.SignatureTracker signatures;

    bool initialized = false;

    function initialize(InitParams memory initParams) override external
    {
        require(!initialized);
        for (uint32 i = 0; i < initParams.oldCores.length; i++) {
            oldCores.push(initParams.oldCores[i]);
        }
        for (uint32 i = 0; i < initParams.recoveryCores.length; i++) {
            recoveryCores.push(initParams.recoveryCores[i]);
        }
        core = initParams.core;
        spendingState = initParams.spendingState;
        recoveryAddress = initParams.recoveryAddress;
        backlinkAddresses = initParams.backlinkAddresses;
        identificationHash = initParams.identificationHash;
        initialized = true;
    }

    function _getForwardAddress() internal override view returns (address payable){
        return forwardAddress;
    }

    function getForwardAddress() external override view returns (address payable){
        return forwardAddress;
    }

    function _forwardPayment() internal {
        (bool success,) = forwardAddress.call{value : msg.value}("");
        require(success);
        emit PaymentForwarded(msg.value, msg.sender);
    }

    receive() external payable {
        require(initialized);
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
        require(uint32(block.timestamp / core.interval) - core.t0 > core.lifespan);
        require(_isRecoveryAddressSet());
        require(_drain());
        emit Retired();
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

    function getCurrentSpendingState() external override view returns (uint256, uint256, uint32, uint32){
        return spendingState.getState();
    }

    function getNonce() external override view returns (uint8){
        return commitState.getNonce(core.interval);
    }

    function getTrackedTokens() external override view returns (Enums.TokenType[] memory, address[] memory, uint256[] memory){
        return tokenTrackerState.getTrackedTokens();
    }

    function getBalance(Enums.TokenType tokenType, address contractAddress, uint256 tokenId) external override view returns (uint256){
        (uint256 balance, bool success, string memory reason) = TokenTracker.getBalance(tokenType, contractAddress, tokenId);
        require(success, reason);
        return balance;
    }

    function getAllCommits() external override view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        return commitState.getAllCommits();
    }


    function lookupCommit(bytes32 hash) external override view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        return commitState.lookupCommit(hash);
    }

    function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external override {
        require(initialized);
        commitState.commit(hash, paramsHash, verificationHash);
    }

    /// require approval using recovery cores, unless recovery address is set
    function _forward(address payable dest) internal {
        if (address(forwardAddress) == address(this) || dest == address(0)) {
            emit ForwardAddressInvalid(dest);
            return;
        }
        // TODO: in the next version, add a flag in the parameter indicating whether the operation is from the forwardAddress. If the flag is set, skip the check below
        //        if (forwardAddress != address(0)) {
        //            if (!_isRecoveryAddressSet() || dest != recoveryAddress) {
        //                emit ForwardAddressAlreadySet(dest);
        //                return;
        //            }
        //        }
        forwardAddress = dest;
        emit ForwardAddressUpdated(dest);
        if (!_isRecoveryAddressSet()) {
            // since approval is gained from recovery cores, we can transfer all assets without violating the principal that no operation should spend more than what is specified in spend limit
            _setRecoveryAddress(forwardAddress);
            bool drainSuccess = _drain();
            emit ForwardedBalance(drainSuccess);
        } else {
            uint256 budget = spendingState.getRemainingAllowance();
            _transfer(forwardAddress, budget);
            tokenTrackerState.recoverAllTokens(dest);
        }
        backlinkAddresses.batchUpdateForwardAddress(dest);
    }

    /// This function sends all remaining funds and tokens in the wallet to `recoveryAddress`. The caller should verify that `recoveryAddress` is not null.
    function _drain() internal returns (bool) {
        // this may be triggered after revealing the proof, and we must prevent revert in all cases
        (bool success,) = recoveryAddress.call{value : address(this).balance}("");
        if (success) {
            forwardAddress = recoveryAddress;
            tokenTrackerState.recoverAllTokens(recoveryAddress);
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

    /// To initiate recovery, client should submit leaf_{-1} as eotp, where leaf_{-1} is the last leaf in OTP Merkle Tree. Note that leaf_0 = hasher(hseed . nonce . OTP . randomness) where hasher is either sha256 or argon2, depending on client's security parameters. The definition of leaf_{-1} ensures attackers cannot use widespread miners to brute-force for seed or hseed, even if keccak256(leaf_{i}) for any i is known. It has been considered that leaf_0 should be used instead of leaf_{-1}, because leaf_0 is extremely unlikely to be used for any wallet operation. It is only used if the user performs any operation within the first 60 seconds of seed generation (when QR code is displayed). Regardless of which leaf is used to trigger recovery, this mechanism ensures hseed remains secret at the client. Even when the leaf becomes public (on blockchain), it is no longer useful because the wallet would already be deprecated (all assets transferred out). It can be used to repeatedly trigger recovery on this deprecated wallet, but that would cause no harm.
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
        emit RecoveryTriggered();
        return true;
    }

    function _overrideRecoveryAddress() internal {
        recoveryAddress = forwardAddress;
        emit RecoveryAddressUpdated(recoveryAddress);
    }

    function _setRecoveryAddress(address payable recoveryAddress_) internal {
        if (_isRecoveryAddressSet() || recoveryAddress_ == address(this)) {
            emit RecoveryAddressUpdated(address(0));
            return;
        }
        recoveryAddress = recoveryAddress_;
        emit RecoveryAddressUpdated(recoveryAddress);
    }

    function _batch(bytes memory data) internal {
        OperationParams[] memory batchParams = abi.decode(data, (OperationParams[]));
        uint8 len = uint8(batchParams.length);
        for (uint32 i = 0; i < len; i++) {
            _execute(batchParams[i]);
        }
    }

    function reveal(AuthParams calldata auth, OperationParams calldata op) external override {
        require(initialized);
        if (msg.sender != forwardAddress) {
            core.authenticate(oldCores, commitState, auth, op);
            lastOperationTime = block.timestamp;
        }
        _execute(op);
    }

    function _execute(OperationParams memory op) internal {
        // No revert should occur below this point
        if (op.operationType == Enums.OperationType.TRANSFER) {
            _transfer(op.dest, op.amount);
        } else if (op.operationType == Enums.OperationType.RECOVER) {
            _recover();
        } else if (op.operationType == Enums.OperationType.SET_RECOVERY_ADDRESS) {
            _setRecoveryAddress(op.dest);
        } else if (op.operationType == Enums.OperationType.FORWARD) {
            _forward(op.dest);
        } else if (op.operationType == Enums.OperationType.CALL) {
            if (op.tokenId == 0) {
                _callContract(op.contractAddress, op.amount, op.data);
            } else {
                _multiCall(op.data);
            }
        } else if (op.operationType == Enums.OperationType.DISPLACE) {
            CoreManager.displaceCoreWithValidationByBytes(oldCores, core, op.data, forwardAddress);
        } else if (op.operationType == Enums.OperationType.BATCH) {
            _batch(op.data);
        } else {
            Executor.execute(op, tokenTrackerState, backlinkAddresses, signatures);
        }
    }

    function _isRecoveryAddressSet() internal view returns (bool) {
        return address(recoveryAddress) != address(0) && address(recoveryAddress) != ONE_WALLET_TREASURY;
    }

    function getBacklinks() external override view returns (IONEWallet[] memory){
        return backlinkAddresses;
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

    function _multiCall(bytes memory data) internal {
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

    function isValidSignature(bytes32 hash, bytes memory signatureBytes) override public view returns (bytes4){
        return signatures.isValidSignature(hash, signatureBytes);
    }

    function listSignatures(uint32 start, uint32 end) external override view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, uint32[] memory){
        return signatures.list(start, end);
    }

    function lookupSignature(bytes32 hash) external override view returns (bytes32, uint32, uint32){
        return signatures.lookup(hash);
    }

}
