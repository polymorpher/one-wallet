import { createAction } from '@reduxjs/toolkit'

const setDev = createAction('SET_DEV')

// Set the wallet address that is known by the user, that is the address has been entered in the system at least once.
// E.g. transaction destination or recovery address.
const setKnownAddress = createAction('SET_KNOWN_ADDRESS')
const deleteKnownAddress = createAction('DELETE_KNOWN_ADDRESS')

const setFetchStatus = createAction('SET_FETCH_STATUS')
const setError = createAction('SET_ERROR')
const setSelectedToken = createAction('SET_SELECTED_TOKEN')

const fetchPrice = createAction('FETCH_PRICE')
const fetchPriceSuccess = createAction('FETCH_PRICE_SUCCESS')

const setRelayer = createAction('SET_RELAYER')
const setRelayerSecret = createAction('SET_RELAYER_SECRET')
const setNetwork = createAction('SET_NETWORK')

export default {
  setDev,

  deleteKnownAddress,
  setKnownAddress,
  setError,
  setFetchStatus,
  setSelectedToken,

  fetchPrice,
  fetchPriceSuccess,

  setRelayer,
  setRelayerSecret,
  setNetwork,
}
