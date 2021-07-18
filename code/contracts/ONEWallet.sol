// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ONEWallet is IERC721Receiver, IERC1155Receiver {
    //  This event is for debugging - should not be used in production
    //    event CheckingCommit(bytes data, bytes32 hash);
    event InsufficientFund(uint256 amount, uint256 balance, address dest);
    event ExceedDailyLimit(uint256 amount, uint256 limit, uint256 current, address dest);
    event UnknownTransferError(address dest);
    event LastResortAddressNotSet();
    event PaymentReceived(uint256 amount, address from);
    event PaymentSent(uint256 amount, address dest);
    event AutoRecoveryTriggered(address from);
    event RecoveryFailure();

    bytes32 root; // Note: @ivan brought up a good point in reducing this to 16-bytes so hash of two consecutive nodes can be done in a single word (to save gas and reduce blockchain clutter). Let's not worry about that for now and re-evalaute this later.
    uint8 height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
    uint8 interval; // otp interval in seconds, default is 30
    uint32 t0; // starting time block (effectiveTime (in ms) / interval)
    uint32 lifespan;  // in number of block (e.g. 1 block per [interval] seconds)
    uint8 maxOperationsPerInterval; // number of transactions permitted per OTP interval. Each transaction shall have a unique nonce. The nonce is auto-incremented within each interval

    // global mutable
    address payable lastResortAddress; // where money will be sent during a recovery process (or when the wallet is beyond its lifespan)
    uint256 dailyLimit; // uint128 is sufficient, but uint256 is more efficient since EVM works with 32-byte words.
    uint256 spentToday; // note: instead of tracking the money spent for the last 24h, we are simply tracking money spent per 24h block based on UTC time. It is good enough for now, but we may want to change this later.
    uint32 lastTransferDay;

    mapping(uint32 => uint8) nonces; // keys: otp index (=timestamp in seconds / interval - t0); values: the expected nonce for that otp interval. An reveal with a nonce less than the expected value will be rejected
    uint32[] nonceTracker; // list of nonces keys that have a non-zero value. keys cannot possibly result a successful reveal (indices beyond REVEAL_MAX_DELAY old) are auto-deleted during a clean up procedure that is called every time the nonces are incremented for some key. For each deleted key, the corresponding key in nonces will also be deleted. So the size of nonceTracker and nonces are both bounded.

    struct Commit {
        bytes32 hash;
        uint32 timestamp;
        bool completed;
    }

    uint32 constant REVEAL_MAX_DELAY = 60;
    uint32 constant SECONDS_PER_DAY = 86400;
    uint256 constant AUTO_RECOVERY_TRIGGER_AMOUNT = 1 ether;
    uint32 constant MAX_COMMIT_SIZE = 120;

    uint32 constant majorVersion = 0x5; // a change would require client to migrate
    uint32 constant minorVersion = 0x3; // a change would not require the client to migrate

    //    bool commitLocked; // not necessary at this time
    Commit[] commits; // self-clean on commit (auto delete commits that are beyond REVEAL_MAX_DELAY), so it's bounded by the number of commits an attacker can spam within REVEAL_MAX_DELAY time in the worst case, which is not too bad.

    //
    enum OperationType {
        TRACK, UNTRACK, TRANSFER_TOKEN, OVERRIDE_TRACK
        //        , TRANSFER, SET_RECOVERY_ADDRESS, RECOVER
    }
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

    mapping(bytes32 => uint256[]) trackedTokenPositions; // sha256(bytes.concat(byte32(uint(tokenType)), bytes32(contractAddress), bytes32(tokenId)) => positions in trackedTokens. Positions should be of length 1 except in very rare occasion of collision
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
        // will be used in the next version
        bytes32[] memory args = new bytes32[](commits.length);

        bytes32[] memory hashes = new bytes32[](commits.length);
        uint32[] memory timestamps = new uint32[](commits.length);
        bool[] memory completed = new bool[](commits.length);
        for (uint32 i = 0; i < commits.length; i++) {
            hashes[i] = commits[i].hash;
            timestamps[i] = commits[i].timestamp;
            completed[i] = commits[i].completed;
        }
        return (hashes, args, timestamps, completed);
    }

    function commit(bytes32 hash) external
    {
        _cleanupCommits();
        (uint32 ct, bool completed) = _findCommit(hash);
        require(ct == 0 && !completed, "Commit already exists");
        Commit memory nc = Commit(hash, uint32(block.timestamp), false);
        require(commits.length < MAX_COMMIT_SIZE, "Too many commits are pending");
        commits.push(nc);
    }

    function revealTransfer(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, address payable dest, uint256 amount) external
    returns (bool)
    {
        _isCorrectProof(neighbors, indexWithNonce, eotp);
        //        bytes memory packedNeighbors = _pack(neighbors);
        bytes memory packed = bytes.concat(neighbors[0],
            bytes32(bytes4(indexWithNonce)), eotp, bytes32(bytes20(address(dest))), bytes32(amount));
        bytes32 commitHash = keccak256(bytes.concat(packed));
        //        emit CheckingCommit(packed, commitHash);
        _revealPreCheck(commitHash, indexWithNonce);
        _completeReveal(commitHash);
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

    function revealRecovery(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp) external
    returns (bool)
    {
        _isCorrectProof(neighbors, indexWithNonce, eotp);
        bytes memory packed = bytes.concat(
            neighbors[0],
            bytes32(bytes4(indexWithNonce)),
            eotp
        );
        bytes32 commitHash = keccak256(bytes.concat(packed));
        _revealPreCheck(commitHash, indexWithNonce);
        _completeReveal(commitHash);
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

    function revealSetLastResortAddress(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, address payable lastResortAddress_)
    external
    {
        _isCorrectProof(neighbors, indexWithNonce, eotp);
        require(lastResortAddress == address(0), "Last resort address is already set");
        bytes memory packed = bytes.concat(
            neighbors[0],
            bytes32(bytes4(indexWithNonce)),
            eotp,
            bytes32(bytes20(address(lastResortAddress_)))
        );
        bytes32 commitHash = keccak256(bytes.concat(packed));
        _revealPreCheck(commitHash, indexWithNonce);
        _completeReveal(commitHash);
        lastResortAddress = lastResortAddress_;
    }

    function _trackToken(TokenType tokenType, address contractAddress, uint256 tokenId) internal {
        bytes32 key = sha256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
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
        bytes32 key = sha256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
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
            bytes32 swappedKey = sha256(bytes.concat(bytes32(uint256(trackedTokens[j].tokenType)), bytes32(bytes20(trackedTokens[j].contractAddress)), bytes32(trackedTokens[j].tokenId)));
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
            bytes32 key = sha256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
            delete trackedTokenPositions[key];
        }
        delete trackedTokens;
        for (uint32 i = 0; i < newTrackedTokens.length; i++) {
            TokenType tokenType = newTrackedTokens[i].tokenType;
            address contractAddress = newTrackedTokens[i].contractAddress;
            uint256 tokenId = newTrackedTokens[i].tokenId;
            bytes32 key = sha256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
            TrackedToken memory t = TrackedToken(tokenType, contractAddress, tokenId);
            trackedTokens.push(t);
            trackedTokenPositions[key].push(i);
        }
    }

    function _overrideTrackWithBytes(bytes calldata data) internal {
        uint32 numTokens = uint32(data.length / 96);
        require(numTokens* 96 == data.length, "data must have length multiple to 96");
        TrackedToken[] memory newTrackedTokens = new TrackedToken[](numTokens);
        for (uint32 i = 0; i < numTokens; i++) {
            TokenType tokenType = TokenType(uint256(_asByte32(data[i * 96 : i * 96 + 32])));
            address contractAddress = address(bytes20(_asByte32(data[i * 96 + 32 : i * 96 + 52])));
            uint256 tokenId = uint256(_asByte32(data[i * 96 + 64 : i * 96 + 96]));
            newTrackedTokens[i] = TrackedToken(tokenType, contractAddress, tokenId);
        }
        _overrideTrack(newTrackedTokens);
    }

    function _revealTokenOperationPack(bytes32 neighbor, uint32 indexWithNonce, bytes32 eotp,
        OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes calldata data) pure internal returns (bytes32) {
        bytes memory packed = bytes.concat(
            neighbor,
            bytes32(bytes4(indexWithNonce)),
            eotp,
            bytes32(uint256(operationType)),
            bytes32(uint256(tokenType)),
            bytes32(bytes20(contractAddress)),
            bytes32(tokenId),
            bytes32(bytes20(dest)),
            bytes32(amount),
            data
        );
        bytes32 commitHash = keccak256(bytes.concat(packed));
        return commitHash;
    }

    function revealTokenOperation(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp,
        OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes calldata data)
    external {
        _isCorrectProof(neighbors, indexWithNonce, eotp);
        bytes32 commitHash = _revealTokenOperationPack(
            neighbors[0],
            indexWithNonce,
            eotp,
            operationType,
            tokenType,
            contractAddress,
            tokenId,
            dest,
            amount,
            data
        );
        _revealPreCheck(commitHash, indexWithNonce);
        _completeReveal(commitHash);
        if (operationType == OperationType.TRACK) {
            _trackToken(tokenType, contractAddress, tokenId);
        } else if (operationType == OperationType.UNTRACK) {
            _untrackToken(tokenType, contractAddress, tokenId);
        } else if (operationType == OperationType.TRANSFER_TOKEN) {
            _transferToken(tokenType, contractAddress, tokenId, dest, amount, data);
        } else if (operationType == OperationType.OVERRIDE_TRACK) {
            _overrideTrackWithBytes(data);
        }
    }

    function _drain() internal returns (bool) {
        // this may be triggered after revealing the proof, and we must prevent revert in all cases
        (bool success,) = lastResortAddress.call{value : address(this).balance}("");
        return success;
    }

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
        // just a wrapper around the old isCorrectProof modifier to avoid "Stack too deep" error. Duh.
    }

    function _findCommit(bytes32 hash) view internal returns (uint32, bool)
    {
        if (hash == "") {
            return (0, false);
        }
        for (uint32 i = 0; i < commits.length; i++) {
            Commit storage c = commits[i];
            if (c.hash == hash) {
                return (c.timestamp, c.completed);
            }
        }
        return (0, false);
    }

    // simple mechanism to prevent commits grow unbounded, if an attacker decides to spam commits (at their own expense)
    function _cleanupCommits() internal
    {
        //        commitLocked = true;
        uint32 commitIndex = 0;
        uint32 bt = uint32(block.timestamp);
        for (uint32 i = 0; i < commits.length; i++) {
            Commit storage c = commits[i];
            if (c.timestamp >= bt - REVEAL_MAX_DELAY) {
                commitIndex = i;
                break;
            }
        }
        if (commitIndex == 0) {
            return;
        }
        uint32 len = uint32(commits.length);

        //        TODO (@polymorpher): replace below code with the commented out version, after solidity implements proper support for struct-array memory-storage copy operation
        for (uint32 i = commitIndex; i < len; i++) {
            commits[i - commitIndex] = commits[i];
        }
        for (uint32 i = 0; i < commitIndex; i++) {
            commits.pop();
        }
        //        TODO (@polymorpher): Can't use below code because: std::exception::what: Copying of type struct ONEWallet.Commit memory[] memory to storage not yet supported.
        //        Commit[] memory remainingCommits = new Commit[](len - commitIndex);
        //        for (uint8 i = 0; i < remainingCommits.length; i++) {
        //            remainingCommits[i] = commits[commitIndex + i];
        //        }
        //        commits = remainingCommits;

        //        commitLocked = false;
    }

    function _isRevealTimely(uint32 commitTime) view internal returns (bool)
    {
        return block.timestamp - commitTime < REVEAL_MAX_DELAY;
    }

    function _revealPreCheck(bytes32 hash, uint32 indexWithNonce) view internal
    {
        uint32 index = indexWithNonce / maxOperationsPerInterval;
        uint8 nonce = uint8(indexWithNonce % maxOperationsPerInterval);
        (uint32 ct, bool completed) = _findCommit(hash);
        require(ct > 0, "Cannot find commit for this transaction");
        uint32 counter = ct / interval - t0;
        require(counter == index, "Provided index does not match committed timestamp");
        uint8 expectedNonce = nonces[counter];
        require(nonce >= expectedNonce, "Nonce is too low");
        require(!completed, "Commit is already completed");
        // this should not happen (since old commit should be cleaned up already)
        require(_isRevealTimely(ct), "Reveal is too late. Please re-commit");
    }

    function _completeReveal(bytes32 hash) internal {
        for (uint8 i = 0; i < commits.length; i++) {
            Commit storage c = commits[i];
            if (c.hash == hash) {
                c.completed = true;
                uint32 index = uint32(c.timestamp) / interval - t0;
                _incrementNonce(index);
                _cleanupNonces();
                return;
            }
        }
        revert("Invalid commit hash");
    }

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
        // TODO (@polymorpher): this is so stupid. Replace this with inline assembly later. https://ethereum.stackexchange.com/questions/51891/how-to-pop-from-decrease-the-length-of-a-memory-array-in-solidity
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
        require(b.length <= 32, "input bytes are too long for _asByte32");
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
