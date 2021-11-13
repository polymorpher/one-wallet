// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

/// This factory is expected to be deployed only once. Its deployed address will be used by clients to infer expected address of their 1wallet (given seed) and verify the address is as expected (thus validating the implementation)
contract ONEWalletFactory {
    event ONEWalletDeployFailed(uint256 salt, bytes32 codeHash);
    event ONEWalletDeploySuccess(address addr, uint256 salt, bytes32 codeHash);

    /// This method may be called by ONEWalletFactoryHelper to verify an address is created using 1wallet code, and by clients who do not want to compute the address by themselves.
    function predict(bytes memory code, uint256 salt) view public returns (address){
        bytes memory data = bytes.concat(bytes1(0xff), bytes20(address(this)), bytes32(salt), keccak256(code));
        bytes32 hash = keccak256(data);
        return address(uint160(uint256(hash)));
    }

    /// an alternative is to use create3 mechanisms (and library) in https://github.com/0xsequence/create3, which allows the address of the contract to be independent to its code. This is achieved by deploying (via CREATE2) a proxy contract with fixed content and to have the proxy contract pointing to the actual implementation contract (which its address does depend on the bytecode). This approach has two downsides: (1) unlike CREATE2, the client would not be able to verify the contract does contain the intended code simply by verifying the address is as expected. (2) the use of proxy and fallback mechanisms make debugging harder and may introduce unexpected behaviors
    function deploy(bytes memory code, uint256 salt) public payable returns (address){
        address ret;
        bytes32 codeHash = keccak256(code);
        assembly{
            ret := create2(callvalue(), add(0x20, code), mload(code), salt)
        }
        if (ret == address(0)) {
            emit ONEWalletDeployFailed(salt, codeHash);
            return address(0);
        }
        emit ONEWalletDeploySuccess(ret, salt, codeHash);
        return ret;
    }
}
