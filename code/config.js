require('dotenv').config()

module.exports = {
  pollingInterval: 1000,
  networks: {
    'harmony-testnet': {
      key: process.env.HARMONY_TESTNET_KEY || '',
      url: process.env.TESTNET_RPC || 'https://api.s0.b.hmny.io',
      wss: process.env.TESTNET_WSS,
      mnemonic: process.env.HARMONY_TESTNET_MNEMONIC,
      skip: process.env.SKIP_TESTNET,
      numAccounts: process.env.TESTNET_NUM_ACCOUNTS || 1,
      chainId: 1666600001,
      networkId: 2
    },
    'harmony-mainnet': {
      key: process.env.HARMONY_MAINNET_KEY || '',
      url: process.env.MAINNET_RPC || 'https://api.s0.t.hmny.io',
      wss: process.env.MAINNET_WSS,
      mnemonic: process.env.HARMONY_MAINNET_MNEMONIC,
      skip: process.env.SKIP_MAINNET,
      numAccounts: process.env.MAINNET_NUM_ACCOUNTS || 1,
      chainId: 1,
      networkId: 1666600000,
    },
    'eth-ganache': {
      url: process.env.GANACHE_RPC || 'http://127.0.0.1:7545',
      mnemonic: process.env.ETH_GANACHE_MNEMONIC,
      wss: process.env.GANACHE_WSS,
      key: process.env.ETH_GANACHE_KEY,
      mnemonic: process.env.ETH_GANACHE_MNEMONIC,
      skip: process.env.SKIP_GANACHE,
      numAccounts: process.env.GANACHE_NUM_ACCOUNTS || 1,
    },
  },
  gasLimit: process.env.GAS_LIMIT,
  gasPrice: process.env.GAS_PRICE,
  verbose: process.env.VERBOSE === 'true' || process.env.VERBOSE === '1'
}
