const { factoryContractsList, factoryContracts, libraryList, dependencies, ONEWallet } = require('./contracts')
const ONEConfig = require('../lib/config/common')
const Contract = require('@truffle/contract')

const knownAddresses = {
  ONEWalletFactory: (network) => ONEConfig.networks[network]?.deploy?.factory,
  ONEWalletFactoryHelper: (network) => ONEConfig.networks[network]?.deploy?.deployer,
  ONEWalletCodeHelper: (network) => ONEConfig.networks[network]?.deploy?.codeHelper,
}

// including libraries
const loadContracts = async (Logger) => {
  const libraries = {}
  const factories = {}
  const accounts = await web3.eth.getAccounts()
  for (let lib of [...libraryList, ...factoryContractsList]) {
    const libName = lib.contractName
    const c = Contract(lib)
    c.setProvider(web3.currentProvider)
    c.defaults({ from: accounts[0] })
    Logger.debug(`Deploying [${libName}]`)
    if (dependencies[libName]) {
      for (let dep of dependencies[libName]) {
        Logger.debug(`[${libName}] Contract depends on ${dep.contractName}. Linking...`)
        if (!libraries[dep.contractName]) {
          throw new Error(`[${dep.contractName}] Contract is not deployed yet`)
        }
        await c.detectNetwork()
        await c.link(libraries[dep.contractName])
      }
    }
    try {
      let args = []
      if (libName === 'ONEWalletFactoryHelper') {
        args = [factories['ONEWalletFactory'].address]
        Logger.debug('ONEWalletFactoryHelper', { args })
      }
      const instance = await c.new(...args)
      if (!factoryContracts[libName]) {
        libraries[libName] = instance
        Logger.debug(`libraries ${libName} deployed at ${instance.address}`)
      } else {
        factories[libName] = instance
        Logger.debug(`factories ${libName} deployed at ${instance.address}`)
      }
    } catch (ex) {
      console.error(`Failed to deploy ${libName}`)
      console.error(ex)
    }
  }
  const c = Contract(ONEWallet)
  c.setProvider(web3.currentProvider)
  c.defaults({ from: accounts[0] })
  await c.detectNetwork()
  for (const library of Object.values(libraries)) {
    c.link(library)
  }
  return { factories, libraries, ONEWalletAbs: c }
}

module.exports = {
  knownAddresses,
  loadContracts,
}
