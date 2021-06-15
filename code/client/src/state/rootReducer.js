import { persistCombineReducers, persistReducer } from 'redux-persist'
// import { combineReducers } from 'redux'
import { connectRouter } from 'connected-react-router'
import * as reducers from './modules'
import localForage from 'localforage'
import { appId } from '../config'

const storage = localForage.createInstance({
  name: appId,
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
  blacklist: ['layers', 'provider', 'error', 'fetching', 'loading']
}

// const rootReducer = (history) => combineReducers({
//   ...reducers,
//   wallet: persistReducer(walletConfig, reducers.wallet),
//   router: connectRouter(history)
// })

// export default (history) => persistReducer(rootConfig, rootReducer)

export default (history) => persistCombineReducers(rootConfig, {
  ...reducers,
  wallet: persistReducer(walletConfig, reducers.wallet),
  router: connectRouter(history)
})
