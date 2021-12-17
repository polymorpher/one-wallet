import { createAction } from '@reduxjs/toolkit'

const setDev = createAction('SET_DEV')

// Set the wallet address that is known by the user, that is the address has been entered in the system at least once.
// E.g. transaction destination or recovery address.
const setKnownAddress = createAction('SET_KNOWN_ADDRESS')
const deleteKnownAddress = createAction('DELETE_KNOWN_ADDRESS')

const setFetchStatus = createAction('SET_FETCH_STATUS')
const setError = createAction('SET_ERROR')

const fetchPrice = createAction('FETCH_PRICE')
const fetchPriceSuccess = createAction('FETCH_PRICE_SUCCESS')

export default {
  setDev,

  deleteKnownAddress,
  setKnownAddress,
  setError,
  setFetchStatus,

  fetchPrice,
  fetchPriceSuccess,
}
