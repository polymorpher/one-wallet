export default {
  interval: 30 * 1000,
  defaultDuration: 3600 * 1000 * 24 * 364,
  defaultDailyLimit: process.env.DAILY_LIMIT | 1000, // ONEs
  maxTransferAttempts: 3,
  checkCommitInterval: 5000,
}
