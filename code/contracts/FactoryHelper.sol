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

interface IONEWalletFactoryHelper{
    event ONEWalletDeployFailed(uint256 salt, bytes32 codeHash);
    event ONEWalletDeploySuccess(address addr, uint256 salt, bytes32 codeHash);
    function factory() external view returns (ONEWalletFactory);
    function getVersion() external pure returns (uint32, uint32);
    function deploy(IONEWallet.InitParams memory args) payable external returns (address);
    function predict(bytes memory identificationKey) external view returns (address);
    function getCode() external pure returns (bytes memory);
    function verify(IONEWallet addr) external view returns (bool);
}

contract ONEWalletFactoryHelper is IONEWalletFactoryHelper {
    ONEWalletFactory public override factory = ONEWalletFactory(address(0));
    constructor(ONEWalletFactory factory_){
        factory = factory_;
    }
    function getVersion() override public pure returns (uint32, uint32){
        return (Version.majorVersion, Version.minorVersion);
    }

    function deploy(IONEWallet.InitParams memory args) payable override public returns (address){
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

    function predict(bytes memory identificationKey) override public view returns (address){
        return factory.predict(uint256(keccak256(identificationKey)), ONEWalletCodeHelper.code());
    }

    function getCode() override public pure returns (bytes memory){
        return ONEWalletCodeHelper.code();
    }

    function verify(IONEWallet addr) override public view returns (bool){
        address predictedAddress = factory.predict(uint256(keccak256(addr.identificationKey())), ONEWalletCodeHelper.code());
        return predictedAddress == address(addr);
    }
}
