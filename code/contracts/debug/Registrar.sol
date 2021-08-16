// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol";
import "@ensdomains/subdomain-registrar-core/contracts/Resolver.sol";
import "@ensdomains/subdomain-registrar-core/contracts/interfaces/IReverseRegistrar.sol";
import "@ensdomains/subdomain-registrar-core/contracts/interfaces/IDefaultReverseResolver.sol";

contract Registrar is IRegistrar {
    function query(bytes32 /*label*/, string calldata /*subdomain*/) external override pure returns (string memory domain, uint signupFee, uint rent, uint referralFeePPM){
        return ("", 0, 0, 0);
    }

    function register(bytes32 /*label*/, string calldata /*subdomain*/, address /*owner*/, address payable /*referrer*/, address /*resolver*/) external override payable {

    }

    function rentDue(bytes32 /*label*/, string calldata /*subdomain*/) external override pure returns (uint timestamp){
        return 0;
    }

    function payRent(bytes32 /*label*/, string calldata /*subdomain*/) external override payable {

    }
}

contract ReverseRegistrar is IReverseRegistrar {
    function claim(address /*owner*/) external pure override returns (bytes32){
        return bytes32(0);
    }

    function node(address /*addr*/) external pure override returns (bytes32){
        return bytes32(0);
    }

    function setName(string memory /*name*/) external pure override returns (bytes32){
        return bytes32(0);
    }

    function claimWithResolver(address /*owner*/, address /*resolver*/) external pure override returns (bytes32){
        return bytes32(0);
    }
    // DOES NOT EXIST in vanilla ens/ReverseRegistrar.sol. Added in ens-contracts/contracts/registry/ReverseRegistrar
    function claimForAddr(address /*addr*/, address /*owner*/) external pure override {

    }
    // DOES NOT EXIST in vanilla ens/ReverseRegistrar.sol. Added in ens-contracts/contracts/registry/ReverseRegistrar
    function claimWithResolverForAddr(
        address /*addr*/,
        address /*owner*/,
        address /*resolver*/
    ) external pure override returns (bytes32){
        return bytes32(0);
    }
}
