pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./core/wallet_data.sol";
import "./features/guardians.sol";
import "./features/daily_limit.sol";
import "./features/recovery.sol";

contract TOTPWallet {

    using Guardians for Core.Wallet;
    using DailyLimit for Core.Wallet;
    using Recovery for Core.Wallet;
    Core.Wallet public wallet;

    event DebugEvent(bytes16 data);
    event DebugEventN(uint32 data);
    event WalletTransfer(address to, uint amount);
    event Deposit(address indexed sender, uint value);

    constructor(bytes16 rootHash, uint8 height, uint interval,
        uint startTime, address payable drainAddress, uint initialDailyLimit)
    {
        wallet.rootHash = rootHash;
        wallet.merkelHeight = height;
        wallet.timePeriod = interval;
        wallet.timeOffset = startTime;
        wallet.drainAddr = drainAddress;
        wallet.dailyLimit = initialDailyLimit;

    }

    modifier onlyValidTOTP(bytes16[] memory confirmMaterial, bytes20 sides)
    {
        require(_deriveChildTreeIdx(sides) == getCurrentCounter(), "unexpected counter value");
        bytes16 reduced = _reduceConfirmMaterial(confirmMaterial, sides);
        require(reduced == wallet.rootHash, "unexpected proof");
        _;
    }

    function makeTransfer(address payable to, uint amount, bytes16[] calldata confirmMaterial, bytes20 sides) external onlyValidTOTP(confirmMaterial, sides)
    {
        require(wallet.isUnderLimit(amount), "over withdrawal limit");
        require(address(this).balance >= amount, "not enough balance");

        wallet.spentToday += amount;
        to.transfer(amount);
        emit WalletTransfer(to, amount);
    }

    //TODO: Drain ERC20 tokens too
    function drain(bytes16[] calldata confirmMaterial, bytes20 sides) external onlyValidTOTP(confirmMaterial, sides) {
        wallet.drainAddr.transfer(address(this).balance);
    }

    function drain() external {
        require(msg.sender == wallet.drainAddr, "sender != drain");
        require(remainingTokens() <= 0, "not depleted tokens");
        wallet.drainAddr.transfer(address(this).balance);
    }

    //
    // Guardians functions
    //
    function addGuardian(address guardian, bytes16[] calldata confirmMaterial, bytes20 sides)
    external
    onlyValidTOTP(confirmMaterial, sides)
    {
        wallet.addGuardian(guardian);
    }

    function revokeGuardian(address guardian, bytes16[] calldata confirmMaterial, bytes20 sides)
    external
    onlyValidTOTP(confirmMaterial, sides)
    {
        wallet.revokeGuardian(guardian);
    }

    function isGuardian(address addr)
    public
    view
    returns (bool)
    {
        return wallet.isGuardian(addr);
    }

    function getGuardians()
    public
    view
    returns (address[] memory)
    {
        return wallet.guardians;
    }

    //
    // Recovery functions
    //

    function startRecovery(bytes16 rootHash_, uint8 merkelHeight_, uint timePeriod_,
        uint timeOffset_, bytes calldata signatures_) external {
        wallet.startRecovery(rootHash_, merkelHeight_, timePeriod_, timeOffset_, signatures_);
    }

    function isRecovering() external view returns (bool) {
        return wallet.recovery.rootHash != 0x0;
    }

    function cancelRecovery(bytes16[] calldata confirmMaterial, bytes20 sides) external onlyValidTOTP(confirmMaterial, sides) {
        wallet.recovery = Core.RecoveryInfo(0, 0, 0, 0, 0);
    }

    function getRecovery() external view returns (bytes16, uint8, uint, uint) {
        return (wallet.recovery.rootHash, wallet.recovery.merkelHeight, wallet.recovery.timePeriod, wallet.recovery.timeOffset);
    }

    function finalizeRecovery() external {
        wallet.finalizeRecovery();
    }

    //
    // Utility functions
    //

    // 1609459200 is 2021-01-01 00:00:00
    function getCurrentCounter() public view returns (uint) {
        return (block.timestamp - wallet.timeOffset) / wallet.timePeriod;
    }

    function remainingTokens() public view returns (uint) {
        // timeOffset + (DURATION*2^depth) < current time
        //uint lastTokenExpires = timeOffset + (timePeriod * (2**treeHeight));
        uint c = getCurrentCounter();
        uint total = 2 ** uint(wallet.merkelHeight);
        return total > c ? total - c : 0;
    }

    function _deriveChildTreeIdx(bytes20 sides) private view returns (uint32) {
        uint32 derivedIdx = 0;
        for (uint8 i = 0; i < wallet.merkelHeight; i++) {
            if (byte(0x01) == sides[i]) {
                derivedIdx |= uint32(0x01) << i;
            }
        }
        return derivedIdx;
    }

    function _reduceConfirmMaterial(bytes16[] memory confirmMaterial, bytes20 sides) public returns (bytes16) {
        //  and then compute h(OTP) to get the leaf of the tree
        confirmMaterial[0] = bytes16(keccak256(abi.encodePacked(confirmMaterial[0])));
        return _reduceAuthPath(confirmMaterial, sides);
    }

    function _reduceAuthPath(bytes16[] memory authPath, bytes20 sides) internal returns (bytes16){
        for (uint8 i = 1; i < authPath.length; i++) {
            if (byte(0x00) == sides[i - 1]) {
                authPath[0] = bytes16(keccak256(abi.encodePacked(authPath[0], authPath[i])));
            } else {
                authPath[0] = bytes16(keccak256(abi.encodePacked(authPath[i], authPath[0])));
            }
        }
        //emit DebugEvent(authPath[0]);
        return authPath[0];
    }


    /// @dev Fallback function allows to deposit ether.
    receive() external payable {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

}
