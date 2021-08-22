// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./TokenManager.sol";
import "./DomainManager.sol";
import "./WalletGraph.sol";
import "./Enums.sol";
import "./IONEWallet.sol";

contract ONEWallet is TokenManager, IONEWallet {
    using TokenTracker for TokenTrackerState;
    using WalletGraph for IONEWallet[];
    /// Some variables can be immutable, but doing so would increase contract size. We are at threshold at the moment (~24KiB) so until we separate the contracts, we will do everything to minimize contract size
    bytes32 root; // Note: @ivan brought up a good point in reducing this to 16-bytes so hash of two consecutive nodes can be done in a single word (to save gas and reduce blockchain clutter). Let's not worry about that for now and re-evalaute this later.
    uint8 height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
    uint8 interval; // otp interval in seconds, default is 30
    uint32 t0; // starting time block (effectiveTime (in ms) / interval)
    uint32 lifespan;  // in number of block (e.g. 1 block per [interval] seconds)
    uint8  maxOperationsPerInterval; // number of transactions permitted per OTP interval. Each transaction shall have a unique nonce. The nonce is auto-incremented within each interval
    uint32 _numLeaves; // 2 ** (height - 1)

    /// global mutable variables
    address payable recoveryAddress; // where money will be sent during a recovery process (or when the wallet is beyond its lifespan)
    uint256 dailyLimit; // uint128 is sufficient, but uint256 is more efficient since EVM works with 32-byte words.
    uint256 spentToday; // note: instead of tracking the money spent for the last 24h, we are simply tracking money spent per 24h block based on UTC time. It is good enough for now, but we may want to change this later.
    uint32 lastTransferDay;
    uint256 lastOperationTime; // in seconds; record the time for the last successful reveal
    address payable forwardAddress; // a non-empty forward address assumes full control of this contract. A forward address can only be set upon a successful recovery or upgrade operation.
    IONEWallet[] backlinkAddresses; // to be set in next version - these are addresses forwarding funds and tokens to this contract AND must have their forwardAddress updated if this contract's forwardAddress is set or updated. One example of such an address is a previous version of the wallet "upgrading" to a new version. See more at https://github.com/polymorpher/one-wallet/issues/78

    /// nonce tracking
    mapping(uint32 => uint8) nonces; // keys: otp index (=timestamp in seconds / interval - t0); values: the expected nonce for that otp interval. An reveal with a nonce less than the expected value will be rejected
    uint32[] nonceTracker; // list of nonces keys that have a non-zero value. keys cannot possibly result a successful reveal (indices beyond REVEAL_MAX_DELAY old) are auto-deleted during a clean up procedure that is called every time the nonces are incremented for some key. For each deleted key, the corresponding key in nonces will also be deleted. So the size of nonceTracker and nonces are both bounded.

    // constants
    uint32 constant REVEAL_MAX_DELAY = 60;
    uint32 constant SECONDS_PER_DAY = 86400;
    uint256 constant AUTO_RECOVERY_TRIGGER_AMOUNT = 1 ether;
    uint32 constant MAX_COMMIT_SIZE = 120;
    uint256 constant AUTO_RECOVERY_MANDATORY_WAIT_TIME = 14 days;
    address constant ONE_WALLET_TREASURY = 0x02F2cF45DD4bAcbA091D78502Dba3B2F431a54D3;

    uint32 constant majorVersion = 0x9; // a change would require client to migrate
    uint32 constant minorVersion = 0x1; // a change would not require the client to migrate

    /// commit management
    struct Commit {
        bytes32 paramsHash;
        bytes32 verificationHash;
        uint32 timestamp;
        bool completed;
    }

    bytes32[] commits; // self-clean on commit (auto delete commits that are beyond REVEAL_MAX_DELAY), so it's bounded by the number of commits an attacker can spam within REVEAL_MAX_DELAY time in the worst case, which is not too bad.
    mapping(bytes32 => Commit[]) commitLocker;


    constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_, uint8 maxOperationsPerInterval_,
        address payable recoveryAddress_, uint256 dailyLimit_, IONEWallet[] memory backlinkAddresses_)
    {
        root = root_;
        height = height_;
        interval = interval_;
        t0 = t0_;
        lifespan = lifespan_;
        recoveryAddress = recoveryAddress_;
        dailyLimit = dailyLimit_;
        maxOperationsPerInterval = maxOperationsPerInterval_;
        _numLeaves = uint32(2 ** (height_ - 1));
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
        require(uint32(block.timestamp / interval) - t0 > lifespan, "Too early");
        require(_isRecoveryAddressSet(), "Recovery not set");
        require(_drain(), "Recovery failed");
        return true;
    }

    function getInfo() external override view returns (bytes32, uint8, uint8, uint32, uint32, uint8, address, uint256){
        return (root, height, interval, t0, lifespan, maxOperationsPerInterval, recoveryAddress, dailyLimit);
    }

    function getVersion() external override pure returns (uint32, uint32){
        return (majorVersion, minorVersion);
    }

    function getCurrentSpending() external override view returns (uint256, uint256){
        return (spentToday, lastTransferDay);
    }

    function getNonce() external override view returns (uint8){
        return nonces[uint32(block.timestamp) / interval - t0];
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
        uint32 numCommits = 0;
        for (uint32 i = 0; i < commits.length; i++) {
            Commit[] storage cc = commitLocker[commits[i]];
            numCommits += uint32(cc.length);
        }
        bytes32[] memory hashes = new bytes32[](numCommits);
        bytes32[] memory paramHashes = new bytes32[](numCommits);
        bytes32[] memory verificationHashes = new bytes32[](numCommits);
        uint32[] memory timestamps = new uint32[](numCommits);
        bool[] memory completed = new bool[](numCommits);
        uint32 index = 0;
        for (uint32 i = 0; i < commits.length; i++) {
            Commit[] storage cc = commitLocker[commits[i]];
            for (uint32 j = 0; j < cc.length; j++) {
                Commit storage c = cc[j];
                hashes[index] = commits[i];
                paramHashes[index] = c.paramsHash;
                verificationHashes[index] = c.verificationHash;
                timestamps[index] = c.timestamp;
                completed[index] = c.completed;
                index++;
            }
        }
        return (hashes, paramHashes, verificationHashes, timestamps, completed);
    }

    function findCommit(bytes32 /*hash*/) external override pure returns (bytes32, bytes32, uint32, bool){
        revert();
    }

    function lookupCommit(bytes32 hash) external override view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        Commit[] storage cc = commitLocker[hash];
        bytes32[] memory hashes = new bytes32[](cc.length);
        bytes32[] memory paramHashes = new bytes32[](cc.length);
        bytes32[] memory verificationHashes = new bytes32[](cc.length);
        uint32[] memory timestamps = new uint32[](cc.length);
        bool[] memory completed = new bool[](cc.length);
        for (uint32 i = 0; i < cc.length; i++) {
            Commit storage c = cc[i];
            hashes[i] = hash;
            paramHashes[i] = c.paramsHash;
            verificationHashes[i] = c.verificationHash;
            timestamps[i] = c.timestamp;
            completed[i] = c.completed;
        }
        return (hashes, paramHashes, verificationHashes, timestamps, completed);
    }

    function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external override {
        _cleanupCommits();
        Commit memory nc = Commit(paramsHash, verificationHash, uint32(block.timestamp), false);
        require(commits.length < MAX_COMMIT_SIZE, "Too many");
        commits.push(hash);
        commitLocker[hash].push(nc);
    }

    function _forward(address payable dest) internal {
        if (address(forwardAddress) == address(this)) {
            emit ForwardAddressInvalid(dest);
            return;
        }
        forwardAddress = dest;
        emit ForwardAddressUpdated(dest);
        if (!_isRecoveryAddressSet()) {
            _setRecoveryAddress(forwardAddress);
        }
        uint32 today = uint32(block.timestamp / SECONDS_PER_DAY);
        uint256 remainingAllowanceToday = today > lastTransferDay ? dailyLimit : dailyLimit - spentToday;
        if (remainingAllowanceToday > address(this).balance) {
            remainingAllowanceToday = address(this).balance;
        }
        _transfer(forwardAddress, remainingAllowanceToday);
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
        uint32 day = uint32(block.timestamp / SECONDS_PER_DAY);
        if (day > lastTransferDay) {
            spentToday = 0;
            lastTransferDay = day;
        }
        if (spentToday + amount > dailyLimit) {
            emit ExceedDailyLimit(amount, dailyLimit, spentToday, dest);
            return false;
        }
        if (address(this).balance < amount) {
            emit InsufficientFund(amount, address(this).balance, dest);
            return false;
        }
        spentToday += amount;
        (bool success,) = dest.call{value : amount}("");
        // we do not want to revert the whole transaction if this operation fails, since EOTP is already revealed
        if (!success) {
            spentToday -= amount;
            // TODO: decode error string from returned value of .call{...}("")
            emit UnknownTransferError(dest);
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

    function _command(OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data) internal {
        (address backlink, bytes memory commandData) = abi.decode(data, (address, bytes));
        uint32 position = backlinkAddresses.findBacklink(backlink);
        if (position == backlinkAddresses.length) {
            emit WalletGraph.CommandFailed(backlink, "Not linked", commandData);
            return;
        }
        try IONEWallet(backlink).reveal(new bytes32[](0), 0, bytes32(0), operationType, tokenType, contractAddress, tokenId, dest, amount, commandData){
            emit WalletGraph.CommandDispatched(backlink, commandData);
        }catch Error(string memory reason){
            emit WalletGraph.CommandFailed(backlink, reason, commandData);
        }catch {
            emit WalletGraph.CommandFailed(backlink, "", commandData);
        }
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
            _isCorrectProof(neighbors, indexWithNonce, eotp);
            if (indexWithNonce == _numLeaves - 1) {
                require(operationType == OperationType.RECOVER, "Reserved");
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
            WalletGraph.reclaimDomainFromBacklink(backlinkAddresses, amount, contractAddress, dest, uint8(tokenId), string(data));
        } else if (operationType == OperationType.RECOVER_SELECTED_TOKENS) {
            TokenManager._recoverSelectedTokensEncoded(dest, data);
        } else if (operationType == OperationType.FORWARD) {
            _forward(dest);
        } else if (operationType == OperationType.COMMAND) {
            _command(operationType, tokenType, contractAddress, tokenId, dest, amount, data);
        } else if (operationType == OperationType.BACKLINK_ADD) {
            _backlinkAdd(data);
        } else if (operationType == OperationType.BACKLINK_DELETE) {
            _backlinkDelete(data);
        } else if (operationType == OperationType.BACKLINK_OVERRIDE) {
            _backlinkOverride(data);
        }
    }

    /// This is just a wrapper around a modifier previously called `isCorrectProof`, to avoid "Stack too deep" error. Duh.
    function _isCorrectProof(bytes32[] calldata neighbors, uint32 position, bytes32 eotp) view internal {
        require(neighbors.length == height - 1, "Bad neighbors");
        bytes32 h = sha256(bytes.concat(eotp));
        if (position == _numLeaves - 1) {
            // special case: recover only
            h = eotp;
        }
        for (uint8 i = 0; i < height - 1; i++) {
            if ((position & 0x01) == 0x01) {
                h = sha256(bytes.concat(neighbors[i], h));
            } else {
                h = sha256(bytes.concat(h, neighbors[i]));
            }
            position >>= 1;
        }
        require(root == h, "Proof is incorrect");
        return;
    }

    /// Remove old commits from storage, where the commit's timestamp is older than block.timestamp - REVEAL_MAX_DELAY. The purpose is to remove dangling data from blockchain, and prevent commits grow unbounded. This is executed at commit time. The committer pays for the gas of this cleanup. Therefore, any attacker who intend to spam commits would be disincentivized. The attacker would not succeed in preventing any normal operation by the user.
    function _cleanupCommits() internal {
        uint32 timelyIndex = 0;
        uint32 bt = uint32(block.timestamp);
        // go through past commits chronologically, starting from the oldest, and find the first commit that is not older than block.timestamp - REVEAL_MAX_DELAY.
        for (; timelyIndex < commits.length; timelyIndex++) {
            bytes32 hash = commits[timelyIndex];
            Commit[] storage cc = commitLocker[hash];
            // We may skip because the commit is already cleaned up and is considered "untimely".
            if (cc.length == 0) {
                continue;
            }
            // We take the first entry in `cc` as the timestamp for all commits under commit hash `hash`, because the first entry represents the oldest commit and only commit if an attacker is not attacking this wallet. If an attacker is front-running commits, the first entry may be from the attacker, but its timestamp should be identical to the user's commit (or close enough to the user's commit, if network is a bit congested)
            Commit storage c = cc[0];
        unchecked {
            if (c.timestamp >= bt - REVEAL_MAX_DELAY) {
                break;
            }
        }
        }
        // Now `timelyIndex` holds the index of the first commit that is timely. All commits at an index less than `timelyIndex` must be deleted;
        if (timelyIndex == 0) {
            // no commit is older than block.timestamp - REVEAL_MAX_DELAY. Nothing needs to be cleaned up
            return;
        }
        // Delete Commit instances for commits that are are older than block.timestamp - REVEAL_MAX_DELAY
        for (uint32 i = 0; i < timelyIndex; i++) {
            bytes32 hash = commits[i];
            Commit[] storage cc = commitLocker[hash];
            for (uint32 j = 0; j < cc.length; j++) {
                delete cc[j];
            }
            delete commitLocker[hash];
        }
        // Shift all commit hashes up by `timelyIndex` positions, and discard `commitIndex` number of hashes at the end of the array
        // This process erases old commits
        uint32 len = uint32(commits.length);
        for (uint32 i = timelyIndex; i < len; i++) {
        unchecked{
            commits[i - timelyIndex] = commits[i];
        }
        }
        for (uint32 i = 0; i < timelyIndex; i++) {
            commits.pop();
        }
        // TODO (@polymorpher): upgrade the above code after solidity implements proper support for struct-array memory-storage copy operation.
    }

    /// This function verifies that the first valid entry with respect to the given `eotp` in `commitLocker[hash]` matches the provided `paramsHash` and `verificationHash`. An entry is valid with respect to `eotp` iff `h3(entry.paramsHash . eotp)` equals `entry.verificationHash`
    function _verifyReveal(bytes32 hash, uint32 indexWithNonce, bytes32 paramsHash, bytes32 eotp, OperationType operationType) view internal returns (uint32)
    {
        uint32 index = indexWithNonce / maxOperationsPerInterval;
        uint8 nonce = uint8(indexWithNonce % maxOperationsPerInterval);
        Commit[] storage cc = commitLocker[hash];
        require(cc.length > 0, "No commit found");
        for (uint32 i = 0; i < cc.length; i++) {
            Commit storage c = cc[i];
            bytes32 expectedVerificationHash = keccak256(bytes.concat(c.paramsHash, eotp));
            if (c.verificationHash != expectedVerificationHash) {
                // Invalid entry. Ignore
                continue;
            }
            require(c.paramsHash == paramsHash, "Param mismatch");
            if (operationType != OperationType.RECOVER) {
                uint32 counter = c.timestamp / interval - t0;
                require(counter == index, "Time mismatch");
                uint8 expectedNonce = nonces[counter];
                require(nonce >= expectedNonce, "Nonce too low");
            }
            require(!c.completed, "Commit already done");
            // This normally should not happen, but when the network is congested (regardless of whether due to an attacker's malicious acts or not), the legitimate reveal may become untimely. This may happen before the old commit is cleaned up by another fresh commit. We enforce this restriction so that the attacker would not have a lot of time to reverse-engineer a single EOTP or leaf using an old commit.
            require(uint32(block.timestamp) - c.timestamp < REVEAL_MAX_DELAY, "Too late");
            return i;
        }
        revert("No commit");
    }

    function _completeReveal(bytes32 commitHash, uint32 commitIndex, OperationType operationType) internal {
        Commit[] storage cc = commitLocker[commitHash];
        assert(cc.length > 0);
        assert(cc.length > commitIndex);
        Commit storage c = cc[commitIndex];
        assert(c.timestamp > 0);
        if (operationType != OperationType.RECOVER) {
            uint32 index = uint32(c.timestamp) / interval - t0;
            _incrementNonce(index);
            _cleanupNonces();
        }
        c.completed = true;
        lastOperationTime = block.timestamp;
    }

    /// This function removes all tracked nonce values correspond to interval blocks that are older than block.timestamp - REVEAL_MAX_DELAY. In doing so, extraneous data in the blockchain is removed, and both nonces and nonceTracker are bounded in size.
    function _cleanupNonces() internal {
        uint32 tMin = uint32(block.timestamp) - REVEAL_MAX_DELAY;
        uint32 indexMinUnadjusted = tMin / interval;
        uint32 indexMin = 0;
        if (indexMinUnadjusted > t0) {
            indexMin = indexMinUnadjusted - t0;
        }
        uint32[] memory nonZeroNonces = new uint32[](nonceTracker.length);
        uint32 numValidIndices = 0;
        for (uint8 i = 0; i < nonceTracker.length; i++) {
            uint32 index = nonceTracker[i];
            if (index < indexMin) {
                delete nonces[index];
            } else {
                nonZeroNonces[numValidIndices] = index;
            unchecked {
                numValidIndices++;
            }
            }
        }
        // TODO (@polymorpher): This can be later made more efficient by inline assembly. https://ethereum.stackexchange.com/questions/51891/how-to-pop-from-decrease-the-length-of-a-memory-array-in-solidity
        uint32[] memory reducedArray = new uint32[](numValidIndices);
        for (uint8 i = 0; i < numValidIndices; i++) {
            reducedArray[i] = nonZeroNonces[i];
        }
        nonceTracker = reducedArray;
    }

    function _incrementNonce(uint32 index) internal {
        uint8 v = nonces[index];
        if (v == 0) {
            nonceTracker.push(index);
        }
    unchecked{
        nonces[index] = v + 1;
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
}
