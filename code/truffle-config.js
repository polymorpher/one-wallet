const config = require('./config')
const HDWalletProvider = require('@truffle/hdwallet-provider')

const BuildProvider = (conf) => {
  return new HDWalletProvider({
    mnemonic: conf.mnemonic,
    privateKeys: !conf.mnemonic && [conf.key],
    providerOrUrl: conf.wss || conf.url,
    sharedNonce: false,
    pollingInterval: config.pollingInterval,
    numberOfAddresses: conf.numAccounts,
  })
}

module.exports = {
  networks: {
    dev: {
      network_id: '*',
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
      provider: () => config.networks['eth-ganache'] && BuildProvider(config.networks['eth-ganache'])
    },
    ganache: {
      host: '127.0.0.1',
      port: 7545,
      network_id: '*',
    },
    'harmony-testnet': {
      provider: () => config.networks['harmony-testnet'].key && BuildProvider(config.networks['harmony-testnet']),
      network_id: config.networks['harmony-testnet'].networkId,
      gas: config.gasLimit
    },
    'harmony-mainnet': {
      provider: () => config.networks['harmony-mainnet'].key && BuildProvider(config.networks['harmony-mainnet']),
      network_id: config.networks['harmony-mainnet'].networkId,
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
      version: '0.8.4',
      settings: {
        optimizer: {
          enabled: true,
        },
      },
    },
  },

  plugins: [
    'truffle-contract-size'
  ],
}
