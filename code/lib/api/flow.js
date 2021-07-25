const ONEUtil = require('../util')
const ONE = require('../onewallet')
const config = require('../config/provider').getConfig()
const storage = require('./storage').getStorage()
const messager = require('./message').getMessage()
const { api } = require('./index')

const EotpBuilders = {
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

const Committer = {
  legacy: async ({ address, commitHashGenerator, neighbor, index, eotp, commitHashArgs }) => {
    const { hash: commitHash } = commitHashGenerator({ neighbor, index, eotp, ...commitHashArgs })
    return { commitHash }
  },
  v6: async ({ address, commitHashGenerator, neighbor, index, eotp, commitHashArgs }) => {
    const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
    const { hash: paramsHash } = commitHashGenerator({ ...commitHashArgs })
    return { commitHash, paramsHash }
  }
}

const Flows = {
  commitReveal: async ({
    otp, eotpBuilder = EotpBuilders.fromOtp,
    committer = Committer.legacy,
    wallet, layers, commitHashGenerator, commitHashArgs,
    beforeCommit, afterCommit, onCommitError, onCommitFailure,
    revealAPI, revealArgs, onRevealFailure, onRevealSuccess, onRevealError, onRevealAttemptFailed,
    beforeReveal,
    maxTransferAttempts = 3, checkCommitInterval = 5000,
    message = messager
  }) => {
    const { effectiveTime, root, address } = wallet
    if (!layers) {
      layers = await storage.getItem(root)
      if (!layers) {
        message.error('Cannot find pre-computed proofs for this wallet. Storage might be corrupted. Please restore the wallet from Google Authenticator.')
        return
      }
    }
    const eotp = eotpBuilder({ otp, wallet, layers })
    if (!eotp) {
      message.error('Local state verification failed.')
      return
    }
    beforeCommit && await beforeCommit()
    const index = ONEUtil.timeToIndex({ effectiveTime })
    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]

    const { commitHash, paramsHash } = committer({ address, commitHashGenerator, neighbor, index, eotp, commitHashArgs })
    try {
      const { success, error } = await api.relayer.commit({
        address,
        hash: ONEUtil.hexString(commitHash),
        paramsHash: ONEUtil.hexString(paramsHash),
      })
      if (!success) {
        onCommitFailure && await onCommitFailure(error)
        return
      }
      return commitHash
    } catch (ex) {
      onCommitError && await onCommitError(ex)
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
          onRevealFailure && await onRevealFailure(error)
          return
        }
        onRevealSuccess && await onRevealSuccess(txId)
        return true
      } catch (ex) {
        // console.trace(ex)
        if (numAttemptsRemaining <= 0) {
          onRevealError && await onRevealError(ex)
          return
        }
        onRevealAttemptFailed && onRevealAttemptFailed(numAttemptsRemaining, ex)
        numAttemptsRemaining -= 1
        return tryReveal()
      }
    }, checkCommitInterval)
    return tryReveal()
  }
}

const SecureFlows = {
  commitReveal: async ({
    wallet, beforeReveal, ...args
  }) => {
    const { address } = wallet
    const _beforeReveal = beforeReveal
    beforeReveal = async (commitHash) => {
      _beforeReveal && _beforeReveal()
      const commits = await api.blockchain.getCommits({ address })
      commitHash = ONEUtil.hexString(commitHash)
      // console.log({ commitHash, commits })
      if (!commits || !commits.find(c => c.hash === commitHash)) {
        throw new Error('Commit not yet confirmed by blockchain')
      }
    }
    return Flows.commitReveal({
      ...args, wallet, beforeReveal, committer: Committer.legacy
    })
  }
}

const SecureFlowsV6 = {
  /**
   * require contract version >= v6
   * @param wallet
   * @param beforeReveal
   * @param args
   * @returns {Promise<undefined|number>}
   */
  commitReveal: async ({
    wallet, beforeReveal, ...args
  }) => {
    const { address } = wallet
    const _beforeReveal = beforeReveal
    beforeReveal = async (commitHash) => {
      _beforeReveal && _beforeReveal()
      commitHash = ONEUtil.hexString(commitHash)
      const { timestamp, completed } = await api.blockchain.findCommit({ address, commitHash })
      // console.log({ timestamp, completed })
      if (!(timestamp > 0)) {
        throw new Error('Commit not yet confirmed by blockchain')
      }
      if (completed) {
        throw new Error('Commit is already completed')
      }
    }
    return Flows.commitReveal({
      ...args, wallet, beforeReveal, committer: Committer.v6
    })
  }
}

const SmartFlows = {
  commitReveal: async ({ wallet, message = messager, ...args }) => {
    if (!wallet.majorVersion || !(wallet.majorVersion >= config.minWalletVersion)) {
      message.warning('You are using an outdated wallet, which is less secure than the current version. Please move your funds to a new wallet.', 15)
    }
    if (wallet.majorVersion >= 6) {
      return SecureFlowsV6.commitReveal({ ...args, wallet })
    }
    message.warning('You are using a wallet version that is prone to man-in-the-middle attack. Please create a new wallet and migrate assets ASAP.See https://github.com/polymorpher/one-wallet/issues/47')
    if (wallet.majorVersion >= 3) {
      return SecureFlows.commitReveal({ ...args, wallet })
    }
    return Flows.commitReveal({
      ...args, wallet, committer: Committer.legacy
    })
  }
}

module.exports = {
  EotpBuilders,
  SecureFlows,
  Flows,
  SmartFlows,
}
