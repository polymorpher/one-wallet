import walletActions from '../state/modules/wallet/actions'
import storage from './index'
import { message } from 'antd'
import Paths from '../constants/paths'

export const deleteWalletLocally = async ({ wallet, wallets, dispatch, history, silent }) => {
  const { root, name, address } = wallet || {}
  if (!root || !address) {
    return
  }
  dispatch(walletActions.deleteWallet(address))
  if (!wallets) {
    return
  }
  try {
    if (Object.keys(wallets).map(k => wallets[k]).filter(w => w.root === root).length === 0) {
      storage.removeItem(root)
    }
    !silent && message.success(`Wallet ${name} is deleted`)
    if (history) {
      history.push(Paths.wallets)
    }
  } catch (ex) {
    console.error(ex)
    !silent && message.error(`Failed to delete wallet proofs. Error: ${ex}`)
  }
}
