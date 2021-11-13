// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./ONEWallet.sol";
import "./IONEWallet.sol";
import "./Factory.sol";

contract ONEWalletFactoryHelper {
    ONEWalletFactory public factory = ONEWalletFactory(address(0));
    constructor(ONEWalletFactory factory_){
        factory = factory_;
    }

    function deploy(IONEWallet.InitParams memory args) payable public returns (address){
        bytes memory code = type(ONEWallet).creationCode;
        // ONEWallet has no constructor argument since v15
        address addr = factory.deploy{value : msg.value}(code, uint256(args.identificationHash));
        if (addr == address(0)) {
            return addr;
        }
        IONEWallet(addr).initialize(args);
        return addr;
    }

    function predict(bytes32 identificationHash) public view returns (address){
        bytes memory code = type(ONEWallet).creationCode;
        return factory.predict(code, uint256(identificationHash));
    }

    function verify(IONEWallet addr) public view returns (bool){
        bytes memory code = type(ONEWallet).creationCode;
        address predictedAddress = factory.predict(code, uint256(addr.identificationHash()));
        return predictedAddress == address(addr);
    }
}
