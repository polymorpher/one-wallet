const axios = require('axios')
const config = require('../config/provider').getConfig()
const { isEqual } = require('lodash')
const contract = require('@truffle/contract')
const { TruffleProvider } = require('@harmony-js/core')
const Web3 = require('web3')
const ONEWalletContract = require('../../build/contracts/IONEWallet.json')
const IERC20 = require('../../build/contracts/IERC20.json')
const IERC20Metadata = require('../../build/contracts/IERC20Metadata.json')
const IERC721 = require('../../build/contracts/IERC721.json')
const IERC721Metadata = require('../../build/contracts/IERC721Metadata.json')
const IERC1155 = require('../../build/contracts/IERC1155.json')
const IERC1155MetadataURI = require('../../build/contracts/IERC1155MetadataURI.json')
const Resolver = require('../../build/contracts/Resolver.json')
const ReverseResolver = require('../../build/contracts/IDefaultReverseResolver.json')
const Registrar = require('../../build/contracts/IRegistrar.json')

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

let base = axios.create({
  baseURL: config.defaults.relayer,
  headers: headers(apiConfig.secret, apiConfig.network),
  timeout: 15000,
})

const initAPI = (store) => {
  store.subscribe(() => {
    const state = store.getState()
    const { relayer: relayerId, network, relayerSecret: secret, wallets, selected } = state.wallet
    const { majorVersion, minorVersion } = wallets?.[selected] || {}
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
        timeout: 15000,
      })
    }
    // console.log('api update: ', { relayer, network, secret })
  })
}

// TODO: cleanup this mess
const providers = {}; const contractWithProvider = {}; const networks = []; const web3instances = {}
let activeNetwork = config.defaults.network
let web3; let one
let tokenContractTemplates = { erc20: IERC20, erc721: IERC721, erc1155: IERC1155 }
let tokenMetadataTemplates = { erc20: IERC20Metadata, erc721: IERC721Metadata, erc1155: IERC1155MetadataURI }
let tokenContractsWithProvider = { erc20: {}, erc721: {}, erc1155: {} }
let tokenMetadataWithProvider = { erc20: {}, erc721: {}, erc1155: {} }
let tokens = { erc20: null, erc721: null, erc1155: null }
let tokenMetadata = { erc20: null, erc721: null, erc1155: null }

let resolverWithProvider, reverseResolverWithProvider, registrarWithProvider
let resolver, reverseResolver, registrar

