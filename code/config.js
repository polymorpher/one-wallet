require('dotenv').config()

module.exports = {
  harmony: {
    testnet: {
      key: process.env.HARMONY_TESTNET_KEY || '',
      url: 'https://api.s0.b.hmny.io',
      chainId: 2,
      networkId: 2
    },
    mainnet: {
      key: process.env.HARMONY_MAINNET_KEY || '',
      url: 'https://api.s0.t.hmny.io',
      chainId: 1,
      networkId: 1
    }
  },
  eth: {
    rinkeby: {
      url: process.env.RINKEBY_RPC,
      key: process.env.ETH_RINKEBY_KEY || '',
    },
    ganache: {
      url: process.env.GANACHE_RPC || 'http://127.0.0.1:7545',
      mnemonic: process.env.ETH_GANACHE_MNEMONIC,
    }
  },
  gasLimit: process.env.GAS_LIMIT,
  gasPrice: process.env.GAS_PRICE,
  verbose: process.env.VERBOSE === 'true' || process.env.VERBOSE === '1'
}
