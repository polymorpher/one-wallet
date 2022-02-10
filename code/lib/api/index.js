const axios = require('axios')
const config = require('../config/provider').getConfig()
const Contract = require('web3-eth-contract')
const isEqual = require('lodash/fp/isEqual')
const { TruffleProvider } = require('@harmony-js/core')
const Web3 = require('web3')
const ONEWalletContractAbi = require('../../build/abi/IONEWallet.json')
const IONEWalletFactoryHelper = require('../../build/abi/IONEWalletFactoryHelper.json')
const IERC20 = require('../../build/abi/IERC20.json')
const IERC20Metadata = require('../../build/abi/IERC20Metadata.json')
const IERC721 = require('../../build/abi/IERC721.json')
const IERC165 = require('../../build/abi/IERC165.json')
const IERC721Metadata = require('../../build/abi/IERC721Metadata.json')
const IERC1155 = require('../../build/abi/IERC1155.json')
const IERC1155MetadataURI = require('../../build/abi/IERC1155MetadataURI.json')
const Resolver = require('../../build/abi/Resolver.json')
const ReverseResolver = require('../../build/abi/IDefaultReverseResolver.json')
const Registrar = require('../../build/abi/IRegistrar.json')
// abi only - load with web3 or ethers
const SushiRouter = require('../../external/IUniswapV2Router02.json')
const SushiFactory = require('../../external/IUniswapV2Factory.json')
const SushiToken = require('../../external/IERC20Uniswap.json')
const SushiPair = require('../../external/IUniswapV2Pair.json')

const BN = require('bn.js')
const ONEUtil = require('../util')
const ONEConstants = require('../constants')

const apiConfig = {
  relayer: config.defaults.relayer,
  network: config.defaults.network,
  secret: '',
  majorVersion: 0,
  minorVersion: 0,
}

const headers = ({ secret, network, majorVersion, minorVersion }) => ({
  'X-ONEWALLET-RELAYER-SECRET': secret,
  'X-NETWORK': network,
  'X-MAJOR-VERSION': majorVersion,
  'X-MINOR-VERSION': minorVersion,
})

const TIMEOUT = 60000

let base = axios.create({
  baseURL: config.defaults.relayer,
  headers: headers(apiConfig.secret, apiConfig.network),
  timeout: TIMEOUT,
})

const initAPI = (store) => {
  store.subscribe(() => {
    const state = store.getState()
    const { relayer: relayerId, network, relayerSecret: secret, selectedWallet } = state.global
    const wallets = state.wallet
    const { majorVersion, minorVersion } = wallets?.[selectedWallet] || {}
    let relayer = relayerId
    if (relayer && !relayer.startsWith('http')) {
      relayer = config.relayers[relayer]?.url
      if (!relayer) {
        relayer = config.relayers[config.defaults.relayer].url
      }
    }
    if (!isEqual(apiConfig, { relayer, network, secret, majorVersion, minorVersion })) {
      base = axios.create({
        baseURL: relayer,
        headers: headers({ secret, network, majorVersion, minorVersion }),
        timeout: TIMEOUT,
      })
    }
    // console.log('api update: ', { relayer, network, secret })
  })
}

// TODO: cleanup this mess after switching to w3

let activeNetwork = config.defaults.network
let web3
let oneWallet

let getTokenContract = { erc20: null, erc721: null, erc1155: null }
let getTokenMetadataContract = { erc20: null, erc721: null, erc1155: null }
let resolver, reverseResolver, registrar

