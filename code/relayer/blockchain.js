const config = require('./config')
const ONEConfig = require('../lib/config/common')
const ONEUtil = require('../lib/util')
const TruffleContract = require('@truffle/contract')
const { ONEWallet, factoryContractsList, factoryContracts, libraryList, dependencies } = require('../extensions/contracts')
const { ONEWalletV5, ONEWalletV6 } = require('../extensions/deprecated')
const { knownAddresses } = require('../extensions/loader')
const HDWalletProvider = require('@truffle/hdwallet-provider')
const fs = require('fs/promises')
const path = require('path')
const pick = require('lodash/fp/pick')
const cloneDeep = require('lodash/fp/cloneDeep')
const { backOff } = require('exponential-backoff')
const { rpc } = require('./rpc')
const BN = require('bn.js')

const networks = []
const providers = {}
const pendingNonces = {}
const contracts = {}
const contractsV5 = {}
const contractsV6 = {}
const factories = {}
const libraries = {}

const constructorArguments = {
  ONEWalletFactoryHelper: (factories, network) => {
    return [factories[network]['ONEWalletFactory'].address]
  }
}

const ensureDir = async (p) => {
  try {
    await fs.access(p)
  } catch (ex) {
    await fs.mkdir(p, { recursive: true })
  }
}

// including libraries
const initCachedContracts = async () => {
  const p = path.join(config.cache, ONEConfig.lastLibraryUpdateVersion || ONEConfig.version)
  await ensureDir(p)
  for (let network of networks) {
    if (config.networks[network].skip) {
      console.log(`[${network}] Skipped`)
      continue
    }
    libraries[network] = {}
    factories[network] = {}
    for (let lib of [...libraryList, ...factoryContractsList]) {
      const libName = lib.contractName
      const f = [libName, network].join('-')
      const fp = path.join(p, f)
      const c = TruffleContract(lib)
      c.setProvider(providers[network])
      const from = providers[network].addresses[0]
      const params = { from, gas: config.gasLimit, gasPrice: config.gasPrice }
      c.defaults(params)
      const expectedHash = ONEUtil.hexString(ONEUtil.keccak(ONEUtil.hexToBytes(lib.bytecode)))
      try {
        if (knownAddresses[libName]) {
          const libAddress = knownAddresses[libName](network)
          if (libAddress) {
            console.log(`[${network}][${libName}] Found contract known address at ${libAddress}`)
            // const instance = new c(libAddress)
            const instance = new c(libAddress)
            if (!factoryContracts[libName]) {
              libraries[network][libName] = instance
            } else {
              c.defaults({ from, gas: config.gasLimit, gasPrice: config.gasPrice })
              factories[network][libName] = instance
            }
            continue
          }
        }
        await fs.access(fp)
        const content = await fs.readFile(fp, { encoding: 'utf-8' })
        const [address, hash] = content.split(',')
        if (hash === expectedHash) {
          console.log(`[${network}][${libName}] Found existing deployed contract at address ${address}`)
          // const instance = new c(address)
          const instance = new c(address)
          if (!factoryContracts[libName]) {
            libraries[network][libName] = instance
          } else {
            factories[network][libName] = instance
          }
          console.log(`[${network}][${libName}] Initialized contract at ${address}`)
          continue
        } else {
          console.log(`[${network}][${libName}] Contract code is changed. Redeploying`)
        }
      } catch {}
      console.log(`[${network}][${libName}] Contract address is not cached or is outdated. Deploying new instance`)
      if (dependencies[libName]) {
        for (let dep of dependencies[libName]) {
          console.log(`[${network}][${libName}] Contract depends on ${dep.contractName}. Linking...`)
          if (!libraries[network][dep.contractName]) {
            throw new Error(`[${network}][${dep.contractName}] Contract is not deployed yet`)
          }
          await c.detectNetwork()
          await c.link(libraries[network][dep.contractName])
        }
      }
      try {
        await backOff(async () => {
          let args = []
          if (constructorArguments[libName]) {
            args = constructorArguments[libName](factories, network)
          }
          const instance = await c.new(...args)
          if (!factoryContracts[libName]) {
            libraries[network][libName] = instance
            // console.log(`libraries[${network}][${libName}] = ${instance.address}`)
          } else {
            // console.log(`factories[${network}][${libName}] = ${instance.address}`)
            factories[network][libName] = instance
          }
          console.log(`[${network}][${libName}] Deployed at ${instance.address}`)
          await fs.writeFile(fp, `${instance.address},${expectedHash}`, { encoding: 'utf-8' })
        }, {
          retry: (ex, n) => {
            console.error(`[${network}] Failed to deploy ${libName} (attempted ${n}/10)`)
            console.error(ex)
            return true
          }
        })
      } catch (ex) {
        console.error(`Failed to deploy ${libName} after all attempts. Exiting`)
        process.exit(1)
      }
    }
  }
}

