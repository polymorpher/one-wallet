// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

// TODO: support token spending limit
library SpendingManager {
    event ExceedSpendingLimit(uint256 amount, uint256 limit, uint256 current, uint256 spendingInterval, address dest);
    event InsufficientFund(uint256 amount, uint256 balance, address dest);
    event SpendingLimitChanged(uint256 newLimit);
    event HighestSpendingLimitChanged(uint256 newLimit);
    event SpendingLimitChangeFailed(uint256 newLimit, string reason);
    event SpendingLimitJumped(uint256 newLimit);

    struct SpendingState {
        uint256 spendingLimit; // current maximum amount of wei allowed to be spent per interval
        uint256 spentAmount; // amount spent for the current time interval
        uint32 lastSpendingInterval; // last time interval when spending of ONE occurred (block.timestamp / spendingInterval)
        uint32 spendingInterval; // number of seconds per interval of spending, e.g. when this equals 86400, the spending limit represents a daily spending limit
        uint32 lastLimitAdjustmentTime; // last time when spend limit was adjusted
        uint256 initialSpendingLimit; // the initial spending limit (equals spendingLimit initially, but it should be set by client)
        uint256 highestSpendingLimit; // the highest spending limit the user ever got
    }

    function getRemainingAllowance(SpendingState storage ss) view public returns (uint256) {
        uint32 interval = uint32(block.timestamp / ss.spendingInterval);
        uint256 remainingAllowance = interval > ss.lastSpendingInterval ? ss.spendingLimit : ss.spendingLimit - ss.spentAmount;
        if (remainingAllowance > address(this).balance) {
            remainingAllowance = address(this).balance;
        }
        return remainingAllowance;
    }

    function isWithinLimit(SpendingState storage ss, uint256 amount) view public returns (bool){
        uint256 budget = getRemainingAllowance(ss);
        if (budget < amount) {
            return false;
        }
        return true;
    }

    function canSpend(SpendingState storage ss, uint256 amount) view external returns (bool){
        if (address(this).balance < amount) {
            return false;
        }
        if (!isWithinLimit(ss, amount)) {
            return false;
        }
        return true;
    }

    function canSpend(SpendingState storage ss, address dest, uint256 amount) external returns (bool){
        if (address(this).balance < amount) {
            emit InsufficientFund(amount, address(this).balance, dest);
            return false;
        }
        if (!isWithinLimit(ss, amount)) {
            emit ExceedSpendingLimit(amount, ss.spendingLimit, ss.spentAmount, ss.spendingInterval, dest);
            return false;
        }
        return true;
    }

    function accountSpending(SpendingState storage ss, uint256 amount) external {
        uint32 interval = uint32(block.timestamp / ss.spendingInterval);
        if (interval > ss.lastSpendingInterval) {
            ss.spentAmount = 0;
            ss.lastSpendingInterval = interval;
        }
        ss.spentAmount = ss.spentAmount + amount;
    }

    function changeSpendLimit(SpendingState storage ss, uint256 newLimit) external {
        if (ss.lastLimitAdjustmentTime + ss.spendingInterval > block.timestamp) {
            emit SpendingLimitChangeFailed(newLimit, "Too early");
            return;
        }
        if (newLimit > (ss.spendingLimit + 1 ether) * 2) {
            emit SpendingLimitChangeFailed(newLimit, "Too much");
            return;
        }
        ss.spendingLimit = newLimit;
        emit SpendingLimitChanged(newLimit);
        if (newLimit > ss.highestSpendingLimit) {
            ss.highestSpendingLimit = newLimit;
            emit HighestSpendingLimitChanged(newLimit);
        }
    }

    function jumpSpendLimit(SpendingState storage ss, uint256 newLimit) external {
        uint256 bestLimit = ss.highestSpendingLimit > ss.initialSpendingLimit ? ss.highestSpendingLimit : ss.initialSpendingLimit;
        if (newLimit > bestLimit) {
            emit SpendingLimitChangeFailed(newLimit, "Too high");
            return;
        }
        ss.spendingLimit = newLimit;
    }
}
