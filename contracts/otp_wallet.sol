pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./core/wallet_data.sol";
import "./features/guardians.sol";
import "./features/daily_limit.sol";

contract TOTPWallet {
    uint8 public treeHeight;
    uint public timePeriod;
    bytes16 public rootHash;
    uint public timeOffset;
    address payable public drainAddr;

    using Guardians for Core.Wallet;
    using DailyLimit for Core.Wallet;
    Core.Wallet wallet;

    event DebugEvent(bytes16 data);
    event DebugEventN(uint32 data);
    event WalletTransfer(address to, uint amount);
    event WalletTotpMismatch(bytes16 totp);
    event Deposit(address indexed sender, uint value);

    constructor(bytes16 rootHash_, uint8 merkelHeight_, uint timePeriod_, 
                uint timeOffset_, address payable drainAddr_, uint dailyLimit_)
    {
        rootHash = rootHash_;
        treeHeight = merkelHeight_;
        timePeriod = timePeriod_;
        timeOffset = timeOffset_;
        drainAddr = drainAddr_;
        wallet.dailyLimit = dailyLimit_;
    }   

    modifier onlyValidTOTP(bytes16[] memory confirmMaterial, bytes20 sides) 
    {
        require(_deriveChildTreeIdx(sides) == getCurrentCounter(), "unexpected counter value"); 
        bytes16 reduced = _reduceConfirmMaterial(confirmMaterial, sides);
        require(reduced==rootHash, "unexpected proof");
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
    function drain(bytes16[] calldata confirmMaterial, bytes20 sides) external onlyValidTOTP(confirmMaterial, sides)  {
        drainAddr.transfer(address(this).balance);            
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
         returns (address[] memory )
     {
         return wallet.guardians;
     }

    //
    // Recovery functions
    //

    function recovery(bytes16 rootHash_, uint8 merkelHeight_, uint timePeriod_, 
                uint timeOffset_) external {

    }

    //
    // Utility functions
    //

    // 1609459200 is 2021-01-01 00:00:00
    function getCurrentCounter() public view returns (uint) {
        return (block.timestamp-timeOffset)/timePeriod;
    }

    function remainingTokens() public view returns (uint) {
        // timeOffset + (DURATION*2^depth) < current time
        //uint lastTokenExpires = timeOffset + (timePeriod * (2**treeHeight));
        return 2**uint(treeHeight) - getCurrentCounter();
    }
        
    //
    // Private functions
    //
    
    function _deriveChildTreeIdx(bytes20 sides) private view returns (uint32) {
        uint32 derivedIdx = 0;
        for(uint8 i = 0 ; i <treeHeight ; i++){
            if(byte(0x01) == sides[i]){
                derivedIdx |=  uint32(0x01) << i;
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
        for (uint8 i = 1; i < authPath.length ; i++) {
            if(byte(0x00) == sides[i - 1]){
                authPath[0] = bytes16(keccak256(abi.encodePacked(authPath[0], authPath[i])));
            } else{
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
