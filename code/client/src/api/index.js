import axios from 'axios'
import config from '../config'
import { isEqual } from 'lodash'
import contract from '@truffle/contract'
import { TruffleProvider } from '@harmony-js/core'
import Web3 from 'web3'
import ONEWalletContract from '../../../build/contracts/ONEWallet.json'
import WalletConstants from '../constants/wallet'
import BN from 'bn.js'
import * as Sentry from '@sentry/browser'

const apiConfig = {
  relayer: config.defaults.relayer,
  network: config.defaults.network,
  secret: ''
}

const headers = (secret, network) => ({ 'X-ONEWALLET-RELAYER-SECRET': secret, 'X-NETWORK': network })

let api = axios.create({
  baseURL: config.defaults.relayer,
  headers: headers(apiConfig.secret, apiConfig.network),
  timeout: 15000,
})

export const initAPI = (store) => {
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
      api = axios.create({
        baseURL: relayer,
        headers: headers(secret, network),
        timeout: 15000,
      })
    }
    // console.log('api update: ', { relayer, network, secret })
  })
}

const providers = {}; const contracts = {}; const networks = []; const web3instances = {}
let activeNetwork = config.defaults.network
let web3; let one

export const initBlockchain = (store) => {
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
      Sentry.captureException(ex)
      console.error(ex)
      console.trace(ex)
    }
  })
  Object.keys(providers).forEach(k => {
    const c = contract(ONEWalletContract)
    c.setProvider(providers[k])
    contracts[k] = c
  })
  web3 = web3instances[activeNetwork]
  one = contracts[activeNetwork]
  store.subscribe(() => {
    const state = store.getState()
    const { network } = state.wallet
    if (network !== activeNetwork) {
      console.log(`Switching blockchainProvider: from ${activeNetwork} to ${network}`)
      activeNetwork = network
      web3 = web3instances[activeNetwork]
      one = contracts[activeNetwork]
    }
  })
  console.log('blockchain init complete:', { networks })
}

export default {
  binance: {
    getPrice: async () => {
      const { data } = await axios.get('https://api.binance.com/api/v3/ticker/24hr?symbol=ONEUSDT')
      const { lastPrice } = data
      return parseFloat(lastPrice)
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
        console.log(`Failed to get wallet version. Wallet might be too old. Error: ${ex.toString()}`)
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
      // TODO: use smart contract interval value, after we fully support 60 second interval in client (and Android Google Authenticator supports that too)
      return {
        address,
        root: root.slice(2),
        effectiveTime: t0.toNumber() * WalletConstants.interval,
        duration: lifespan.toNumber() * WalletConstants.interval,
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
    }
  },
  relayer: {
    create: async ({ root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit }) => {
      const { data } = await api.post('/new', { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit })
      return data
    },
    commit: async ({ address, hash }) => {
      // return new Promise((resolve, reject) => {
      //   setTimeout(() => resolve({ mock: true }), 2000)
      // })
      const { data } = await api.post('/commit', { address, hash })
      return data
    },
    revealTransfer: async ({ neighbors, index, eotp, dest, amount, address }) => {
      // return new Promise((resolve, reject) => {
      //   setTimeout(() => resolve({ mock: true }), 2000)
      // })
      const { data } = await api.post('/reveal/transfer', { neighbors, index, eotp, dest, amount, address })
      return data
    },
    revealRecovery: async ({ neighbors, index, eotp, address }) => {
      const { data } = await api.post('/reveal/recovery', { neighbors, index, eotp, address })
      return data
    },
    revealSetRecoveryAddress: async ({ neighbors, index, eotp, address, lastResortAddress }) => {
      const { data } = await api.post('/reveal/set-recovery-address', { neighbors, index, eotp, address, lastResortAddress })
      return data
    },
    retire: async ({ address }) => {
      const { data } = await api.post('/retire', { address })
      return data
    },
    health: async () => {
      const { data } = await api.get('/health')
      return data === 'OK'
    }
  },
}
