import walletActions from '../state/modules/wallet/actions'
import { globalActions } from '../state/modules/global'
import storage from './index'
import message from '../message'
import Paths from '../constants/paths'
import { flatten } from 'lodash'

export const deleteRoot = async ({ fromAddress, root, wallets, name, history, silent }) => {
  try {
    const usedByWallets = Object.keys(wallets).map(k => wallets[k]).filter(w => w.root === root && w.address !== fromAddress)
    if (usedByWallets.length === 0) {
      message.debug(`Deleted root ${root}`)
      await storage.removeItem(root)
    } else {
      message.debug(`Skip deleting root ${root} (used by ${usedByWallets.join(', ')})`)
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
  const { root, name, address, oldInfos, innerRoots } = wallet || {}
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
  if (innerRoots?.length > 0) {
    for (const innerRoot of innerRoots) {
      await deleteRoot({ root: innerRoot, wallets, silent: true })
    }
  }
  return deleteRoot({ fromAddress: address, root, wallets, name, history, silent })
}

export const cleanStorage = async ({ wallets }) => {
  message.debug('Scanning orphaned trees from storage')
  const keys = await storage.keys()
  const roots = flatten(Object.values(wallets).map(e => [e.root, ...(e.oldInfos || []).map(e => e.root), ...(e.innerRoots || [])])).map(e => [e, true])
  const rootLookup = Object.fromEntries(roots)
  const promises = []
  for (const k of keys) {
    if (!rootLookup[k]) {
      message.debug(`Deleting tree root ${k} from storage`)
      promises.push(storage.removeItem(k))
    }
  }
  await Promise.all(promises)
  message.debug(`Deleted ${promises.length}/${keys.length} trees from storage`, 15)
}
