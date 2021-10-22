const ONEConstants = require('../../../lib/constants')
export default {
  interval: 30 * 1000,
  defaultDuration: 3600 * 1000 * 24 * 364,
  defaultSpendingLimit: 1000, // ONEs
  defaultSpendingInterval: ONEConstants.DefaultSpendingInterval,
  minDuration: 3600 * 1000 * 24 * 120,
  maxDuration: 3600 * 1000 * 24 * 364 * 2,
  maxTransferAttempts: 3,
  checkCommitInterval: 5000,
  fetchBalanceFrequency: 15000,
  fetchDelaysAfterTransfer: [0, 2000, 5000],
  oneWalletTreasury: {
    label: '1wallet DAO',
    address: ONEConstants.TreasuryAddress
  },
  redPacketDuration: 3600 * 1000 * 24 * 5,
  qrcodePattern: /\/to\/([a-zA-Z0-9]{42})/,
  unwrapPattern: /\/unwrap\?data=[a-zA-Z0-9]+/,

  globalStatsCacheDuration: 3600 * 1000 * 2,
}
