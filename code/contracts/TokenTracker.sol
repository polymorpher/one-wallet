// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";


contract TokenTracker is IERC721Receiver, IERC1155Receiver {

    /// token tracking
    enum TokenType{
        ERC20, ERC721, ERC1155, NONE
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

    constructor(){}

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
