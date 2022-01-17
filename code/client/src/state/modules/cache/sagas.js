import { put, all, call, takeLatest } from 'redux-saga/effects'
import cacheActions from './actions'
import api from '../../../api'

function * handleFetchCode (action) {
  const { network } = action.payload
  try {
    const code = yield call(api.factory.getCode)
    yield put(cacheActions.updateCode({ code, network }))
  } catch (err) {
    console.error(err)
  }
}

function * handleFetchGlobalStats () {
  try {
    const statsData = yield call(api.walletStats.getStats)
    yield put(cacheActions.updateGlobalStats({ ...statsData, timeUpdated: Date.now() }))
  } catch (err) {
    console.error(err)
  }
}

function * handleFetchVersion (action) {
  const { network } = action.payload
  try {
    const version = yield call(api.factory.getVersion)
    yield put(cacheActions.updateVersion({ network, version }))
  } catch (err) {
    console.error(err)
  }
}

function * walletSages () {
  yield all([
    takeLatest(cacheActions.fetchCode().type, handleFetchCode),
    takeLatest(cacheActions.fetchVersion().type, handleFetchVersion),
    takeLatest(cacheActions.fetchGlobalStats().type, handleFetchGlobalStats),
  ])
}

export default walletSages
