import { put, all, call, takeLatest, takeEvery } from 'redux-saga/effects'
import walletActions from './actions'
import api from '../../../api'

function * handleFetchWallet (action) {
  try {
    const { address } = action.payload
    const wallet = yield call(api.blockchain.getWallet, { address })
    yield put(walletActions.fetchWalletSuccess(wallet))
  } catch (err) {
    console.error(err)
    yield put(walletActions.fetchWalletFailed(new Error('Failed to get wallet information')))
  }
}

function * handleFetchBalance (action) {
  try {
    const { address } = action.payload
    const balance = yield call(api.blockchain.getBalance, { address })
    yield put(walletActions.fetchBalanceSuccess({ address, balance }))
  } catch (err) {
    console.error(err)
    yield put(walletActions.fetchBalanceFailed(new Error('Failed to get wallet balance')))
  }
}

function * handleFetchPrice () {
  try {
    const price = yield call(api.binance.getPrice)
    yield put(walletActions.fetchPriceSuccess(price))
  } catch (err) {
    console.error(err)
    yield put(walletActions.fetchPriceFailed(new Error('Failed to get ONE/USDT price')))
  }
}

function * walletSages () {
  yield all([
    takeEvery(walletActions.fetchWallet().type, handleFetchWallet),
    takeEvery(walletActions.fetchBalance().type, handleFetchBalance),
    takeLatest(walletActions.fetchPrice().type, handleFetchPrice),
  ])
}

export default walletSages
