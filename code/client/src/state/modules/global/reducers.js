import { handleActions } from 'redux-actions'
import globalActions from './actions'

export const initialState = {
  dev: false,
  stats: {}
}

const reducer = handleActions(
  {
    [globalActions.setDev]: (state, action) => ({
      ...state,
      dev: action.payload
    }),

    [globalActions.updateStats]: (state, action) => ({
      ...state,
      stats: { ...state.stats, stats: action.payload }
    }),
  },
  {
    ...initialState
  }
)

export default reducer
