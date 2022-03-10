## `Registrar`






### `query(bytes32, string) → string domain, uint256 signupFee, uint256 rent, uint256 referralFeePPM` (external)





### `register(bytes32, string, address, address payable, address)` (external)





### `rentDue(bytes32, string) → uint256 timestamp` (external)





### `payRent(bytes32, string)` (external)





### `configureDomainFor(string, uint256, uint256, address payable, address)` (external)





### `configureDomainFor(string, uint256, address payable, address payable, address)` (external)

Harmony specific implementation: https://github.com/harmony-one/subdomain-registrar/blob/one-names-v4/contracts/EthRegistrarSubdomainRegistrar.sol#L139



### `register(bytes32, string, address, uint256, string, address)` (external)

Harmony specific implementation: https://github.com/harmony-one/subdomain-registrar/blob/one-names-v4/contracts/EthRegistrarSubdomainRegistrar.sol#L229



### `rentPrice(string, uint256) → uint256` (external)





### `transfer(string name, address payable newOwner)` (external)





### `renew(bytes32 label, string subdomain, uint256 duration)` (external)

Harmony specific: https://github.com/harmony-one/subdomain-registrar/blob/one-names-v4/contracts/EthRegistrarSubdomainRegistrar.sol#L64



### `ens() → address` (external)








