import { createAction } from '@reduxjs/toolkit'
const deleteBalance = createAction('DELETE_BALANCE')

const fetchBalance = createAction('FETCH_BALANCE')
const fetchBalanceSuccess = createAction('FETCH_BALANCE_SUCCESS')

const fetchTokenBalance = createAction('FETCH_TOKEN_BALANCE')
const fetchTokenBalanceSuccess = createAction('FETCH_TOKEN_BALANCE_SUCCESS')

export default {
  deleteBalance,

  fetchBalance,
  fetchBalanceSuccess,
  fetchTokenBalance,
  fetchTokenBalanceSuccess,
}
