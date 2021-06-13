// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

contract ONEWallet {
    //  This event is for debugging - should not be used in production
    //    event CheckingCommit(bytes data, bytes32 hash);
    event InsufficientFund(uint256 amount, uint256 balance, address dest);
    event ExceedDailyLimit(uint256 amount, uint256 limit, uint256 current, address dest);
    event UnknownTransferError(address dest);
    event LastResortAddressNotSet();

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

    //    bool commitLocked; // not necessary at this time
    Commit[] public commits; // self-clean on commit (auto delete commits that are beyond REVEAL_MAX_DELAY), so it's bounded by the number of commits an attacker can spam within REVEAL_MAX_DELAY time in the worst case, which is not too bad.

    uint256[64] ______gap; // reserved space for future upgrade

    constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_, uint8 maxOperationsPerInterval_,
        address payable lastResortAddress_, uint256 dailyLimit_)
    {
        root = root_;
        height = height_;
        interval = interval_;
        t0 = t0_;
        lifespan_ = lifespan_;
        lastResortAddress = lastResortAddress_;
        dailyLimit = dailyLimit_;
        maxOperationsPerInterval = maxOperationsPerInterval_;
    }

    receive() external payable {}

    function retire() external returns (bool)
    {
        require(uint32(block.timestamp / interval) - t0 > lifespan, "Too early to retire");
        require(lastResortAddress != address(0), "Last resort address is not set");
        return _drain();
    }

    function setLastResortAddressIfNull(address payable lastResortAddress_) external
    {
        require(lastResortAddress == address(0), "Last resort address is already set");
        lastResortAddress = lastResortAddress_;
    }

    function getNonce() public view returns (uint8)
    {
        uint32 index = uint32(block.timestamp) / interval - t0;
        return nonces[index];
    }

    function commit(bytes32 hash) external
    {
        //        require(!commitLocked, "Cleanup in progress. Queue is temporarily locked. Please resubmit.");
        _cleanupCommits();
        (uint32 ct, bool completed) = _findCommit(hash);
        require(ct == 0 && !completed, "Commit already exists");
        Commit memory nc = Commit(hash, uint32(block.timestamp), false);
        commits.push(nc);
    }

    function revealTransfer(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, address payable dest, uint256 amount) external
    isCorrectProof(neighbors, indexWithNonce, eotp)
    returns (bool)
    {
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
        bool success = dest.send(amount);
        // we do not want to revert the whole transaction if this operation fails, since EOTP is already revealed
        if (!success) {
            emit UnknownTransferError(dest);
            return false;
        }
        spentToday += amount;
        return true;
    }

    function revealRecovery(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp) external
    isCorrectProof(neighbors, indexWithNonce, eotp)
    returns (bool)
    {
        //        bytes memory packedNeighbors = _pack(neighbors);
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
        return _drain();
    }

    function _drain() internal returns (bool) {
        return lastResortAddress.send(address(this).balance);
    }

    // not used at this time
    //    modifier isValidIndex(uint32 index)
    //    {
    //        uint32 counter = uint32(block.timestamp) / interval - t0;
    //        require(counter == index, "Code has incorrect timestamp");
    //        _;
    //    }

    modifier isCorrectProof(bytes32[] calldata neighbors, uint32 index, bytes32 eotp)
    {
        require(neighbors.length == height - 1, "Not enough neighbors provided");
        bytes32 h = sha256(bytes.concat(eotp));
        for (uint8 i = 0; i < height - 1; i++) {
            if ((index & 0x01) == 0x01) {
                h = sha256(bytes.concat(neighbors[i], h));
                //                h = sha256(abi.encoderPacked(neighbors[i], h));
            } else {
                h = sha256(bytes.concat(h, neighbors[i]));
                //                h = sha256(abi.encoderPacked(h, neighbors[i]));
            }
            index >>= 1;
        }
        require(root == h, "Proof is incorrect");
        _;
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

    // not used at this time
    // same output as abi.encodePacked(x), but the behavior of abi.encodePacked is sort of uncertain
    //    function _pack(bytes32[] calldata x) pure internal returns (bytes memory)
    //    {
    //        // TODO (@polymorpher): use assembly mstore and mload to do this, similar to _asByte32 below
    //        bytes memory r = new bytes(x.length * 32);
    //        for (uint8 i = 0; i < x.length; i++) {
    //            for (uint8 j = 0; j < 32; j++) {
    //                r[i * 32 + j] = x[i][j];
    //            }
    //        }
    //        return r;
    //    }

    // not used at this time
    //    function _asByte32(bytes memory b) pure internal returns (bytes32){
    //        if (b.length == 0) {
    //            return bytes32(0x0);
    //        }
    //        require(b.length <= 32, "input bytes are too long for _asByte32");
    //        byte32 r;
    //        uint8 len = (32 - b.length) * 8;
    //        assembly{
    //            r := mload(add(b, 32))
    //            r := shr(len, r)
    //            r := shl(len, r)
    //        }
    //        return r;
    //    }
}
