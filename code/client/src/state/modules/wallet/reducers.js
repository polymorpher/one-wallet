import { handleActions } from 'redux-actions'
import walletActions from './actions'
import config from '../../../config'
import { omit, uniq } from 'lodash'

export const initialState = {
  wallets: {},
  selected: undefined, // address in hex string, matching a key in wallets
  network: config.defaults.network,
  relayer: config.defaults.relayer,
  relayerSecret: config.defaults.relayerSecret,
}

const reducer = handleActions(
  {
    [walletActions.fetchWalletSuccess]: (state, action) => ({
      ...state,
      wallets: { ...state.wallets, [action.payload.address]: { ...state.wallets[action.payload.address], ...action.payload } },
    }),

    [walletActions.updateWallet]: (state, action) => ({
      ...state,
      wallets: { ...state.wallets, [action.payload.address]: action.payload._merge ? omit({ ...state.wallets[action.payload.address], ...action.payload }, ['_merge']) : action.payload }
    }),

    [walletActions.selectWallet]: (state, action) => ({
      ...state,
      selected: action.payload,
    }),

    [walletActions.deleteWallet]: (state, action) => ({
      ...state,
      wallets: omit(state.wallets, [action.payload]),
    }),

    [walletActions.trackTokens]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          trackedTokens: [...(state.wallets?.[action.payload.address]?.trackedTokens || []), ...action.payload.tokens],
          untrackedTokens: (state.wallets?.[action.payload.address]?.untrackedTokens || []).filter(k => (action.payload.tokens || []).find(t => t.key === k) === undefined)
        }
      }
    }),
    [walletActions.untrackTokens]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          trackedTokens: (state.wallets?.[action.payload.address]?.trackedTokens || []).filter(e => action.payload.keys.find(k => k === e.key) === undefined),
          untrackedTokens: uniq([...(state.wallets?.[action.payload.address]?.untrackedTokens || []), ...action.payload.keys])
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

    [walletActions.userAcknowledgedToSaveAddress]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          acknowledgedToSaveAddress: true
        }
      }
    }),

    [walletActions.userAcknowledgedNewRoot]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          acknowledgedNewRoot: action.payload.root
        }
      }
    }),

    [walletActions.userSkipVersion]: (state, action) => ({
      ...state,
      wallets: {
        ...state.wallets,
        [action.payload.address]: {
          ...state.wallets[action.payload.address],
          skipVersion: action.payload.version
        }
      }
    }),
  },
  {
    ...initialState
  }
)

export default reducer
