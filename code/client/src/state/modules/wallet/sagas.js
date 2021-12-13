import { put, all, call, takeLatest, takeEvery } from 'redux-saga/effects'
import walletActions from './actions'
import globalActions from '../global/actions'
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

function * handleFetchBalance (action) {
  yield put(globalActions.setFetchStatus(true))
  try {
    const { address } = action.payload
    const balance = yield call(api.blockchain.getBalance, { address })
    yield all([
      put(walletActions.fetchBalanceSuccess({ address, balance })),
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

function * handleFetchPrice () {
  yield put(globalActions.setFetchStatus(true))
  try {
    const price = yield call(api.binance.getPrice)
    yield all([
      put(walletActions.fetchPriceSuccess(price)),
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

function * handleFetchTokenBalance (action) {
  try {
    const { address, contractAddress, tokenType, tokenId, key } = action.payload
    const balance = yield call(api.blockchain.tokenBalance, { contractAddress, tokenType, tokenId, address })
    yield all([
      put(walletActions.fetchTokenBalanceSuccess({ address, key, balance: balance.toString() })),
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

function * walletSagas () {
  yield all([
    takeEvery(walletActions.fetchWallet().type, handleFetchWallet),
    takeEvery(walletActions.fetchBalance().type, handleFetchBalance),
    takeEvery(walletActions.fetchTokenBalance().type, handleFetchTokenBalance),
    takeLatest(walletActions.fetchPrice().type, handleFetchPrice),
  ])
}

export default walletSagas
