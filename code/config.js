require('dotenv').config()

module.exports = {
  harmony: {
    testnet: {
      key: process.env.HARMONY_TESTNET_KEY || ''
    },
    mainnet: {
      key: process.env.HARMONY_MAINNET_KEY || ''
    }
  },
  eth: {
    rinkeby: {
      url: process.env.ETH_RINKEBY_URL,
      key: process.env.ETH_RINKEBY_KEY || '',
    },
    ganache: {
      host: process.env.ETH_GANACHE_HOST || '127.0.0.1',
      port: parseInt(process.env.ETH_GANACHE_HOST || 7545),
      key: process.env.ETH_GANACHE_KEY,
    }
  },
  gasLimit: process.env.GAS_LIMIT,
  gasPrice: process.env.GAS_PRICE
}
