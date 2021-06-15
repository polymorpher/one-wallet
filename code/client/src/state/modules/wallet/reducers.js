import { handleActions } from 'redux-actions'
import walletActions from './actions'
import { defaults } from '../../../config'
export const initialState = {
  wallets: {},
  layers: {}, // keys are addresses. Each value is an array of uint8array
  selected: undefined, // address in hex string, matching a key in wallets
  network: defaults.network,
  relayer: defaults.relayer,
  relayerSecret: undefined,
  provider: undefined,
  fetching: false,
  loading: false,
  error: undefined
}

const reducer = handleActions(
  {
    [walletActions.fetchWallet]: (state) => ({
      ...state,
      fetching: true,
    }),
    [walletActions.fetchWalletSuccess]: (state, action) => ({
      ...state,
      wallets: { ...state.wallets, [action.payload.address]: action.payload },
      fetching: false,
    }),
    [walletActions.fetchWalletFailed]: (state, action) => ({
      ...state,
      fetching: false,
      error: action.payload,
    }),
    [walletActions.loadingWalletLayers]: (state, action) => ({
      ...state,
      loading: true,
    }),
    [walletActions.loadWalletLayers]: (state, action) => ({
      ...state,
      layers: { ...state.layers, [action.payload.address]: action.payload.layers },
      loading: false,
    }),
    [walletActions.deleteWalletLayers]: (state, action) => ({
      ...state,
      layers: { ...state.layers, [action.payload]: undefined },
    }),

    [walletActions.updateWallet]: (state, action) => ({
      ...state,
      wallets: { ...state.wallets, [action.payload.address]: action.payload }
    }),

    [walletActions.selectWallet]: (state, action) => ({
      ...state,
      selected: action.payload,
    }),

    [walletActions.setRelayer]: (state, action) => ({
      ...state,
      relayer: action.payload,
    }),

    [walletActions.setRelayerSecret]: (state, action) => ({
      ...state,
      relayerSecret: action.payload,
    }),

    [walletActions.setNetwork]: (state, action) => ({
      ...state,
      network: action.payload,
    }),

    [walletActions.setProvider]: (state, action) => ({
      ...state,
      provider: action.payload,
    }),
  },
  {
    ...initialState
  }
)

export default reducer
