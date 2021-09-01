// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

/// we will slowly move commit-reveal related stuff from ONEWallet to here
library CommitManager {
    uint32 constant REVEAL_MAX_DELAY = 60;

    struct Commit {
        bytes32 paramsHash;
        bytes32 verificationHash;
        uint32 timestamp;
        bool completed;
    }

    struct CommitState {
        mapping(bytes32 => Commit[]) commitLocker;
        bytes32[] commits;  // self-clean on commit (auto delete commits that are beyond REVEAL_MAX_DELAY), so it's bounded by the number of commits an attacker can spam within REVEAL_MAX_DELAY time in the worst case, which is not too bad.
    }


    function getNumCommits(mapping(bytes32 => Commit[]) storage commitLocker, bytes32[] storage commits) view internal returns (uint32){
        uint32 numCommits = 0;
        for (uint32 i = 0; i < commits.length; i++) {
            numCommits += uint32(commitLocker[commits[i]].length);
        }
        return numCommits;
    }

    function getCommitHashes(CommitState storage cs, uint32 numCommits) internal view returns (bytes32[] memory){
        bytes32[] memory hashes = new bytes32[](numCommits);
        uint32 index = 0;
        for (uint32 i = 0; i < cs.commits.length; i++) {
            Commit[] storage cc = cs.commitLocker[cs.commits[i]];
            for (uint32 j = 0; j < cc.length; j++) {
                hashes[index] = cs.commits[i];
                index++;
            }
        }
        return hashes;
    }

    function getCommitParamHashes(CommitState storage cs, uint32 numCommits) internal view returns (bytes32[] memory){
        bytes32[] memory paramHashes = new bytes32[](numCommits);
        uint32 index = 0;
        for (uint32 i = 0; i < cs.commits.length; i++) {
            Commit[] storage cc = cs.commitLocker[cs.commits[i]];
            for (uint32 j = 0; j < cc.length; j++) {
                Commit storage c = cc[j];
                paramHashes[index] = c.paramsHash;
                index++;
            }
        }
        return paramHashes;
    }

    function getVerificationHashes(CommitState storage cs, uint32 numCommits) internal view returns (bytes32[] memory){
        bytes32[] memory verificationHashes = new bytes32[](numCommits);
        uint32 index = 0;
        for (uint32 i = 0; i < cs.commits.length; i++) {
            Commit[] storage cc = cs.commitLocker[cs.commits[i]];
            for (uint32 j = 0; j < cc.length; j++) {
                Commit storage c = cc[j];
                verificationHashes[index] = c.verificationHash;
                index++;
            }
        }
        return verificationHashes;
    }

    function getTimestamps(CommitState storage cs, uint32 numCommits) internal view returns (uint32[] memory){
        uint32[] memory timestamps = new uint32[](numCommits);
        uint32 index = 0;
        for (uint32 i = 0; i < cs.commits.length; i++) {
            Commit[] storage cc = cs.commitLocker[cs.commits[i]];
            for (uint32 j = 0; j < cc.length; j++) {
                Commit storage c = cc[j];
                timestamps[index] = c.timestamp;
                index++;
            }
        }
        return timestamps;
    }

    function getCompletionStatus(CommitState storage cs, uint32 numCommits) internal view returns (bool[] memory){
        bool[] memory completed = new bool[](numCommits);
        uint32 index = 0;
        for (uint32 i = 0; i < cs.commits.length; i++) {
            Commit[] storage cc = cs.commitLocker[cs.commits[i]];
            for (uint32 j = 0; j < cc.length; j++) {
                Commit storage c = cc[j];
                completed[index] = c.completed;
                index++;
            }
        }
        return completed;
    }

    function getAllCommits(CommitState storage cs) public view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        uint32 numCommits = getNumCommits(cs.commitLocker, cs.commits);
        bytes32[] memory hashes = getCommitHashes(cs, numCommits);
        bytes32[] memory paramHashes = getCommitParamHashes(cs, numCommits);
        bytes32[] memory verificationHashes = getVerificationHashes(cs, numCommits);
        uint32[] memory timestamps = getTimestamps(cs, numCommits);
        bool[] memory completed = getCompletionStatus(cs, numCommits);
        return (hashes, paramHashes, verificationHashes, timestamps, completed);
    }

    function lookupCommit(CommitState storage cs, bytes32 hash) external view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        Commit[] storage cc = cs.commitLocker[hash];
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

    /// Remove old commits from storage, where the commit's timestamp is older than block.timestamp - REVEAL_MAX_DELAY. The purpose is to remove dangling data from blockchain, and prevent commits grow unbounded. This is executed at commit time. The committer pays for the gas of this cleanup. Therefore, any attacker who intend to spam commits would be disincentivized. The attacker would not succeed in preventing any normal operation by the user.
    function cleanupCommits(CommitState storage commitState) external {
        uint32 timelyIndex = 0;
        uint32 bt = uint32(block.timestamp);
        // go through past commits chronologically, starting from the oldest, and find the first commit that is not older than block.timestamp - REVEAL_MAX_DELAY.
        for (; timelyIndex < commitState.commits.length; timelyIndex++) {
            bytes32 hash = commitState.commits[timelyIndex];
            Commit[] storage cc = commitState.commitLocker[hash];
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
            bytes32 hash = commitState.commits[i];
            Commit[] storage cc = commitState.commitLocker[hash];
            for (uint32 j = 0; j < cc.length; j++) {
                delete cc[j];
            }
            delete commitState.commitLocker[hash];
        }
        // Shift all commit hashes up by `timelyIndex` positions, and discard `commitIndex` number of hashes at the end of the array
        // This process erases old commits
        uint32 len = uint32(commitState.commits.length);
        for (uint32 i = timelyIndex; i < len; i++) {
        unchecked{
            commitState.commits[i - timelyIndex] = commitState.commits[i];
        }
        }
        for (uint32 i = 0; i < timelyIndex; i++) {
            commitState.commits.pop();
        }
        // TODO (@polymorpher): upgrade the above code after solidity implements proper support for struct-array memory-storage copy operation.
    }
}
