// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./IONEWallet.sol";

contract ProxyWallet {
    function commit(IONEWallet dest, bytes32 hash, bytes32 paramsHash, bytes32 verificationHash) external {
        dest.commit(hash, paramsHash, verificationHash);
    }

    function reveal(IONEWallet dest, IONEWallet.AuthParams calldata auth, IONEWallet.OperationParams calldata op) external {
        dest.reveal(auth, op);
    }

    function retire(IONEWallet dest) external {
        dest.retire();
    }
}