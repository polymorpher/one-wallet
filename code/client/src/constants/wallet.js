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
  oneWalletTreasury: {
    address: '0x02F2cF45DD4bAcbA091D78502Dba3B2F431a54D3'
  }
}
