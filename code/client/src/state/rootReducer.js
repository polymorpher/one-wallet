import { persistReducer } from 'redux-persist'
import { combineReducers } from 'redux'
import { connectRouter } from 'connected-react-router'
import * as reducers from './modules'
import { persistConfig as globalPersistConfig } from './modules/global'
import { persistConfig as walletPersistConfig } from './modules/wallet'
import localForage from 'localforage'
import config from '../config'

const storage = localForage.createInstance({
  name: config.appId,
  driver: localForage.INDEXEDDB,
  version: 1.0,
  storeName: 'ONEWalletState'
})

export const rootConfig = {
  key: 'root',
  storage,
  whitelist: [globalPersistConfig.key, walletPersistConfig.key]
}

const lastAction = (state = null, action) => {
  return action.type
}


const cacheConfig = {
  return action.type
  storage,
}

const rootReducer = (history) => combineReducers({
  ...reducers,
  wallet: persistReducer({ ...walletPersistConfig, storage }, reducers.wallet),
  cache: persistReducer(cacheConfig, reducers.cache),
  global: persistReducer({ ...globalPersistConfig, storage }, reducers.global),
  router: connectRouter(history),
  lastAction
})

export default (history) => persistReducer(rootConfig, rootReducer(history))

// export default (history) => persistCombineReducers(rootConfig, {
//   ...reducers,
//   wallet: persistReducer(walletConfig, reducers.wallet),
//   router: connectRouter(history)
// })
