import { put, all, call, takeEvery } from 'redux-saga/effects'
import balanceActions from './actions'
import globalActions from '../global/actions'
import api from '../../../api'

function * handleFetchBalance (action) {
  yield put(globalActions.setFetchStatus(true))
  try {
    const { address } = action.payload
    const balance = yield call(api.blockchain.getBalance, { address })
    yield all([
      put(balanceActions.fetchBalanceSuccess({ address, balance })),
      put(globalActions.setFetchStatus(false)),
    ])
  } catch (err) {
    console.error(err)
    yield all([
      put(globalActions.setFetchStatus(false)),
      put(globalActions.setError(new Error('Failed to get wallet balance'))),
    ])
  }
}

function * handleFetchTokenBalance (action) {
  yield put(globalActions.setFetchStatus(true))
  try {
    const { address, contractAddress, tokenType, tokenId, key } = action.payload
    const balance = yield call(api.blockchain.tokenBalance, { contractAddress, tokenType, tokenId, address })
    yield all([
      put(balanceActions.fetchTokenBalanceSuccess({ address, key, balance: balance.toString() })),
      put(globalActions.setFetchStatus(false)),
    ])
  } catch (err) {
    console.error(err)
    yield all([
      put(globalActions.setFetchStatus(false)),
      put(globalActions.setError(new Error('Failed to get wallet balance'))),
    ])
  }
}

function * balanceSagas () {
  yield all([
    takeEvery(balanceActions.fetchBalance().type, handleFetchBalance),
    takeEvery(balanceActions.fetchTokenBalance().type, handleFetchTokenBalance),
  ])
}

export default balanceSagas
