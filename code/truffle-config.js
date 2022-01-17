const config = require('./config')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const { TruffleProvider } = require('@harmony-js/core')
const { Account } = require('@harmony-js/account')

const HarmonyProvider = ({ key, url, chainId, gasLimit, gasPrice }) => {
  const truffleProvider = new TruffleProvider(
    url,
    {},
    { shardID: 0, chainId },
    gasLimit && gasPrice && { gasLimit, gasPrice },
  )
  truffleProvider.addByPrivateKey(key)
  const account = new Account(key)
  truffleProvider.setSigner(account.checksumAddress)
  return truffleProvider
}

const BuildProvider = (conf, useTruffle) => {
  if (useTruffle) {
    return new HDWalletProvider({
      mnemonic: conf.mnemonic, privateKeys: !conf.mnemonic && [conf.key], providerOrUrl: conf.url, sharedNonce: false
    })
  } else {
    return HarmonyProvider({ key: conf.key,
      url: conf.url,
      chainId: conf.chainId,
      gasLimit: config.gasLimit,
      gasPrice: config.gasPrice
    })
    // providers[k] = new HDWalletProvider({ privateKeys: [n.key], providerOrUrl: n.url })
  }
}

module.exports = {
  // contracts_directory: '@ensdomains/subdomain-registrar-core/contracts/interfaces/IRegistrar.sol',
  networks: {
    dev: {
      // host: '127.0.0.1',
      // port: 7545,
      network_id: '*',
      // host: process.env.GANACHE_RPC || '127.0.0.1',
      // port: process.env.GANACHE_PORT || 7545,
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
      provider: () => config.eth.ganache && BuildProvider(config.eth.ganache, true)
    },
    ganache: {
      host: '127.0.0.1',
      port: 7545,
      network_id: '*',
    },
    rinkeby: {
      network_id: '4',
      gas: config.gasLimit,
      gasPrice: config.gasPrice,
      provider: () => config.eth.rinkeby.key && BuildProvider(config.eth.rinkeby, true)
    },
    'harmony-testnet': {
      provider: () => config.harmony.testnet.key && BuildProvider(config.harmony.testnet),
      network_id: config.harmony.testnet.networkId,
      gas: config.gasLimit
    },
    'harmony-mainnet': {
      provider: () => config.harmony.mainnet.key && BuildProvider(config.harmony.mainnet),
      network_id: config.harmony.mainnet.networkId,
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
