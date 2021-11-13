// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./ONEWallet.sol";
import "./IONEWallet.sol";
import "./Factory.sol";

library ONEWalletCodeHelper {
    function code() pure public returns (bytes memory){
        return type(ONEWallet).creationCode;
    }
}

contract ONEWalletFactoryHelper {
    ONEWalletFactory public factory = ONEWalletFactory(address(0));
    constructor(ONEWalletFactory factory_){
        factory = factory_;
    }

    function deploy(IONEWallet.InitParams memory args) payable public returns (address){
        // ONEWallet has no constructor argument since v15
        address addr = factory.deploy{value : msg.value}(ONEWalletCodeHelper.code(), uint256(args.identificationHash));
        if (addr == address(0)) {
            return addr;
        }
        IONEWallet(addr).initialize(args);
        return addr;
    }

    function predict(bytes32 identificationHash) public view returns (address){
        return factory.predict(ONEWalletCodeHelper.code(), uint256(identificationHash));
    }

    function verify(IONEWallet addr) public view returns (bool){
        address predictedAddress = factory.predict(ONEWalletCodeHelper.code(), uint256(addr.identificationHash()));
        return predictedAddress == address(addr);
    }
}
