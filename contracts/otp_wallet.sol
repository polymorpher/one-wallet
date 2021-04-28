pragma solidity 0.4.24;

contract TOTPWallet {
    uint8 public treeHeight;
    uint public timePeriod;
    bytes16 public rootHash;
    uint public timeOffset;
    address public drainAddr;
    uint public withdrawLimit;

    event DebugEvent(bytes16 data);
    event DebugEventN(uint32 data);
    event WalletTransfer(address to, uint amount);
    event WalletTotpMismatch(bytes16 totp);
    event Deposit(address indexed sender, uint value);

    constructor(bytes16 rootHash_, uint8 merkelHeight_, uint timePeriod_, uint timeOffset_, address drainAddr_, uint withdrawLimit_) public {
        rootHash = rootHash_;
        treeHeight = merkelHeight_;
        timePeriod = timePeriod_;
        timeOffset = timeOffset_;
        drainAddr = drainAddr_;
        withdrawLimit = withdrawLimit_;
    }   

    //TODO: Drain ERC20 tokens too
    function drain(bytes16[] memory confirmMaterial, bytes20 sides) public {
        bytes16 proof = evaluateProof(confirmMaterial, sides);
        if (proof==rootHash) {
             drainAddr.transfer(address(this).balance);            
        } else {
             emit WalletTotpMismatch(proof);            
        }
    }

    function evaluateProof(bytes16[] memory confirmMaterial, bytes20 sides) private view returns (bytes16) {
        require(_deriveChildTreeIdx(sides) == getCurrentCounter(), "unexpected counter value"); 
        //require(confirmMaterial.length, treeHeight+1, "unexpected proof");

        //emit DebugEventN(_deriveChildTreeIdx(sides));

        return _reduceConfirmMaterial(confirmMaterial, sides);
    }

    function makeTransfer(address to, uint amount, bytes16[] memory confirmMaterial, bytes20 sides) public {
        // fire off totp check
        require(amount <= withdrawLimit, "over withdrawal limit");
        require(address(this).balance >= amount, "not enough balance");  
        require(_deriveChildTreeIdx(sides) == getCurrentCounter(), "unexpected counter value"); 
        //require(confirmMaterial.length, treeHeight+1, "unexpected proof");

        //emit DebugEventN(_deriveChildTreeIdx(sides));

        bytes16 proof = _reduceConfirmMaterial(confirmMaterial, sides);
        if (proof == rootHash) {
             to.transfer(amount);
             emit WalletTransfer(to, amount);             
        } else {
             emit WalletTotpMismatch(proof);            
        }
    }

    // 1609459200 is 2021-01-01 00:00:00
    function getCurrentCounter() public view returns (uint) {
        return (block.timestamp-timeOffset)/timePeriod;
    }

    function hasRemainingTokens() public view returns (bool) {
        // timeOffset + (DURATION*2^depth) < current time
        //uint lastTokenExpires = timeOffset + (timePeriod * (2**treeHeight));
        return getCurrentCounter() < 2**uint(treeHeight);
    }

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
    function() public
        payable
    {
        if (msg.value > 0)
            emit Deposit(msg.sender, msg.value);
    }

}
