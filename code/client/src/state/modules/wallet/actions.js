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

const setRelayer = createAction('SET_RELAYER')
const setRelayerSecret = createAction('SET_RELAYER_SECRET')
const setNetwork = createAction('SET_NETWORK')
const setProvider = createAction('SET_PROVIDER')

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
  trackTokens,
  untrackTokens
}
