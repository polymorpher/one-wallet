import { createAction } from '@reduxjs/toolkit'
const fetchWallet = createAction('FETCH_WALLET')
const fetchWalletSuccess = createAction('FETCH_WALLET_SUCCESS')

const updateWallet = createAction('UPDATE_WALLET')
const selectWallet = createAction('SELECT_WALLET')
const deleteWallet = createAction('DELETE_WALLET')

const trackTokens = createAction('TRACK_TOKENS')
const untrackTokens = createAction('UNTRACK_TOKENS')
const setSelectedToken = createAction('SET_SELECTED_TOKEN')

const setRelayer = createAction('SET_RELAYER')
const setRelayerSecret = createAction('SET_RELAYER_SECRET')
const setNetwork = createAction('SET_NETWORK')

const bindDomain = createAction('BIND_DOMAIN')

// User has acknowledged that they has been notified to save the wallet address for a created wallet.
const userAcknowledgedToSaveAddress = createAction('USER_ACKNOWLEDGED_TO_SAVE_ADDRESS')
const userAcknowledgedNewRoot = createAction('USER_ACKNOWLEDGED_NEW_ROOT')
const userSkipVersion = createAction('USER_SKIP_VERSION')

export default {
  fetchWallet,
  fetchWalletSuccess,
  updateWallet,
  selectWallet,
  deleteWallet,
  setRelayer,
  setRelayerSecret,
  setNetwork,
  bindDomain,

  userAcknowledgedToSaveAddress,
  userAcknowledgedNewRoot,
  userSkipVersion,

  trackTokens,
  untrackTokens,
  setSelectedToken,
}
