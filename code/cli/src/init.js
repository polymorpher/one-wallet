import config from './config'
import { setMessage } from '../../lib/api/message'
import { setStorage } from '../../lib/api/storage'
import { initAPI, initBlockchain } from '../../lib/api'
import { setConfig } from '../../lib/config/provider'
import { getState, mergeState } from './state'

const message = () => ({
  error: (m) => console.error('[ERROR  ]', m),
  warning: (m) => console.log('[WARNING]', m),
  info: (m) => console.log('[INFO   ]', m),
  success: (m) => console.log('[SUCCESS]', m),
})
setConfig(config)
setMessage(message)

const storage = {
  getItem: (key) => {
    throw new Error('CLI storage interface is not implemented. Caller must provide [layers] to Flow')
  },
}

const apiStore = {
  state: {
    wallet: {
      relayer: config.defaults.relayer,
      network: config.defaults.network,
      relayerSecret: config.defaults.relayerSecret
    }
  },
  subscribers: [],
  subscribe: (callback) => {
    apiStore.subscribers.push(callback)
  },
  getState: () => {
    return getState()
  }
}

setStorage(storage)

export const updateState = ({ relayer, network, relayerSecret } = {}) => {
  mergeState({ wallet: { relayer, network, relayerSecret } })
  apiStore.subscribers.forEach(callback => callback && callback())
}

export const init = () => {
  initAPI(apiStore)
  initBlockchain(apiStore)
}
