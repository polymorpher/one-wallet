// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Forwardable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./Enums.sol";
import "./TokenTracker.sol";

abstract contract TokenManager is IERC721Receiver, IERC1155Receiver, Forwardable {
    event ReceivedToken(Enums.TokenType tokenType, uint256 amount, address from, address tokenContract, address operator, uint256 tokenId, bytes data);
    event ForwardedToken(Enums.TokenType tokenType, uint256 amount, address from, address tokenContract, address operator, uint256 tokenId, bytes data);


    // We track tokens in the contract instead of at the client so users can immediately get a record of what tokens they own when they restore their wallet at a new client
    // The tracking of ERC721 and ERC1155 are automatically established upon a token is transferred to this wallet. The tracking of ERC20 needs to be manually established by the client.
    // The gas cost of tracking and untracking operations are of constant complexity. The gas cost is paid by the transferer in the case of automatically established tracking, and paid by the user in the case of manual tracking.

    TokenTracker.TokenTrackerState tokenTrackerState;

    using TokenTracker for TokenTracker.TokenTrackerState;

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override returns (bytes4){
        emit ReceivedToken(Enums.TokenType.ERC1155, value, from, msg.sender, operator, id, data);
        address payable forwardAddress = _getForwardAddress();
        if (forwardAddress != address(0)) {
            tokenTrackerState.transferToken(Enums.TokenType.ERC1155, msg.sender, id, forwardAddress, value, data);
            return this.onERC1155Received.selector;
        }
        tokenTrackerState.trackToken(Enums.TokenType.ERC1155, msg.sender, id);
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address operator, address from, uint256[] calldata ids, uint256[] calldata values, bytes calldata data) external override returns (bytes4){
        for (uint32 i = 0; i < ids.length; i++) {
            this.onERC1155Received(operator, from, ids[i], values[i], data);
        }
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceID) public override virtual pure returns (bool) {
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
        emit ReceivedToken(Enums.TokenType.ERC721, 1, from, msg.sender, operator, tokenId, data);
        address payable forwardAddress = _getForwardAddress();
        if (forwardAddress != address(0)) {
            tokenTrackerState.transferToken(Enums.TokenType.ERC721, msg.sender, tokenId, forwardAddress, 1, data);
            return this.onERC721Received.selector;
        }
        tokenTrackerState.trackToken(Enums.TokenType.ERC721, msg.sender, tokenId);
        return this.onERC721Received.selector;
    }
}
