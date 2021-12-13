import walletActions from '../state/modules/wallet/actions'
import { globalActions } from '../state/modules/global'
import storage from './index'
import message from '../message'
import Paths from '../constants/paths'

export const deleteRoot = async ({ root, wallets, name, history, silent }) => {
  try {
    if (Object.keys(wallets).map(k => wallets[k]).filter(w => w.root === root).length === 0) {
      await storage.removeItem(root)
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

export const deleteWalletLocally = async ({ wallet, wallets, dispatch, history, silent }) => {
  const { root, name, address, oldInfos } = wallet || {}
  if (!root || !address) {
    return
  }
  dispatch(walletActions.deleteWallet(address))
  dispatch(globalActions.deleteKnownAddress(address))
  if (!wallets) {
    return
  }
  if (oldInfos?.length > 0) {
    for (let i = 0; i < oldInfos.length; i++) {
      const { root: oldroot } = oldInfos[i] || {}
      if (!oldroot) {
        continue
      }
      await deleteRoot({ root: oldroot, wallets, silent: true })
    }
  }
  return deleteRoot({ root, wallets, name, history, silent })
}
