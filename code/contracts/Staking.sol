//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.4;

/// from https://github.com/MaxMustermann2/harmony-staking-precompiles/blob/main/contracts/lib/StakingPrecompiles.sol
abstract contract StakingPrecompilesSelectors {
    function Delegate(address delegatorAddress,
        address validatorAddress,
        uint256 amount) public virtual;

    function Undelegate(address delegatorAddress,
        address validatorAddress,
        uint256 amount) public virtual;

    function CollectRewards(address delegatorAddress) public virtual;

    function Migrate(address from, address to) public virtual;
}

library Staking {
    enum StakingAction {
        CREATE_VALIDATOR, // unused
        EDIT_VALIDATOR, // unused
        DELEGATE,
        UNDELEGATE,
        COLLECT_REWARDS
    }

    event StakingSuccess(StakingAction action, address validatorAddress, uint256 amount, uint256 result);
    event StakingFailure(StakingAction action, address validatorAddress, uint256 amount, uint256 result);

    function _delegate(address validatorAddress, uint256 amount) internal returns (uint256 result) {
        bytes memory encodedInput = abi.encodeWithSelector(StakingPrecompilesSelectors.Delegate.selector,
            address(this),
            validatorAddress,
            amount);
        assembly {
        // we estimate a gas consumption of 25k per precompile
            result := call(25000,
            0xfc,
            0x0,
            add(encodedInput, 32),
            mload(encodedInput),
            mload(0x40),
            0x20
            )
        }
    }

    function _undelegate(address validatorAddress, uint256 amount) internal returns (uint256 result) {
        bytes memory encodedInput = abi.encodeWithSelector(StakingPrecompilesSelectors.Undelegate.selector,
            address(this),
            validatorAddress,
            amount);
        assembly {
            result := call(25000,
            0xfc,
            0x0,
            add(encodedInput, 32),
            mload(encodedInput),
            mload(0x40),
            0x20
            )
        }
    }

    function _collectRewards() internal returns (uint256 result) {
        bytes memory encodedInput = abi.encodeWithSelector(StakingPrecompilesSelectors.CollectRewards.selector,
            address(this));
        assembly {
            result := call(
            25000,
            0xfc,
            0x0,
            add(encodedInput, 32),
            mload(encodedInput),
            mload(0x40),
            0x20
            )
        }
    }

    function epoch() public view returns (uint256) {
        bytes32 input;
        bytes32 epochNumber;
        assembly {
            let memPtr := mload(0x40)
            if iszero(staticcall(not(0), 0xfb, input, 32, memPtr, 32)) {
                invalid()
            }
            epochNumber := mload(memPtr)
        }
        return uint256(epochNumber);
    }

    function delegate(address validatorAddress, uint256 amount) public returns (bool) {
        uint256 result = _delegate(validatorAddress, amount);
        bool success = result != 0;
        if (success) {
            emit StakingSuccess(StakingAction.DELEGATE, validatorAddress, amount, result);
        } else {
            emit StakingFailure(StakingAction.DELEGATE, validatorAddress, amount, result);
        }
        return success;
    }

    function undelegate(address validatorAddress, uint256 amount) public returns (bool) {
        uint256 result = _undelegate(validatorAddress, amount);
        bool success = result != 0;
        if (success) {
            emit StakingSuccess(StakingAction.UNDELEGATE, validatorAddress, amount, result);
        } else {
            emit StakingFailure(StakingAction.UNDELEGATE, validatorAddress, amount, result);
        }
        return success;
    }

    function collectRewards() public returns (bool) {
        uint256 result = _collectRewards();
        bool success = result != 0;
        if (success) {
            emit StakingSuccess(StakingAction.COLLECT_REWARDS, address(0), 0, result);
        } else {
            emit StakingFailure(StakingAction.COLLECT_REWARDS, address(0), 0, result);
        }
        return success;
    }

}