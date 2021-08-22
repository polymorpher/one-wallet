// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;
import "./IONEWallet.sol";

library WalletGraph {
    event BackLinkAltered(address[] added, address[] removed); // in case of override, both args would be empty
    event InvalidBackLinkIndex(uint256 index);
    function findBacklink(IONEWallet[] storage backlinkAddresses, address backlink) public view returns (uint32){
        for (uint32 i = 0; i < backlinkAddresses.length; i++) {
            if (address(backlinkAddresses[i]) == backlink) {
                return i;
            }
        }
        return uint32(backlinkAddresses.length);
    }

    function backlinkDelete(IONEWallet[] storage backlinkAddresses, address[] memory addresses) public {
        uint32 numRemoved = 0;
        address[] memory removed = new address[](addresses.length);
        for (uint32 j = 0; j < addresses.length; j++) {
            address dest = addresses[j];
            uint32 position = findBacklink(backlinkAddresses, dest);
            if (position < backlinkAddresses.length) {
                removed[numRemoved] = dest;
                numRemoved += 1;
                backlinkAddresses[position] = backlinkAddresses[backlinkAddresses.length - 1];
                backlinkAddresses.pop();
            }
        }
        if (numRemoved > 0) {
            emit BackLinkAltered(new address[](0), removed);
        }
    }

    function backlinkAdd(IONEWallet[] storage backlinkAddresses, address[] memory addresses) public {
        address[] memory added = new address[](addresses.length);
        for (uint32 i = 0; i < addresses.length; i++) {
            uint32 position = findBacklink(backlinkAddresses, addresses[i]);
            if (position == backlinkAddresses.length) {
                added[i] = addresses[i];
            }
        }
        for (uint32 i = 0; i < added.length; i++) {
            if (added[i] != address(0)) {
                backlinkAddresses.push(IONEWallet(added[i]));
            }
        }
        emit BackLinkAltered(added, new address[](0));
    }

    function backlinkOverride(IONEWallet[] storage backlinkAddresses, address[] memory addresses) internal {
        for (uint32 i = 0; i < backlinkAddresses.length - addresses.length; i++) {
            backlinkAddresses.pop();
        }
        for (uint32 i = 0; i < addresses.length; i++) {
            backlinkAddresses[i] = IONEWallet(addresses[i]);
        }
        emit BackLinkAltered(new address[](0), new address[](0));
    }
}
