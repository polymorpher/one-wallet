import { handleActions } from 'redux-actions'
import walletActions from './actions'
import { omit, uniq } from 'lodash'

// address -> wallet
export const initialState = {
}

const reducer = handleActions(
  {
    // Auto-migrate for old structure: `{wallets: {address: wallet}}`
    [walletActions.autoMigrateWallets]: (state) => {
      const currentEntries = Object.entries(state)
      const oldWalletEntries = Object.entries(state.wallets || {})
      const validEntries = oldWalletEntries.concat(currentEntries).filter(([_, wallet]) => wallet.root && wallet.address)
      return Object.fromEntries(validEntries)
    },

    [walletActions.fetchWalletSuccess]: (state, action) => ({
      ...state,
      [action.payload.address]: { ...state[action.payload.address], ...action.payload },
    }),

    [walletActions.updateWallet]: (state, action) => ({
      ...state,
      [action.payload.address]: action.payload._merge ? omit({ ...state[action.payload.address], ...action.payload }, ['_merge']) : action.payload
    }),

    [walletActions.deleteWallet]: (state, action) => ({
      ...omit(state, [action.payload]),
    }),

    [walletActions.trackTokens]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        trackedTokens: [...(state[action.payload.address]?.trackedTokens || []), ...action.payload.tokens],
        untrackedTokens: (state[action.payload.address]?.untrackedTokens || []).filter(k => (action.payload.tokens || []).find(t => t.key === k) === undefined)
      }
    }),
    [walletActions.untrackTokens]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        trackedTokens: (state[action.payload.address]?.trackedTokens || []).filter(e => action.payload.keys.find(k => k === e.key) === undefined),
        untrackedTokens: uniq([...(state[action.payload.address]?.untrackedTokens || []), ...action.payload.keys])
      }
    }),
    [walletActions.setSelectedToken]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        selectedToken: action.payload.token
      }
    }),

    [walletActions.bindDomain]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        domain: action.payload.domain
      }
    }),

    [walletActions.userAcknowledgedToSaveAddress]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        acknowledgedToSaveAddress: true
      }
    }),

    [walletActions.userAcknowledgedNewRoot]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        acknowledgedNewRoot: action.payload.root
      }
    }),

    [walletActions.userSkipVersion]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        skipVersion: action.payload.version
      }
    }),
  },
  {
    ...initialState
  }
)

export default reducer
