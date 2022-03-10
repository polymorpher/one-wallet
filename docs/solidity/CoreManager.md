## `CoreManager`






### `displace(struct IONEWallet.CoreSetting[] oldCores, struct IONEWallet.CoreSetting[] innerCores, struct IONEWallet.CoreSetting core, bytes[] identificationKeys, bytes data, address forwardAddress)` (public)





### `displaceCore(struct IONEWallet.CoreSetting[] oldCores, struct IONEWallet.CoreSetting[] innerCores, struct IONEWallet.CoreSetting core, bytes[] identificationKeys, struct IONEWallet.CoreSetting newCore, struct IONEWallet.CoreSetting[] newInnerCores, bytes newIdentificationKey)` (public)

Note: parameter verifications on inner cores are not done. Client should do it




### `CoreDisplaced(struct IONEWallet.CoreSetting oldCore, struct IONEWallet.CoreSetting newCore, struct IONEWallet.CoreSetting[] newInnerCores)`





### `CoreDisplacementFailed(struct IONEWallet.CoreSetting newCore, struct IONEWallet.CoreSetting[] newInnerCores, string reason)`







