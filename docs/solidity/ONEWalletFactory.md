## `ONEWalletFactory`

This factory is expected to be deployed only once. Its deployed address will be used by clients to infer expected address of their 1wallet (given seed) and verify the address is as expected (thus validating the implementation)




### `predict(uint256 salt, bytes code) → address` (public)

This method may be called by ONEWalletFactoryHelper to verify an address is created using 1wallet code, and by clients who do not want to compute the address by themselves.



### `hasCode(address addr) → bool` (public)





### `deploy(uint256 salt, bytes code) → address` (public)

an alternative is to use create3 mechanisms (and library) in https://github.com/0xsequence/create3, which allows the address of the contract to be independent to its code. This is achieved by deploying (via CREATE2) a proxy contract with fixed content and to have the proxy contract pointing to the actual implementation contract (which its address does depend on the bytecode). This approach has two downsides: (1) unlike CREATE2, the client would not be able to verify the contract does contain the intended code simply by verifying the address is as expected. (2) the use of proxy and fallback mechanisms make debugging harder and may introduce unexpected behaviors