const initBlockchain = (store) => {
  const web3instances = {}
  const providers = {}
  const networks = []
  let resolverWithProvider, reverseResolverWithProvider, registrarWithProvider
  let tokenContractTemplates = { erc20: IERC20, erc721: IERC721, erc1155: IERC1155 }
  let tokenMetadataTemplates = { erc20: IERC20Metadata, erc721: IERC721Metadata, erc1155: IERC1155MetadataURI }
  let tokenContractsWithProvider = { erc20: {}, erc721: {}, erc1155: {} }
  let tokenMetadataWithProvider = { erc20: {}, erc721: {}, erc1155: {} }
  const getOneWalletContractWithProvider = {}
  Object.keys(config.networks).forEach(k => {
    const n = config.networks[k]
    try {
      if (k.startsWith('eth')) {
        providers[k] = new Web3.providers.HttpProvider(n.url)
      } else {
        providers[k] = new TruffleProvider(n.url, {}, { shardId: 0, chainId: n.chainId })
      }
      web3instances[k] = new Web3(providers[k])
      networks.push(k)
    } catch (ex) {
      console.error(ex)
      console.trace(ex)
    }
  })

  Object.keys(providers).forEach(network => {
    getOneWalletContractWithProvider[network] = (address) => {
      Contract.setProvider(providers[network])
      return new Contract(ONEWalletContractAbi, address)
    }
    Object.keys(tokenContractsWithProvider).forEach(t => {
      tokenContractsWithProvider[t][network] = (address) => {
        Contract.setProvider(providers[network])
        return new Contract(tokenContractTemplates[t], address)
      }
      tokenMetadataWithProvider[t][network] = (address) => {
        Contract.setProvider(providers[network])
        return new Contract(tokenMetadataTemplates[t], address)
      }
    })
    if (network === 'harmony-mainnet') {
      resolverWithProvider = (address) => new Contract(Resolver, address)
      reverseResolverWithProvider = (address) => new Contract(ReverseResolver, address)
      registrarWithProvider = (address) => new Contract(Registrar, address)
    }
  })
  const switchNetwork = () => {
    web3 = web3instances[activeNetwork]
    oneWallet = getOneWalletContractWithProvider[activeNetwork]
    Object.keys(getTokenContract).forEach(t => {
      getTokenContract[t] = tokenContractsWithProvider[t][activeNetwork]
      getTokenMetadataContract[t] = tokenMetadataWithProvider[t][activeNetwork]
    })
    if (activeNetwork === 'harmony-mainnet') {
      resolver = resolverWithProvider
      reverseResolver = reverseResolverWithProvider
      registrar = registrarWithProvider
    } else {
      resolver = null
      reverseResolver = null
      registrar = null
    }
  }
  switchNetwork()
  store.subscribe(() => {
    const state = store.getState()
    const { network } = state.global
    if (network && network !== activeNetwork) {
      if (config.debug) console.log(`Switching blockchain provider: from ${activeNetwork} to ${network}`)
      activeNetwork = network
      switchNetwork()
    }
  })
  if (config.debug) console.log('blockchain init complete:', { networks })
}
const parseCommits = (result) => {
  const [hashes, paramsHashes, verificationHashes, timestamps, completed] = Object.keys(result).map(k => result[k])
  const commits = []
  for (let i = 0; i < hashes.length; i += 1) {
    commits.push({ hash: hashes[i], paramsHash: paramsHashes[i], verificationHash: verificationHashes[i], timestamp: timestamps[i], completed: completed[i] })
  }
  return commits
}
const api = {
  web: {
    get: async ({ link, options }) => {
      const { data } = await axios.get(link, options)
      return data
    },
    head: async ({ link }) => {
      const { headers } = await axios.head(link)
      return headers
    }
  },
  binance: {
    getPrice: async () => {
      const { data } = await axios.get('https://api.binance.com/api/v3/ticker/24hr?symbol=ONEUSDT')
      const { lastPrice } = data
      return parseFloat(lastPrice)
    }
  },
  walletStats: {
    getStats: async () => {
      const { data } = await axios.get('https://explorer-v2-api.hmny.io/v0/1wallet/metrics')
      const totalAmount = Math.round(ONEUtil.toOne(new BN(data.totalAmount)))

      return {
        count: data.count,
        totalAmount: totalAmount
      }
    }
  },
  factory: {
    getCode: async () => {
      const c = new web3.eth.Contract(IONEWalletFactoryHelper, config.networks[activeNetwork].deploy.deployer)
      return c.methods.getCode().call()
    },
    getVersion: async () => {
      const c = new web3.eth.Contract(IONEWalletFactoryHelper, config.networks[activeNetwork].deploy.deployer)
      const r = await c.methods.getVersion().call()
      const majorVersion = r[0].toString()
      const minorVersion = r[1].toString()
      return `${majorVersion}.${minorVersion}`
    },
    predictAddress: async ({ identificationKey }) => {
      const c = new web3.eth.Contract(IONEWalletFactoryHelper, config.networks[activeNetwork].deploy.deployer)
      return c.methods.predict(identificationKey).call()
    },
    verify: async ({ address }) => {
      const c = new web3.eth.Contract(IONEWalletFactoryHelper, config.networks[activeNetwork].deploy.deployer)
      return c.methods.verify(address).call()
    }
  },
  blockchain: {
    getOldInfos: async ({ address, raw }) => {
      const c = oneWallet(address)
      const res = await c.methods.getOldInfos().call()
      return res.map(e => ONEUtil.processCore(e, raw))
    },
    getInnerCores: async ({ address, raw }) => {
      const c = oneWallet(address)
      const res = await c.methods.getInnerCores().call()
      return res.map(e => ONEUtil.processCore(e, raw))
    },
    getIdentificationKeys: async ({ address }) => {
      const c = oneWallet(address)
      const res = await c.methods.getIdentificationKeys().call()
      return res
    },
    getLastOperationTime: async ({ address }) => {
      const c = oneWallet(address)
      const t = await c.methods.lastOperationTime().call() // BN but convertible to uint32
      return new BN(t).toNumber()
    },
    getNonce: async ({ address }) => {
      const c = oneWallet(address)
      const nonce = await c.methods.getNonce().call()
      return new BN(nonce).toNumber()
    },
    getSpending: async ({ address }) => {
      const c = oneWallet(address)
      let spendingLimit, spendingAmount, lastSpendingInterval, spendingInterval
      const r = await c.methods.getCurrentSpendingState().call()
      spendingLimit = new BN(r[0])
      spendingAmount = new BN(r[1])
      lastSpendingInterval = new BN(r[2])
      spendingInterval = new BN(r[3])
      return { spendingLimit, spendingAmount, lastSpendingInterval, spendingInterval }
    },
    /**
     * Require contract >= v2
     * @param address
     * @param raw
     * @returns {Promise<{address, slotSize, highestSpendingLimit: string, effectiveTime: number, majorVersion: (number|number), lastSpendingInterval: number, spendingAmount: string, duration: number, spendingLimit: string, lastLimitAdjustmentTime: number, root, minorVersion: (number|number), spendingInterval: number, lastResortAddress: *}|{maxOperationsPerInterval, highestSpendingLimit: BN, lifespan, majorVersion: (number|number), spendingAmount: BN, lastSpendingInterval: BN, spendingLimit: BN, lastLimitAdjustmentTime: BN, root: *, dailyLimit: string, interval, t0, minorVersion: (number|number), spendingInterval: BN, lastResortAddress: *, height}>}
     */
    getWallet: async ({ address, raw }) => {
      const c = oneWallet(address)
      const result = await c.methods.getInfo().call()
      let majorVersion = new BN(0)
      let minorVersion = new BN(0)
      try {
        const versionResult = await c.methods.getVersion().call()
        majorVersion = new BN(versionResult[0])
        minorVersion = new BN(versionResult[1])
      } catch (ex) {
        if (config.debug) console.log(`Failed to get wallet version. Wallet might be too old. Error: ${ex.toString()}`)
      }
      const root = result[0]
      const height = new BN(result[1])
      const interval = new BN(result[2])
      const t0 = new BN(result[3])
      const lifespan = new BN(result[4])
      const maxOperationsPerInterval = new BN(result[5])
      const lastResortAddress = result[6]
      const dailyLimit = new BN(result[7])
      let spendingLimit; let spendingAmount; let lastSpendingInterval; let spendingInterval
      let lastLimitAdjustmentTime = new BN(0); let highestSpendingLimit = new BN(0)
      if (majorVersion >= 15) {
        const r = await c.methods.getSpendingState().call()
        spendingLimit = new BN(r[0])
        spendingAmount = new BN(r[1])
        lastSpendingInterval = new BN(r[2])
        spendingInterval = new BN(r[3])
        lastLimitAdjustmentTime = new BN(r[4])
        highestSpendingLimit = new BN(r[5])
      } else if (majorVersion >= 12) {
        const r = await c.methods.getCurrentSpendingState().call()
        spendingLimit = new BN(r[0])
        spendingAmount = new BN(r[1])
        lastSpendingInterval = new BN(r[2])
        spendingInterval = new BN(r[3])
      } else {
        const r = await c.methods.getCurrentSpending().call()
        spendingAmount = new BN(r[0])
        lastSpendingInterval = new BN(r[1])
        spendingLimit = dailyLimit
        spendingInterval = new BN(ONEConstants.DefaultSpendingInterval) // default value for pre-v12 wallets i.e. dailyLimit
      }

      if (raw) {
        return {
          root,
          height: height.toNumber(),
          interval: interval.toNumber(),
          t0: t0.toNumber(),
          lifespan: lifespan.toNumber(),
          maxOperationsPerInterval: maxOperationsPerInterval.toNumber(),
          lastResortAddress,
          dailyLimit: dailyLimit.toString(10),
          majorVersion: majorVersion ? majorVersion.toNumber() : 0,
          minorVersion: minorVersion ? minorVersion.toNumber() : 0,
          spendingAmount: spendingAmount.toString(),
          lastSpendingInterval: lastSpendingInterval.toNumber(),
          spendingLimit: spendingLimit.toString(),
          spendingInterval: spendingInterval.toNumber(),
          lastLimitAdjustmentTime: lastLimitAdjustmentTime.toNumber(),
          highestSpendingLimit: highestSpendingLimit.toString(),
        }
      }
      const intervalMs = interval.toNumber() * 1000
      // TODO: use smart contract interval value, after we fully support 60 second interval in client (and Android Google Authenticator supports that too)
      return {
        address,
        root: root.slice(2),
        effectiveTime: t0.toNumber() * intervalMs,
        duration: lifespan.toNumber() * intervalMs,
        slotSize: maxOperationsPerInterval.toNumber(),
        lastResortAddress,
        majorVersion: majorVersion ? majorVersion.toNumber() : 0,
        minorVersion: minorVersion ? minorVersion.toNumber() : 0,
        spendingLimit: spendingLimit.toString(),
        lastSpendingInterval: lastSpendingInterval.toNumber(),
        spendingAmount: spendingAmount.toString(),
        spendingInterval: spendingInterval.toNumber() * 1000,
        lastLimitAdjustmentTime: lastLimitAdjustmentTime.toNumber() * 1000,
        highestSpendingLimit: highestSpendingLimit.toString(),
      }
    },
    getBalance: async ({ address }) => {
      const balance = await web3.eth.getBalance(address)
      return balance
    },
    getCode: async ({ address }) => {
      const code = await web3.eth.getCode(address)
      return code
    },
    /**
     * Require contract >= v3, <= v6
     * @param address
     * @returns {Promise<*[]>}
     */
    getCommitsV3: async ({ address }) => {
      const c = oneWallet(address)
      const result = await c.methods.getCommits().call()
      const [hashes, paramsHashes, timestamps, completed] = Object.keys(result).map(k => result[k])
      const commits = []
      for (let i = 0; i < hashes.length; i += 1) {
        commits.push({ hash: hashes[i], paramsHash: paramsHashes[i], timestamp: timestamps[i], completed: completed[i] })
      }
      return commits
    },

    /**
     * Require contract >= v7
     * @param address
     * @returns {Promise<*[]>}
     */
    getCommits: async ({ address }) => {
      const c = oneWallet(address)
      const result = await c.methods.getAllCommits().call()
      return parseCommits(result)
    },
    /**
     * Require contract == v6
     * @param address
     * @returns {Promise<void>}
     */
    findCommitV6: async ({ address, commitHash }) => {
      const c = oneWallet(address)
      const result = await c.methods.findCommit(commitHash).call()
      const [hash, paramsHash, timestamp, completed] = Object.keys(result).map(k => result[k])
      return { hash, paramsHash, timestamp: new BN(timestamp).toNumber(), completed }
    },
    /**
     * Require contract >= v7
     * @param address
     * @returns {Promise<void>}
     */
    findCommit: async ({ address, commitHash }) => {
      const c = oneWallet(address)
      const result = await c.methods.lookupCommit(commitHash).call()
      return parseCommits(result)
    },
    /**
     * Require contract >= v5
     * @param address
     * @returns {Promise<*[]>}
     */
    getTrackedTokens: async ({ address }) => {
      const c = oneWallet(address)
      const result = await c.methods.getTrackedTokens().call()
      const [tokenTypes, contracts, tokenIds] = Object.keys(result).map(k => result[k])
      const tt = []
      for (let i = 0; i < tokenTypes.length; i++) {
        tt.push({
          tokenType: tokenTypes[i].toNumber(),
          contractAddress: contracts[i],
          tokenId: tokenIds[i].toString()
        })
      }
      return tt
    },

    // returns Promise<BN>
    tokenBalance: async ({ address, contractAddress, tokenType, tokenId }) => {
      const ct = ONEConstants.TokenType[tokenType]
      if (!ct) {
        throw new Error(`Unknown token type: ${tokenType}`)
      }
      const c = await getTokenContract[ct.toLowerCase()](contractAddress)
      if (tokenType === ONEConstants.TokenType.ERC20) {
        return c.methods.balanceOf(address).call()
      } else if (tokenType === ONEConstants.TokenType.ERC721) {
        const owner = await c.ownerOf(tokenId)
        return owner === address ? new BN(1) : new BN(0)
      } else if (tokenType === ONEConstants.TokenType.ERC1155) {
        return c.methods.balanceOf(address, tokenId).call()
      }
    },

    getTokenMetadata: async ({ tokenType, contractAddress, tokenId }) => {
      const ct = ONEConstants.TokenType[tokenType]
      if (!ct) {
        throw new Error(`Unknown token type: ${tokenType}`)
      }
      const c = await getTokenMetadataContract[ct.toLowerCase()](contractAddress)
      let name, symbol, uri, decimals
      if (tokenType === ONEConstants.TokenType.ERC20) {
        [name, symbol, decimals] = await Promise.all([c.methods.name().call(), c.methods.symbol().call(), c.methods.decimals().call()])
      } else if (tokenType === ONEConstants.TokenType.ERC721) {
        [name, symbol, uri] = await Promise.all([c.methods.name().call(), c.methods.symbol().call(), c.methods.tokenURI(tokenId).call()])
      } else if (tokenType === ONEConstants.TokenType.ERC1155) {
        uri = await c.methods.uri(tokenId).call()
      }
      // console.log({ tokenType, contractAddress, tokenId, name, symbol, uri })
      return { name, symbol, uri, decimals: decimals && new BN(decimals).toNumber() }
    },

    getBacklinks: async ({ address }) => {
      const c = oneWallet(address)
      try {
        const backlinks = await c.methods.getBacklinks().call()
        return backlinks
      } catch (ex) {
        console.debug(ex)
        return []
      }
    },

    getForwardAddress: async ({ address }) => {
      const c = oneWallet(address)
      try {
        const forwardAddress = await c.methods.getForwardAddress().call()
        return forwardAddress
      } catch (ex) {
        console.debug(ex)
        return ONEConstants.EmptyAddress
      }
    },

    domain: {
      resolve: async ({ name }) => {
        if (!resolver) {
          return ONEConstants.EmptyAddress
        }
        const c = await resolver(ONEConstants.Domain.DEFAULT_RESOLVER)
        const node = ONEUtil.hexString(ONEUtil.namehash(name))
        const address = await c.methods.addr(node).call()
        return address
      },
      reverseLookup: async ({ address }) => {
        if (!reverseResolver) {
          return ''
        }
        if (address.startsWith('0x')) {
          address = address.slice(2)
        }
        const label = ONEUtil.keccak(address.toLowerCase())
        const buffer = new Uint8Array(64)
        buffer.set(ONEUtil.hexStringToBytes(ONEConstants.Domain.ADDR_REVERSE_NODE))
        buffer.set(label, 32)
        const node = ONEUtil.keccak(buffer)
        const nodeHex = ONEUtil.hexString(node)
        // console.log(nodeHex)
        const c = await reverseResolver(ONEConstants.Domain.DEFAULT_REVERSE_RESOLVER)
        const name = await c.methods.name(nodeHex).call()
        return name
      },

      price: async ({ name }) => {
        if (!registrar) {
          // throw new Error('Unsupported network')
          return new BN(0)
        }
        const c = await registrar(ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR)
        const price = await c.methods.rentPrice(name, ONEConstants.Domain.DEFAULT_RENT_DURATION).call()
        return new BN(price) // This is a BN
      },

      available: async ({ name }) => {
        if (!registrar) {
          // throw new Error('Unsupported network')
          return false
        }
        const c = await registrar(ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR)
        const label = ONEUtil.hexString(ONEUtil.keccak(ONEConstants.Domain.DEFAULT_PARENT_LABEL))
        const ret = await c.methods.query(label, name).call()
        return !!ret[0]
      }
    },
  },

  sushi: {
    getCachedTokenPairs: async () => {
      const { data } = await base.get('/sushi')
      const { pairs, tokens } = data || {}
      return { pairs, tokens }
    },
    getAmountOut: async ({ amountIn, tokenAddress, inverse }) => {
      const c = new web3.eth.Contract(SushiRouter, ONEConstants.Sushi.ROUTER)
      const path = inverse ? [tokenAddress, ONEConstants.Sushi.WONE] : [ONEConstants.Sushi.WONE, tokenAddress]
      const amountsOut = await c.methods.getAmountsOut(amountIn, path).call()
      return amountsOut[1]
    },
    getAmountIn: async ({ amountOut, tokenAddress, inverse }) => {
      const c = new web3.eth.Contract(SushiRouter, ONEConstants.Sushi.ROUTER)
      const path = inverse ? [ONEConstants.Sushi.WONE, tokenAddress] : [tokenAddress, ONEConstants.Sushi.WONE]
      const amountsIn = await c.methods.getAmountsIn(amountOut, path).call()
      return amountsIn[0]
    },
    getTokenInfo: async ({ tokenAddress }) => {
      const t = new web3.eth.Contract(SushiToken, tokenAddress)
      const [symbol, name, decimal, supply] = await Promise.all([t.methods.symbol().call(), t.methods.name().call(), t.methods.decimals().call(), t.methods.totalSupply().call()])
      return {
        symbol, name, decimal, supply, address: tokenAddress
      }
    },
    getPair: async ({ t0, t1 }) => {
      const factory = new web3.eth.Contract(SushiFactory, ONEConstants.Sushi.FACTORY)
      const pair = await factory.methods.getPair(t0, t1).call()
      return pair
    },
    getReserves: async ({ pairAddress }) => {
      const t = new web3.eth.Contract(SushiPair, pairAddress)
      const r = await t.methods.getReserves().call()
      const [reserve0, reserve1, time] = [r[0], r[1], r[2]]
      return { reserve0, reserve1, time }
    },
    getTokenIcon: async ({ symbol }) => {
      return `https://res.cloudinary.com/sushi-cdn/image/fetch/w_64/https://raw.githubusercontent.com/sushiswap/icons/master/token/${symbol.toLowerCase()}.jpg`
    },
    getAllowance: async ({ address, contractAddress }) => {
      const t = new web3.eth.Contract(SushiToken, contractAddress)
      const r = await t.methods.allowance(address, ONEConstants.Sushi.ROUTER).call()
      // returns a BN
      return new BN(r)
    }
  },

  relayer: {
    create: async ({
      root, height, interval, t0, lifespan, slotSize, lastResortAddress, spendingLimit, // classic
      spendingInterval, spentAmount = 0, lastSpendingInterval = 0, // v12
      backlinks = [], // v9
      oldCores = [], // v14
      innerCores, identificationKeys, lastLimitAdjustmentTime = 0, highestSpendingLimit = spendingLimit, // v15
    }) => {
      const { data } = await base.post('/new', {
        root,
        height,
        interval,
        t0,
        lifespan,
        slotSize,
        lastResortAddress,
        spendingLimit, // ^classic
        spendingInterval,
        spentAmount,
        lastSpendingInterval, // ^v12
        backlinks, // v9
        oldCores, // v14
        innerCores,
        identificationKeys,
        lastLimitAdjustmentTime,
        highestSpendingLimit, // ^v15
      })
      return data
    },
    commit: async ({ address, hash, paramsHash, verificationHash, majorVersion, minorVersion }) => {
      const { data } = await base.post('/commit', { address, hash, paramsHash, verificationHash, majorVersion, minorVersion })
      return data
    },
    revealTransfer: async ({ neighbors, index, eotp, dest, amount, address }) => {
      return api.relayer.reveal({
        address,
        neighbors,
        index,
        eotp,
        dest,
        amount,
        operationType: ONEConstants.OperationType.TRANSFER,
        tokenType: ONEConstants.TokenType.NONE,
        contractAddress: ONEConstants.EmptyAddress,
        tokenId: 0
      })
    },

    updateTrackToken: async ({ address, neighbors, index, eotp, tokenType, contractAddress, tokenId, track }) => {
      return api.relayer.revealTokenOperation({ address, neighbors, index, eotp, tokenType, contractAddress, tokenId, operationType: track ? ONEConstants.OperationType.TRACK : ONEConstants.OperationType.UNTRACK, dest: ONEConstants.EmptyAddress, amount: '0', data: '0x' })
    },

    revealTokenOperation: async ({ address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data = '0x' }) => {
      return api.relayer.reveal({ address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
    },
    revealRecovery: async ({ neighbors, index, eotp, address, data }) => {
      return api.relayer.reveal({
        address,
        neighbors,
        index,
        eotp,
        operationType: ONEConstants.OperationType.RECOVER,
        tokenType: ONEConstants.TokenType.NONE,
        contractAddress: ONEConstants.EmptyAddress,
        tokenId: 0,
        dest: ONEConstants.EmptyAddress,
        amount: 0,
        data,
      })
    },
    revealSetRecoveryAddress: async ({ neighbors, index, eotp, address, lastResortAddress }) => {
      return api.relayer.reveal({
        address,
        neighbors,
        index,
        eotp,
        operationType: ONEConstants.OperationType.SET_RECOVERY_ADDRESS,
        tokenType: ONEConstants.TokenType.NONE,
        contractAddress: ONEConstants.EmptyAddress,
        tokenId: 0,
        dest: lastResortAddress,
        amount: 0,
      })
    },

    /**
     *
     * @param neighbors
     * @param index
     * @param eotp
     * @param address
     * @param registrar - hex address of Registrar
     * @param reverseRegistrar - hex address of ReverseRegistrar
     * @param resolver - hex address of Resolver
     * @param maxPrice - string, maximum price acceptable for the domain purchase, in wei
     * @param subdomain - string, the subdomain to be purchased. For "polymorpher.crazy.one", the subdomain is "polymorpher"
     * @returns {Promise<void>}
     */
    revealBuyDomain: async ({ neighbors, index, eotp, address,
      registrar = ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR,
      reverseRegistrar = ONEConstants.Domain.DEFAULT_REVERSE_REGISTRAR,
      resolver = ONEConstants.Domain.DEFAULT_RESOLVER,
      maxPrice,
      subdomain,
      data,
    }) => {
      return api.relayer.reveal({
        neighbors,
        index,
        eotp,
        address,
        operationType: ONEConstants.OperationType.BUY_DOMAIN,
        tokenType: ONEConstants.TokenType.NONE,
        contractAddress: registrar,
        dest: resolver,
        amount: maxPrice,
        tokenId: subdomain.length,
        data,
      })
    },

    revealTransferDomain: async ({ neighbors, index, eotp, address,
      parentLabel = ONEConstants.Domain.DEFAULT_PARENT_LABEL,
      tld = ONEConstants.Domain.DEFAULT_TLD,
      registrar = ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR,
      resolver = ONEConstants.Domain.DEFAULT_RESOLVER,
      subdomain,
      dest,
    }) => {
      const subnode = ONEUtil.namehash([subdomain, parentLabel, tld].join('.'))
      return api.relayer.reveal({
        neighbors,
        index,
        eotp,
        address,
        operationType: ONEConstants.OperationType.TRANSFER_DOMAIN,
        tokenType: ONEConstants.TokenType.NONE,
        contractAddress: registrar,
        tokenId: ONEUtil.hexString(ONEUtil.hexStringToBytes(resolver, 32)),
        dest,
        amount: ONEUtil.hexString(subnode),
      })
    },

    revealForward: async ({ address, neighbors, index, eotp, dest }) => {
      return api.relayer.reveal({
        address,
        neighbors,
        index,
        eotp,
        operationType: ONEConstants.OperationType.FORWARD,
        tokenType: ONEConstants.TokenType.NONE,
        contractAddress: ONEConstants.EmptyAddress,
        tokenId: 0,
        amount: 0,
        dest
      })
    },

    reveal: async ({ address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data = '0x', majorVersion, minorVersion }) => {
      if (data.constructor === Uint8Array) {
        data = ONEUtil.hexString(data)
      }
      const { data: ret } = await base.post('/reveal', { address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data, majorVersion, minorVersion })
      return ret
    },
    retire: async ({ address }) => {
      const { data } = await base.post('/retire', { address })
      return data
    },
    health: async () => {
      const { data } = await base.get('/health')
      return data === 'OK'
    }
  },

  // utilities around tokens
  tokens: {
    batchGetMetadata: async (tokens) => {
      return Promise.all(tokens.map(async (t) => {
        try {
          if (t.key === 'one') {
            return t
          }
          const { name, symbol, decimals } = await api.blockchain.getTokenMetadata(t)
          return {
            ...t,
            name,
            symbol,
            decimals
          }
        } catch (ex) {
          console.error(ex)
        }
      }))
    },
    getNFTType: async (contractAddress) => {
      const c = new web3.eth.Contract(IERC165.abi, contractAddress)
      const is721 = await c.methods.supportsInterface(ONEConstants.TokenInterfaces.ERC721).call()
      if (is721) {
        return ONEConstants.TokenType.ERC721
      }
      const is1155 = await c.methods.supportsInterface(ONEConstants.TokenInterfaces.ERC1155).call()
      if (is1155) {
        return ONEConstants.TokenType.ERC1155
      }
      return ONEConstants.TokenType.NONE
    }
  },
  daVinci: {
    query: async (tokenId) => {
      const { data } = await axios.get(`https://davinci.gallery/api/orderbyartwork/${tokenId}`)
      const { orderid: orderIdNum, created, startdate: startDateResponse, enddate: endDateResponse, owner, seller, tokenid: tokenIdResponse,
        tokentype: tokenTypeResponse, sellprice, buyprice, royalties: royaltyResponse, beneficiary, collection, original: isOriginal,
        address: orderId
        // fees, artwork,
      } = data
      let tokenType = ONEConstants.TokenType.NONE
      if (tokenTypeResponse === '1155') {
        tokenType = ONEConstants.TokenType.ERC1155
      } else if (tokenTypeResponse === '1155') {
        tokenType = ONEConstants.TokenType.ERC721
      }
      const sellPrice = ONEUtil.toFraction(sellprice || 0)
      const buyPrice = ONEUtil.toFraction(buyprice || 0)
      const royalty = (royaltyResponse || 0) / 100
      return {
        orderId,
        orderIdNum,
        creationTime: Date.parse(created),
        startTime: Date.parse(startDateResponse),
        endTime: Date.parse(endDateResponse),
        owner,
        seller,
        tokenId: tokenIdResponse,
        tokenType,
        sellPrice,
        buyPrice,
        royalty,
        beneficiary,
        collection,
        isOriginal
      }
    }
  },
  explorer: {
    decodeMethod: (hash) => {
      const { data } = axios.get(`https://explorer-v2-api.hmny.io/v0/signature/hash/${hash.slice(10)}`)
      return data || []
    }
  }
}

if (typeof window !== 'undefined') {
  window.ONEWallet = window.ONEWallet || {}
  window.ONEWallet.api = api
}

module.exports = {
  initAPI,
  initBlockchain,
  api
}
