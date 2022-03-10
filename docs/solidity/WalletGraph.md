## `WalletGraph`






### `findBacklink(contract IONEWallet[] backlinkAddresses, address backlink) → uint32` (public)





### `backlinkDelete(contract IONEWallet[] backlinkAddresses, address[] addresses)` (public)





### `backlinkAdd(contract IONEWallet[] backlinkAddresses, address[] addresses)` (public)





### `backlinkOverride(contract IONEWallet[] backlinkAddresses, address[] addresses)` (internal)





### `reclaimDomainFromBacklink(contract IONEWallet[] backlinkAddresses, uint32 backlinkIndex, contract IRegistrar reg, contract IReverseRegistrar rev, bytes data)` (public)





### `command(contract IONEWallet[] backlinkAddresses, enum Enums.TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes data)` (public)





### `batchUpdateForwardAddress(contract IONEWallet[] backlinkAddresses, address payable dest)` (public)






### `BackLinkAltered(address[] added, address[] removed)`





### `InvalidBackLinkIndex(uint256 index)`





### `CommandDispatched(address backlink, bytes commandData)`





### `CommandFailed(address backlink, string reason, bytes commandData)`





### `BackLinkUpdated(address dest, address backlink)`





### `BackLinkUpdateError(address dest, address backlink, string error)`







