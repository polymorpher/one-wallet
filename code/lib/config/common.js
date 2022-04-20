const Constants = require('../constants')
const DEBUG = process.env.DEBUG

module.exports = {
  appId: 'ONEWallet',
  appName: '1wallet',
  version: `v0.${Constants.MajorVersion}.${Constants.MinorVersion}`,
  lastLibraryUpdateVersion: `v0.${Constants.MajorVersion}.1`,
  // lastLibraryUpdateVersion: `v0.16.0`, // use this for manual override
  minWalletVersion: parseInt(process.env.MIN_WALLET_VERSION || 9),
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
        url: process.env.GANACHE_RPC || 'http://127.0.0.1:7545',
        // explorer: 'https://explorer.harmony.one/#/tx/{{txId}}',
        deploy: {
          factory: process.env.DEPLOY_FACTORY_GANACHE,
          deployer: process.env.DEPLOY_DEPLOYER_GANACHE,
          codeHelper: process.env.DEPLOY_CODE_HELPER_GANACHE
        },
      }
    }),
    'harmony-mainnet': {
      name: 'Harmony Mainnet',
      url: process.env.MAINNET_RPC || 'https://api.s0.t.hmny.io',
      explorer: 'https://explorer.harmony.one/tx/{{txId}}',
      production: true,
      chainId: 1,
      deploy: {
        factory: process.env.DEPLOY_FACTORY_MAINNET || '',
        deployer: process.env.DEPLOY_DEPLOYER_MAINNET || '',
        codeHelper: process.env.DEPLOY_CODE_HELPER_MAINNET || '',
      },
    },
    'harmony-testnet': {
      name: 'Harmony Testnet',
      url: process.env.TESTNET_RPC || 'https://api.s0.b.hmny.io',
      explorer: 'https://explorer.pops.one/tx/{{txId}}',
      chainId: 2,
      deploy: {
        factory: process.env.DEPLOY_FACTORY_TESTNET || '',
        deployer: process.env.DEPLOY_DEPLOYER_TESTNET || '',
        codeHelper: process.env.DEPLOY_CODE_HELPER_TESTNET || '',
      },
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
