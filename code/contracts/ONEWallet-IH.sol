// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.0;

contract ONEWallet {

    bytes32 root; // Note: @ivan brought up a good point in reducing this to 16-bytes so hash of two consecutive nodes can be done in a single word (to save gas and reduce blockchain clutter). Let's not worry about that for now and re-evalaute this later.
    uint8 height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
    uint8 interval; // otp interval in seconds, default is 30
    uint32 t0; // starting time block (effectiveTime (in ms) / interval)
    uint32 lifespan;  // in number of blocks (e.g. 1 block per [interval] seconds)
    
    address payable lastResortAddress; // where money will be sent during a recovery process (or when the wallet is beyond its lifespan)
    uint8 constant MAX_REVEAL_DELAY = 2; // in OTP intervals (i.e., 2 * interval seconds)    
    
    // Management of daily spendings
    uint256 dailyLimit; // uint128 is sufficient, but uint256 is more efficient since EVM works with 32-byte words.
    mapping(uint => uint) dailySpendings; // day => amount ; can be cleaned up once in a while to save storage
    uint cleanupCheckpoint; // the index of the day since epoch, when the last cleanup was made
    uint16 constant CLEAN_UP_DAILY_SPENDING_BATCH = 1024; // this is to avoid out-of-gas exceptions
    uint8 AUTO_CLEANUP_DAYS = 100; // do the auto cleanup of daily spending data after every 100 days
    
    uint lastExecutedIdx; // stores the index of OTP that was executed last (this is to avoid reply attacks within the same OTP interval by not allowing commits <= than this number)

    enum OperType { TRANSFER, RECOVERY, SET_LAST_RESORT_ADDR }

    struct Commit {
        bytes32 hash;          // h(eOTP || operType || params)  
        uint timestamp;      // OTP must be valid in this time; not in the time of reveal        
        OperType operType;
        // below are operation-specific parameters, based on operType
        address payable addr; 
        uint amount;        
    }    
    mapping(uint32 => Commit[]) public commits; // idx of OTP valid during a commitment => commitment data

    event UnknownTransferError(address dest);
    event UnknownOperationType(OperType otype);

    constructor(bytes32 root_, uint8 height_, uint8 interval_, uint32 t0_, uint32 lifespan_, address payable lastResortAddress_, uint256 dailyLimit_){        
        require(lastResortAddress_ != address(0), "Last resort address is not set");
        root = root_;
        height = height_;
        interval = interval_;        
        t0 = t0_; 
        lifespan_ = lifespan_;
        lastResortAddress = lastResortAddress_;
        dailyLimit = dailyLimit_; 
        cleanupCheckpoint = block.timestamp / 1 days;     // init to day before
    }

    receive() external payable {}

    /**
     * This is a general commit and should works with all kinds of operations distinguished by otype, followed by operation-specific parameters. 
     */
    function commit(bytes32 hash, OperType otype, address payable addr, uint amount) external {
        uint32 submittedOTPIdx = uint32(block.timestamp) / interval - t0;
        require(submittedOTPIdx > lastExecutedIdx, "It is not possible to submit commits in the current OTP interval anymore. Wait for the next interval.");
        Commit memory nc = Commit(hash, block.timestamp, otype, addr, amount);
        commits[submittedOTPIdx].push(nc);                
    }

    /**
     * This is a general reveal for all types of operation.
     */
    function reveal(bytes32[] calldata neighbors, uint32 otpIdx, bytes32 eotp) external
        isCorrectProof(neighbors, otpIdx, eotp)
    returns (bool) {
        // clean up
        if(block.timestamp / 1 days - cleanupCheckpoint  >= AUTO_CLEANUP_DAYS) {
            cleanUpDailySpendings();
        }

        // check idx of OTP
        uint32 currentIdx = uint32(block.timestamp) / interval - t0;
        require(currentIdx - otpIdx <= MAX_REVEAL_DELAY, "Reveal is out of max allowed delay.");                
        
        // scan all the commits made within otpIdx interval and execute the first matching one        
        for (uint i = 0; i < commits[otpIdx].length; i++) {
            Commit storage c = commits[otpIdx][i];
            bytes32 hashedArgs = sha256(abi.encodePacked(eotp, c.operType, c.addr, c.amount));
            if(hashedArgs == commits[otpIdx][i].hash){                
                
                // execute operation according to its type
                if(c.operType == OperType.TRANSFER){
                    _executeTransfer(c.addr, c.amount);                
                } else if(c.operType == OperType.SET_LAST_RESORT_ADDR){
                    lastResortAddress = c.addr;
                } else if(c.operType == OperType.RECOVERY){ // we do not care about params in Commits
                    _drain(); // IH: I do not find any reason for this operation to be executed using OTP.
                } else {
                    emit UnknownOperationType(c.operType);                    
                }                
                
                delete commits[otpIdx][i];
                lastExecutedIdx = otpIdx; // it is not possible to execute any operations using otpIdx anymore (handled in commit)
                return true;
            }
        }
        return false;        
    }
           

    /**
     * Can be called once in a while by the user or automatically from revealTransfer().
     */
    function cleanUpDailySpendings() public {
        uint curDay = block.timestamp / 1 days;
        uint i = cleanupCheckpoint;
        for (; i <=  cleanupCheckpoint + CLEAN_UP_DAILY_SPENDING_BATCH && i < curDay; i++)            
            delete dailySpendings[i]; // NOTE: I guess it makes no difference whether it was initialized or not.
        cleanupCheckpoint = i; // shift clean-up checkpoint
    }

    function retire() external returns (bool){
        require(uint32(block.timestamp / interval) - t0 > lifespan, "Too early to retire");        
        return _drain();
    }
    
    function getCurrentSpending() external view returns (uint){ 
        return dailySpendings[block.timestamp / 1 days];
    }

    //////////////////////////////////////////////////

    modifier isCorrectProof(bytes32[] calldata neighbors, uint32 index, bytes32 eotp)
    {
        require(neighbors.length == height - 1, "Not enough neighbors provided");
        bytes32 h = sha256(abi.encodePacked(eotp));
        for (uint8 i = 0; i < height - 1; i++) {
            if ((index & 0x01) == 0x01) {
                h = sha256(abi.encodePacked(neighbors[i], h));                
            } else {
                h = sha256(abi.encodePacked(h, neighbors[i]));
            }
            index >>= 1;
        }
        require(root == h, "Proof is incorrect");
        _;
    }

    function _executeTransfer(address payable dest, uint amount) internal {
        require(dailySpendings[block.timestamp / 1 days] + amount <= dailyLimit, "Daily limit exceeded.");        
        require(dest.send(amount), "Unknown transfer error.");        
        dailySpendings[block.timestamp / 1 days] += amount;
    }  

    function _drain() internal returns (bool) {
        return lastResortAddress.send(address(this).balance);
    }    
}
