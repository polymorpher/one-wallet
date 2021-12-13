import { put, all, call, takeEvery } from 'redux-saga/effects'
import walletActions from './actions'
import globalActions from '../global/actions'
import balanceActions from '../balance/actions'
import api from '../../../api'

function * handleFetchWallet (action) {
  yield put(globalActions.setFetchStatus(true))
  try {
    const { address } = action.payload
    const wallet = yield call(api.blockchain.getWallet, { address })
    let backlinks = []
    let forwardAddress = null
    let oldInfos = []
    if (wallet?.majorVersion >= 9) {
      backlinks = yield call(api.blockchain.getBacklinks, { address })
      forwardAddress = yield call(api.blockchain.getForwardAddress, { address })
    }
    if (wallet?.majorVersion >= 14) {
      oldInfos = yield call(api.blockchain.getOldInfos, { address })
    }
    yield all([
      put(walletActions.fetchWalletSuccess({ ...wallet, backlinks, forwardAddress, oldInfos })),
      put(globalActions.setFetchStatus(false)),
    ])
  } catch (err) {
    console.error(err)
    yield all([
      put(globalActions.setFetchStatus(false)),
      put(globalActions.setError(new Error('Failed to get wallet information'))),
    ])
  }
}

function * handleDeleteWallet (action) {
  yield all([
    put(balanceActions.deleteBalance(action.payload)),
  ])
}

function * walletSagas () {
  yield all([
    takeEvery(walletActions.fetchWallet().type, handleFetchWallet),
    takeEvery(walletActions.deleteWallet().type, handleDeleteWallet),
  ])
}

export default walletSagas
