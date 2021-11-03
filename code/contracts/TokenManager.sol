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
    event TokenTransferFailed(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount);
    event TokenTransferError(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, string reason);
    event TokenTransferSucceeded(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount);
    event TokenRecovered(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, uint256 balance);
    event BalanceRetrievalError(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, string reason);

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
            _transferToken(Enums.TokenType.ERC1155, msg.sender, id, forwardAddress, value, data);
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
            _transferToken(Enums.TokenType.ERC721, msg.sender, tokenId, forwardAddress, 1, data);
            return this.onERC721Received.selector;
        }
        tokenTrackerState.trackToken(Enums.TokenType.ERC721, msg.sender, tokenId);
        return this.onERC721Received.selector;
    }

    function _getTrackedTokens() internal view returns (Enums.TokenType[] memory, address[] memory, uint256[] memory){
        Enums.TokenType[] memory tokenTypes = new Enums.TokenType[](tokenTrackerState.trackedTokens.length);
        address[] memory contractAddresses = new address[](tokenTrackerState.trackedTokens.length);
        uint256[] memory tokenIds = new uint256[](tokenTrackerState.trackedTokens.length);
        for (uint32 i = 0; i < tokenTrackerState.trackedTokens.length; i++) {
            tokenTypes[i] = tokenTrackerState.trackedTokens[i].tokenType;
            contractAddresses[i] = tokenTrackerState.trackedTokens[i].contractAddress;
            tokenIds[i] = tokenTrackerState.trackedTokens[i].tokenId;
        }
        return (tokenTypes, contractAddresses, tokenIds);
    }

    function _transferToken(Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address dest, uint256 amount, bytes memory data) internal {
        if (tokenType == Enums.TokenType.ERC20) {
            try IERC20(contractAddress).transfer(dest, amount) returns (bool success){
                if (success) {
                    tokenTrackerState.trackToken(tokenType, contractAddress, tokenId);
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

    function _getBalance(Enums.TokenType tokenType, address contractAddress, uint256 tokenId) internal view returns (uint256, bool success, string memory){
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

    function _recoverToken(address dest, TokenTracker.TrackedToken storage t) internal {
        (uint256 balance, bool success, string memory reason) = _getBalance(t.tokenType, t.contractAddress, t.tokenId);
        if (!success) {
            emit BalanceRetrievalError(t.tokenType, t.contractAddress, t.tokenId, reason);
        }
        if (balance > 0) {
            _transferToken(t.tokenType, t.contractAddress, t.tokenId, dest, balance, bytes(""));
            emit TokenRecovered(t.tokenType, t.contractAddress, t.tokenId, balance);
        }
    }

    function _recoverSelectedTokensEncoded(address dest, bytes memory data) internal {
        uint32[] memory indices = abi.decode(data, (uint32[]));
        for (uint32 i = 0; i < indices.length; i++) {
            _recoverToken(dest, tokenTrackerState.trackedTokens[indices[i]]);
        }
    }

    function _recoverAllTokens(address dest) internal {
        for (uint32 i = 0; i < tokenTrackerState.trackedTokens.length; i++) {
            _recoverToken(dest, tokenTrackerState.trackedTokens[i]);
        }
    }

}
