const axios = require('axios')
const config = require('../config/provider').getConfig()
const { isEqual } = require('lodash')
const contract = require('@truffle/contract')
const { TruffleProvider } = require('@harmony-js/core')
const Web3 = require('web3')
const ONEWalletContract = require('../../build/contracts/ONEWallet.json')
const IERC20 = require('../../build/contracts/IERC20.json')
const IERC20Metadata = require('../../build/contracts/IERC20Metadata.json')
const IERC721 = require('../../build/contracts/IERC721.json')
const IERC721Metadata = require('../../build/contracts/IERC721Metadata.json')
const IERC1155 = require('../../build/contracts/IERC1155.json')
const IERC1155MetadataURI = require('../../build/contracts/IERC1155MetadataURI.json')
const BN = require('bn.js')
const ONEUtil = require('../util')
const ONEConstants = require('../constants')

const apiConfig = {
  relayer: config.defaults.relayer,
  network: config.defaults.network,
  secret: ''
}

const headers = (secret, network) => ({ 'X-ONEWALLET-RELAYER-SECRET': secret, 'X-NETWORK': network })

let base = axios.create({
  baseURL: config.defaults.relayer,
  headers: headers(apiConfig.secret, apiConfig.network),
  timeout: 15000,
})

const initAPI = (store) => {
  store.subscribe(() => {
    const state = store.getState()
    const { relayer: relayerId, network, relayerSecret: secret } = state.wallet
    let relayer = relayerId
    if (relayer && !relayer.startsWith('http')) {
      relayer = config.relayers[relayer]?.url
      if (!relayer) {
        relayer = config.relayers[config.defaults.relayer].url
      }
    }
    if (!isEqual(apiConfig, { relayer, network, secret })) {
      base = axios.create({
        baseURL: relayer,
        headers: headers(secret, network),
        timeout: 15000,
      })
    }
    // console.log('api update: ', { relayer, network, secret })
  })
}

const providers = {}; const contractWithProvider = {}; const networks = []; const web3instances = {}
let activeNetwork = config.defaults.network
let web3; let one
let tokenContractTemplates = { erc20: IERC20, erc721: IERC721, erc1155: IERC1155 }
let tokenMetadataTemplates = { erc20: IERC20Metadata, erc721: IERC721Metadata, erc1155: IERC1155MetadataURI }
let tokenContractsWithProvider = { erc20: {}, erc721: {}, erc1155: {} }
let tokenMetadataWithProvider = { erc20: {}, erc721: {}, erc1155: {} }
let tokens = { erc20: null, erc721: null, erc1155: null }
let tokenMetadata = { erc20: null, erc721: null, erc1155: null }

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
  })
  const switchNetwork = () => {
    web3 = web3instances[activeNetwork]
    one = contractWithProvider[activeNetwork]
    Object.keys(tokens).forEach(t => {
      tokens[t] = tokenContractsWithProvider[t][activeNetwork]
      tokenMetadata[t] = tokenMetadataWithProvider[t][activeNetwork]
    })
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

const api = {
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
    getCommits: async ({ address }) => {
      const c = await one.at(address)
      const result = await c.getCommits()
      const [hashes, args, timestamps, completed] = Object.keys(result).map(k => result[k])
      const commits = []
      for (let i = 0; i < hashes.length; i += 1) {
        commits.push({ hash: hashes[i], args: args[i], timestamp: timestamps[i], completed: completed[i] })
      }
      return commits
    },
    getTrackedTokens: async ({ address }) => {
      const c = await one.at(address)
      const result = c.getTrackedTokens()
      const [tokenTypes, contracts, tokenIds] = Object.keys(result).map(k => result[k])
      const tt = []
      for (let i = 0; i < tokenTypes.length; i++) {
        tt.push({
          tokenType: tokenTypes[i],
          contractAddress: contracts[i],
          tokenId: tokenIds[i]
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
      let name, symbol, uri
      if (tokenType === ONEConstants.TokenType.ERC20) {
        [name, symbol] = await Promise.all([c.name(), c.symbol()])
      } else if (tokenType === ONEConstants.TokenType.ERC721) {
        [name, symbol, uri] = await Promise.all([c.name(), c.symbol(), c.tokenURI(tokenId)])
      } else if (tokenType === ONEConstants.TokenType.ERC1155) {
        uri = await c.uri(tokenId)
      }
      return { name, symbol, uri }
    }
  },
  relayer: {
    create: async ({ root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit }) => {
      const { data } = await base.post('/new', { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit })
      return data
    },
    commit: async ({ address, hash }) => {
      // return new Promise((resolve, reject) => {
      //   setTimeout(() => resolve({ mock: true }), 2000)
      // })
      const { data } = await base.post('/commit', { address, hash })
      return data
    },
    revealTransfer: async ({ neighbors, index, eotp, dest, amount, address }) => {
      // return new Promise((resolve, reject) => {
      //   setTimeout(() => resolve({ mock: true }), 2000)
      // })
      const { data } = await base.post('/reveal/transfer', { neighbors, index, eotp, dest, amount, address })
      return data
    },

    updateTrackToken: async ({ address, neighbors, index, eotp, tokenType, contractAddress, tokenId, track }) => {
      return api.relayer.revealTokenOperation({ address, neighbors, index, eotp, tokenType, contractAddress, tokenId, operationType: track ? ONEConstants.OperationType.TRACK : ONEConstants.OperationType.UNTRACK, dest: ONEConstants.EmptyAddress, amount: '0', data: '0x' })
    },

    revealTokenOperation: async ({ address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data }) => {
      const { data: ret } = await base.post({ address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
      return ret
    },
    revealRecovery: async ({ neighbors, index, eotp, address }) => {
      const { data } = await base.post('/reveal/recovery', { neighbors, index, eotp, address })
      return data
    },
    revealSetRecoveryAddress: async ({ neighbors, index, eotp, address, lastResortAddress }) => {
      const { data } = await base.post('/reveal/set-recovery-address', { neighbors, index, eotp, address, lastResortAddress })
      return data
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

module.exports = {
  initAPI,
  initBlockchain,
  api
}
