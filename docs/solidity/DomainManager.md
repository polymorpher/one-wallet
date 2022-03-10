## `DomainManager`






### `buyDomainEncoded(bytes data, uint256 maxPrice, uint8 subdomainLabelLength, address reg, address resolver) → bool` (public)





### `buyDomain(contract IRegistrar reg, contract IReverseRegistrar rev, address resolver, uint256 maxPrice, string subdomain, bytes32 node, string fqdn) → bool` (public)





### `reclaimReverseDomain(address rev, string fqdn) → bool` (public)





### `transferDomain(contract IRegistrar reg, address resolver, bytes32 subnode, address payable dest)` (public)

WARNING: this function may revert. Guard against it.



### `renewDomain(contract IRegistrar reg, bytes32 node, string subdomain, uint256 maxPrice) → bool` (public)





### `_revertReason(bytes _res) → string` (internal)

https://github.com/Uniswap/uniswap-v3-periphery/blob/v1.0.0/contracts/base/Multicall.sol




### `DomainRegistered(address subdomainRegistrar, string subdomain, bytes32 domainLabel)`





### `ReverseDomainClaimed(address reverseRegistrar, bytes32 nodeHash)`





### `ReverseDomainClaimError(string reason)`





### `InvalidFQDN(string fqdn, uint32 subdomainLabelLength)`





### `DomainRegistrationFailed(string reason)`





### `AttemptRegistration(bytes32 node, string subdomain, address owner, uint256 duration, string url, address resolver)`





### `DomainTransferFailed(string reason)`





### `AttemptRenewal(bytes32 node, string subdomain, uint256 duration)`





### `DomainRenewalFailed(string reason)`





### `DomainTransferred(bytes32 subnode, address dest)`





### `DomainRenewed(bytes32 node, string subdomain, uint256 duration)`







