// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";

interface IONEWallet {

    function getForwardAddress() external view returns (address payable);

    function retire() external returns (bool);

    function getInfo() external view returns (bytes32, uint8, uint8, uint32, uint32, uint8, address, uint256);

    function getVersion() external pure returns (uint32, uint32);

    function getCurrentSpending() external view returns (uint256, uint256);

    function getNonce() external view returns (uint8);
    /// DEPRECATED
    function getCommits() external pure returns (bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);

    function getAllCommits() external view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);

    function findCommit(bytes32 /*hash*/) external pure returns (bytes32, bytes32, uint32, bool);

    function lookupCommit(bytes32 hash) external view returns (bytes32[] memory, bytes32[] memory, bytes32[] memory, uint32[] memory, bool[] memory);

    function commit(bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external;

    function reveal(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp, OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data) external;
}
