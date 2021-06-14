const config = require('./config')
const HDWalletProvider = require('@truffle/hdwallet-provider')
// const { TruffleProvider } = require('@harmony-js/core') // TODO

const BuildProvider = (key, url) => new HDWalletProvider({
  privateKeys: [key],
  providerOrUrl: url,
  numberOfAddresses: 1,
  shareNonce: true,
  derivationPath: "m/44'/1'/0'/0/"
})

module.exports = {
  networks: {
    dev: {
      network_id: '*', // Match any network id
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
      websockets: true,
      provider: () => config.eth.ganache.key && BuildProvider(config.eth.ganache.key, config.eth.ganache.url)
    },
    rinkeby: {
      network_id: '4',
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
      provider: () => config.eth.rinkeby.key && BuildProvider(config.eth.rinkeby.key, config.eth.rinkeby.url)
    },
    'harmony-testnet': {
      provider: () => config.harmony.testnet.key && BuildProvider(config.harmony.testnet.key, config.harmony.testnet.url),
      network_id: '1666700000',
      gas: config.gasLimit
    },
    'harmony-mainnet': {
      provider: () => config.harmony.mainnet.key && BuildProvider(config.harmony.mainnet.key, config.harmony.mainnet.url),
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
