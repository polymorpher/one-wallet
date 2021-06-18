export default {
  appId: 'ONEWallet',
  appName: 'ONE Wallet',
  version: 'v0.0.1',
  priceRefreshInterval: 60 * 1000,
  defaults: {
    relayer: process.env.REACT_APP_RELAYER || 'dev',
    network: process.env.REACT_APP_NETWORK || 'eth-ganache',
  },
  networks: {
    'eth-ganache': {
      name: 'Ethereum Ganache',
      url: 'http://127.0.0.1:7545',
      // explorer: 'https://explorer.harmony.one/#/tx/{{txId}}',
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
    dev: {
      name: 'Dev Relayer',
      // url: 'https://127.0.0.1:8443'
      url: 'https://dev.hiddenstate.xyz'
    },
    hiddenstate: {
      name: 'ONE Test Relayer',
      url: 'https://relayer.onewallet.hiddenstate.xyz'
    }
  }
}
