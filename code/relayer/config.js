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
      url: 'https://api.s0.b.hmny.io',
      chainId: 2,
    },
    'harmony-mainnet': {
      key: process.env.HARMONY_MAINNET_KEY || '',
      url: 'https://api.s0.t.hmny.io',
      chainId: 1,
    },
    'eth-rinkeby': {
      url: process.env.ETH_RINKEBY_URL,
      key: process.env.ETH_RINKEBY_KEY || '',
    },
    'eth-ganache': {
      url: process.env.ETH_GANACHE_URL || 'http://127.0.0.1:7545',
      key: process.env.ETH_GANACHE_KEY,
    },
  },
  gasLimit: parseInt(process.env.GAS_LIMIT || '210000'),
  gasPrice: parseInt(process.env.GAS_PRICE || '200')
}
module.exports = config
