const config = require('./config')
const PrivateKeyProvider = require('truffle-privatekey-provider')

module.exports = {
  networks: {
    dev: {
      // host: '127.0.0.1',
      // port: 7545,
      network_id: '*', // Match any network id
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
      websockets: true,
      provider: config.eth.ganache.key && new PrivateKeyProvider(
        config.eth.ganache.key,
        config.eth.ganache.url
      ),
    },
    rinkeby: {
      network_id: '4',
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
      provider: config.eth.rinkeby.key && new PrivateKeyProvider(
        config.eth.rinkeby.key,
        config.eth.rinkeby.url
      ),
    },
    'harmony-testnet': {
      provider: config.harmony.testnet.key && new PrivateKeyProvider(
        config.harmony.testnet.key,
        config.harmony.testnet.url,
      ),
      network_id: '1666700000',
      gas: config.gasLimit
    },
    'harmony-mainnet': {
      provider: config.harmony.mainnet.key && new PrivateKeyProvider(
        config.harmony.mainnet.key,
        config.harmony.mainnet.url,
      ),
      network_id: '1666600000',
      gas: config.gasLimit
    }
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    timeout: 10 * 60 * 1000,
    bail: true
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: '0.8.4'
    },
  },
}
