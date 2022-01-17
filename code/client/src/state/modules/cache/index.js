import reducer from './reducers'

export { default as cacheSagas } from './sagas'
export { default as cacheActions } from './actions'

export const persistConfig = {
  key: 'cache',
  blacklist: []
}

export default reducer
