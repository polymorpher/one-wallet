import axios from 'axios'
import config from '../config'
import store from '../state/store'
import { isEqual } from 'lodash'
// eslint-disable-next-line no-unused-vars
const apiConfig = {
  relayer: config.defaults.relayer,
  network: config.defaults.network,
  secret: ''
}

const headers = (secret, network) => ({
  headers: { 'X-ONEWALLET-RELAYER-SECRET': secret, 'X-NETWORK': network }
})

let api = axios.create({
  baseURL: config.defaults.relayer,
  headers: headers(apiConfig.secret, apiConfig.network),
  timeout: 10000,
})

export const initAPI = (store) => {
  console.log(store)
  store.subscribe(() => {
    const state = store.getState()
    const { relayer: relayerId, network, secret } = state.wallet
    let relayer = relayerId
    if (relayer && !relayer.startsWith('http')) {
      relayer = config.relayers[relayer]
      if (!relayer) {
        relayer = config.defaults.relayer
      }
    }
    if (!isEqual(apiConfig, { relayer, network, secret })) {
      api = axios.create({
        baseURL: relayer,
        headers: headers(secret, network),
        timeout: 10000,
      })
    }
    console.log('api update: ', { relayer, network, secret })
  })
}

export default {
  blockchain: {
    getWallet: async ({ provider, address }) => {
      throw new Error('Not implemented')
    },
    getBalance: async ({ provider, address }) => {
      throw new Error('Not implemented')
    }
  },
  relayer: {
    create: async ({ secret, network, root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit }) => {
      const { data } = await api.post('/new', { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit }, headers(secret, network))
      return data
    },
    commit: async ({ secret, network, address, hash }) => {
      const { data } = await api.post('/commit', { address, hash }, headers(secret, network))
      return data
    },
    revealTransfer: async ({ secret, network, neighbors, index, eotp, dest, amount, address }) => {
      const { data } = await api.post('/reveal/transfer', { neighbors, index, eotp, dest, amount, address }, headers(secret, network))
      return data
    },
    revealRecovery: async ({ secret, network, neighbors, index, eotp, address }) => {
      const { data } = await api.post('/reveal/recovery', { neighbors, index, eotp, address }, headers(secret, network))
      return data
    },
    retire: async ({ secret, network, address }) => {
      const { data } = await api.post('/retire', { address }, headers(secret, network))
      return data
    },
    health: async () => {
      const { data } = await api.get('/health')
      return data === 'OK'
    }
  },
}
