const config = require('./config')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const PrivateKeyProvider = require('truffle-privatekey-provider')

const harmonyTestNetProvider = config.harmony.testnet.key && new HDWalletProvider({
  privateKeys: [config.harmony.testnet.key],
  providerOrUrl: config.harmony.testnet.url
})

const harmonyMainNetProvider = config.harmony.mainnet.key && new HDWalletProvider({
  privateKeys: [config.harmony.mainnet.key],
  providerOrUrl: config.harmony.mainnet.url,
})

module.exports = {
  networks: {
    dev: {
      // host: '127.0.0.1',
      // port: 7545,
      network_id: '*', // Match any network id
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
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
      provider: harmonyTestNetProvider,
      network_id: '1666700000',
      gas: config.gasLimit
    },
    'harmony-mainnet': {
      provider: harmonyMainNetProvider,
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
