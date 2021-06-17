import { createAction } from '@reduxjs/toolkit'
const fetchWallet = createAction('FETCH_WALLET')
const fetchWalletSuccess = createAction('FETCH_WALLET_SUCCESS')
const fetchWalletFailed = createAction('FETCH_WALLET_FAILED')

const updateWallet = createAction('UPDATE_WALLET')
const selectWallet = createAction('SELECT_WALLET')

const setRelayer = createAction('SET_RELAYER')
const setRelayerSecret = createAction('SET_RELAYER_SECRET')
const setNetwork = createAction('SET_NETWORK')
const setProvider = createAction('SET_PROVIDER')

export default {
  fetchWallet,
  fetchWalletSuccess,
  fetchWalletFailed,
  updateWallet,
  selectWallet,
  setRelayer,
  setRelayerSecret,
  setNetwork,
  setProvider
}
