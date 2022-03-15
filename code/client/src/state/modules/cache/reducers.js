import { handleActions } from 'redux-actions'
import cacheActions from './actions'

export const initialState = {
  code: {},
  global: {},
  version: {},
  clientVersion: '',
  needCodeUpdate: true,
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
      needCodeUpdate: (action.payload.version !== state.version[action.payload.network]) || action.payload.version?.endsWith('SNAPSHOT')
    }),
    [cacheActions.updateClientVersion]: (state, action) => ({
      ...state,
      clientVersion: action.payload,
    }),
    [cacheActions.updateGlobalStats]: (state, action) => ({
      ...state,
      global: { ...state.global, stats: action.payload }
    }),
  },
  {
    ...initialState
  }
)

export default reducer
