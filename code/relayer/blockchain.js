const config = require('./config')
const ONEConfig = require('../lib/config/common')
const ONEUtil = require('../lib/util')
const contract = require('@truffle/contract')
const { TruffleProvider } = require('@harmony-js/core')
const { Account } = require('@harmony-js/account')
const WalletGraph = require('../build/contracts/WalletGraph.json')
const CommitManager = require('../build/contracts/CommitManager.json')
const SignatureManager = require('../build/contracts/SignatureManager.json')
const TokenTracker = require('../build/contracts/TokenTracker.json')
const DomainManager = require('../build/contracts/DomainManager.json')
const SpendingManager = require('../build/contracts/SpendingManager.json')
const Reveal = require('../build/contracts/Reveal.json')
const ONEWallet = require('../build/contracts/ONEWallet.json')
const ONEWalletV5 = require('../build/contracts/ONEWalletV5.json')
const ONEWalletV6 = require('../build/contracts/ONEWalletV6.json')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const fs = require('fs/promises')
const path = require('path')
const { pick } = require('lodash')
const { backOff } = require('exponential-backoff')

const providers = {}
const contracts = {}
const contractsV5 = {}
const contractsV6 = {}
const networks = []
const libraryList = [DomainManager, TokenTracker, WalletGraph, CommitManager, SignatureManager, SpendingManager, Reveal]
const libraryDeps = { WalletGraph: [DomainManager], Reveal: [CommitManager] }
const libraries = {}

const ensureDir = async (p) => {
  try {
    await fs.access(p)
  } catch (ex) {
    await fs.mkdir(p, { recursive: true })
  }
}

const initCachedLibraries = async () => {
  const p = path.join(config.cache, ONEConfig.lastLibraryUpdateVersion || ONEConfig.version)
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
      const expectedHash = ONEUtil.hexString(ONEUtil.keccak(ONEUtil.hexToBytes(lib.bytecode)))
      try {
        await fs.access(fp)
        const content = await fs.readFile(fp, { encoding: 'utf-8' })
        const [address, hash] = content.split(',')
        if (hash === expectedHash) {
          console.log(`[${network}][${lib.contractName}] Found existing deployed library at address ${address}`)
          libraries[network][lib.contractName] = await c.at(address)
          console.log(`[${network}][${lib.contractName}] Initialized contract at ${address}`)
          continue
        } else {
          console.log(`[${network}][${lib.contractName}] Library code is changed. Redeploying`)
        }
      } catch {}
      console.log(`[${network}][${lib.contractName}] Library address is not cached or is outdated. Deploying new instance`)
      if (libraryDeps[lib.contractName]) {
        for (let dep of libraryDeps[lib.contractName]) {
          console.log(`[${network}][${lib.contractName}] Library depends on ${dep.contractName}. Linking...`)
          if (!libraries[network][dep.contractName]) {
            throw new Error(`[${network}][${dep.contractName}] Library is not deployed yet`)
          }
          await c.detectNetwork()
          await c.link(libraries[network][dep.contractName])
        }
      }
      try {
        await backOff(async () => {
          const instance = await c.new()
          libraries[network][lib.contractName] = instance
          await fs.writeFile(fp, `${instance.address},${expectedHash}`, { encoding: 'utf-8' })
        }, {
          retry: (ex, n) => {
            console.error(`[${network}] Failed to deploy ${lib.contractName} (attempted ${n}/10)`)
            console.error(ex)
            return true
          }
        })
      } catch (ex) {
        console.error(`Failed to deploy ${lib.contractName} after all attempts. Exiting`)
        process.exit(1)
      }
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
    // console.log(n)
    if (n.key) {
      try {
        if (k.startsWith('eth')) {
          providers[k] = new HDWalletProvider({ mnemonic: n.mnemonic, privateKeys: !n.mnemonic && [n.key], providerOrUrl: n.url, sharedNonce: false })
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
    const params = k.startsWith('eth') ? { from: account.address } : { from: account.address, gas: config.gasLimit, gasPrice: config.gasPrice }
    c.defaults(params)
    c5.defaults(params)
    c6.defaults(params)
    contracts[k] = c
    contractsV5[k] = c5
    contractsV6[k] = c6
  })
  console.log('init complete:', {
    networks,
    providers: Object.keys(providers).map(k => pick(providers[k], ['gasLimit', 'gasPrice', 'addresses'])),
    contracts: Object.keys(contracts).map(k => contracts[k].toString()),
    contractsV5: Object.keys(contractsV5).map(k => contracts[k].toString()),
    contractsV6: Object.keys(contractsV6).map(k => contracts[k].toString()),
  })
  initCachedLibraries().then(async () => {
    console.log('library initialization complete')
    for (let network in libraries) {
      for (let libraryName in libraries[network]) {
        const n = await contracts[network].detectNetwork()
        try {
          await backOff(() => contracts[network].link(libraries[network][libraryName]), {
            retry: (ex, n) => {
              console.error(`[${network}] Failed to link ${libraryName} (attempted ${n}/10)`)
            }
          })
        } catch (ex) {
          console.error(`Failed to link ${libraryName} after all attempts. Exiting`)
          process.exit(2)
        }

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
