// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./IONEWallet.sol";

/// For now, this is just a place to put all the deprecated stuff. In the future we can put some state variables here, along with some simple getters
abstract contract AbstractONEWallet is IONEWallet {
    // DEPRECATED
    function getCurrentSpending() external pure override returns (uint256, uint256){
        revert();
    }

    /// DEPRECATED
    function getCommits() external pure override returns (bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory){
        revert();
    }

    /// DEPRECATED
    function findCommit(bytes32 /*hash*/) external pure override returns (bytes32, bytes32, uint32, bool){
        revert();
    }

    // Deprecated since v14
    function reveal(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, Enums.OperationType operationType, Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data) external pure override {
        revert();
    }
}
