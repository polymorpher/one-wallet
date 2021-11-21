// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./IONEWallet.sol";

library CoreManager {
    event CoreDisplaced(IONEWallet.CoreSetting oldCore, IONEWallet.CoreSetting newCore, IONEWallet.CoreSetting[] newInnerCores);
    event CoreDisplacementFailed(IONEWallet.CoreSetting newCore, IONEWallet.CoreSetting[] newInnerCores, string reason);

    function displace(
        IONEWallet.CoreSetting[] storage oldCores,
        IONEWallet.CoreSetting[] storage innerCores,
        IONEWallet.CoreSetting storage core,
        bytes[] storage identificationKeys,
        bytes memory data,
        address forwardAddress
    ) public {
        (IONEWallet.CoreSetting memory newCore, IONEWallet.CoreSetting[] memory newInnerCores, bytes memory newIdentificationKey) = abi.decode(data, (IONEWallet.CoreSetting, IONEWallet.CoreSetting[], bytes));
        // if recovery is already performed on this wallet, or the wallet is already upgrade to a new version, or set to forward to another address (hence is controlled by that address), its lifespan should not be extended
        if (forwardAddress != address(0)) {
            emit CoreDisplacementFailed(newCore, newInnerCores, "Wallet deprecated");
            return;
        }
        displaceCore(oldCores, innerCores, core, identificationKeys, newCore, newInnerCores, newIdentificationKey);
    }

    /// Note: parameter verifications on inner cores are not done. Client should do it
    function displaceCore(
        IONEWallet.CoreSetting[] storage oldCores,
        IONEWallet.CoreSetting[] storage innerCores,
        IONEWallet.CoreSetting storage core,
        bytes[] storage identificationKeys,
        IONEWallet.CoreSetting memory newCore,
        IONEWallet.CoreSetting[] memory newInnerCores,
        bytes memory newIdentificationKey
    ) public {
        IONEWallet.CoreSetting memory oldCore = core;
        if (newCore.t0 + newCore.lifespan <= oldCore.t0 + oldCore.lifespan || newCore.t0 <= oldCore.t0) {
            emit CoreDisplacementFailed(newCore, newInnerCores, "Must have newer time range");
            return;
        }
        if (newCore.root == oldCore.root) {
            emit CoreDisplacementFailed(newCore, newInnerCores, "Must have different root");
            return;
        }
        if(newIdentificationKey.length == 64){
            identificationKeys.push(newIdentificationKey);
        }
        oldCores.push(oldCore);
        core.root = newCore.root;
        core.t0 = newCore.t0;
        core.height = newCore.height;
        core.interval = newCore.interval;
        core.lifespan = newCore.lifespan;
        core.maxOperationsPerInterval = newCore.maxOperationsPerInterval;
        for (uint32 i = 0; i < newInnerCores.length; i++) {
            innerCores.push(newInnerCores[i]);
        }
        emit CoreDisplaced(oldCore, core, newInnerCores);
    }
}
