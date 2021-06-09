// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

contract ONEWallet {
    bytes32 root; // Note: @ivan brought up a good point in reducing this to 16-bytes so hash of two consecutive nodes can be done in a single word (to save gas and reduce blockchain clutter). Let's not worry about that for now and re-evalaute this later.
    uint8 height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
    uint8 interval; // otp interval in seconds, default is 30
    uint32 t0; // starting time block (effectiveTime (in ms) / interval)
    uint32 lifespan;  // in number of block (e.g. 1 block per [interval] seconds)

    // mutable
    address payable lastResortAddress;
    uint256 dailyLimit; // uint128 is sufficient, but uint256 is more efficient since EVM works with 32-byte words.
    uint256 spentToday;
    uint32 lastTransferDay;

    struct Commit {
        bytes32 hash;
        uint32 timestamp;
        bool completed;
    }

    uint32 constant REVEAL_MAX_DELAY = 60;
    //    bool commitLocked; // not necessary at this time

    Commit[] commits;

    uint256[64] ______gap;

    constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_,
        address payable lastResortAddress_, uint256 dailyLimit_)
    {
        root = root_;
        height = height_;
        interval = interval_;
        t0 = t0_;
        lifespan_ = lifespan_;
        lastResortAddress = lastResortAddress_;
        dailyLimit = dailyLimit_;
    }

    function retire() external
    {
        require(uint32(block.timestamp) / interval - t0 > lifespan, "Too young to retire");
        _drain();
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

    // TODO: during reveal, reject if index corresponds to a timestamp that is same as current block.timestamp, so we don't let the client accidentally leak EOTP that is still valid at the current time, which an attacker could use to commit and reveal a new transaction. This introduces a limitation that there would be a OTP_INTERVAL (=30 seconds by default) delay between commit and reveal, which translates to an unpleasant user experience. To fix this, we may slice OTP_INTERVAL further and use multiple EOTP per OTP_INTERVAL, and index the operations within an interval by an operation id. For a slice of size 16, we will need to generate a Merkle Tree 16 times as large. In this case, we would reject transactions only if both (1) the index corresponds to a timestamp that is same as current block.timestamp, and, (2) the operation id is not less than the id corresponding to the current timestamp's slice
    function revealTransfer(bytes32[] calldata neighbors, uint32 index, bytes32 eotp, address payable dest, uint256 amount) external
    isCorrectProof(neighbors, index, eotp)
    returns (bool)
    {
        bytes memory packedNeighbors = _pack(neighbors);
        bytes memory packed = bytes.concat(packedNeighbors,
            bytes32(bytes4(index)), eotp, bytes32(bytes20(address(dest))), bytes32(amount));
        bytes32 commitHash = keccak256(bytes.concat(packed));
        _revealPreCheck(commitHash, index);
        _markCommitCompleted(commitHash);
        uint32 day = uint32(block.timestamp) / 86400;
        if (day > lastTransferDay) {
            spentToday = 0;
            lastTransferDay = day;
        }
        if (spentToday + amount > dailyLimit) {
            return false;
        }
        bool success = dest.send(amount);
        if (!success) {
            return false;
        }
        spentToday += amount;
        return true;
    }

    function revealRecovery(bytes32[] calldata neighbors, uint32 index, bytes32 eotp) external
    isCorrectProof(neighbors, index, eotp)
    returns (bool)
    {
        bytes memory packedNeighbors = _pack(neighbors);
        bytes memory packed = bytes.concat(packedNeighbors, bytes32(bytes4(index)), eotp);
        bytes32 commitHash = keccak256(bytes.concat(packed));
        _revealPreCheck(commitHash, index);
        _markCommitCompleted(commitHash);
        if (lastResortAddress == address(0)) {
            return false;
        }
        _drain();
        return true;
    }

    function _drain() internal {
        require(lastResortAddress != address(0), "Last resort address is not provided");
        lastResortAddress.transfer(address(this).balance);
    }

    modifier isValidIndex(uint32 index)
    {
        uint32 counter = uint32(block.timestamp) / interval - t0;
        require(counter == index, "Code has incorrect timestamp");
        _;
    }

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

    function _findCommit(bytes32 hash) view internal returns (uint32, bool)
    {
        if (hash == "") {
            return (0, false);
        }
        for (uint8 i = 0; i < commits.length; i++) {
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
        uint8 index = 0;
        uint32 bt = uint32(block.timestamp);
        for (uint8 i = 0; i < commits.length; i++) {
            Commit storage c = commits[i];
            if (c.timestamp >= bt - REVEAL_MAX_DELAY) {
                index = i;
                break;
            }
        }
        uint32 len = uint32(commits.length);
        for (uint8 i = index; i < len; i++) {
            commits[i - index] = commits[i];
        }
        for (uint8 i = 0; i < index; i++) {
            commits.pop();
        }
        //        commitLocked = false;
    }

    function _isRevealTimely(uint32 commitTime) view internal returns (bool)
    {
        return block.timestamp - commitTime < REVEAL_MAX_DELAY;
    }

    function _revealPreCheck(bytes32 hash, uint32 index) view internal
    {
        (uint32 ct, bool completed) = _findCommit(hash);
        require(ct > 0, "Cannot find commit for this transaction");
        uint32 counter = ct / interval - t0;
        require(counter == index, "Provided index does not match commit timestamp");
        require(!completed, "Commit is already completed");
        // this should not happen (since old commit should be cleaned up already)
        require(_isRevealTimely(ct), "Reveal is too late. Please re-commit");
    }

    function _markCommitCompleted(bytes32 hash) internal {
        for (uint8 i = 0; i < commits.length; i++) {
            Commit storage c = commits[i];
            if (c.hash == hash) {
                c.completed = true;
                return;
            }
        }
        revert("Invalid commit hash");
    }

    // same output as abi.encodePacked(x), but the behavior of abi.encodePacked is sort of uncertain
    function _pack(bytes32[] calldata x) pure internal returns (bytes memory)
    {
        bytes memory r = new bytes(x.length * 32);
        for (uint8 i = 0; i < x.length; i++) {
            for (uint8 j = 0; j < 32; j++) {
                r[i * 32 + j] = x[i][j];
            }
        }
        return r;
    }
}
