// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

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
    }

    bool commitLocked;
    Commit[] commits;

    uint256[64] ______gap;

    constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_,
        address payable lastResortAddress_, uint256 dailyLimit_)
    {
        root = root_;
        height = height_;
        interval = interval_;
        t0 = t0_;
        lifespan_ = interval_;
        lastResortAddress = lastResortAddress_;
        dailyLimit = dailyLimit_;
    }

    function commit(bytes32 hash) external
    {
        require(!commitLocked, "Cleanup in progress. Queue is temporarily locked. Please resubmit.");
        uint32 ct = _findCommit(hash);
        require(ct == 0, "Commit already exists");
        Commit memory nc = Commit(hash, uint32(block.timestamp));
        commits.push(nc);
    }

    function revealTransfer(bytes32[] calldata neighbors, uint32 index, bytes32 eotp, address payable dest, uint256 amount) external
    isValidIndex(index)
    isCorrectProof(neighbors, index, eotp)
    returns (bool)
    {
        _cleanupCommits();
        bytes memory packedNeighbors = _packBytes32Array(neighbors);
        bytes memory packed = bytes.concat(packedNeighbors,
            bytes32(bytes4(index)), eotp, bytes32(bytes20(address(dest))), bytes32(amount));
        require(_canReveal(packed), "Failed to reveal transfer");
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
    isValidIndex(index)
    isCorrectProof(neighbors, index, eotp)
    returns (bool)
    {
        bytes memory packedNeighbors = _packBytes32Array(neighbors);
        bytes memory packed = bytes.concat(packedNeighbors, bytes32(bytes4(index)), eotp);
        require(_canReveal(packed), "Failed to reveal recovery");
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

    function _findCommit(bytes32 hash) view internal returns (uint32)
    {
        if (hash == "") {
            return 0;
        }
        for (uint8 i = 0; i < commits.length; i++) {
            Commit storage c = commits[i];
            if (c.hash == hash) {
                return c.timestamp;
            }
        }
        return 0;
    }

    // simple mechanism to prevent commits grow unbounded, if an attacker decides to spam commits (at their own expense)
    function _cleanupCommits() internal
    {
        commitLocked = true;
        uint8 index = 0;
        uint32 bt = uint32(block.timestamp);
        for (uint8 i = 0; i < commits.length; i++) {
            Commit storage c = commits[i];
            if (c.timestamp >= bt - 30) {
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
        commitLocked = false;
    }

    function _isRevealTimely(uint32 commitTime) view internal returns (bool)
    {
        return block.timestamp - commitTime < 30;
    }

    function _canReveal(bytes memory packedArgs) view internal returns (bool)
    {
        bytes32 h = keccak256(bytes.concat(packedArgs));
        uint32 ct = _findCommit(h);
        require(ct > 0, "Cannot find commit for this transaction");
        // this should not happen (since old commit should be cleaned up already), but let's check just in case
        require(_isRevealTimely(ct), "Reveal is too late. Please re-commit");
        return true;
    }

    // same output as abi.encodePacked(x), but the behavior of abi.encodePacked is sort of uncertain
    function _packBytes32Array(bytes32[] calldata x) pure internal returns (bytes memory)
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
