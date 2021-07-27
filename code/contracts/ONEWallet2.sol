// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract ONEWallet2 {
    bytes32 root; // Note: @ivan brought up a good point in reducing this to 16-bytes so hash of two consecutive nodes can be done in a single word (to save gas and reduce blockchain clutter). Let's not worry about that for now and re-evalaute this later.
    uint8 height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
    uint8 interval; // otp interval in seconds, default is 30
    uint32 t0; // starting time block (effectiveTime (in ms) / interval)
    uint32 lifespan;  // in number of blocks (e.g. 1 block per [interval] seconds)
    
    address payable lastResortAddress; // where money will be sent during a recovery process (or when the wallet is beyond its lifespan)
    bytes32 recoveryHash; // hash of the secret stored at the client, which can be used to recover the walletif the user loses the authenticator
    uint8 constant MAX_REVEAL_DELAY = 2; // in OTP intervals (i.e., 2 * interval seconds)    
    
    // Management of daily spendings
    uint dailyLimit; // uint128 is sufficient, but uint256 is more efficient since EVM works with 32-byte words.
    mapping(uint => uint) dailySpendings; // day => amount ; this mapping can have maximally a single value at the time -- except the execution time of the reveal(). However, in contrast to 2-var approach for daily spending, it is still valid and in the case of inactivity it refers to the last day of transfer    
    uint32 lastExecutedTransfer; // in days since epoch; Since the transfer is the only operation that changes dailySpendings, we need to record the day of the recent transfer for cleanup of daily spendings.
    
    uint32 lastRevealedOTPIdx; // stores the index of the valid OTP that was revealed as the last one within reveal() -- this is to avoid reply attacks within the same OTP interval by not allowing commits <= than this number or repeating reveal with stolen arguments from incompleed reveal().

    uint32 lastCleanUpOfCommitsIdx; // the OTP idx of the last OTP interval when clean up of malicious or accidental commits was made

    enum OperType { TRANSFER, RECOVERY, SET_LAST_RESORT_ADDR }

    struct Commit {
        bytes32 hash;          // h(eOTP || operType || ...params)  
        uint timestamp;      // OTP must be valid in this time; not in the time of reveal 
    }    
    mapping(uint32 => Commit[]) public commits; // idx of OTP valid during a commitment => commitment data

    event UnknownTransferError(address dest);
    event UnknownOperationType(OperType otype);

    constructor(bytes32 root_, bytes32 recoveryHash_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_, address payable lastResortAddress_, uint256 dailyLimit_){                
        root = root_; // Merkle root for OTPs
        recoveryHash = recoveryHash_;
        height = height_;
        interval = interval_;        
        t0 = t0_; 
        lifespan_ = lifespan_;
        lastResortAddress = lastResortAddress_;
        dailyLimit = dailyLimit_; 
        // lastRevealedOTPIdx = 0; // implicit
        // lastExecutedTransfer = 0; // implicit
        // lastCleanUpOfCommitsIdx = 0; // implicit
    }

    receive() external payable {}

    /**
     * This is a general commit and should work with all kinds of operations.
     * Note that there can be multiple commits submitted in the current interval, while only the first matching one will be executed in reveal().
     */
    function commit(bytes32 hash) external {
        uint32 submittedOTPIdx = uint32(block.timestamp) / interval - t0;
        require(submittedOTPIdx > lastRevealedOTPIdx, "The OTP of the current interval was already revealed. It is not possible to submit commits in the current OTP interval anymore. Wait for the next interval.");
        Commit memory nc = Commit(hash, block.timestamp);
        commits[submittedOTPIdx].push(nc);                
    }

    /**
     * This is a general reveal for all types of operation. Arguments contain all possible parameters as the union (only the relevant args for a particular operation are used).
     * It cannot revert with not yet invalidated OTP, since the attacker can steal it + its  proof and misuse it for the malicious commit() and reveal().
     */
    function reveal(bytes32[] calldata neighbors, uint32 otpIdx, bytes32 eotp, OperType operType, address payable addr, uint amount) external returns (bool) {                        

        // 1) Check time constrains of reveal
        uint32 currentIdx = uint32(block.timestamp) / interval - t0; // check whether idx of OTP is timely
        require(currentIdx - otpIdx <= MAX_REVEAL_DELAY, "Reveal is out of max allowed delay."); // here is OK to revert, coz if revert fails, submitted eotp + proof are invalidated already and cannot be misused anymore.

        // 2) scan all the commits made within otpIdx interval and execute the first matching one        
        for (uint i = 0; i < commits[otpIdx].length; i++) {
            bytes32 hashedArgs = keccak256(abi.encodePacked(eotp, operType, addr, amount));
            if(hashedArgs == commits[otpIdx][i].hash){                
                
                // 3) verify the provided OTP in a specific way, according to the operation type
                if(operType != OperType.RECOVERY){                                        
                    _verifyMerkleProof(neighbors, otpIdx, eotp);
                } else {
                    require(keccak256(abi.encodePacked(eotp)) == recoveryHash, "Provided secret for recovery is incorrect."); // here is also OK to revert since invalid secret (in eotp) was submitted
                }

                // 4) execute the operation according to its type; never revert since a valid OTP + proof are already submitted in args.
                if(operType == OperType.TRANSFER){                    

                    if(!_executeTransfer(addr, amount)){
                        lastRevealedOTPIdx = otpIdx; // do not allow to call reveal with this eotp again
                        return false; // if daily limit is not met or there was an error with send()
                    }                
                    _cleanUpDailySpendings(); // clean up only after a successful transfer

                } else if(operType == OperType.SET_LAST_RESORT_ADDR){
                    if(lastResortAddress == address(0x0) && addr != address(0x0)) // alow setting up last resort address only if it was 0x0 before
                        lastResortAddress = addr;
                } else if(operType == OperType.RECOVERY){ // we do not care about params in Commits
                    _drain(); // IH: I do not find any reason for this operation to be executed using OTP.
                } else {
                    emit UnknownOperationType(operType);                    
                }                
                
                delete commits[otpIdx];
                lastRevealedOTPIdx = otpIdx; // it is not possible to execute any operations using the otpIdx anymore (handled in commit)
                return true;
            }
        }
        return false;        
    }

    //////////////////////// Public Aux Functions ////////////////////////// 

    /**
     * It serves for the deletion of accidentaly submitted commits by the user or malicious commits submitted by the attackers, which contribute to the total storage allocation.
     * Currently, this method can be called by anybody since it does touch only the garbage. 
     * Also, in theory, someone may earn gas if there are too many entries submitted by the attacker (who payed for it).
     */
    function cleanUpCommits() external {                 
        for (uint32 i = lastCleanUpOfCommitsIdx; i <= lastRevealedOTPIdx; i++){ // IH: in theory, this might lead to out-of-gas exception for settings of TOTP with very long validity but currently I'd not be affraid. Moreover, we are  getting the gas back for successfull deletions.
            delete commits[i]; // NOTE: I'd say it makes no difference whether it was initialized or not, so we can delete any entry.        
        }
        lastCleanUpOfCommitsIdx = lastRevealedOTPIdx; // shift commit clean-up checkpoint
    }

    function getCurrentSpending() external view returns (uint){ 
        return dailySpendings[block.timestamp / 1 days];
    }        

    function retire() external returns (bool){
        require(uint32(block.timestamp / interval) - t0 > lifespan, "Too early to retire");        
        return _drain();
    }

    //////////////////////// Internal Functions ////////////////////////// 

    /**
     * It cleans up the previous value of daily spending from the map (this ensures that map has always only a single value -- except the execution time of the reveal())
     * Can be called only after successfully executed transfer within reveal().
     */      
    function _cleanUpDailySpendings() internal {
        uint32 curDay = uint32(block.timestamp / 1 days);
        if(curDay > lastExecutedTransfer ){
            delete dailySpendings[lastExecutedTransfer];
        }
        lastExecutedTransfer = curDay; // shift the clean-up checkpoint
    }    

    function _verifyMerkleProof(bytes32[] calldata neighbors, uint32 index, bytes32 eotp) internal view
    {                
        require(neighbors.length == height - 1, "Not enough neighbors provided");
        bytes32 h = keccak256(abi.encodePacked(eotp));
        for (uint8 i = 0; i < height - 1; i++) {
            if ((index & 0x01) == 0x01) {
                h = keccak256(abi.encodePacked(neighbors[i], h));                
            } else {
                h = keccak256(abi.encodePacked(h, neighbors[i]));
            }
            index >>= 1;
        }
        require(root == h, "Proof is incorrect");        
    }

    function _executeTransfer(address payable dest, uint amount) internal returns(bool) {
        if(dailySpendings[block.timestamp / 1 days] + amount > dailyLimit)
            return false; // Daily limit exceeded.        
        
        if(!dest.send(amount))
            return false; // Unknown transfer error.
                 
        dailySpendings[block.timestamp / 1 days] += amount;
        return true;
    }  

    function _drain() internal returns (bool) {
        return lastResortAddress.send(address(this).balance);
    }    
}