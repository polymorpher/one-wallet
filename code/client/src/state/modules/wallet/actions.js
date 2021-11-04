import { createAction } from '@reduxjs/toolkit'
const fetchWallet = createAction('FETCH_WALLET')
const fetchWalletSuccess = createAction('FETCH_WALLET_SUCCESS')
const fetchWalletFailed = createAction('FETCH_WALLET_FAILED')

const fetchBalance = createAction('FETCH_BALANCE')
const fetchBalanceSuccess = createAction('FETCH_BALANCE_SUCCESS')
const fetchBalanceFailed = createAction('FETCH_BALANCE_FAILED')

const fetchPrice = createAction('FETCH_PRICE')
const fetchPriceSuccess = createAction('FETCH_PRICE_SUCCESS')
const fetchPriceFailed = createAction('FETCH_PRICE_FAILED')

const updateWallet = createAction('UPDATE_WALLET')
const selectWallet = createAction('SELECT_WALLET')
const deleteWallet = createAction('DELETE_WALLET')

const trackTokens = createAction('TRACK_TOKENS')
const untrackTokens = createAction('UNTRACK_TOKENS')
const setSelectedToken = createAction('SET_SELECTED_TOKEN')
const fetchTokenBalance = createAction('FETCH_TOKEN_BALANCE')
const fetchTokenBalanceSuccess = createAction('FETCH_TOKEN_BALANCE_SUCCESS')
const fetchTokenBalanceFailed = createAction('FETCH_TOKEN_BALANCE_FAILED')

const setRelayer = createAction('SET_RELAYER')
const setRelayerSecret = createAction('SET_RELAYER_SECRET')
const setNetwork = createAction('SET_NETWORK')
const setProvider = createAction('SET_PROVIDER')

// Set the wallet address that is known by the user, that is the address has been entered in the system at least once.
// E.g. transaction destination or recovery address.
const setKnownAddress = createAction('SET_KNOWN_ADDRESS')
const deleteKnownAddress = createAction('DELETE_KNOWN_ADDRESS')

const bindDomain = createAction('BIND_DOMAIN')

// User has acknowledged that they has been notified to save the wallet address for a created wallet.
const userAcknowledgedToSaveAddress = createAction('USER_ACKNOWLEDGED_TO_SAVE_ADDRESS')
const userAcknowledgedNewRoot = createAction('USER_ACKNOWLEDGED_NEW_ROOT')
const userSkipVersion = createAction('USER_SKIP_VERSION')

const setDev = createAction('SET_DEV')

const updateGlobalStats = createAction('UPDATE_GLOBAL_STATS')

export default {
  fetchWallet,
  fetchWalletSuccess,
  fetchWalletFailed,
  fetchBalance,
  fetchBalanceSuccess,
  fetchBalanceFailed,
  fetchPrice,
  fetchPriceSuccess,
  fetchPriceFailed,
  updateWallet,
  selectWallet,
  deleteWallet,
  setRelayer,
  setRelayerSecret,
  setNetwork,
  setProvider,
  setKnownAddress,
  deleteKnownAddress,
  bindDomain,

  userAcknowledgedToSaveAddress,
  userAcknowledgedNewRoot,
  userSkipVersion,

  trackTokens,
  untrackTokens,
  setSelectedToken,
  fetchTokenBalance,
  fetchTokenBalanceSuccess,
  fetchTokenBalanceFailed,
  setDev,

  updateGlobalStats
}
