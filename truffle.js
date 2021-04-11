require('babel-register')({
  ignore: /node_modules\/(?!zeppelin-solidity)/
})
require('babel-polyfill')

let secrets = require('./secrets')
const WalletProvider = require('truffle-wallet-provider')
const Wallet = require('ethereumjs-wallet')
// let mainNetPrivateKey = new Buffer(secrets.mainnetPK, "hex");
// let mainNetWallet = Wallet.fromPrivateKey(mainNetPrivateKey);
// let mainNetProvider = new WalletProvider(mainNetWallet, "https://mainnet.infura.io/");
let ropstenPrivateKey = new Buffer(secrets.ropstenPK, 'hex')
let ropstenWallet = Wallet.fromPrivateKey(ropstenPrivateKey)
let ropstenProvider = new WalletProvider(ropstenWallet, 'https://ropsten.infura.io/')

// See <http://truffleframework.com/docs/advanced/configuration> to customize your Truffle configuration!
module.exports = {
  networks: {
    test: {
      host: '127.0.0.1',
      port: 9545,
      network_id: '*', // Match any network id
      gas: 201000000,
    },
    development: {
      host: '127.0.0.1',
      port: 9545, // port: 7545 for Ganashe
      network_id: '*', // Match any network id
      gas: 201000000,
    },
    ropsten: {
      provider: ropstenProvider,
      network_id: '3',
      gas: 201000000
    },
    // live: {
    //   provider: mainNetProvider,
    //   network_id: "1",
    //   gas: 7500000
    // },
    advanced: {
      port: 8777, // Custom port
      host: '127.0.0.1', // Localhost (default: none)
      network_id: 1234, // Custom network
      gas: 100111555, // Gas sent with each transaction (default: ~6700000)
      gasPrice: 200000 // 20 gwei (in wei) (default: 100 gwei)
    // from: <address>,        // Account to send txs from (default: accounts[0])
    // websockets: true        // Enable EventEmitter interface for web3 (default: false)
    },

  // $> ganache-cli -p 8777 -l 150111555 -i 1234 --allowUnlimitedContractSize -a 100
  //
  // allowUnlimitedContractSize allows unlimited contract sizes while debugging. By enabling this flag, the check within
  // the EVM for contract size limit of 24KB (see EIP-170) is bypassed. Enabling this flag
  // *will* cause ganache-cli to behave differently than production environments.
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    timeout: 100000000,
    bail: true,
    enableTimeouts: false,
    before_timeout: 900000000
  },
}
