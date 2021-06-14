const config = require('./config')
const contract = require('@truffle/contract')
// const { TruffleProvider } = require('@harmony-js/core')
const ONEWallet = require('../build/contracts/ONEWallet.json')
const HDWalletProvider = require('@truffle/hdwallet-provider')

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
    console.log(n)
    if (n.key) {
      networks.push(k)
      if (k.startsWith('eth')) {
        providers[k] = new HDWalletProvider({ privateKeys: [n.key], providerOrUrl: n.url })
      } else {
        // providers[k] = new HarmonyProvider(n.key, n.url, n.chainId) // TODO: try and debug later
        providers[k] = new HDWalletProvider({ privateKeys: [n.key], providerOrUrl: n.url })
      }
    }
  })
  Object.keys(providers).forEach(k => {
    const c = contract(ONEWallet)
    c.setProvider(providers[k])
    c.defaults({
      from: providers[k].getAddress(0)
    })
    contracts[k] = c
  })
  console.log('init complete:', {
    networks,
    providers,
    contracts
  })
}

init()

module.exports = {
  getNetworks: () => networks,
  getProvider: (network) => providers[network],
  getContract: (network) => contracts[network],
}
