const ONEUtil = require('../util')
const ONE = require('../onewallet')
const config = require('../config/provider').getConfig()
const storage = require('./storage').getStorage()
const message = require('./message').getMessage()
const { api } = require('./index')

export const EotpBuilders = {
  fromOtp: ({ otp, wallet }) => {
    const { hseed } = wallet
    const encodedOtp = ONEUtil.encodeNumericalOtp(otp)
    return ONE.computeEOTP({ otp: encodedOtp, hseed: ONEUtil.hexToBytes(hseed) })
  },
  recovery: ({ wallet, layers }) => {
    const { hseed, effectiveTime } = wallet
    const index = ONEUtil.timeToIndex({ effectiveTime })
    const leaf = layers[0].subarray(index * 32, index * 32 + 32).slice()
    const { eotp } = ONE.bruteforceEOTP({ hseed: ONEUtil.hexToBytes(hseed), leaf })
    return eotp
  }
}

export const Flows = {
  commitReveal: async ({
    otp, eotpBuilder = EotpBuilders.fromOtp,
    wallet, layers, commitHashGenerator, commitHashArgs,
    beforeCommit, afterCommit, onCommitError, onCommitFailure,
    revealAPI, revealArgs, onRevealFailure, onRevealSuccess, onRevealError, onRevealAttemptFailed,
    beforeReveal,
    maxTransferAttempts = 3, checkCommitInterval = 5000
  }) => {
    const { effectiveTime, root, address } = wallet
    if (!layers) {
      layers = await storage.getItem(root)
      if (!layers) {
        console.log(layers)
        message.error('Cannot find pre-computed proofs for this wallet. Storage might be corrupted. Please restore the wallet from Google Authenticator.')
        return
      }
    }
    const eotp = eotpBuilder({ otp, wallet, layers })
    if (!eotp) {
      message.error('Local state verification failed.')
      return
    }
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

    let numAttemptsRemaining = maxTransferAttempts - 1
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
    }, checkCommitInterval)
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
      commitHash = ONEUtil.hexString(commitHash)
      console.log({ commitHash, commits })
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
    if (!wallet.majorVersion || !(wallet.majorVersion >= config.minWalletVersion)) {
      message.warning('You are using an outdated wallet, which is less secure than the current version. Please move your funds to a new wallet.', 15)
      return Flows.commitReveal({ ...args, wallet })
    }
    return SecureFlows.commitReveal({ ...args, wallet })
  }
}
