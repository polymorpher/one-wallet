## `SpendingManager`






### `getRemainingAllowance(struct SpendingManager.SpendingState ss) → uint256` (public)





### `isWithinLimit(struct SpendingManager.SpendingState ss, uint256 amount) → bool` (public)





### `canSpend(struct SpendingManager.SpendingState ss, uint256 amount) → bool` (external)





### `canSpend(struct SpendingManager.SpendingState ss, address dest, uint256 amount) → bool` (external)





### `accountSpending(struct SpendingManager.SpendingState ss, uint256 amount)` (external)





### `changeSpendLimit(struct SpendingManager.SpendingState ss, uint256 newLimit)` (external)





### `jumpSpendLimit(struct SpendingManager.SpendingState ss, uint256 newLimit)` (external)






### `ExceedSpendingLimit(uint256 amount, uint256 limit, uint256 current, uint256 spendingInterval, address dest)`





### `InsufficientFund(uint256 amount, uint256 balance, address dest)`





### `SpendingLimitChanged(uint256 newLimit)`





### `HighestSpendingLimitChanged(uint256 newLimit)`





### `SpendingLimitChangeFailed(uint256 newLimit, string reason)`





### `SpendingLimitJumped(uint256 newLimit)`






### `SpendingState`


uint256 spendingLimit


uint256 spentAmount


uint32 lastSpendingInterval


uint32 spendingInterval


uint32 lastLimitAdjustmentTime


uint256 highestSpendingLimit



