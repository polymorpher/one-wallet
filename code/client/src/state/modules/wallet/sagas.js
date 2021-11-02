import { put, all, call, takeLatest, takeEvery } from 'redux-saga/effects'
import walletActions from './actions'
import api from '../../../api'

function * handleFetchWallet (action) {
  try {
    const { address } = action.payload
    const wallet = yield call(api.blockchain.getWallet, { address })
    const backlinks = yield call(api.blockchain.getBacklinks, { address })
    const forwardAddress = yield call(api.blockchain.getForwardAddress, { address })
    const oldInfos = yield call(api.blockchain.getOldInfos, { address })
    yield put(walletActions.fetchWalletSuccess({ ...wallet, backlinks, forwardAddress, oldInfos }))
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

function * handleFetchTokenBalance (action) {
  try {
    const { address, contractAddress, tokenType, tokenId, key } = action.payload
    const balance = yield call(api.blockchain.tokenBalance, { contractAddress, tokenType, tokenId, address })
    yield put(walletActions.fetchTokenBalanceSuccess({ address, key, balance: balance.toString() }))
  } catch (err) {
    console.error(err)
    yield put(walletActions.fetchTokenBalanceFailed(new Error('Failed to get wallet balance')))
  }
}

function * walletSages () {
  yield all([
    takeEvery(walletActions.fetchWallet().type, handleFetchWallet),
    takeEvery(walletActions.fetchBalance().type, handleFetchBalance),
    takeEvery(walletActions.fetchTokenBalance().type, handleFetchTokenBalance),
    takeLatest(walletActions.fetchPrice().type, handleFetchPrice),
  ])
}

export default walletSages
