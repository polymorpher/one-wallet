const config = require('./config')
const WalletProvider = require('truffle-wallet-provider')
const Wallet = require('ethereumjs-wallet')

const rinkebyProvider = config.eth.rinkeby.key && new WalletProvider(
  Wallet.fromPrivateKey(Buffer.from(config.eth.rinkeby.key, 'hex')),
  config.eth.rinkeby.url)

const harmonyTestNetProvider = config.harmony.testnet.key && new WalletProvider(
  Wallet.fromPrivateKey(Buffer.from(config.harmony.testnet.key, 'hex')),
  'https://api.s0.b.hmny.io')

const harmonyMainNetProvider = config.harmony.mainnet.key && new WalletProvider(
  Wallet.fromPrivateKey(Buffer.from(config.harmony.mainnet.key, 'hex')),
  'https://api.s0.t.hmny.io')

module.exports = {
  networks: {
    dev: {
      host: config.eth.ganache.host,
      port: config.eth.ganache.port, // Ganache
      network_id: '*', // Match any network id
      gas: config.gasLimit,
    },
    advanced: {
      port: 8777, // Custom port
      host: '127.0.0.1', // Localhost (default: none)
      network_id: 1234, // Custom network
      gas: config.gasLimit, // Gas sent with each transaction (default: ~6700000)
      gasPrice: config.gasPrice // 20 gwei (in wei) (default: 100 gwei)
      // from: <address>,        // Account to send txs from (default: accounts[0])
      // websockets: true        // Enable EventEmitter interface for web3 (default: false)
    },
    rinkeby: {
      provider: rinkebyProvider,
      network_id: '4',
      gas: config.gasLimit
    },
    'harmony-testnet': {
      provider: harmonyTestNetProvider,
      network_id: '1666700000',
      gas: config.gasLimit
    },
    'harmony-MAINnet': {
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
      version: '0.8.4',
      // settings: {          // See the solidity docs for advice about optimization and evmVersion
      //  optimizer: {
      //    enabled: false,
      //    runs: 200
      //  },
      //  evmVersion: "byzantium"
      // }
    },
  },
}
