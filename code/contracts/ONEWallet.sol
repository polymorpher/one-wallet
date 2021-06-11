// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

contract ONEWallet {
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
    uint32 lastTransferDay; // I'd use uint instead

    // IH: you can drop nonce stuff if you implement commits as mapping (hash => Commit). After reveal you might delete the Commit entry; the timestamp's fresheness will ensure protection against replay in the future.
    mapping(uint32 => uint8) nonces; // keys: otp index (=timestamp in seconds / interval - t0); values: the expected nonce for that otp interval. An reveal with a nonce less than the expected value will be rejected
    uint32[] nonceTracker; // list of nonces keys that have a non-zero value. keys cannot possibly result a successful reveal (indices beyond REVEAL_MAX_DELAY old) are auto-deleted during a clean up procedure that is called every time the nonces are incremented for some key. For each deleted key, the corresponding key in nonces will also be deleted. So the size of nonceTracker and nonces are both bounded.

    struct Commit {
        bytes32 hash;
        uint32 timestamp;
        bool completed;
    }

    uint32 constant REVEAL_MAX_DELAY = 60; 

    //    bool commitLocked; // not necessary at this time
    Commit[] commits; // self-clean on commit (auto delete commits that are beyond REVEAL_MAX_DELAY), so it's bounded by the number of commits an attacker can spam within REVEAL_MAX_DELAY time in the worst case, which is not too bad.

    uint256[64] ______gap; // reserved space for future upgrade // IH: I am not sure how this work

    constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_, uint8 maxOperationsPerInterval_,
        address payable lastResortAddress_, uint256 dailyLimit_)
    {
        root = root_;
        height = height_;
        interval = interval_;
        t0 = t0_;
        lifespan_ = lifespan_; // IH: what are the expected values?
        lastResortAddress = lastResortAddress_;
        dailyLimit = dailyLimit_;
        maxOperationsPerInterval = maxOperationsPerInterval_; // IH: what are the expected values?
    }

    function retire() external returns (bool)
    {
        require(uint32(block.timestamp) / interval - t0 > lifespan, "Too early to retire");
        require(lastResortAddress != address(0), "Last resort address is not set"); // IH: it needs method for adjustment; currently, if it adjust it in constructor to 0x0, retire() will never work
        return _drain();
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
        commits.push(nc); // IH: would not it be better to have mapping of commits?
    }

    // TODO (@polymorpher): during reveal, reject if index corresponds to a timestamp that is same as current block.timestamp, so we don't let the client accidentally leak EOTP that is still valid at the current time, which an attacker could use to commit and reveal a new transaction. This introduces a limitation that there would be a OTP_INTERVAL (=30 seconds by default) delay between commit and reveal, which translates to an unpleasant user experience. To fix this, we may slice OTP_INTERVAL further and use multiple EOTP per OTP_INTERVAL, and index the operations within an interval by an operation id. For a slice of size 16, we will need to generate a Merkle Tree 16 times as large. In this case, we would reject transactions only if both (1) the index corresponds to a timestamp that is same as current block.timestamp, and, (2) the operation id is not less than the id corresponding to the current timestamp's slice
    // IH: what do you state above just supports HOTPs instead of TOTPs, besides other advantages.
    // IH: combining index with nonce is unnecessary complicated to me. I would split them. 
    function revealTransfer(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, address payable dest, uint256 amount) external
    isCorrectProof(neighbors, indexWithNonce, eotp)
    returns (bool)
    {
        bytes memory packedNeighbors = _pack(neighbors); // IH: no need to put Merkle proof into the hash (it is either correct and matches to OTP or not, hence integrity is implicit)
        bytes memory packed = bytes.concat(packedNeighbors,
            bytes32(bytes4(indexWithNonce)), eotp, bytes32(bytes20(address(dest))), bytes32(amount));
        bytes32 commitHash = keccak256(bytes.concat(packed)); // IH: why do you need bytes.concat again?
        _revealPreCheck(commitHash, indexWithNonce);
        _completeReveal(commitHash);
        uint32 day = uint32(block.timestamp) / 86400; // IH: goof to use a constant; also casting uint 256 as uint32 does not seem reasonable (maybe if you'd put division into the parenthesis). But anyway, I'd go for uint instead.
        if (day > lastTransferDay) {
            spentToday = 0;
            lastTransferDay = day;
        }
        if (spentToday + amount > dailyLimit) { // IH: I'd put revert here. So the user will be warned by client that tx will not pass and do not proceed => save gas.
            return false;
        }
        // IH: you should check enough balance first
        bool success = dest.send(amount); 
        // we do not want to revert the whole transaction if this operation fails, since EOTP is already revealed. 
        if (!success) {
            return false;
        }
        spentToday += amount;
        return true;
    }

    function revealRecovery(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp) external
    isCorrectProof(neighbors, indexWithNonce, eotp)
    returns (bool)
    {
        bytes memory packedNeighbors = _pack(neighbors);
        bytes memory packed = bytes.concat(
            packedNeighbors,
            bytes32(bytes4(indexWithNonce)),
            eotp
        );
        bytes32 commitHash = keccak256(bytes.concat(packed)); // IH: why do you need bytes.concat again?
        _revealPreCheck(commitHash, indexWithNonce);
        _completeReveal(commitHash);
        // IH: until here, the code is duplicate with revealTransfer(). Can you put it into some helper function?

        if (lastResortAddress == address(0)) {
            return false;
        }
        _drain(); // IH: the function is short, can you expand it here? and also check return code?
        return true;
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
            if (index & 0x01 == 0x01) {
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

    // IH: why to not make just mapping of hashes to Commits? Then you might drop this and the next functions. Further, you won't have out-of-gas DOS by the attacker in commit stage => manifested here.
    function _findCommit(bytes32 hash) view internal returns (uint32, bool)
    {
        if (hash == "") {
            return (0, false);
        }
        for (uint8 i = 0; i < commits.length; i++) { // IH: uint8 might not be enough, I'd just go for uint since it is (cheap) in-memory var.
            Commit storage c = commits[i];
            if (c.hash == hash) {
                return (c.timestamp, c.completed);
            }
        }
        return (0, false);
    }

    // simple mechanism to prevent commits grow unbounded, if an attacker decides to spam commits (at their own expense)
    // IH: I'd drop this function and use mapping for commits. This would also avoid out-of-gas DOS.
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
        require(nonce >= expectedNonce, "Nonce is too low"); // IH: should not be here equality? One commit object is associated with the one nonce (it is part of commited hash)
        require(!completed, "Commit is already completed");
        // this should not happen (since old commit should be cleaned up already)
        require(_isRevealTimely(ct), "Reveal is too late. Please re-commit"); // IH: What might happen if we'd increase REVEAL_MAX_DELAY 10x or 100x? I do not see any advantage of keeping it short since MITM attacker gets only extended 32B OTP while attacker that tampers with the client can do anything regardless of this lenght. This brings me again to using HOTPs.
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

    // same output as abi.encodePacked(x), but the behavior of abi.encodePacked is sort of uncertain - IH: this is surprising; in which sense?
    function _pack(bytes32[] calldata x) pure internal returns (bytes memory)
    {
        // TODO (@polymorpher): use assembly mstore and mload to do this, similar to _asByte32 below
        bytes memory r = new bytes(x.length * 32);
        for (uint8 i = 0; i < x.length; i++) {
            for (uint8 j = 0; j < 32; j++) {
                r[i * 32 + j] = x[i][j];
            }
        }
        return r;
    }

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
