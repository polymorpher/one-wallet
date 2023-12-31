import { createAction } from '@reduxjs/toolkit'
const fetchCode = createAction('FETCH_CODE')
const fetchVersion = createAction('FETCH_VERSION')
const updateCode = createAction('UPDATE_CODE')
const clearCode = createAction('CLEAR_CODE')
const updateVersion = createAction('UPDATE_VERSION')
const updateClientVersion = createAction('UPDATE_CLIENT_VERSION')
const fetchGlobalStats = createAction('FETCH_GLOBAL_STATS')
const updateGlobalStats = createAction('UPDATE_GLOBAL_STATS')
const enqueueWalletConnectRequest = createAction('ENQUEUE_WALLET_CONNECT_REQUEST')
const removeWalletConnectRequest = createAction('REMOVE_WALLET_CONNECT_REQUEST')

export default {
  fetchCode,
  fetchVersion,
  updateVersion,
  updateClientVersion,
  updateCode,
  clearCode,
  fetchGlobalStats,
  updateGlobalStats,
  enqueueWalletConnectRequest,
  removeWalletConnectRequest
}
