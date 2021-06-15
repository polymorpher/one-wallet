import config from '../config'
import localforage from 'localforage'

const store = localforage.createInstance({
  name: config.appId,
  driver: localforage.INDEXEDDB,
  version: 1.0,
  storeName: 'ONEWalletLayersStorage',
})

export default store
