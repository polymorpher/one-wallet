// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./SpendingManager.sol";
import "./CommitManager.sol";
import "./TokenManager.sol";
import "./DomainManager.sol";
import "./SignatureManager.sol";
import "./WalletGraph.sol";
import "./Enums.sol";
import "./IONEWallet.sol";

contract ONEWallet is TokenManager, IONEWallet {
    using TokenTracker for TokenTracker.TokenTrackerState;
    using WalletGraph for IONEWallet[];
    using SignatureManager for SignatureManager.SignatureTracker;
    using SpendingManager for SpendingManager.SpendingState;
    using CommitManager for CommitManager.CommitState;

    CoreSetting core;
    CoreSetting[] public oldCores;
    uint32 _numLeaves; // 2 ** (height - 1)

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
        _numLeaves = uint32(2 ** (core_.height - 1));
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

    function getTrackedTokens() external override view returns (TokenType[] memory, address[] memory, uint256[] memory){
        return TokenManager._getTrackedTokens();
    }

    function getBalance(TokenType tokenType, address contractAddress, uint256 tokenId) external override view returns (uint256){
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
            try backlinkAddresses[i].reveal(new bytes32[](0), 0, bytes32(0), OperationType.FORWARD, TokenType.NONE, address(0), 0, dest, 0, bytes("")){
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

    /// Provides commitHash, paramsHash, and verificationHash given the parameters
    function _getRevealHash(bytes32 neighbor, uint32 indexWithNonce, bytes32 eotp,
        OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes calldata data) pure internal returns (bytes32, bytes32) {
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


    function reveal(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp,
        OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data)
    external override {
        if (msg.sender != forwardAddress) {
            if (operationType == OperationType.RECOVER) {
                _isCorrectRecoveryProof(neighbors, indexWithNonce, eotp);
            } else {
                _isNonRecoveryLeaf(indexWithNonce);
                _isCorrectProof(neighbors, indexWithNonce, eotp);
            }
            (bytes32 commitHash, bytes32 paramsHash) = _getRevealHash(neighbors[0], indexWithNonce, eotp,
                operationType, tokenType, contractAddress, tokenId, dest, amount, data);
            uint32 commitIndex = _verifyReveal(commitHash, indexWithNonce, paramsHash, eotp, operationType);
            _completeReveal(commitHash, commitIndex, operationType);
        }
        // No revert should occur below this point
        if (operationType == OperationType.TRACK) {
            if (data.length > 0) {
                TokenManager.tokenTrackerState.multiTrack(data);
            } else {
                TokenManager.tokenTrackerState.trackToken(tokenType, contractAddress, tokenId);
            }
        } else if (operationType == OperationType.UNTRACK) {
            if (data.length > 0) {
                TokenManager.tokenTrackerState.untrackToken(tokenType, contractAddress, tokenId);
            } else {
                TokenManager.tokenTrackerState.multiUntrack(data);
            }
        } else if (operationType == OperationType.TRANSFER_TOKEN) {
            TokenManager._transferToken(tokenType, contractAddress, tokenId, dest, amount, data);
        } else if (operationType == OperationType.OVERRIDE_TRACK) {
            TokenManager.tokenTrackerState.overrideTrackWithBytes(data);
        } else if (operationType == OperationType.TRANSFER) {
            _transfer(dest, amount);
        } else if (operationType == OperationType.RECOVER) {
            _recover();
        } else if (operationType == OperationType.SET_RECOVERY_ADDRESS) {
            _setRecoveryAddress(dest);
        } else if (operationType == OperationType.BUY_DOMAIN) {
            DomainManager.buyDomainEncoded(data, amount, uint8(tokenId), contractAddress, dest);
        } else if (operationType == OperationType.TRANSFER_DOMAIN) {
            _transferDomain(IRegistrar(contractAddress), address(bytes20(bytes32(tokenId))), bytes32(amount), dest);
        } else if (operationType == OperationType.RENEW_DOMAIN) {
            DomainManager.renewDomain(IRegistrar(contractAddress), bytes32(tokenId), string(data), amount);
        } else if (operationType == OperationType.RECLAIM_REVERSE_DOMAIN) {
            DomainManager.reclaimReverseDomain(contractAddress, string(data));
        } else if (operationType == OperationType.RECLAIM_DOMAIN_FROM_BACKLINK) {
            backlinkAddresses.reclaimDomainFromBacklink(uint32(amount), IRegistrar(contractAddress), IReverseRegistrar(dest), data);
        } else if (operationType == OperationType.RECOVER_SELECTED_TOKENS) {
            TokenManager._recoverSelectedTokensEncoded(dest, data);
        } else if (operationType == OperationType.FORWARD) {
            _forward(dest);
        } else if (operationType == OperationType.COMMAND) {
            backlinkAddresses.command(tokenType, contractAddress, tokenId, dest, amount, data);
        } else if (operationType == OperationType.BACKLINK_ADD) {
            _backlinkAdd(data);
        } else if (operationType == OperationType.BACKLINK_DELETE) {
            _backlinkDelete(data);
        } else if (operationType == OperationType.BACKLINK_OVERRIDE) {
            _backlinkOverride(data);
        } else if (operationType == OperationType.SIGN) {
            signatures.authorizeHandler(contractAddress, tokenId, dest, amount);
        } else if (operationType == OperationType.REVOKE) {
            signatures.revokeHandler(contractAddress, tokenId, dest, amount);
        } else if (operationType == OperationType.CALL) {
            if (tokenId == 0) {
                _callContract(contractAddress, amount, data);
            } else {
                _multiCall(data);
            }
        } else if (operationType == OperationType.REPLACE) {
            _replaceCoreBytes(data);
        }
    }

    /// This is just a wrapper around a modifier previously called `isCorrectProof`, to avoid "Stack too deep" error. Duh.
    function _isCorrectProof(bytes32[] calldata neighbors, uint32 position, bytes32 eotp) view internal {
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

    /// check the current position is not used by *any* core as a recovery slot
    function _isNonRecoveryLeaf(uint32 position) view internal {
        require(position != _numLeaves - 1, "reserved");
        require(position < _numLeaves - 1, "out of bound");
        for (uint8 i = 0; i < oldCores.length; i++) {
            uint32 recoveryPosition = oldCores[i].t0 + uint32(2 ** (oldCores[i].height - 1)) - 1;
            require(core.t0 + position != recoveryPosition, "reserved before");
        }
    }

    /// WARNING: Clients should not use eotps that *may* be used for recovery. The time slots should be manually excluded for use.
    function _isCorrectRecoveryProof(bytes32[] calldata neighbors, uint32 position, bytes32 eotp) view internal {
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
            require(position == _numLeaves - 1, "Must use last leaf");
            return;
        }
        // check old cores
        for (uint8 i = 0; i < oldCores.length; i++) {
            if (oldCores[i].root == h) {
                require(neighbors.length == oldCores[i].height - 1, "Mismatched neighbors size");
                require(position == uint32(2 ** (oldCores[i].height - 1)) - 1, "Must use last leaf in old tree");
                return;
            }
        }
        revert("Recovery proof is incorrect");
    }



    /// This function verifies that the first valid entry with respect to the given `eotp` in `commitState.commitLocker[hash]` matches the provided `paramsHash` and `verificationHash`. An entry is valid with respect to `eotp` iff `h3(entry.paramsHash . eotp)` equals `entry.verificationHash`. It returns the index of first valid entry in the array of commits, with respect to the commit hash
    function _verifyReveal(bytes32 hash, uint32 indexWithNonce, bytes32 paramsHash, bytes32 eotp, OperationType operationType) view internal returns (uint32)
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
            if (operationType != OperationType.RECOVER) {
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

    function _completeReveal(bytes32 commitHash, uint32 commitIndex, OperationType operationType) internal {
        CommitManager.Commit[] storage cc = commitState.commitLocker[commitHash];
        assert(cc.length > 0);
        assert(cc.length > commitIndex);
        CommitManager.Commit storage c = cc[commitIndex];
        assert(c.timestamp > 0);
        if (operationType != OperationType.RECOVER) {
            uint32 index = uint32(c.timestamp) / core.interval;
            commitState.incrementNonce(index);
            commitState.cleanupNonces(core.interval);
        }
        c.completed = true;
        lastOperationTime = block.timestamp;
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
        if (signatureBytes.length < 32) {
            return 0xffffffff;
        }
        if (signatureBytes.length > 32) {
            for (uint32 i = 32; i < signatureBytes.length; i++) {
                if (signatureBytes[i] != 0x00) {
                    return 0xffffffff;
                }
            }
        }
        (bytes32 signature) = abi.decode(signatureBytes[0 : 32], (bytes32));
        if (!signatures.validate(hash, signature)) {
            return 0xffffffff;
        }
        // magic value for valid signature, eip-1271
        return 0x1626ba7e;
    }

    function listSignatures(uint32 start, uint32 end) external override view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, uint32[] memory){
        return signatures.list(start, end);
    }

    function lookupSignature(bytes32 hash) external override view returns (bytes32, uint32, uint32){
        return signatures.lookup(hash);
    }

    function _replaceCoreBytes(bytes memory data) internal {
        CoreSetting memory core = abi.decode(data, (CoreSetting));
        _replaceCore(core);
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
