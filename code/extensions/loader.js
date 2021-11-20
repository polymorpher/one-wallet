const { factoryContractsList, factoryContracts, libraryList, dependencies } = require('./contracts')
const ONEConfig = require('../lib/config/common')
const Contract = require('@truffle/contract')

const knownAddresses = {
  ONEWalletFactory: (network) => ONEConfig.networks[network]?.deploy?.factory,
  ONEWalletFactoryHelper: (network) => ONEConfig.networks[network]?.deploy?.deployer,
  ONEWalletCodeHelper: (network) => ONEConfig.networks[network]?.deploy?.codeHelper,
}

// including libraries
const loadContracts = async () => {
  const libraries = {}
  const factories = {}
  for (let lib of [...libraryList, ...factoryContractsList]) {
    const libName = lib.contractName
    const accounts = await web3.eth.getAccounts()
    const c = Contract(lib)
    c.setProvider(web3.currentProvider)
    c.defaults({ from: accounts[0] })
    console.log(`Deploying [${libName}]`)
    if (dependencies[libName]) {
      for (let dep of dependencies[libName]) {
        console.log(`[${libName}] Contract depends on ${dep.contractName}. Linking...`)
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
        console.log('ONEWalletFactoryHelper', { args })
      }
      const instance = await c.new(...args)
      if (!factoryContracts[libName]) {
        libraries[libName] = instance
        console.log(`libraries ${libName} deployed at ${instance.address}`)
      } else {
        factories[libName] = instance
        console.log(`factories ${libName} deployed at ${instance.address}`)
      }
    } catch (ex) {
      console.error(`Failed to deploy ${libName}`)
      console.error(ex)
    }
  }
  return { factories, libraries }
}

module.exports = {
  knownAddresses,
  loadContracts,
}
