// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

abstract contract Forwardable{
    function _getForwardAddress() internal virtual returns (address payable){
        return payable(address(0));
    }
}
