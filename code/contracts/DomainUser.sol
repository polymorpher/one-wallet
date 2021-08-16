// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol";
import "@ensdomains/subdomain-registrar-core/contracts/interfaces/IReverseRegistrar.sol";

contract DomainUser {
    event DomainRegistered(address subdomainRegistrar, string subdomain, bytes32 domainLabel);
    event ReverseDomainClaimed(address reverseRegistrar, bytes32 nodeHash);
    event InvalidFQDN(string fqdn, uint32 subdomainLabelLength);
    event DomainRegistrationFailed(string reason);

    function _buyDomainEncoded(bytes calldata data, uint256 maxPrice, uint8 subdomainLabelLength, address reg, address resolver) internal returns (bool) {
        (address rev, bytes32 node, string memory fqdn) = abi.decode(data, (address, bytes32, string));
        bytes memory bfqdn = bytes(fqdn);
        if (bfqdn.length > 64) {
            emit InvalidFQDN(fqdn, subdomainLabelLength);
            return false;
        }
        if (bfqdn.length < subdomainLabelLength) {
            emit InvalidFQDN(fqdn, subdomainLabelLength);
            return false;
        }
        bytes memory subdomainBytes = new bytes(subdomainLabelLength);
        for (uint i = 0; i < subdomainLabelLength; i++) {
            subdomainBytes[i] = bfqdn[i];
        }
        string memory subdomain = string(subdomainBytes);
        return _buyDomain(IRegistrar(reg), IReverseRegistrar(rev), resolver, maxPrice, subdomain, node, fqdn);
    }


    function _buyDomain(IRegistrar reg, IReverseRegistrar rev, address resolver, uint256 maxPrice, string memory subdomain, bytes32 node, string memory fqdn) internal returns (bool) {
        (bool success, bytes memory ret) = address(reg).call{value : maxPrice}(abi.encodeWithSignature("register(bytes32,string,address,address,address)", node, subdomain, address(this), address(0x0), resolver));
        if (!success) {
            string memory reason = _revertReason(ret);
            emit DomainRegistrationFailed(reason);
            return false;
        }
        emit DomainRegistered(address(reg), subdomain, node);
        bytes32 revNodeHash = rev.setName(fqdn);
        emit ReverseDomainClaimed(address(rev), revNodeHash);
        return true;
    }

    /// https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/base/Multicall.sol
    function _revertReason(bytes memory _res) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_res.length < 68) return 'Silent revert';
        assembly {
        // Slice the sighash.
            _res := add(_res, 0x04)
        }
        // Remove the selector which is the first 4 bytes
        return abi.decode(_res, (string));
        // All that remains is the revert string
    }
}
