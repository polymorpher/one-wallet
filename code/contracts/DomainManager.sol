// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "@ensdomains/subdomain-registrar-core/contracts/Resolver.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol";
import "@ensdomains/subdomain-registrar-core/contracts/interfaces/IReverseRegistrar.sol";

library DomainManager {
    uint256 constant MIN_DOMAIN_RENT_DURATION = 31536000;

    event DomainRegistered(address subdomainRegistrar, string subdomain, bytes32 domainLabel);
    event ReverseDomainClaimed(address reverseRegistrar, bytes32 nodeHash);
    event ReverseDomainClaimError(string reason);
    event InvalidFQDN(string fqdn, uint32 subdomainLabelLength);
    event DomainRegistrationFailed(string reason);
    event AttemptRegistration(bytes32 node, string subdomain, address owner, uint256 duration, string url, address resolver);
    event DomainTransferFailed(string reason);
    event AttemptRenewal(bytes32 node, string subdomain, uint256 duration);
    event DomainRenewalFailed(string reason);
    event DomainTransferred(bytes32 subnode, address dest);
    event DomainRenewed(bytes32 node, string subdomain, uint256 duration);


    function buyDomainEncoded(bytes calldata data, uint256 maxPrice, uint8 subdomainLabelLength, address reg, address resolver) public returns (bool) {
        (address rev, bytes32 node, string memory fqdn) = abi.decode(data, (address, bytes32, string));
        bytes memory bfqdn = bytes(fqdn);
        if (bfqdn.length > 64 || bfqdn.length < subdomainLabelLength) {
            emit InvalidFQDN(fqdn, subdomainLabelLength);
            return false;
        }
        bytes memory subdomainBytes = new bytes(subdomainLabelLength);
        for (uint i = 0; i < subdomainLabelLength; i++) {
            subdomainBytes[i] = bfqdn[i];
        }
        string memory subdomain = string(subdomainBytes);
        return buyDomain(IRegistrar(reg), IReverseRegistrar(rev), resolver, maxPrice, subdomain, node, fqdn);
    }

    function buyDomain(IRegistrar reg, IReverseRegistrar rev, address resolver, uint256 maxPrice, string memory subdomain, bytes32 node, string memory fqdn) public returns (bool) {
        //        (bool success, bytes memory ret) = address(reg).call{value : maxPrice}(abi.encodeWithSignature("register(bytes32,string,address,address,address)", node, subdomain, address(this), address(0x0), resolver));
        (bool success, bytes memory ret) = address(reg).call{value : maxPrice}(abi.encodeWithSignature("register(bytes32,string,address,uint256,string,address)", node, subdomain, address(this), MIN_DOMAIN_RENT_DURATION, "", resolver));
        emit AttemptRegistration(node, subdomain, address(this), MIN_DOMAIN_RENT_DURATION, "", resolver);
        if (!success) {
            string memory reason = _revertReason(ret);
            emit DomainRegistrationFailed(reason);
            return false;
        }
        emit DomainRegistered(address(reg), subdomain, node);
        try rev.setName(fqdn) returns (bytes32 revNodeHash){
            emit ReverseDomainClaimed(address(rev), revNodeHash);
        } catch Error(string memory reason){
            emit ReverseDomainClaimError(reason);
        } catch {
            emit ReverseDomainClaimError("");
        }
        return true;
    }

    function reclaimReverseDomain(address rev, string memory fqdn) public returns (bool){
        try IReverseRegistrar(rev).setName(fqdn) returns (bytes32 revNodeHash){
            emit ReverseDomainClaimed(rev, revNodeHash);
            return true;
        } catch Error(string memory reason){
            emit ReverseDomainClaimError(reason);
        } catch {
            emit ReverseDomainClaimError("");
        }
        return false;
    }

    /// WARNING: this function may revert. Guard against it.
    function transferDomain(IRegistrar reg, address resolver, bytes32 subnode, address payable dest) public {
        address ens = reg.ens();
        Resolver(resolver).setAddr(subnode, dest);
        ENS(ens).setOwner(subnode, dest);
        emit DomainTransferred(subnode, dest);
    }

    function renewDomain(IRegistrar reg, bytes32 node, string memory subdomain, uint256 maxPrice) public returns (bool){
        (bool success, bytes memory ret) = address(reg).call{value : maxPrice}(abi.encodeWithSignature("renew(bytes32,string,uint256)", node, subdomain, MIN_DOMAIN_RENT_DURATION));
        emit AttemptRenewal(node, subdomain, MIN_DOMAIN_RENT_DURATION);
        if (!success) {
            string memory reason = _revertReason(ret);
            emit DomainRenewalFailed(reason);
            return false;
        }
        emit DomainRenewed(node, subdomain, MIN_DOMAIN_RENT_DURATION);
        return true;
    }

    /// https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/base/Multicall.sol
    function _revertReason(bytes memory _res) internal pure returns (string memory) {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_res.length < 68) return "";
        assembly {
        // Slice the sighash.
            _res := add(_res, 0x04)
        }
        // Remove the selector which is the first 4 bytes
        return abi.decode(_res, (string));
        // All that remains is the revert string
    }
}
