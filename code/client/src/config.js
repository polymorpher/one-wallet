export default {
  appId: 'ONEWallet',
  appName: 'ONE Wallet',
  version: 'v0.0.1',
  defaults: {
    relayer: process.env.REACT_APP_RELAYER || 'https://dev.hiddenstate.xyz',
    network: process.env.NETWORK || 'eth-ganache',
  }
}
