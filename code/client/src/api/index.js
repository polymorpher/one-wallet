import axios from 'axios'
import config from '../config'

// eslint-disable-next-line no-unused-vars
const api = axios.create({
  baseURL: config.defaults.relayer,
  timeout: 10000,
})

// TODO: use middleware later to load secret and network states, so we don't need to pass them in every function call
const headers = (secret, network) => ({
  headers: { 'X-ONEWALLET-RELAYER-SECRET': secret, 'X-NETWORK': network }
})

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
