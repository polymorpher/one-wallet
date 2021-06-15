import { createAction } from '@reduxjs/toolkit'
const fetchWallet = createAction('FETCH_WALLET')
const fetchWalletSuccess = createAction('FETCH_WALLET_SUCCESS')
const fetchWalletFailed = createAction('FETCH_WALLET_FAILED')

const loadingWalletLayers = createAction('LOADING_WALLET_LAYERS')
const loadWalletLayers = createAction('LOAD_WALLET_LAYERS')
const deleteWalletLayers = createAction('DELETE_WALLET_LAYERS')

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
  loadingWalletLayers,
  loadWalletLayers,
  deleteWalletLayers,
  updateWallet,
  selectWallet,
  setRelayer,
  setRelayerSecret,
  setNetwork,
  setProvider
}
