import axios from 'axios'
import config from '../config'

// eslint-disable-next-line no-unused-vars
const api = axios.create({
  baseURL: config.defaults.relayer,
  timeout: 10000,
})

export default {
  blockchain: {
    getWallet: async () => {
      throw new Error('Not implemented')
    }
  },
  relayer: {
    create: async () => {

    },
    commit: async () => {

    },
    revealTransfer: async () => {

    },
    revealRecovery: async () => {

    },
    retire: async () => {

    }
  },
}
