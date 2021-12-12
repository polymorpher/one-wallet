import { createAction } from '@reduxjs/toolkit'

const setDev = createAction('SET_DEV')
const updateStats = createAction('UPDATE_STATS')

export default {
  setDev,
  updateStats,
}
