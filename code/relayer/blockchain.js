const config = require('./config')
const ONEConfig = require('../lib/config/common')
const contract = require('@truffle/contract')
const { TruffleProvider } = require('@harmony-js/core')
const { Account } = require('@harmony-js/account')
const WalletGraph = require('../build/contracts/WalletGraph.json')
const CommitManager = require('../build/contracts/CommitManager.json')
const SignatureManager = require('../build/contracts/SignatureManager.json')
const TokenTracker = require('../build/contracts/TokenTracker.json')
const DomainManager = require('../build/contracts/DomainManager.json')
const ONEWallet = require('../build/contracts/ONEWallet.json')
const ONEWalletV5 = require('../build/contracts/ONEWalletV5.json')
const ONEWalletV6 = require('../build/contracts/ONEWalletV6.json')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const fs = require('fs/promises')
const path = require('path')

const providers = {}
const contracts = {}
const contractsV5 = {}
const contractsV6 = {}
const networks = []
const libraryList = [DomainManager, TokenTracker, WalletGraph, CommitManager, SignatureManager]
const libraryDeps = { WalletGraph: [DomainManager] }
const libraries = {}

const ensureDir = async (p) => {
  try {
    await fs.access(p)
  } catch (ex) {
    await fs.mkdir(p, { recursive: true })
  }
}

const initCachedLibraries = async () => {
  const p = path.join(config.cache, ONEConfig.lastContractUpdateVersion || ONEConfig.version)
  await ensureDir(p)
  for (let network of networks) {
    libraries[network] = {}
    for (let lib of libraryList) {
      const f = [lib.contractName, network].join('-')
      const fp = path.join(p, f)
      const key = config.networks[network].key
      const account = new Account(key)
      const c = contract(lib)
      c.setProvider(providers[network])
      c.defaults({ from: account.address })
      try {
        await fs.access(fp)
        const address = await fs.readFile(fp, { encoding: 'utf-8' })
        if (address) {
          console.log(`[${network}][${lib.contractName}] Found existing deployed library at address ${address}`)
          libraries[network][lib.contractName] = await c.at(address)
          continue
        }
      } catch {}
      console.log(`[${network}] Library ${lib.contractName} address is not cached. Deploying new instance`)
      if (libraryDeps[lib.contractName]) {
        for (let dep of libraryDeps[lib.contractName]) {
          console.log(`[${network}] Library ${lib.contractName} depends on ${dep.contractName}. Linking...`)
          if (!libraries[network][dep.contractName]) {
            throw new Error(`[${network}] ${dep.contractName} is not deployed yet`)
          }
          await c.detectNetwork()
          await c.link(libraries[network][dep.contractName])
        }
      }
      const instance = await c.new()
      libraries[network][lib.contractName] = instance
      await fs.writeFile(fp, instance.address, { encoding: 'utf-8' })
    }
  }
}

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
    c6.defaults({ from: account.address })
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
  initCachedLibraries().then(async () => {
    console.log('library initialization complete')
    for (let network in libraries) {
      for (let libraryName in libraries[network]) {
        const n = await contracts[network].detectNetwork()
        await contracts[network].link(libraries[network][libraryName])

        console.log(`Linked ${network} (${JSON.stringify(n)}) ${libraryName} with ${libraries[network][libraryName].address}`)
      }
    }
  })
}

module.exports = {
  init,
  getNetworks: () => networks,
  getProvider: (network) => providers[network],
  getContract: (network) => contracts[network],
  getContractV5: (network) => contractsV5[network],
  getContractV6: (network) => contractsV6[network],
  getLibraries: (network) => libraries[network],
}
