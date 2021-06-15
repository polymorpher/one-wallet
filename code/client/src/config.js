export default {
  appId: 'ONEWallet',
  appName: 'ONE Wallet',
  defaults: {
    relayer: process.env.REACT_APP_RELAYER || 'https://dev.hiddenstate.xyz',
    network: process.env.NETWORK || 'eth-ganache',
  }
}
