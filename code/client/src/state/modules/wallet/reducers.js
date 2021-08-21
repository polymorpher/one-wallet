import { handleActions } from 'redux-actions'
import walletActions from './actions'
import config from '../../../config'
import { omit } from 'lodash'

export const initialState = {
  wallets: {},
  balances: {}, // address => amount in wei
  selected: undefined, // address in hex string, matching a key in wallets
  network: config.defaults.network,
  relayer: config.defaults.relayer,
  relayerSecret: config.defaults.relayerSecret,
  provider: undefined,
  fetching: false,
  loading: false,
  error: undefined,
  knownAddresses: {}
}

const reducer = handleActions(
  {
    [walletActions.fetchWallet]: (state) => ({
      ...state,
      fetching: true,
    }),
    [walletActions.fetchWalletSuccess]: (state, action) => ({
      ...state,
      wallets: { ...state.wallets, [action.payload.address]: { ...state.wallets[action.payload.address], ...action.payload } },
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

    [walletActions.fetchPrice]: (state) => ({
      ...state,
    }),
    [walletActions.fetchPriceSuccess]: (state, action) => ({
      ...state,
      price: action.payload,
    }),
    [walletActions.fetchPriceFailed]: (state, action) => ({
      ...state,
      fetching: false,
    }),

    [walletActions.updateWallet]: (state, action) => ({
      ...state,
      wallets: { ...state.wallets, [action.payload.address]: action.payload }
    }),

    [walletActions.selectWallet]: (state, action) => ({
      ...state,
      selected: action.payload,
    }),

    [walletActions.deleteWallet]: (state, action) => ({
      ...state,
      wallets: omit(state.wallets, [action.payload]),
      balances: omit(state.balances, [action.payload])
    }),
    [walletActions.trackTokens]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          trackedTokens: [...(state.wallets?.[action.payload.address]?.trackedTokens || []), ...action.payload.tokens]
        }
      }
    }),
    [walletActions.untrackTokens]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          trackedTokens: (state.wallets?.[action.payload.address]?.trackedTokens || []).filter(e => action.payload.keys.find(k => k === e.key) === undefined)
        }
      }
    }),
    [walletActions.setSelectedToken]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          selectedToken: action.payload.token
        }
      }
    }),

    [walletActions.fetchTokenBalance]: (state, action) => ({
      ...state,
    }),

    [walletActions.fetchTokenBalanceSuccess]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          tokenBalances: {
            ...state.wallets?.[action.payload.address]?.tokenBalances,
            [action.payload.key]: action.payload.balance
          }
        }
      }
    }),

    [walletActions.fetchTokenBalanceFailed]: (state, action) => ({
      ...state,
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

    [walletActions.setKnownAddress]: (state, action) => ({
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
          numUsed: action.payload.numUsed
        }
      },
    }),

    [walletActions.deleteKnownAddress]: (state, action) => {
      const { [action.payload]: deleted, ...restKnownAddresses } = state.knownAddresses

      return {
        ...state,
        knownAddresses: restKnownAddresses
      }
    },

    [walletActions.bindDomain]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          domain: action.payload.domain
        }
      }
    }),
  },
  {
    ...initialState
  }
)

export default reducer
