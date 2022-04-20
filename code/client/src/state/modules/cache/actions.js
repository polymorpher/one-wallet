import { createAction } from '@reduxjs/toolkit'
const fetchCode = createAction('FETCH_CODE')
const fetchVersion = createAction('FETCH_VERSION')
const updateCode = createAction('UPDATE_CODE')
const clearCode = createAction('CLEAR_CODE')
const updateVersion = createAction('UPDATE_VERSION')
const updateClientVersion = createAction('UPDATE_CLIENT_VERSION')
const fetchGlobalStats = createAction('FETCH_GLOBAL_STATS')
const updateGlobalStats = createAction('UPDATE_GLOBAL_STATS')
const updateWalletConnectSession = createAction('UPDATE_WALLET_CONNECT_SESSION')

export default {
  fetchCode,
  fetchVersion,
  updateVersion,
  updateClientVersion,
  updateCode,
  clearCode,
  fetchGlobalStats,
  updateGlobalStats,
  updateWalletConnectSession
}
