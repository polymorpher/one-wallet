pragma solidity ^0.7.6;

import "../core/wallet_data.sol";

library Guardians
{
    event GuardianAdded   (address guardian, uint effectiveTime);
    event GuardianRemoved (address guardian, uint effectiveTime);

    /**
     * @notice Lets an authorised module add a guardian to a wallet.
     * @param _wallet The target wallet.
     * @param _guardian The guardian to add.
     */
    function addGuardian(Core.Wallet storage _wallet, address _guardian) public {
        _wallet.guardians.push(_guardian);
        _wallet.info[_guardian] = Core.GuardianInfo(true, uint128(_wallet.guardians.length - 1));
    }

    /**
     * @notice Lets an authorised module revoke a guardian from a wallet.
     * @param _wallet The target wallet.
     * @param _guardian The guardian to revoke.
     */
    function revokeGuardian(Core.Wallet storage _wallet, address _guardian) public {
        address lastGuardian = _wallet.guardians[_wallet.guardians.length - 1];
        if (_guardian != lastGuardian) {
            uint128 targetIndex = _wallet.info[_guardian].index;
            _wallet.guardians[targetIndex] = lastGuardian;
            _wallet.info[lastGuardian].index = targetIndex;
        }
        delete _wallet.guardians[_wallet.guardians.length - 1];
        delete _wallet.info[_guardian];
    }

    /**
     * @notice Returns the number of guardians for a wallet.
     * @param _wallet The target wallet.
     * @return the number of guardians.
     */
    function guardianCount(Core.Wallet storage _wallet) public view returns (uint256) {
        return _wallet.guardians.length;
    }

    /**
     * @notice Gets the list of guaridans for a wallet.
     * @param _wallet The target wallet.
     * @return the list of guardians.
     */
    function getGuardians(Core.Wallet storage _wallet) public view returns (address[] memory) {
        address[] memory guardians = new address[](_wallet.guardians.length);
        for (uint256 i = 0; i < _wallet.guardians.length; i++) {
            guardians[i] = _wallet.guardians[i];
        }
        return guardians;
    }

    /**
     * @notice Checks if an account is a guardian for a wallet.
     * @param _wallet The target wallet.
     * @param _guardian The account.
     * @return true if the account is a guardian for a wallet.
     */
    function isGuardian(Core.Wallet storage _wallet, address _guardian) public view returns (bool) {
        return _wallet.info[_guardian].exists;
    }

}

