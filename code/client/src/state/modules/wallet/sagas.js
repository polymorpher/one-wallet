import { put, all, call, takeLatest } from 'redux-saga/effects'
import walletActions from './actions'
import api from '../../../api'

function * handleFetchWallet () {
  try {
    const { wallet } = yield call(api.blockchain.getWallet)
    yield put(walletActions.fetchWalletSuccess(wallet))
  } catch (err) {
    console.error(err)
    yield put(walletActions.fetchWalletFailed(new Error('Failed to get wallet information on-chain. Please try again.')))
  }
}

function * walletSages () {
  yield all([
    takeLatest(walletActions.fetchWallet().type, handleFetchWallet),
  ])
}

export default walletSages
