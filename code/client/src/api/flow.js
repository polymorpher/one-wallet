import WalletConstants from '../constants/wallet'
import walletActions from '../state/modules/wallet/actions'
import { EotpBuilders, SecureFlows, Flows, SmartFlows } from '../../../lib/api/flow'

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
  }
}
