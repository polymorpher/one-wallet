// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./Enums.sol";
import "./IONEWallet.sol";

library CoreManager {
    event CoreDisplaced(IONEWallet.CoreSetting oldCore, IONEWallet.CoreSetting newCore);
    event CoreDisplacementFailed(IONEWallet.CoreSetting newCore, string reason);

    function displaceCoreWithValidationByBytes(IONEWallet.CoreSetting[] storage oldCores, IONEWallet.CoreSetting storage core, bytes memory data, address forwardAddress) public {
        IONEWallet.CoreSetting memory newCore = abi.decode(data, (IONEWallet.CoreSetting));
        displaceCoreWithValidation(oldCores, core, newCore, forwardAddress);
    }

    function displaceCoreWithValidation(IONEWallet.CoreSetting[] storage oldCores, IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting memory newCore, address forwardAddress) public {
        // if recovery is already performed on this wallet, or the wallet is already upgrade to a new version, or set to forward to another address (hence is controlled by that address), its lifespan should not be extended
        if (forwardAddress != address(0)) {
            emit CoreDisplacementFailed(newCore, "Wallet deprecated");
            return;
        }
        // we should not require the recovery address to approve this operation, since the ability of recovery address initiating an auto-triggered recovery (via sending 1.0 ONE) is unaffected after the root is displaced.
        displaceCore(oldCores, core, newCore);
    }

    function displaceCore(IONEWallet.CoreSetting[] storage oldCores, IONEWallet.CoreSetting storage core, IONEWallet.CoreSetting memory newCore) public {
        IONEWallet.CoreSetting memory oldCore = core;
        if (newCore.t0 + newCore.lifespan <= oldCore.t0 + oldCore.lifespan || newCore.t0 <= oldCore.t0) {
            emit CoreDisplacementFailed(newCore, "Must have newer time range");
            return;
        }
        if (newCore.root == oldCore.root) {
            emit CoreDisplacementFailed(newCore, "Must have different root");
            return;
        }
        oldCores.push(oldCore);
        core.root = newCore.root;
        core.t0 = newCore.t0;
        core.height = newCore.height;
        core.interval = newCore.interval;
        core.lifespan = newCore.lifespan;
        core.maxOperationsPerInterval = newCore.maxOperationsPerInterval;
        emit CoreDisplaced(oldCore, core);
    }
}
