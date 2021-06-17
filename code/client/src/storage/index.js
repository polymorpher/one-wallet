import config from '../config'
import localforage from 'localforage'

const storage = localforage.createInstance({
  name: config.appId,
  driver: localforage.INDEXEDDB,
  version: 1.0,
  storeName: 'ONEWalletStorage',
})

export default storage
