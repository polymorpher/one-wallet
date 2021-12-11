import { handleActions } from 'redux-actions'
import cacheActions from './actions'

export const initialState = {
  code: '',
  global: {},
  version: '',
  clientVersion: '',
  needCodeUpdate: true,
}

const reducer = handleActions(
  {
    [cacheActions.updateCode]: (state, action) => ({
      ...state,
      code: action.payload,
    }),
    [cacheActions.updateVersion]: (state, action) => ({
      ...state,
      version: action.payload,
      needCodeUpdate: action.payload !== state.version
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
