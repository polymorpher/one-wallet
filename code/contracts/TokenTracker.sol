// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

library TokenTracker {
    event TokenTransferFailed(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount);
    event TokenTransferError(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, string reason);
    event TokenTransferSucceeded(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount);
    event TokenRecovered(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, uint256 balance);
    event BalanceRetrievalError(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, string reason);

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

    function transferToken(TokenTrackerState storage state, Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes memory data) public {
        if (tokenType == Enums.TokenType.ERC20) {
            try IERC20(contractAddress).transfer(dest, amount) returns (bool success){
                if (success) {
                    trackToken(state, tokenType, contractAddress, tokenId);
                    emit TokenTransferSucceeded(tokenType, contractAddress, tokenId, dest, amount);
                    return;
                }
                emit TokenTransferFailed(tokenType, contractAddress, tokenId, dest, amount);
            } catch Error(string memory reason){
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, reason);
            } catch {
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, "");
            }
        } else if (tokenType == Enums.TokenType.ERC721) {
            try IERC721(contractAddress).safeTransferFrom(address(this), dest, tokenId, data){
                emit TokenTransferSucceeded(tokenType, contractAddress, tokenId, dest, amount);
            } catch Error(string memory reason){
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, reason);
            } catch {
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, "");
            }
        } else if (tokenType == Enums.TokenType.ERC1155) {
            try IERC1155(contractAddress).safeTransferFrom(address(this), dest, tokenId, amount, data) {
                emit TokenTransferSucceeded(tokenType, contractAddress, tokenId, dest, amount);
            } catch Error(string memory reason){
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, reason);
            } catch {
                emit TokenTransferError(tokenType, contractAddress, tokenId, dest, amount, "");
            }
        }
    }

    function getBalance(Enums.TokenType tokenType, address contractAddress, uint256 tokenId) public view returns (uint256, bool success, string memory)  {
        // all external calls are safe because they are automatically compiled to static call due to view mutability
        if (tokenType == Enums.TokenType.ERC20) {
            try IERC20(contractAddress).balanceOf(address(this)) returns (uint256 balance){
                return (balance, true, "");
            }catch Error(string memory reason){
                return (0, false, reason);
            }catch {
                return (0, false, "Unknown");
            }
        } else if (tokenType == Enums.TokenType.ERC721) {
            try IERC721(contractAddress).ownerOf(tokenId) returns (address owner){
                bool owned = (owner == address(this));
                if (owned) {
                    return (1, true, "");
                } else {
                    return (0, true, "");
                }
            }catch Error(string memory reason){
                return (0, false, reason);
            }catch {
                return (0, false, "Unknown");
            }
        } else if (tokenType == Enums.TokenType.ERC1155) {
            try IERC1155(contractAddress).balanceOf(address(this), tokenId) returns (uint256 balance){
                return (balance, true, "");
            }catch Error(string memory reason){
                return (0, false, reason);
            }catch {
                return (0, false, "Unknown");
            }
        }
        return (0, false, "Bad type");
    }

    function recoverToken(TokenTrackerState storage state, address dest, TokenTracker.TrackedToken storage t) public {
        (uint256 balance, bool success, string memory reason) = getBalance(t.tokenType, t.contractAddress, t.tokenId);
        if (!success) {
            emit BalanceRetrievalError(t.tokenType, t.contractAddress, t.tokenId, reason);
        }
        if (balance > 0) {
            transferToken(state, t.tokenType, t.contractAddress, t.tokenId, dest, balance, bytes(""));
            emit TokenRecovered(t.tokenType, t.contractAddress, t.tokenId, balance);
        }
    }

    function recoverSelectedTokensEncoded(TokenTrackerState storage state, address dest, bytes memory data) public {
        uint32[] memory indices = abi.decode(data, (uint32[]));
        for (uint32 i = 0; i < indices.length; i++) {
            recoverToken(state, dest, state.trackedTokens[indices[i]]);
        }
    }

    function recoverAllTokens(TokenTrackerState storage state, address dest) public {
        for (uint32 i = 0; i < state.trackedTokens.length; i++) {
            recoverToken(state, dest, state.trackedTokens[i]);
        }
    }

    function getTrackedTokens(TokenTrackerState storage state) public view returns (Enums.TokenType[] memory, address[] memory, uint256[] memory){
        Enums.TokenType[] memory tokenTypes = new Enums.TokenType[](state.trackedTokens.length);
        address[] memory contractAddresses = new address[](state.trackedTokens.length);
        uint256[] memory tokenIds = new uint256[](state.trackedTokens.length);
        for (uint32 i = 0; i < state.trackedTokens.length; i++) {
            tokenTypes[i] = state.trackedTokens[i].tokenType;
            contractAddresses[i] = state.trackedTokens[i].contractAddress;
            tokenIds[i] = state.trackedTokens[i].tokenId;
        }
        return (tokenTypes, contractAddresses, tokenIds);
    }
}
