import ONEUtil from '../../../lib/util'
import ONE from '../../../lib/onewallet'
import storage from '../storage'
import { message } from 'antd'
import api from './index'
import WalletConstants from '../constants/wallet'
import util from '../util'

export const Flows = {
  commitReveal: async ({
    otp, wallet, layers, commitHashGenerator, commitHashArgs,
    beforeCommit, afterCommit, onCommitError, onCommitFailure,
    revealAPI, revealArgs, onRevealFailure, onRevealSuccess, onRevealError, onRevealAttemptFailed,
    beforeReveal
  }) => {
    const { hseed, effectiveTime, root, address } = wallet
    if (!layers) {
      layers = await storage.getItem(root)
      if (!layers) {
        console.log(layers)
        message.error('Cannot find pre-computed proofs for this wallet. Storage might be corrupted. Please restore the wallet from Google Authenticator.')
        return
      }
    }
    const encodedOtp = ONEUtil.encodeNumericalOtp(otp)
    const eotp = ONE.computeEOTP({ otp: encodedOtp, hseed: ONEUtil.hexToBytes(hseed) })
    const index = ONEUtil.timeToIndex({ effectiveTime })
    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]
    const { hash: commitHash } = commitHashGenerator({ neighbor, index, eotp, ...commitHashArgs })
    beforeCommit && await beforeCommit()
    try {
      const { success, error } = await api.relayer.commit({ address, hash: ONEUtil.hexString(commitHash) })
      if (!success) {
        onCommitFailure && await onCommitFailure(error)
        return
      }
    } catch (ex) {
      onCommitError && await onCommitError(ex)
      return
    }
    afterCommit && await afterCommit(commitHash)

    let numAttemptsRemaining = WalletConstants.maxTransferAttempts - 1
    const tryReveal = () => setTimeout(async () => {
      try {
        beforeReveal && await beforeReveal(commitHash)
        // TODO: should reveal only when commit is confirmed and viewable on-chain. This should be fixed before releasing it to 1k+ users
        // TODO: Prevent transfer more than maxOperationsPerInterval per interval (30 seconds)
        const { success, txId, error } = await revealAPI({
          neighbors: neighbors.map(n => ONEUtil.hexString(n)),
          index,
          eotp: ONEUtil.hexString(eotp),
          address,
          ...revealArgs
        })
        if (!success) {
          if (error.includes('Cannot find commit')) {
            message.error(`Network busy. Trying ${numAttemptsRemaining} more time`)
            numAttemptsRemaining -= 1
            return tryReveal()
          }
          onRevealFailure && await onRevealFailure()
          return
        }
        onRevealSuccess && await onRevealSuccess(txId)
        return true
      } catch (ex) {
        console.trace(ex)
        if (numAttemptsRemaining <= 0) {
          onRevealError && await onRevealError(ex)
          return
        }
        onRevealAttemptFailed && onRevealAttemptFailed(numAttemptsRemaining)
        numAttemptsRemaining -= 1
        return tryReveal()
      }
    }, WalletConstants.checkCommitInterval)
    return tryReveal()
  }
}

export const SecureFlows = {
  commitReveal: async ({
    wallet, beforeReveal, ...args
  }) => {
    const { address } = wallet
    const _beforeReveal = beforeReveal
    beforeReveal = async (commitHash) => {
      _beforeReveal && _beforeReveal()
      const commits = await api.blockchain.getCommits({ address })
      if (!commits || !commits.find(c => c.hash === commitHash)) {
        throw new Error('Commit not yet confirmed by blockchain')
      }
    }
    return Flows.commitReveal({
      ...args, wallet, beforeReveal
    })
  }
}

export const SmartFlows = {
  commitReveal: async ({ wallet, ...args }) => {
    if (util.isWalletOutdated(wallet)) {
      message.warning('You are using an outdated wallet, which is less secure than the current version. Please move your funds to a new wallet.')
      return Flows.commitReveal({ ...args, wallet })
    }
    return SecureFlows.commitReveal({ ...args, wallet })
  }
}
