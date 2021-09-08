import WalletConstants from '../constants/wallet'
import walletActions from '../state/modules/wallet/actions'
import { EotpBuilders, SecureFlows, Flows, SmartFlows } from '../../../lib/api/flow'
import { api } from '../../../lib/api'

export { EotpBuilders, SecureFlows, Flows, SmartFlows }

export const Chaining = {
  refreshBalance: (dispatch, addresses) => {
    if (!addresses || !dispatch) {
      return
    }
    WalletConstants.fetchDelaysAfterTransfer.forEach(t => {
      setTimeout(() => {
        addresses.forEach(address => {
          dispatch(walletActions.fetchBalance({ address }))
        })
      }, t)
    })
  },

  refreshTokenBalance: ({ dispatch, address, token }) => {
    const { tokenType, contractAddress, tokenId, key } = token
    WalletConstants.fetchDelaysAfterTransfer.forEach(t => {
      setTimeout(() => {
        dispatch(walletActions.fetchTokenBalance({ address, contractAddress, tokenType, tokenId, key }))
      }, t)
    })
  },

  refreshAllowance: ({ address, contractAddress, onAllowanceReceived }) => {
    WalletConstants.fetchDelaysAfterTransfer.forEach(async t => {
      const allowance = await api.sushi.getAllowance({ address, contractAddress })
      onAllowanceReceived && onAllowanceReceived(allowance)
    })
  }
}