const init = async () => {
  console.log(`Version=${ONEConfig.version}; LibraryVersion=${ONEConfig.lastLibraryUpdateVersion}`)
  Object.keys(config.networks).forEach(k => {
    if (config.networks[k].skip) {
      console.log(`[${k}] Skipped initialization`)
      return
    }
    const n = config.networks[k]
    if (n.key) {
      try {
        providers[k] = new HDWalletProvider({
          mnemonic: n.mnemonic,
          privateKeys: !n.mnemonic && [n.key],
          providerOrUrl: n.wss || n.url,
          sharedNonce: config.safeNonce,
          pollingInterval: config.pollingInterval,
          numberOfAddresses: n.numAccounts
        })
        networks.push(k)
      } catch (ex) {
        console.error(ex)
        console.trace(ex)
      }
    }
  })
  Object.keys(providers).forEach(k => {
    const c = TruffleContract(ONEWallet)
    c.setProvider(providers[k])
    const c5 = TruffleContract(ONEWalletV5)
    c5.setProvider(providers[k])
    const c6 = TruffleContract(ONEWalletV6)
    c6.setProvider(providers[k])
    const from = providers[k].addresses[0]
    const params = { from, gas: config.gasLimit, gasPrice: config.gasPrice }
    c.defaults(params)
    c5.defaults(params)
    c6.defaults(params)
    contracts[k] = c
    contractsV5[k] = c5
    contractsV6[k] = c6
  })
  console.log('init complete:', {
    networks,
    providers: JSON.stringify(Object.keys(providers).map(k => [k, pick(['gasLimit', 'gasPrice', 'addresses'], providers[k])]), null, 2),
    contracts: Object.keys(contracts),
    contractsV5: Object.keys(contractsV5),
    contractsV6: Object.keys(contractsV6),
  })
  await initCachedContracts()
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
  console.log({
    factories,
    libraries,
  })
  for (const network in providers) {
    const addresses = providers[network].addresses
    // const nonce = await rpc.getNonce({ address: providers[network].addresses[0], network })
    pendingNonces[network] = {}
    for (const address of addresses) {
      pendingNonces[network][address] = 0
      console.log(`[${network}][${address}] Set pending nonce = 0`)
    }
  }
}

const sampleExecutionAddress = (network) => {
  const addresses = providers[network].addresses

  const nonces = cloneDeep(pendingNonces[network])
  const probs = []
  let sum = 0
  for (const address of addresses) {
    const p = 1.0 / Math.exp(nonces[address])
    probs.push(p)
    sum += p
  }
  const r = Math.random() * sum
  let s = 0
  for (let i = 0; i < probs.length; i++) {
    s += probs[i]
    if (s >= r) {
      return [i, addresses[i]]
    }
  }
  return [addresses.length - 1, addresses[addresses.length - 1]]
}

// basic executor that
const prepareExecute = (network, logger = console.log) => async (f) => {
  const [fromIndex, from] = sampleExecutionAddress(network)
  logger(`Sampled [${fromIndex}] ${from}`)
  const latestNonce = await rpc.getNonce({ address: from, network })
  const snapshotPendingNonces = pendingNonces[network][from]
  const nonce = latestNonce + snapshotPendingNonces
  pendingNonces[network][from] += 1
  const printNonceStats = () => `[network=${network}][account=${fromIndex}][nonce=${nonce}][snapshot=${snapshotPendingNonces}][current=${pendingNonces[network][from]}]`
  try {
    logger(`[pending]${printNonceStats()}`)
    let numAttempts = 0
    const tx = await backOff(
      async () => f({
        from,
        nonce: '0x' + new BN(nonce).toString(16),
        gasPrice: config.gasPrice.clone().addn(numAttempts)
      }), {
        retry: (ex, n) => {
          if (ex?.abort) {
            logger(`[abort][attempts=${n}]${printNonceStats()}`)
            return false
          }
          numAttempts = n
          logger(`[retry][attempts=${n}]${printNonceStats()}`)
          return true
        }
      })
    logger(`[complete]${printNonceStats()}`, tx)
    return tx
  } catch (ex) {
    logger(`[error]${printNonceStats()}`, ex)
    throw ex
  } finally {
    pendingNonces[network][from] -= 1
  }
}

module.exports = {
  init,
  getNetworks: () => networks,
  getProvider: (network) => providers[network],
  getWalletContract: (network, version) => {
    if (!version) {
      return contracts[network]
    }
    if (version === 5) {
      return contractsV5[network]
    }
    if (version === 6) {
      return contractsV6[network]
    }
  },
  getLibraries: (network) => libraries[network],
  getFactory: (network, name) => factories[network][name || 'ONEWalletFactoryHelper'],
  prepareExecute
}
