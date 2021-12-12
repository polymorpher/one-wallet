import reducer from './reducers'

export { default as walletSagas } from './sagas'
export { default as walletActions } from './actions'

export const persistConfig = {
  key: 'wallet',
  blacklist: ['layers', 'provider', 'error', 'fetching', 'loading']
}

export default reducer
