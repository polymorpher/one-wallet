// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

import "./IONEWallet.sol";
import "./DomainManager.sol";

library WalletGraph {
    event BackLinkAltered(address[] added, address[] removed); // in case of override, both args would be empty
    event InvalidBackLinkIndex(uint256 index);
    event CommandDispatched(address backlink, bytes commandData); // omitting the rest of the parameters, since it would be the same compared to the parameters in the method call
    event CommandFailed(address backlink, string reason, bytes commandData);

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

    function reclaimDomainFromBacklink(IONEWallet[] storage backlinkAddresses, uint32 backlinkIndex, IRegistrar reg, IReverseRegistrar rev, bytes memory data) public {
        if (backlinkIndex >= backlinkAddresses.length) {
            emit InvalidBackLinkIndex(backlinkIndex);
            return;
        }
        (address resolver, bytes32 subnode, string memory fqdn) = abi.decode(data, (address, bytes32, string));
        // transfer the domain to this wallet
        bytes memory commandData = abi.encode(OperationType.TRANSFER_DOMAIN, TokenType.NONE, address(reg), uint256(bytes32(bytes20(resolver))), payable(address(this)), uint256(subnode), "");
        try backlinkAddresses[backlinkIndex].reveal(new bytes32[](0), 0, bytes32(0), OperationType.TRANSFER_DOMAIN, TokenType.NONE, address(reg), uint256(bytes32(bytes20(resolver))), payable(address(this)), uint256(subnode), ""){
            emit CommandDispatched(address(backlinkAddresses[backlinkIndex]), commandData);
        } catch Error(string memory reason){
            emit CommandFailed(address(backlinkAddresses[backlinkIndex]), reason, commandData);
        } catch {
            emit CommandFailed(address(backlinkAddresses[backlinkIndex]), "", commandData);
        }
        // reclaim reverse domain for the domain
        DomainManager.reclaimReverseDomain(address(rev), fqdn);
    }

    function command(IONEWallet[] storage backlinkAddresses, TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data) public {
        (address backlink, uint16 operationType, bytes memory commandData) = abi.decode(data, (address, uint16, bytes));
        if (findBacklink(backlinkAddresses, backlink) == backlinkAddresses.length) {
            emit CommandFailed(backlink, "Not linked", commandData);
            return;
        }
        try IONEWallet(backlink).reveal(new bytes32[](0), 0, bytes32(0), OperationType(operationType), tokenType, contractAddress, tokenId, dest, amount, commandData){
            emit CommandDispatched(backlink, commandData);
        }catch Error(string memory reason){
            emit CommandFailed(backlink, reason, commandData);
        }catch {
            emit CommandFailed(backlink, "", commandData);
        }
    }
}
