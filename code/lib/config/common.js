const DEBUG = process.env.DEBUG

module.exports = {
  appId: 'ONEWallet',
  appName: '1wallet',
  version: 'v0.12.3',
  lastLibraryUpdateVersion: 'v0.12.2',
  minWalletVersion: parseInt(process.env.MIN_WALLET_VERSION || 3),
  minUpgradableVersion: parseInt(process.env.MIN_UPGRADABLE_WALLET_VERSION || 9),
  defaults: {
    relayer: process.env.RELAYER || (DEBUG ? 'dev' : 'hiddenstate'),
    network: process.env.NETWORK || (DEBUG ? 'eth-ganache' : 'harmony-mainnet'),
    relayerSecret: process.env.RELAYER_SECRET || 'onewallet',
    sentryDsn: process.env.SENTRY_DSN
  },
  debug: DEBUG,
  networks: {
    ...(DEBUG && {
      'eth-ganache': {
        name: 'Ganache',
        url: 'http://127.0.0.1:7545',
        // explorer: 'https://explorer.harmony.one/#/tx/{{txId}}',
      }
    }),
    'harmony-mainnet': {
      name: 'Harmony Mainnet',
      url: 'https://api.s0.t.hmny.io',
      explorer: 'https://explorer.harmony.one/tx/{{txId}}',
      chainId: 1,
    },
    'harmony-testnet': {
      name: 'Harmony Testnet',
      url: 'https://api.s0.b.hmny.io',
      chainId: 2,
    }
  },
  relayers: {
    ...(DEBUG && {
      dev: {
        name: 'Local Relayer',
        url: process.env.LOCAL_RELAYER_URL || 'http://127.0.0.1:3001'
        // url: 'https://dev.hiddenstate.xyz'
      }
    }),
    hiddenstate: {
      name: 'Test Relayer',
      url: 'https://relayer.onewallet.hiddenstate.xyz'
    }
  }
}
