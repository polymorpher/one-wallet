import { persistReducer } from 'redux-persist'
import { combineReducers } from 'redux'
import { connectRouter } from 'connected-react-router'
import * as reducers from './modules'
import localForage from 'localforage'
import config from '../config'

const storage = localForage.createInstance({
  name: config.appId,
  driver: localForage.INDEXEDDB,
  version: 1.0,
  storeName: 'ONEWalletState'
})

const rootConfig = {
  key: 'root',
  storage,
  whitelist: ['wallet']
}

const walletConfig = {
  key: 'wallet',
  storage,
  blacklist: ['error', 'fetching', 'loading']
}

const cacheConfig = {
  key: 'cache',
  storage,
}

const rootReducer = (history) => combineReducers({
  ...reducers,
  wallet: persistReducer(walletConfig, reducers.wallet),
  cache: persistReducer(cacheConfig, reducers.cache),
  router: connectRouter(history)
})

export default (history) => persistReducer(rootConfig, rootReducer(history))

// export default (history) => persistCombineReducers(rootConfig, {
//   ...reducers,
//   wallet: persistReducer(walletConfig, reducers.wallet),
//   router: connectRouter(history)
// })
