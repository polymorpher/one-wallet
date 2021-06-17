import { handleActions } from 'redux-actions'
import walletActions from './actions'
import config from '../../../config'
export const initialState = {
  wallets: {},
  balances: {}, // address => amount in wei
  selected: undefined, // address in hex string, matching a key in wallets
  network: config.defaults.network,
  relayer: config.defaults.relayer,
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

    [walletActions.fetchBalance]: (state) => ({
      ...state,
      fetching: true,
    }),
    [walletActions.fetchBalanceSuccess]: (state, action) => ({
      ...state,
      balances: { ...state.balances, [action.payload.address]: action.payload.balance },
      fetching: false,
    }),
    [walletActions.fetchBalanceFailed]: (state, action) => ({
      ...state,
      fetching: false,
      error: action.payload,
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
