// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ONEWallet is IERC721Receiver, IERC1155Receiver {
    event InsufficientFund(uint256 amount, uint256 balance, address dest);
    event ExceedDailyLimit(uint256 amount, uint256 limit, uint256 current, address dest);
    event UnknownTransferError(address dest);
    event LastResortAddressNotSet();
    event PaymentReceived(uint256 amount, address from);
    event PaymentSent(uint256 amount, address dest);
    event AutoRecoveryTriggered(address from);
    event RecoveryFailure();

    /// In future versions, it is planned that we may allow the user to extend the wallet's life through a function call. When that is implemented, the following variables may no longer be immutable, with the exception of root which shall serve as an identifier of the wallet
    bytes32 immutable root; // Note: @ivan brought up a good point in reducing this to 16-bytes so hash of two consecutive nodes can be done in a single word (to save gas and reduce blockchain clutter). Let's not worry about that for now and re-evalaute this later.
    uint8 immutable height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
    uint8 immutable interval; // otp interval in seconds, default is 30
    uint32 immutable t0; // starting time block (effectiveTime (in ms) / interval)
    uint32 immutable lifespan;  // in number of block (e.g. 1 block per [interval] seconds)
    uint8 immutable maxOperationsPerInterval; // number of transactions permitted per OTP interval. Each transaction shall have a unique nonce. The nonce is auto-incremented within each interval

    /// global mutable variables
    address payable lastResortAddress; // where money will be sent during a recovery process (or when the wallet is beyond its lifespan)
    uint256 dailyLimit; // uint128 is sufficient, but uint256 is more efficient since EVM works with 32-byte words.
    uint256 spentToday; // note: instead of tracking the money spent for the last 24h, we are simply tracking money spent per 24h block based on UTC time. It is good enough for now, but we may want to change this later.
    uint32 lastTransferDay;

    /// nonce tracking
    mapping(uint32 => uint8) nonces; // keys: otp index (=timestamp in seconds / interval - t0); values: the expected nonce for that otp interval. An reveal with a nonce less than the expected value will be rejected
    uint32[] nonceTracker; // list of nonces keys that have a non-zero value. keys cannot possibly result a successful reveal (indices beyond REVEAL_MAX_DELAY old) are auto-deleted during a clean up procedure that is called every time the nonces are incremented for some key. For each deleted key, the corresponding key in nonces will also be deleted. So the size of nonceTracker and nonces are both bounded.

    // constants
    uint32 constant REVEAL_MAX_DELAY = 60;
    uint32 constant SECONDS_PER_DAY = 86400;
    uint256 constant AUTO_RECOVERY_TRIGGER_AMOUNT = 1 ether;
    uint32 constant MAX_COMMIT_SIZE = 120;

    uint32 constant majorVersion = 0x6; // a change would require client to migrate
    uint32 constant minorVersion = 0x1; // a change would not require the client to migrate

    enum OperationType {
        TRACK, UNTRACK, TRANSFER_TOKEN, OVERRIDE_TRACK, TRANSFER, SET_RECOVERY_ADDRESS, RECOVER
    }
    /// commit management
    struct Commit {
        bytes32 hash;
        bytes32 paramsHash;
        uint32 timestamp;
        bool completed;
    }

    bytes32[] commits; // self-clean on commit (auto delete commits that are beyond REVEAL_MAX_DELAY), so it's bounded by the number of commits an attacker can spam within REVEAL_MAX_DELAY time in the worst case, which is not too bad.
    mapping(bytes32 => Commit) commitLocker;



    /// token tracking
    enum TokenType{
        ERC20, ERC721, ERC1155
    }
    event ReceivedToken(TokenType tokenType, uint256 amount, address from, address tokenContract, address operator, uint256 tokenId, bytes data);
    event TokenTracked(TokenType tokenType, address contractAddress, uint256 tokenId);
    event TokenUntracked(TokenType tokenType, address contractAddress, uint256 tokenId);
    event TokenNotFound(TokenType tokenType, address contractAddress, uint256 tokenId);
    event TokenTransferFailed(TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount);
    event TokenTransferError(TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, string reason);
    event TokenTransferSucceeded(TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount);

    // We track tokens in the contract instead of at the client so users can immediately get a record of what tokens they own when they restore their wallet at a new client
    // The tracking of ERC721 and ERC1155 are automatically established upon a token is transferred to this wallet. The tracking of ERC20 needs to be manually established by the client.
    // The gas cost of tracking and untracking operations are of constant complexity. The gas cost is paid by the transferer in the case of automatically established tracking, and paid by the user in the case of manual tracking.
    struct TrackedToken {
        TokenType tokenType;
        address contractAddress;
        uint256 tokenId; // only valid for ERC721 and ERC1155
    }

    mapping(bytes32 => uint256[]) trackedTokenPositions; // keccak256(bytes.concat(byte32(uint(tokenType)), bytes32(contractAddress), bytes32(tokenId)) => positions in trackedTokens. Positions should be of length 1 except in very rare occasion of collision
    TrackedToken[] trackedTokens;

    constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_, uint8 maxOperationsPerInterval_,
        address payable lastResortAddress_, uint256 dailyLimit_)
    {
        root = root_;
        height = height_;
        interval = interval_;
        t0 = t0_;
        lifespan = lifespan_;
        lastResortAddress = lastResortAddress_;
        dailyLimit = dailyLimit_;
        maxOperationsPerInterval = maxOperationsPerInterval_;
    }

    receive() external payable {
        emit PaymentReceived(msg.value, msg.sender);
        if (msg.value != AUTO_RECOVERY_TRIGGER_AMOUNT) {
            return;
        }
        if (msg.sender != lastResortAddress) {
            return;
        }
        if (lastResortAddress == address(0)) {
            return;
        }
        if (msg.sender == address(this)) {
            return;
        }
        emit AutoRecoveryTriggered(msg.sender);
        require(_drain());
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4){
        emit ReceivedToken(TokenType.ERC1155, value, from, msg.sender, operator, id, data);
        _trackToken(TokenType.ERC1155, msg.sender, id);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address operator, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external override returns (bytes4){
        for (uint32 i = 0; i < ids.length; i++) {
            this.onERC1155Received(operator, from, ids[i], values[i], data);
        }
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceID) external override pure returns (bool) {
        return interfaceID == this.supportsInterface.selector ||
        interfaceID == this.onERC1155Received.selector ||
        interfaceID == this.onERC721Received.selector;
    }

    // identical to ERC1155, except tracked only on ERC721 related data structures
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external override returns (bytes4){
        emit ReceivedToken(TokenType.ERC721, 1, from, msg.sender, operator, tokenId, data);
        _trackToken(TokenType.ERC721, msg.sender, tokenId);
        return this.onERC721Received.selector;
    }

    function getTrackedTokens() external view returns (TokenType[] memory, address[] memory, uint256[] memory){
        TokenType[] memory tokenTypes = new TokenType[](trackedTokens.length);
        address[] memory contractAddresses = new address[](trackedTokens.length);
        uint256[] memory tokenIds = new uint256[](trackedTokens.length);
        for (uint32 i = 0; i < trackedTokens.length; i++) {
            tokenTypes[i] = trackedTokens[i].tokenType;
            contractAddresses[i] = trackedTokens[i].contractAddress;
            tokenIds[i] = trackedTokens[i].tokenId;
        }
        return (tokenTypes, contractAddresses, tokenIds);
    }

    function retire() external returns (bool)
    {
        require(uint32(block.timestamp / interval) - t0 > lifespan, "Too early to retire");
        require(lastResortAddress != address(0), "Last resort address is not set");
        require(_drain(), "Recovery failed");
        return true;
    }

    function getInfo() external view returns (bytes32, uint8, uint8, uint32, uint32, uint8, address, uint256)
    {
        return (root, height, interval, t0, lifespan, maxOperationsPerInterval, lastResortAddress, dailyLimit);
    }

    function getVersion() external pure returns (uint32, uint32)
    {
        return (majorVersion, minorVersion);
    }

    function getCurrentSpending() external view returns (uint256, uint256)
    {
        return (spentToday, lastTransferDay);
    }

    function getNonce() external view returns (uint8)
    {
        uint32 index = uint32(block.timestamp) / interval - t0;
        return nonces[index];
    }

    function getCommits() external view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory)
    {
        bytes32[] memory paramHashes = new bytes32[](commits.length);
        bytes32[] memory hashes = new bytes32[](commits.length);
        uint32[] memory timestamps = new uint32[](commits.length);
        bool[] memory completed = new bool[](commits.length);
        for (uint32 i = 0; i < commits.length; i++) {
            Commit storage c = commitLocker[commits[i]];
            hashes[i] = c.hash;
            paramHashes[i] = c.paramsHash;
            timestamps[i] = c.timestamp;
            completed[i] = c.completed;
        }
        return (hashes, paramHashes, timestamps, completed);
    }

    function findCommit(bytes32 hash) external view returns (bytes32, bytes32, uint32, bool){
        Commit storage c = commitLocker[hash];
        return (c.hash, c.paramsHash, c.timestamp, c.completed);
    }

    function commit(bytes32 hash, bytes32 paramsHash) external {
        _cleanupCommits();
        Commit storage c = commitLocker[hash];
        require(c.timestamp == 0 && !c.completed, "Commit already exists");
        Commit memory nc = Commit(hash, paramsHash, uint32(block.timestamp), false);
        require(commits.length < MAX_COMMIT_SIZE, "Too many commits");
        commits.push(hash);
        commitLocker[hash] = nc;
    }

    /// This function sends all remaining funds of the wallet to `lastResortAddress`. The caller should verify that `lastResortAddress` is not null.
    /// TODO: also transfer all tracked ERC20, 721, 1155 tokens to `lastResortAddress`
    function _drain() internal returns (bool) {
        // this may be triggered after revealing the proof, and we must prevent revert in all cases
        (bool success,) = lastResortAddress.call{value : address(this).balance}("");
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
        (bool success,) = dest.call{value : amount}("");
        // we do not want to revert the whole transaction if this operation fails, since EOTP is already revealed
        if (!success) {
            emit UnknownTransferError(dest);
            return false;
        }
        spentToday += amount;
        emit PaymentSent(amount, dest);
        return true;
    }

    function _recover() internal returns (bool){
        if (lastResortAddress == address(0)) {
            emit LastResortAddressNotSet();
            return false;
        }
        if (!_drain()) {
            emit RecoveryFailure();
            return false;
        }
        return true;
    }

    function _setRecoveryAddress(address payable lastResortAddress_) internal {
        require(lastResortAddress == address(0), "Last resort address is already set");
        lastResortAddress = lastResortAddress_;
    }

    function _trackToken(TokenType tokenType, address contractAddress, uint256 tokenId) internal {
        bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
        if (trackedTokenPositions[key].length > 0) {
            for (uint32 i = 0; i < trackedTokenPositions[key].length; i++) {
                uint256 j = trackedTokenPositions[key][i];
                if (trackedTokens[j].tokenType != tokenType) continue;
                if (trackedTokens[j].tokenId != tokenId) continue;
                if (trackedTokens[j].contractAddress != contractAddress) continue;
                // we found a token that is already tracked and is identical to the requested token
                return;
            }
        }
        TrackedToken memory tt = TrackedToken(tokenType, contractAddress, tokenId);
        trackedTokenPositions[key].push(trackedTokens.length);
        trackedTokens.push(tt);
        emit TokenTracked(tokenType, contractAddress, tokenId);
    }

    function _untrackToken(TokenType tokenType, address contractAddress, uint256 tokenId) internal {
        bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
        if (trackedTokenPositions[key].length == 0) {
            return;
        }
        for (uint32 i = 0; i < trackedTokenPositions[key].length; i++) {
            uint256 j = trackedTokenPositions[key][i];
            if (trackedTokens[j].tokenType != tokenType) continue;
            if (trackedTokens[j].tokenId != tokenId) continue;
            if (trackedTokens[j].contractAddress != contractAddress) continue;
            // found our token
            uint256 swappedPosition = trackedTokens.length - 1;
            trackedTokens[j] = trackedTokens[swappedPosition];
            bytes32 swappedKey = keccak256(bytes.concat(bytes32(uint256(trackedTokens[j].tokenType)), bytes32(bytes20(trackedTokens[j].contractAddress)), bytes32(trackedTokens[j].tokenId)));
            trackedTokens.pop();
            for (uint32 k = 0; k < trackedTokenPositions[swappedKey].length; k++) {
                if (trackedTokenPositions[swappedKey][k] == swappedPosition) {
                    trackedTokenPositions[swappedKey][k] = j;
                }
            }
            trackedTokenPositions[key][j] = trackedTokenPositions[key][trackedTokenPositions[key].length - 1];
            trackedTokenPositions[key].pop();
            emit TokenUntracked(tokenType, contractAddress, tokenId);
            return;
        }
        emit TokenNotFound(tokenType, contractAddress, tokenId);
    }

    function _transferToken(TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes memory data) internal {
        if (tokenType == TokenType.ERC20) {
            try IERC20(contractAddress).transfer(dest, amount) returns (bool success){
                if (success) {
                    _trackToken(tokenType, contractAddress, tokenId);
                    emit TokenTransferSucceeded(tokenType, contractAddress, tokenId, dest, amount);
                    return;
                }
                emit TokenTransferFailed(tokenType, contractAddress, tokenId, dest, amount);
            } catch Error(string memory reason){
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, reason);
            } catch {
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, "");
            }
        } else if (tokenType == TokenType.ERC721) {
            try IERC721(contractAddress).safeTransferFrom(address(this), dest, tokenId, data){
                emit TokenTransferSucceeded(tokenType, contractAddress, tokenId, dest, amount);
            } catch Error(string memory reason){
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, reason);
            } catch {
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, "");
            }
        } else if (tokenType == TokenType.ERC1155) {
            try IERC1155(contractAddress).safeTransferFrom(address(this), dest, tokenId, amount, data) {
                emit TokenTransferSucceeded(tokenType, contractAddress, tokenId, dest, amount);
            } catch Error(string memory reason){
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, reason);
            } catch {
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, "");
            }
        }
    }

    function _overrideTrack(TrackedToken[] memory newTrackedTokens) internal {
        for (uint32 i = 0; i < trackedTokens.length; i++) {
            TokenType tokenType = trackedTokens[i].tokenType;
            address contractAddress = trackedTokens[i].contractAddress;
            uint256 tokenId = trackedTokens[i].tokenId;
            bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
            delete trackedTokenPositions[key];
        }
        delete trackedTokens;
        for (uint32 i = 0; i < newTrackedTokens.length; i++) {
            TokenType tokenType = newTrackedTokens[i].tokenType;
            address contractAddress = newTrackedTokens[i].contractAddress;
            uint256 tokenId = newTrackedTokens[i].tokenId;
            bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
            TrackedToken memory t = TrackedToken(tokenType, contractAddress, tokenId);
            trackedTokens.push(t);
            trackedTokenPositions[key].push(i);
        }
    }

    function _overrideTrackWithBytes(bytes calldata data) internal {
        uint32 numTokens = uint32(data.length / 96);
        require(numTokens * 96 == data.length, "data must have length multiple to 96");
        TrackedToken[] memory newTrackedTokens = new TrackedToken[](numTokens);
        for (uint32 i = 0; i < numTokens; i++) {
            TokenType tokenType = TokenType(uint256(_asByte32(data[i * 96 : i * 96 + 32])));
            address contractAddress = address(bytes20(_asByte32(data[i * 96 + 32 : i * 96 + 52])));
            uint256 tokenId = uint256(_asByte32(data[i * 96 + 64 : i * 96 + 96]));
            newTrackedTokens[i] = TrackedToken(tokenType, contractAddress, tokenId);
        }
        _overrideTrack(newTrackedTokens);
    }

    function _multiTrack(bytes calldata data) internal {
        uint32 numTokens = uint32(data.length / 96);
        require(numTokens * 96 == data.length, "data must have length multiple to 96");
        for (uint32 i = 0; i < numTokens; i++) {
            TokenType tokenType = TokenType(uint256(_asByte32(data[i * 96 : i * 96 + 32])));
            address contractAddress = address(bytes20(_asByte32(data[i * 96 + 32 : i * 96 + 52])));
            uint256 tokenId = uint256(_asByte32(data[i * 96 + 64 : i * 96 + 96]));
            _trackToken(tokenType, contractAddress, tokenId);
        }
    }

    function _multiUntrack(bytes calldata data) internal {
        uint32 numTokens = uint32(data.length / 96);
        require(numTokens * 96 == data.length, "data must have length multiple to 96");
        for (uint32 i = 0; i < numTokens; i++) {
            TokenType tokenType = TokenType(uint256(_asByte32(data[i * 96 : i * 96 + 32])));
            address contractAddress = address(bytes20(_asByte32(data[i * 96 + 32 : i * 96 + 52])));
            uint256 tokenId = uint256(_asByte32(data[i * 96 + 64 : i * 96 + 96]));
            _untrackToken(tokenType, contractAddress, tokenId);
        }
    }

    function _getRevealHash(bytes32 neighbor, uint32 indexWithNonce, bytes32 eotp,
        OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes calldata data) pure internal returns (bytes32, bytes32) {
        bytes32 hash = keccak256(bytes.concat(neighbor, bytes32(bytes4(indexWithNonce)), eotp));
        bytes32 paramsHash = bytes32(0);
        if (operationType == OperationType.TRANSFER) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(dest))), bytes32(amount)));
        } else if (operationType == OperationType.RECOVER) {
            paramsHash = bytes32(0);
        } else if (operationType == OperationType.SET_RECOVERY_ADDRESS) {
            paramsHash = keccak256(bytes.concat(bytes32(bytes20(address(dest)))));
        } else {
            bytes memory packed = bytes.concat(
                bytes32(uint256(operationType)),
                bytes32(uint256(tokenType)),
                bytes32(bytes20(contractAddress)),
                bytes32(tokenId),
                bytes32(bytes20(dest)),
                bytes32(amount),
                data
            );
            paramsHash = keccak256(bytes.concat(packed));
        }

        return (hash, paramsHash);
    }


    function reveal(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp,
        OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data)
    external {
        _isCorrectProof(neighbors, indexWithNonce, eotp);
        (bytes32 commitHash, bytes32 paramsHash) = _getRevealHash(neighbors[0], indexWithNonce, eotp,
            operationType, tokenType, contractAddress, tokenId, dest, amount, data);
        _verifyReveal(commitHash, indexWithNonce, paramsHash);
        _completeReveal(commitHash);
        // No revert should occur below this point
        if (operationType == OperationType.TRACK) {
            if (data.length > 0) {
                _multiTrack(data);
            } else {
                _trackToken(tokenType, contractAddress, tokenId);
            }
        } else if (operationType == OperationType.UNTRACK) {
            if (data.length > 0) {
                _untrackToken(tokenType, contractAddress, tokenId);
            } else {
                _multiUntrack(data);
            }
        } else if (operationType == OperationType.TRANSFER_TOKEN) {
            _transferToken(tokenType, contractAddress, tokenId, dest, amount, data);
        } else if (operationType == OperationType.OVERRIDE_TRACK) {
            _overrideTrackWithBytes(data);
        } else if (operationType == OperationType.TRANSFER) {
            _transfer(dest, amount);
        } else if (operationType == OperationType.RECOVER) {
            _recover();
        } else if (operationType == OperationType.SET_RECOVERY_ADDRESS) {
            _setRecoveryAddress(dest);
        }
    }

    /// This is just a wrapper around a modifier previously called `isCorrectProof`, to avoid "Stack too deep" error. Duh.
    function _isCorrectProof(bytes32[] calldata neighbors, uint32 position, bytes32 eotp) view internal {
        require(neighbors.length == height - 1, "Not enough neighbors provided");
        bytes32 h = sha256(bytes.concat(eotp));
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
        uint32 commitIndex = 0;
        uint32 bt = uint32(block.timestamp);
        // go through past commits chronologically, starting from the oldest, and find the first commit that is not older than block.timestamp - REVEAL_MAX_DELAY.
        for (uint32 i = 0; i < commits.length; i++) {
            bytes32 hash = commits[i];
            Commit storage c = commitLocker[hash];
            if (c.timestamp >= bt - REVEAL_MAX_DELAY) {
                commitIndex = i;
                break;
            }
        }
        // If this condition holds true, no commit is older than block.timestamp - REVEAL_MAX_DELAY. Nothing needs to be cleaned up
        if (commitIndex == 0) {
            return;
        }
        // Delete Commit instances for commits that are are older than block.timestamp - REVEAL_MAX_DELAY
        for (uint32 i = 0; i < commitIndex; i++) {
            bytes32 hash = commits[i];
            delete commitLocker[hash];
        }
        // Shift all commits up by <commitIndex> positions, and discard <commitIndex> number of commits at the end of the array
        // This process erases old commits
        uint32 len = uint32(commits.length);
        for (uint32 i = commitIndex; i < len; i++) {
            commits[i - commitIndex] = commits[i];
        }
        for (uint32 i = 0; i < commitIndex; i++) {
            commits.pop();
        }
        // TODO (@polymorpher): upgrade the above code after solidity implements proper support for struct-array memory-storage copy operation.
    }

    function _isRevealTimely(uint32 commitTime) view internal returns (bool)
    {
        return uint32(block.timestamp) - commitTime < REVEAL_MAX_DELAY;
    }

    function _verifyReveal(bytes32 hash, uint32 indexWithNonce, bytes32 paramsHash) view internal
    {
        Commit storage c = commitLocker[hash];
        require(c.timestamp > 0, "Cannot find commit");
        uint32 index = indexWithNonce / maxOperationsPerInterval;
        uint8 nonce = uint8(indexWithNonce % maxOperationsPerInterval);
        uint32 counter = c.timestamp / interval - t0;
        require(counter == index, "Index - timestamp mismatch");
        uint8 expectedNonce = nonces[counter];
        require(nonce >= expectedNonce, "Nonce too low");
        require(!c.completed, "Commit already completed");
        require(c.paramsHash == paramsHash, "Invalid params hash");
        // this should not happen (since old commit should be cleaned up already)
        require(_isRevealTimely(c.timestamp), "Reveal too late");
    }

    function _completeReveal(bytes32 commitHash) internal {
        Commit storage c = commitLocker[commitHash];
        require(c.timestamp > 0, "Invalid commit hash");
        uint32 index = uint32(c.timestamp) / interval - t0;
        _incrementNonce(index);
        _cleanupNonces();
        c.completed = true;
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
                numValidIndices++;
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
        nonces[index] = v + 1;
    }

    function _asByte32(bytes memory b) pure internal returns (bytes32){
        if (b.length == 0) {
            return bytes32(0x0);
        }
        require(b.length <= 32, "input bytes too long");
        bytes32 r;
        uint8 len = uint8((32 - b.length) * 8);
        assembly{
            r := mload(add(b, 32))
            r := shr(len, r)
            r := shl(len, r)
        }
        return r;
    }
}
