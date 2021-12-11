import { createAction } from '@reduxjs/toolkit'
const fetchCode = createAction('FETCH_CODE')
const fetchVersion = createAction('FETCH_VERSION')
const updateCode = createAction('UPDATE_CODE')
const updateVersion = createAction('UPDATE_VERSION')
const updateClientVersion = createAction('UPDATE_CLIENT_VERSION')
const fetchGlobalStats = createAction('FETCH_GLOBAL_STATS')
const updateGlobalStats = createAction('UPDATE_GLOBAL_STATS')

export default {
  fetchCode,
  fetchVersion,
  updateVersion,
  updateClientVersion,
  updateCode,
  fetchGlobalStats,
  updateGlobalStats
}
