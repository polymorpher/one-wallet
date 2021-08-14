export default {
  interval: 30 * 1000,
  defaultDuration: 3600 * 1000 * 24 * 364,
  defaultDailyLimit: 1000, // ONEs
  minDuration: 3600 * 1000 * 24 * 120,
  maxDuration: 3600 * 1000 * 24 * 364 * 2,
  maxTransferAttempts: 3,
  checkCommitInterval: 5000,
  fetchBalanceFrequency: 15000,
  fetchDelaysAfterTransfer: [0, 2000, 5000],
  knownAddressKeys: {
    Recovery: 'recovery',
    Transfer: 'transfer'
  }
}
