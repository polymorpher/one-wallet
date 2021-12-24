import { handleActions } from 'redux-actions'
import balanceActions from './actions'
import omit from 'lodash/fp/omit'

// address -> {balance, tokenBalances}
export const initialState = {
}

const reducer = handleActions(
  {
    [balanceActions.fetchBalanceSuccess]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        balance: action.payload.balance,
      }
    }),

    [balanceActions.fetchTokenBalanceSuccess]: (state, action) => ({
      ...state,
      [action.payload.address]: {
        ...state[action.payload.address],
        tokenBalances: {
          ...state[action.payload.address]?.tokenBalances,
          [action.payload.key]: action.payload.balance
        }
      }
    }),

    [balanceActions.deleteBalance]: (state, action) => ({
      ...omit([action.payload], state)
    }),
  },
  {
    ...initialState
  }
)

export default reducer
