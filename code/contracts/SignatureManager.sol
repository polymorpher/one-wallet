// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

library SignatureManager {
    event SignatureMismatch(bytes32 hash, bytes32 newSignature, bytes32 existingSignature);
    event SignatureNotExist(bytes32 hash);
    event SignatureAlreadyExist(bytes32 hash, bytes32 signature);
    event SignatureAuthorized(bytes32 hash, bytes32 signature);
    event SignatureRevoked(bytes32 hash, bytes32 signature);
    event SignatureExpired(bytes32 hash, bytes32 signature);

    struct Signature {
        uint32 timestamp; // seconds, when signature is produced
        uint32 expireAt; // when is the signature no longer valid
        bytes32 signature; // expected signature
        bytes32 hash; // hash of the data
    }

    struct SignatureTracker {
        bytes32[] hashes;
        mapping(bytes32 => Signature) signatureLocker;
        mapping(bytes32 => uint32) positions; // hash => (position at hashes + 1);
    }

    uint32 constant MAX_UINT32 = type(uint32).max;

    function authorize(SignatureTracker storage st, bytes32 hash, bytes32 signature, uint32 expireAt) public returns (bool){
        Signature storage s = st.signatureLocker[hash];
        if (s.timestamp != 0) {
            if (s.signature != signature) {
                emit SignatureMismatch(hash, signature, s.signature);
            } else {
                emit SignatureAlreadyExist(hash, signature);
            }
            return false;
        }
        st.signatureLocker[hash] = Signature(uint32(block.timestamp), expireAt, signature, hash);
        st.hashes.push(hash);
        st.positions[hash] = uint32(st.hashes.length);
        emit SignatureAuthorized(hash, signature);
        return true;
    }

    function revoke(SignatureTracker storage st, bytes32 hash, bytes32 signature) public returns (bool){
        Signature storage s = st.signatureLocker[hash];
        if (s.timestamp == 0) {
            emit SignatureNotExist(hash);
            return false;
        }
        if (s.signature != signature) {
            emit SignatureMismatch(hash, signature, s.signature);
            return false;
        }
        if (st.hashes.length == 1) {
            st.hashes.pop();
            delete st.positions[hash];
            delete st.signatureLocker[hash];
            return true;
        }
        uint32 position = st.positions[hash] - 1;
        bytes32 swapHash = st.hashes[st.hashes.length - 1];
        st.positions[swapHash] = position + 1;
        st.hashes[position] = swapHash;
        st.hashes.pop();
        delete st.positions[hash];
        delete st.signatureLocker[hash];
        emit SignatureRevoked(hash, signature);
        return true;
    }

    function revokeBefore(SignatureTracker storage st, uint32 beforeTime) public {
        uint32 numRemains = 0;
        bytes32[] memory hashes = new bytes32[](st.hashes.length);
        for (uint32 i = 0; i < st.hashes.length; i++) {
            bytes32 h = st.hashes[i];
            Signature storage s = st.signatureLocker[h];
            if (s.expireAt > beforeTime) {
                hashes[numRemains] = h;
                numRemains += 1;
            } else {
                emit SignatureRevoked(h, s.signature);
                delete st.signatureLocker[h];
                delete st.positions[h];
            }
        }
        bytes32[] memory newHashes = new bytes32[](numRemains);
        for (uint32 i = 0; i < numRemains; i++) {
            newHashes[i] = hashes[i];
        }
        for (uint32 i = 0; i < st.hashes.length; i++) {
            delete st.hashes[i];
        }
        delete st.hashes;
        st.hashes = newHashes;
    }

    function revokeExpired(SignatureTracker storage st) public {
        revokeBefore(st, uint32(block.timestamp));
    }

    function revokeAll(SignatureTracker storage st) public {
        revokeBefore(st, MAX_UINT32);
    }

    /// to handle ONEWallet general parameters
    function revokeHandler(SignatureTracker storage st, address contractAddress, uint256 tokenId, address payable dest, uint256 amount) public {
        if (contractAddress != address(0)) {
            revokeAll(st);
        } else {
            uint32 beforeTime = uint32(bytes4(bytes20(address(dest))));
            if (beforeTime > 0) {
                revokeBefore(st, beforeTime);
            } else {
                revoke(st, bytes32(tokenId), bytes32(amount));
            }
        }
    }
    /// to handle ONEWallet general parameters
    function authorizeHandler(SignatureTracker storage st, address contractAddress, uint256 tokenId, address payable dest, uint256 amount) public {
        authorize(st, bytes32(tokenId), bytes32(amount), uint32(bytes4(bytes20(address(dest)))));
        if (contractAddress != address(0)) {
            revokeExpired(st);
        }
    }

    function validate(SignatureTracker storage st, bytes32 hash, bytes32 signature) public view returns (bool){
        Signature storage s = st.signatureLocker[hash];
        if (s.signature != signature) {
            return false;
        }
        if (s.timestamp == 0) {
            return false;
        }
        if (s.expireAt < block.timestamp) {
            return false;
        }
        return true;
    }

    function lookup(SignatureTracker storage st, bytes32 hash) public view returns (bytes32, uint32, uint32){
        Signature storage s = st.signatureLocker[hash];
        return (s.signature, s.timestamp, s.expireAt);
    }

    function list(SignatureTracker storage st, uint32 start, uint32 end) public view returns (bytes32[] memory, bytes32[] memory, uint32[] memory, uint32[] memory){
        bytes32[] memory signatures = new bytes32[](st.hashes.length);
        uint32[] memory timestamps = new uint32[](st.hashes.length);
        uint32[] memory expiries = new uint32[](st.hashes.length);
        if (end > st.hashes.length) {
            end = uint32(st.hashes.length);
        }
        for (uint32 i = start; i < end; i++) {
            Signature storage s = st.signatureLocker[st.hashes[i]];
            signatures[i] = s.signature;
            timestamps[i] = s.timestamp;
            expiries[i] = s.expireAt;
        }
        return (st.hashes, signatures, timestamps, expiries);
    }


}
