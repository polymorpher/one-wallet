// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./Enums.sol";

library TokenTracker {
    struct TrackedToken {
        Enums.TokenType tokenType;
        address contractAddress;
        uint256 tokenId; // only valid for ERC721 and ERC1155
    }

    struct TokenTrackerState {
        TrackedToken[] trackedTokens;
        mapping(bytes32 => uint256[]) trackedTokenPositions;
    }
    event TokenTracked(Enums.TokenType tokenType, address contractAddress, uint256 tokenId);
    event TokenUntracked(Enums.TokenType tokenType, address contractAddress, uint256 tokenId);
    event TokenNotFound(Enums.TokenType tokenType, address contractAddress, uint256 tokenId);

    function trackToken(TokenTrackerState storage state, Enums.TokenType tokenType, address contractAddress, uint256 tokenId) public {
        bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
        if (state.trackedTokenPositions[key].length > 0) {
            for (uint32 i = 0; i < state.trackedTokenPositions[key].length; i++) {
                uint256 j = state.trackedTokenPositions[key][i];
                if (state.trackedTokens[j].tokenType != tokenType) continue;
                if (state.trackedTokens[j].tokenId != tokenId) continue;
                if (state.trackedTokens[j].contractAddress != contractAddress) continue;
                // we found a token that is already tracked and is identical to the requested token
                return;
            }
        }
        state.trackedTokenPositions[key].push(state.trackedTokens.length);
        state.trackedTokens.push(TrackedToken(tokenType, contractAddress, tokenId));
        emit TokenTracked(tokenType, contractAddress, tokenId);
    }

    function untrackToken(TokenTrackerState storage state, Enums.TokenType tokenType, address contractAddress, uint256 tokenId) public {
        bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
        if (state.trackedTokenPositions[key].length == 0) {
            return;
        }
        for (uint32 i = 0; i < state.trackedTokenPositions[key].length; i++) {
            uint256 j = state.trackedTokenPositions[key][i];
            if (state.trackedTokens[j].tokenType != tokenType) continue;
            if (state.trackedTokens[j].tokenId != tokenId) continue;
            if (state.trackedTokens[j].contractAddress != contractAddress) continue;
            // found our token
            uint256 swappedPosition = state.trackedTokens.length - 1;
            state.trackedTokens[j] = state.trackedTokens[swappedPosition];
            bytes32 swappedKey = keccak256(bytes.concat(bytes32(uint256(state.trackedTokens[j].tokenType)), bytes32(bytes20(state.trackedTokens[j].contractAddress)), bytes32(state.trackedTokens[j].tokenId)));
            state.trackedTokens.pop();
            for (uint32 k = 0; k < state.trackedTokenPositions[swappedKey].length; k++) {
                if (state.trackedTokenPositions[swappedKey][k] == swappedPosition) {
                    state.trackedTokenPositions[swappedKey][k] = j;
                }
            }
            state.trackedTokenPositions[key][j] = state.trackedTokenPositions[key][state.trackedTokenPositions[key].length - 1];
            state.trackedTokenPositions[key].pop();
            emit TokenUntracked(tokenType, contractAddress, tokenId);
            return;
        }
        emit TokenNotFound(tokenType, contractAddress, tokenId);
    }

    function overrideTrack(TokenTrackerState storage state, TrackedToken[] memory newTrackedTokens) public {
        for (uint32 i = 0; i < state.trackedTokens.length; i++) {
            Enums.TokenType tokenType = state.trackedTokens[i].tokenType;
            address contractAddress = state.trackedTokens[i].contractAddress;
            uint256 tokenId = state.trackedTokens[i].tokenId;
            bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
            delete state.trackedTokenPositions[key];
        }
        delete state.trackedTokens;
        for (uint32 i = 0; i < newTrackedTokens.length; i++) {
            Enums.TokenType tokenType = newTrackedTokens[i].tokenType;
            address contractAddress = newTrackedTokens[i].contractAddress;
            uint256 tokenId = newTrackedTokens[i].tokenId;
            bytes32 key = keccak256(bytes.concat(bytes32(uint256(tokenType)), bytes32(bytes20(contractAddress)), bytes32(tokenId)));
            state.trackedTokens.push(TrackedToken(tokenType, contractAddress, tokenId));
            state.trackedTokenPositions[key].push(i);
        }
    }

    function overrideTrackWithBytes(TokenTrackerState storage state, bytes calldata data) public {
        (uint256[] memory tokenTypes, address[] memory contractAddresses, uint256[] memory tokenIds) = abi.decode(data, (uint256[], address[], uint256[]));
        TrackedToken[] memory newTrackedTokens = new TrackedToken[](tokenTypes.length);
        for (uint32 i = 0; i < tokenTypes.length; i++) {
            newTrackedTokens[i] = TrackedToken(Enums.TokenType(tokenTypes[i]), contractAddresses[i], tokenIds[i]);
        }
        overrideTrack(state, newTrackedTokens);
    }

    function multiTrack(TokenTrackerState storage state, bytes calldata data) public {
        (uint256[] memory tokenTypes, address[] memory contractAddresses, uint256[] memory tokenIds) = abi.decode(data, (uint256[], address[], uint256[]));
        for (uint32 i = 0; i < tokenTypes.length; i++) {
            trackToken(state, Enums.TokenType(tokenTypes[i]), contractAddresses[i], tokenIds[i]);
        }
    }

    function multiUntrack(TokenTrackerState storage state, bytes calldata data) public {
        (uint256[] memory tokenTypes, address[] memory contractAddresses, uint256[] memory tokenIds) = abi.decode(data, (uint256[], address[], uint256[]));
        for (uint32 i = 0; i < tokenTypes.length; i++) {
            untrackToken(state, Enums.TokenType(tokenTypes[i]), contractAddresses[i], tokenIds[i]);
        }
    }
}
