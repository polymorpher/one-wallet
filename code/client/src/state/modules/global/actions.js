import { createAction } from '@reduxjs/toolkit'

const setDev = createAction('SET_DEV')
const updateStats = createAction('UPDATE_STATS')

// Set the wallet address that is known by the user, that is the address has been entered in the system at least once.
// E.g. transaction destination or recovery address.
const setKnownAddress = createAction('SET_KNOWN_ADDRESS')
const deleteKnownAddress = createAction('DELETE_KNOWN_ADDRESS')

export default {
  setDev,

  updateStats,

  deleteKnownAddress,
  setKnownAddress,
}