const initBlockchain = (store) => {
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

  Object.keys(providers).forEach(k => {
    const c = contract(ONEWalletContract)
    c.setProvider(providers[k])
    contractWithProvider[k] = c
    Object.keys(tokenContractsWithProvider).forEach(t => {
      tokenContractsWithProvider[t][k] = contract(tokenContractTemplates[t])
      tokenContractsWithProvider[t][k].setProvider(providers[k])
      tokenMetadataWithProvider[t][k] = contract(tokenMetadataTemplates[t])
      tokenMetadataWithProvider[t][k].setProvider(providers[k])
    })
    if (k === 'harmony-mainnet') {
      resolverWithProvider = contract(Resolver)
      resolverWithProvider.setProvider(providers[k])
      reverseResolverWithProvider = contract(ReverseResolver)
      reverseResolverWithProvider.setProvider(providers[k])
      registrarWithProvider = contract(Registrar)
      registrarWithProvider.setProvider(providers[k])
    }
  })
  const switchNetwork = () => {
    web3 = web3instances[activeNetwork]
    one = contractWithProvider[activeNetwork]
    Object.keys(tokens).forEach(t => {
      tokens[t] = tokenContractsWithProvider[t][activeNetwork]
      tokenMetadata[t] = tokenMetadataWithProvider[t][activeNetwork]
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
    // console.log(`Set`, { resolver, reverseResolver, registrar })
  }
  switchNetwork()
  store.subscribe(() => {
    const state = store.getState()
    const { network } = state.wallet
    if (network !== activeNetwork) {
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
    get: async ({ link }) => {
      const { data } = await axios.get(link)
      return data
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
  blockchain: {
    /**
     * Require contract >= v2
     * @param address
     * @param raw
     * @returns {Promise<{duration: number, address, slotSize, effectiveTime: number, root, dailyLimit: string, majorVersion: (number|number), minorVersion: (number|number), lastResortAddress: *}|{maxOperationsPerInterval, lifespan, root: *, dailyLimit: string, interval, t0, majorVersion: (number|number), minorVersion: (number|number), lastResortAddress: *, height}>}
     */
    getWallet: async ({ address, raw }) => {
      const c = await one.at(address)
      const result = await c.getInfo()
      let majorVersion = new BN(0)
      let minorVersion = new BN(0)
      try {
        const versionResult = await c.getVersion()
        majorVersion = versionResult[0]
        minorVersion = versionResult[1]
      } catch (ex) {
        if (config.debug) console.log(`Failed to get wallet version. Wallet might be too old. Error: ${ex.toString()}`)
      }
      const [root, height, interval, t0, lifespan, maxOperationsPerInterval, lastResortAddress, dailyLimit] = Object.keys(result).map(k => result[k])
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
        dailyLimit: dailyLimit.toString(10),
        majorVersion: majorVersion ? majorVersion.toNumber() : 0,
        minorVersion: minorVersion ? minorVersion.toNumber() : 0,
      }
    },
    getBalance: async ({ address }) => {
      const balance = await web3.eth.getBalance(address)
      return balance
    },
    /**
     * Require contract >= v3, <= v6
     * @param address
     * @returns {Promise<*[]>}
     */
    getCommitsV3: async ({ address }) => {
      const c = await one.at(address)
      const result = await c.getCommits()
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
      const c = await one.at(address)
      const result = await c.getAllCommits()
      console.log('v7', result)
      return parseCommits(result)
    },
    /**
     * Require contract == v6
     * @param address
     * @returns {Promise<void>}
     */
    findCommitV6: async ({ address, commitHash }) => {
      const c = await one.at(address)
      const result = await c.findCommit(commitHash)
      const [hash, paramsHash, timestamp, completed] = Object.keys(result).map(k => result[k])
      return { hash, paramsHash, timestamp: new BN(timestamp).toNumber(), completed }
    },
    /**
     * Require contract >= v7
     * @param address
     * @returns {Promise<void>}
     */
    findCommit: async ({ address, commitHash }) => {
      const c = await one.at(address)
      const result = await c.lookupCommit(commitHash)
      return parseCommits(result)
    },
    /**
     * Require contract >= v5
     * @param address
     * @returns {Promise<*[]>}
     */
    getTrackedTokens: async ({ address }) => {
      const c = await one.at(address)
      const result = await c.getTrackedTokens()
      const [tokenTypes, contracts, tokenIds] = Object.keys(result).map(k => result[k])
      const tt = []
      for (let i = 0; i < tokenTypes.length; i++) {
        tt.push({
          tokenType: tokenTypes[i].toNumber(),
          contractAddress: contracts[i],
          tokenId: tokenIds[i].toNumber()
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
      const c = await tokens[ct.toLowerCase()].at(contractAddress)
      if (tokenType === ONEConstants.TokenType.ERC20) {
        return c.balanceOf(address)
      } else if (tokenType === ONEConstants.TokenType.ERC721) {
        const owner = await c.ownerOf(tokenId)
        // console.log(owner)
        return owner === address ? new BN(1) : new BN(0)
      } else if (tokenType === ONEConstants.TokenType.ERC1155) {
        return c.balanceOf(address, tokenId)
      }
    },

    getTokenMetadata: async ({ tokenType, contractAddress, tokenId }) => {
      const ct = ONEConstants.TokenType[tokenType]
      if (!ct) {
        throw new Error(`Unknown token type: ${tokenType}`)
      }
      const c = await tokenMetadata[ct.toLowerCase()].at(contractAddress)
      let name, symbol, uri, decimals
      if (tokenType === ONEConstants.TokenType.ERC20) {
        [name, symbol, decimals] = await Promise.all([c.name(), c.symbol(), c.decimals()])
      } else if (tokenType === ONEConstants.TokenType.ERC721) {
        [name, symbol, uri] = await Promise.all([c.name(), c.symbol(), c.tokenURI(tokenId)])
      } else if (tokenType === ONEConstants.TokenType.ERC1155) {
        uri = await c.uri(tokenId)
      }
      // console.log({ tokenType, contractAddress, tokenId, name, symbol, uri })
      return { name, symbol, uri, decimals: decimals && decimals.toNumber() }
    },

    getBacklinks: async ({ address }) => {
      const c = await one.at(address)
      try {
        const backlinks = await c.getBacklinks()
        return backlinks
      } catch (ex) {
        console.debug(ex)
        return []
      }
    },

    getForwardAddress: async ({ address }) => {
      const c = await one.at(address)
      try {
        const forwardAddress = await c.getForwardAddress()
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
        const c = await resolver.at(ONEConstants.Domain.DEFAULT_RESOLVER)
        const node = ONEUtil.hexString(ONEUtil.namehash(name))
        const address = await c.addr(node)
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
        const c = await reverseResolver.at(ONEConstants.Domain.DEFAULT_REVERSE_RESOLVER)
        const name = await c.name(nodeHex)
        return name
      },

      price: async ({ name }) => {
        if (!registrar) {
          // throw new Error('Unsupported network')
          return new BN(0)
        }
        const c = await registrar.at(ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR)
        const price = await c.rentPrice(name, ONEConstants.Domain.DEFAULT_RENT_DURATION)
        return price // This is a BN
      },

      available: async ({ name }) => {
        if (!registrar) {
          // throw new Error('Unsupported network')
          return false
        }
        const c = await registrar.at(ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR)
        const label = ONEUtil.hexString(ONEUtil.keccak(ONEConstants.Domain.DEFAULT_PARENT_LABEL))
        const ret = await c.query(label, name)
        return !!ret[0]
      }

    }
  },
  relayer: {
    create: async ({ root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit, backlinks = [] }) => {
      const { data } = await base.post('/new', { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit, backlinks })
      return data
    },
    commit: async ({ address, hash, paramsHash, verificationHash }) => {
      const { data } = await base.post('/commit', { address, hash, paramsHash, verificationHash })
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

    reveal: async ({ address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data = '0x' }) => {
      if (data.constructor === Uint8Array) {
        data = ONEUtil.hexString(data)
      }
      const { data: ret } = await base.post('/reveal', { address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
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
}

if (window) {
  window.ONEWallet = window.ONEWallet || {}
  window.ONEWallet.api = api
}

module.exports = {
  initAPI,
  initBlockchain,
  api
}
