import { handleActions } from 'redux-actions'
import globalActions from './actions'
import config from '../../../config'

export const initialState = {
  knownAddresses: {},
  dev: false,
  v2ui: false, // the v2 UI toggle switch: https://github.com/polymorpher/one-wallet/issues/260
  theme: 'light', // ignored in v1 ui
  fetching: false,
  error: undefined,
  selectedWallet: undefined, // address in hex string, matching a key in wallets
  price: 0,
  network: config.defaults.network,
  relayer: config.defaults.relayer,
  relayerSecret: config.defaults.relayerSecret,
}

const reducer = handleActions(
  {
    [globalActions.migrate]: (state, action) => ({
      ...state,
      network: state.network || action?.payload?.network || config.defaults.network,
      relayer: state.relayer || action?.payload?.relayer || config.defaults.relayer,
      relayerSecret: state.relayerSecret || action?.payload?.relayerSecret || config.defaults.relayerSecret,
    }),

    [globalActions.setDev]: (state, action) => ({
      ...state,
      dev: action.payload
    }),

    [globalActions.setV2Ui]: (state, action) => ({
      ...state,
      v2ui: action.payload
    }),

    [globalActions.setUiTheme]: (state, action) => ({
      ...state,
      theme: action.payload
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

    // Status
    [globalActions.setFetchStatus]: (state, action) => ({
      ...state,
      fetching: action.payload,
    }),

    [globalActions.setError]: (state, action) => ({
      ...state,
      error: action.payload,
    }),

    [globalActions.selectWallet]: (state, action) => ({
      ...state,
      selectedWallet: action.payload,
    }),

    // Price
    [globalActions.fetchPriceSuccess]: (state, action) => ({
      ...state,
      price: action.payload,
    }),

    // Relayer
    [globalActions.setRelayer]: (state, action) => ({
      ...state,
      relayer: action.payload,
    }),

    [globalActions.setRelayerSecret]: (state, action) => ({
      ...state,
      relayerSecret: action.payload,
    }),

    // Network
    [globalActions.setNetwork]: (state, action) => ({
      ...state,
      network: action.payload,
    }),
  },
  {
    ...initialState
  }
)

export default reducer
