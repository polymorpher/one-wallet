import { handleActions } from 'redux-actions'
import globalActions from './actions'

export const initialState = {
  knownAddresses: {},
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

    [globalActions.setKnownAddress]: (state, action) => ({
      ...state,
      knownAddresses: {
        ...state.knownAddresses,
        [action.payload.address]: {
          ...state.knownAddresses?.[action.payload.address],
          label: action.payload.label,
          address: action.payload.address,
          network: action.payload.network,
          domainName: action.payload.domainName,
          createTime: action.payload.creationTime,
          lastUsedTime: action.payload.lastUsedTime,
          numUsed: action.payload.numUsed,
          domain: action.payload.domain
        }
      },
    }),

    [globalActions.deleteKnownAddress]: (state, action) => {
      const { [action.payload]: deleted, ...restKnownAddresses } = state.knownAddresses

      return {
        ...state,
        knownAddresses: restKnownAddresses
      }
    },
  },
  {
    ...initialState
  }
)

export default reducer