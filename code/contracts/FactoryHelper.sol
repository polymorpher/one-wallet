// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./ONEWallet.sol";
import "./IONEWallet.sol";
import "./Factory.sol";
import "./Version.sol";

library ONEWalletCodeHelper {
    function code() pure public returns (bytes memory){
        return type(ONEWallet).creationCode;
    }
}

contract ONEWalletFactoryHelper {
    event ONEWalletDeployFailed(uint256 salt, bytes32 codeHash);
    event ONEWalletDeploySuccess(address addr, uint256 salt, bytes32 codeHash);

    ONEWalletFactory public factory = ONEWalletFactory(address(0));
    constructor(ONEWalletFactory factory_){
        factory = factory_;
    }
    function getVersion() public pure returns (uint32, uint32){
        return (Version.majorVersion, Version.minorVersion);
    }

    function deploy(IONEWallet.InitParams memory args) payable public returns (address){
        // ONEWallet has no constructor argument since v15
        bytes memory code = ONEWalletCodeHelper.code();
        bytes32 codeHash = keccak256(code);
        uint256 salt = uint256(keccak256(args.identificationKeys[0]));
        address expected = factory.predict(salt, code);
        require(!factory.hasCode(expected), "already deployed");
        address addr = factory.deploy{value : msg.value}(salt, code);
        if (addr == address(0)) {
            emit ONEWalletDeployFailed(salt, codeHash);
            return addr;
        }
        IONEWallet(addr).initialize(args);
        emit ONEWalletDeploySuccess(addr, salt, codeHash);
        return addr;
    }

    function predict(bytes memory identificationKey) public view returns (address){
        return factory.predict(uint256(keccak256(identificationKey)), ONEWalletCodeHelper.code());
    }

    function getCode() public pure returns (bytes memory){
        return ONEWalletCodeHelper.code();
    }

    function verify(IONEWallet addr) public view returns (bool){
        address predictedAddress = factory.predict(uint256(keccak256(addr.identificationKey())), ONEWalletCodeHelper.code());
        return predictedAddress == address(addr);
    }
}
