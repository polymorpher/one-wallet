const DEBUG = process.env.DEBUG

module.exports = {
  appId: 'ONEWallet',
  appName: '1wallet',
  version: 'v0.15.1',
  lastLibraryUpdateVersion: 'v0.15.1',
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
        url: 'http://127.0.0.1:7545',
        // explorer: 'https://explorer.harmony.one/#/tx/{{txId}}',
        deploy: {
          factory: process.env.DEPLOY_FACTORY_GANACHE || '0x69b19f89102DBdb3E1E8709d2CB9cB6b26a0Cc59',
          deployer: process.env.DEPLOY_DEPLOYER_GANACHE || '0x58bbE690cA4ec94D034d91D05d6949661F2bE8E2',
          codeHelper: process.env.DEPLOY_CODE_HELPER_GANACHE || '0x1d560f5904De502f34b556eec01bEc4a97665028'
        },
      }
    }),
    'harmony-mainnet': {
      name: 'Harmony Mainnet',
      url: 'https://api.s0.t.hmny.io',
      explorer: 'https://explorer.harmony.one/tx/{{txId}}',
      production: true,
      chainId: 1,
      deploy: {
        factory: process.env.DEPLOY_FACTORY_MAINNET || '0x743AE189917d5b762CEDbC51FAC4e0C5Adf43132',
        deployer: process.env.DEPLOY_DEPLOYER_MAINNET || '0x0c748D3De066f3c51D1F147b0C74b8E3D999d9c8',
        codeHelper: process.env.DEPLOY_CODE_HELPER_MAINNET || '0xa17A4e2dbC0B6Ce3EE961553967ffE11224113E5',
      },
    },
    'harmony-testnet': {
      name: 'Harmony Testnet',
      url: 'https://api.s0.b.hmny.io',
      chainId: 2,
      deploy: {
        factory: process.env.DEPLOY_FACTORY_TESTNET || '0x12CfEeB5D792Fb5C5b06b166b14706AE4A14bC6d',
        deployer: process.env.DEPLOY_DEPLOYER_TESTNET || '0xac1adA40E096Ee31D3EB0E14830ECAC1F0D18b38',
        codeHelper: process.env.DEPLOY_CODE_HELPER_TESTNET || '0x1d560f5904De502f34b556eec01bEc4a97665028',
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
