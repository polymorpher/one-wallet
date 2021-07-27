const config = require('./config')
const contract = require('@truffle/contract')
const { TruffleProvider } = require('@harmony-js/core')
const { Account } = require('@harmony-js/account')
const ONEWallet = require('../build/contracts/ONEWallet.json')
const ONEWalletV5 = require('../build/contracts/ONEWalletV5.json')
const ONEWalletV6 = require('../build/contracts/ONEWalletV6.json')
const HDWalletProvider = require('@truffle/hdwallet-provider')

const providers = {}
const contracts = {}
const contractsV5 = {}
const contractsV6 = {}
const networks = []

const HarmonyProvider = ({ key, url, chainId, gasLimit, gasPrice }) => {
  const truffleProvider = new TruffleProvider(
    url,
    {},
    { shardID: 0, chainId },
    gasLimit && gasPrice && { gasLimit, gasPrice },
  )
  truffleProvider.addByPrivateKey(key)
  const account = new Account(key)
  truffleProvider.setSigner(account.checksumAddress)
  return truffleProvider
}

const init = () => {
  Object.keys(config.networks).forEach(k => {
    const n = config.networks[k]
    console.log(n)
    if (n.key) {
      try {
        if (k.startsWith('eth')) {
          providers[k] = new HDWalletProvider({ privateKeys: [n.key], providerOrUrl: n.url })
        } else {
          providers[k] = HarmonyProvider({ key: n.key,
            url: n.url,
            chainId: n.chainId,
            gasLimit: config.gasLimit,
            gasPrice: config.gasPrice
          })
          // providers[k] = new HDWalletProvider({ privateKeys: [n.key], providerOrUrl: n.url })
        }
        networks.push(k)
      } catch (ex) {
        console.error(ex)
        console.trace(ex)
      }
    }
  })
  Object.keys(providers).forEach(k => {
    const c = contract(ONEWallet)
    c.setProvider(providers[k])
    const c5 = contract(ONEWalletV5)
    c5.setProvider(providers[k])
    const c6 = contract(ONEWalletV6)
    c6.setProvider(providers[k])
    const key = config.networks[k].key
    const account = new Account(key)
    // console.log(k, account.address, account.bech32Address)
    c.defaults({ from: account.address })
    c5.defaults({ from: account.address })
    contracts[k] = c
    contractsV5[k] = c5
    contractsV6[k] = c6
  })
  console.log('init complete:', {
    networks,
    providers: Object.keys(providers).map(k => providers[k].toString()),
    contracts: Object.keys(contracts).map(k => contracts[k].toString()),
    contractsV5: Object.keys(contractsV5).map(k => contracts[k].toString()),
    contractsV6: Object.keys(contractsV6).map(k => contracts[k].toString()),
  })
}

module.exports = {
  init,
  getNetworks: () => networks,
  getProvider: (network) => providers[network],
  getContract: (network) => contracts[network],
  getContractV5: (network) => contractsV5[network],
  getContractV6: (network) => contractsV6[network],
}
