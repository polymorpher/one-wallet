const DEBUG = process.env.DEBUG

export default {
  appId: 'ONEWallet',
  appName: 'ONE Wallet',
  version: 'v0.1',
  priceRefreshInterval: 60 * 1000,
  defaults: {
    relayer: process.env.REACT_APP_RELAYER || (DEBUG ? 'dev' : 'hiddenstate'),
    network: process.env.REACT_APP_NETWORK || (DEBUG ? 'eth-ganache' : 'harmony-mainnet'),
    relayerSecret: process.env.REACT_APP_RELAYER_SECRET,
  },
  networks: {
    ...DEBUG && {
      'eth-ganache': {
        name: 'Ethereum Ganache',
        url: 'http://127.0.0.1:7545',
      // explorer: 'https://explorer.harmony.one/#/tx/{{txId}}',
      }
    },
    'harmony-mainnet': {
      name: 'Harmony Mainnet',
      url: 'https://api.s0.t.hmny.io',
      explorer: 'https://explorer.harmony.one/#/tx/{{txId}}',
      chainId: 1,
    },
    'harmony-testnet': {
      name: 'Harmony Testnet',
      url: 'https://api.s0.b.hmny.io',
      chainId: 2,
    }
  },
  relayers: {
    ...DEBUG && {
      dev: {
        name: 'Local Relayer',
        url: 'http://127.0.0.1:3001'
      // url: 'https://dev.hiddenstate.xyz'
      }
    },
    hiddenstate: {
      name: 'Test Relayer',
      url: 'https://relayer.onewallet.hiddenstate.xyz'
    }
  }
}
