const WalletGraph = require('../build/contracts/WalletGraph.json')
const CommitManager = require('../build/contracts/CommitManager.json')
const SignatureManager = require('../build/contracts/SignatureManager.json')
const TokenTracker = require('../build/contracts/TokenTracker.json')
const DomainManager = require('../build/contracts/DomainManager.json')
const SpendingManager = require('../build/contracts/SpendingManager.json')
const CoreManager = require('../build/contracts/CoreManager.json')
const Executor = require('../build/contracts/Executor.json')
const Staking = require('../build/contracts/Staking.json')
const ONEWalletFactory = require('../build/contracts/ONEWalletFactory.json')
const ONEWalletFactoryHelper = require('../build/contracts/ONEWalletFactoryHelper.json')
const ONEWalletCodeHelper = require('../build/contracts/ONEWalletCodeHelper.json')
const Reveal = require('../build/contracts/Reveal.json')
const ONEWallet = require('../build/contracts/ONEWallet.json')
const IONEWallet = require('../build/contracts/IONEWallet.json')
const ProxyWallet = require('../build/contracts/ProxyWallet.json')

const baseLibraries = [Staking, DomainManager, TokenTracker, WalletGraph, CommitManager, SignatureManager, SpendingManager, Reveal, CoreManager, Executor]
const factoryLibraries = [ONEWalletCodeHelper]
const factoryContractsList = [ ONEWalletFactory, ONEWalletFactoryHelper ]
const factoryContracts = Object.fromEntries(factoryContractsList.map(e => [e.contractName, e]))
const libraryList = [...baseLibraries, ...factoryLibraries]
const dependencies = {
  WalletGraph: [DomainManager],
  Reveal: [CommitManager],
  Executor: [WalletGraph, SpendingManager, SignatureManager, TokenTracker, DomainManager, Staking],
  ONEWalletCodeHelper: baseLibraries,
  ONEWalletFactoryHelper: [...baseLibraries, ONEWalletCodeHelper],
}

module.exports = {
  ProxyWallet,
  WalletGraph,
  CommitManager,
  SignatureManager,
  TokenTracker,
  DomainManager,
  SpendingManager,
  CoreManager,
  Executor,
  ONEWalletFactory,
  ONEWalletFactoryHelper,
  ONEWalletCodeHelper,
  Reveal,
  ONEWallet,
  IONEWallet,
  Staking,

  baseLibraries,
  factoryLibraries,
  factoryContractsList,
  factoryContracts,
  libraryList,
  dependencies,
}
