import { put, all, call, takeLatest } from 'redux-saga/effects'
import globalActions from './actions'
import api from '../../../api'

function * handleFetchPrice () {
  yield put(globalActions.setFetchStatus(true))
  try {
    const price = yield call(api.binance.getPrice)
    yield all([
      put(globalActions.fetchPriceSuccess(price)),
      put(globalActions.setFetchStatus(false)),
    ])
  } catch (err) {
    console.error(err)
    yield all([
      put(globalActions.setFetchStatus(false)),
      put(globalActions.setError(new Error('Failed to get ONE/USDT price'))),
    ])
  }
}

function * globalSagas () {
  yield all([
    takeLatest(globalActions.fetchPrice().type, handleFetchPrice),
  ])
}

export default globalSagas
