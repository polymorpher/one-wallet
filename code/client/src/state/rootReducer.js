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

export const rootConfig = {
  key: 'root',
  storage,
  whitelist: ['wallet']
}

const walletConfig = {
  key: 'wallet',
  storage,
  blacklist: ['layers', 'provider', 'error', 'fetching', 'loading']
}

const lastAction = (state = null, action) => {
  return action.type
}

const rootReducer = (history) => combineReducers({
  ...reducers,
  wallet: persistReducer(walletConfig, reducers.wallet),
  router: connectRouter(history),
  lastAction
})

export default (history) => persistReducer(rootConfig, rootReducer(history))

// export default (history) => persistCombineReducers(rootConfig, {
//   ...reducers,
//   wallet: persistReducer(walletConfig, reducers.wallet),
//   router: connectRouter(history)
// })
