import { handleActions } from 'redux-actions'
import cacheActions from './actions'
import omit from 'lodash/fp/omit'

export const initialState = {
  code: {},
  global: {},
  version: {},
  clientVersion: '',
  needCodeUpdate: true,
  walletConnectRequests: null,
}

const reducer = handleActions(
  {
    [cacheActions.updateCode]: (state, action) => ({
      ...state,
      code: {
        ...state.code,
        [action.payload.network]: action.payload.code,
      },
    }),
    [cacheActions.clearCode]: (state, action) => ({
      ...state,
      code: {},
      version: {},
      clientVersion: '',
      needCodeUpdate: true,
    }),
    [cacheActions.updateVersion]: (state, action) => ({
      ...state,
      version: {
        ...state.version,
        [action.payload.network]: action.payload.version,
      },
      needCodeUpdate: (action.payload.version !== state.version[action.payload.network]) ||
        action.payload.version?.endsWith('SNAPSHOT') ||
        action.payload.version?.endsWith('.0')
    }),
    [cacheActions.updateClientVersion]: (state, action) => ({
      ...state,
      clientVersion: action.payload,
    }),
    [cacheActions.updateGlobalStats]: (state, action) => ({
      ...state,
      global: { ...state.global, stats: action.payload }
    }),
    [cacheActions.enqueueWalletConnectRequest]: (state, action) => ({
      ...state,
      walletConnectRequests: { ...state.walletConnectRequests, [action.payload.id]: action.payload }
    }),
    [cacheActions.removeWalletConnectRequest]: (state, action) => ({
      ...state,
      walletConnectRequests: omit(state.walletConnectRequests, action.payload)
    }),
  },
  {
    ...initialState
  }
)

export default reducer
