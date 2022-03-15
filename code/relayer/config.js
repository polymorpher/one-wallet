require('dotenv').config()
const DEBUG = process.env['RELAYER_DEBUG'] === 'true' || process.env['RELAYER_DEBUG'] === '1'
const config = {
  debug: DEBUG,
  nullAddress: '0x0000000000000000000000000000000000000000',
  verbose: process.env['VERBOSE'] === 'true' || process.env['VERBOSE'] === '1',
  https: {
    only: process.env['HTTPS_ONLY'] === 'true' || process.env['HTTPS_ONLY'] === '1',
    key: DEBUG ? './certs/test.key' : './certs/privkey.pem',
    cert: DEBUG ? './certs/test.cert' : './certs/fullchain.pem'
  },
  corsOrigins: process.env['CORS'],
  secret: process.env['SECRET'],
  networks: {
    'harmony-testnet': {
      key: process.env.HARMONY_TESTNET_KEY || '',
      url: process.env.TESTNET_RPC || 'https://api.s0.b.hmny.io',
      wss: process.env.TESTNET_WSS,
      chainId: 2,
      skip: process.env.SKIP_TESTNET,
    },
    'harmony-mainnet': {
      key: process.env.HARMONY_MAINNET_KEY || '',
      url: process.env.MAINNET_RPC || 'https://api.s0.t.hmny.io',
      wss: process.env.MAINNET_WSS,
      chainId: 1,
      skip: process.env.SKIP_MAINNET,
    },
    'eth-ganache': {
      url: process.env.GANACHE_RPC || 'http://127.0.0.1:7545',
      wss: process.env.GANACHE_WSS,
      key: process.env.ETH_GANACHE_KEY,
      mnemonic: process.env.ETH_GANACHE_MNEMONIC,
      skip: process.env.SKIP_GANACHE,
    },
  },
  gasLimit: parseInt(process.env.GAS_LIMIT || '210000'),
  gasPrice: parseInt(process.env.GAS_PRICE || '200'),
  cache: process.env.CACHE || 'cache'
}
module.exports = config
