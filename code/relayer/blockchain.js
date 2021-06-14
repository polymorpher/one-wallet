const config = require('./config')
const contract = require('@truffle/contract')
// const { TruffleProvider } = require('@harmony-js/core')
const ONEWallet = require('../build/contracts/ONEWallet.json')
const PrivateKeyProvider = require('truffle-privatekey-provider')

let providers = {}; let contracts = {}; let networks = []

// TODO: try later
// const HarmonyProvider = ({ key, url, chainId, gasLimit, gasPrice }) => {
//   const truffleProvider = new TruffleProvider(
//     url,
//     {},
//     { shardID: 0, chainId },
//     gasLimit && gasPrice && { gasLimit, gasPrice },
//   )
//   truffleProvider.addByPrivateKey(key)
//   truffleProvider.setSigner(key)
// }

const init = () => {
  Object.keys(config.networks).forEach(k => {
    const n = config.networks[k]
    if (n.key) {
      networks.push(k)
      if (k.startsWith('eth')) {
        providers[k] = new PrivateKeyProvider(n.key, n.url)
      } else {
        // providers[k] = new HarmonyProvider(n.key, n.url, n.chainId) // TODO: try and debug later
        providers[k] = new PrivateKeyProvider(n.key, n.url)
      }
    }
  })
  Object.keys(providers).forEach(k => {
    const c = contract(ONEWallet)
    c.setProvider(providers[k])
    contracts[k] = c
  })
}

init()

module.exports = {
  getNetworks: () => networks,
  getProvider: (network) => providers[network],
  getContract: (network) => contracts[network],
}
