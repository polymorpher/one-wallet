// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.4;

// TODO: support token spending limit
library SpendingManager {
    event ExceedSpendingLimit(uint256 amount, uint256 limit, uint256 current, uint256 spendingInterval, address dest);
    event InsufficientFund(uint256 amount, uint256 balance, address dest);

    struct SpendingState {
        uint256 spendingLimit; // maximum amount of wei allowed to be spent per interval
        uint256 spentAmount; // amount spent for the current time interval
        uint32 lastSpendingInterval; // last time interval when spending of ONE occurred (block.timestamp / spendingInterval)
        uint32 spendingInterval; // number of seconds per interval of spending, e.g. when this equals 86400, the spending limit represents a daily spending limit
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

    function getState(SpendingState storage ss) external view returns (uint256, uint256, uint32, uint32){
        return (ss.spendingLimit, ss.spentAmount, ss.lastSpendingInterval, ss.spendingInterval);
    }

}
