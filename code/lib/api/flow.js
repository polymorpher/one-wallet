const ONEUtil = require('../util')
const ONE = require('../onewallet')
const config = require('../config/provider').getConfig()
const storage = require('./storage').getStorage()
const messager = require('./message').getMessage()
const { api } = require('./index')
const BN = require('bn.js')

const EotpBuilders = {
  fromOtp: async ({ otp, otp2, rand, nonce, wallet }) => {
    const { hseed } = wallet
    const encodedOtp = ONEUtil.encodeNumericalOtp(otp)
    const encodedOtp2 = otp2 ? ONEUtil.encodeNumericalOtp(otp2) : undefined
    return ONE.computeEOTP({ otp: encodedOtp, otp2: encodedOtp2, rand, nonce, hseed: ONEUtil.hexToBytes(hseed) })
  },
  restore: async ({ otp }) => {
    return ONE.computeInnerEOTP({ otps: otp.map(e => ONEUtil.encodeNumericalOtp(e)) })
  },
  recovery: async ({ wallet, layers }) => {
    // eslint-disable-next-line no-unused-vars
    const { hseed, effectiveTime } = wallet
    const leaf = layers[0].subarray(layers[0].length - 32, layers[0].length)
    return leaf
  },
  legacyRecovery: async ({ wallet, layers }) => {
    const { hseed, effectiveTime } = wallet
    const index = ONEUtil.timeToIndex({ effectiveTime })
    const leaf = layers[0].subarray(index * 32, index * 32 + 32).slice()
    const { eotp } = ONE.bruteforceEOTP({ hseed: ONEUtil.hexToBytes(hseed), leaf })
    return eotp
  }
}

const Committer = {
  legacy: ({ address, commitHashGenerator, neighbor, index, eotp, commitHashArgs }) => {
    const { bytes } = commitHashGenerator({ neighbor, index, eotp, ...commitHashArgs })
    const input = new Uint8Array(bytes.length + 96)
    input.set(neighbor)
    const indexBytes = new BN(index, 10).toArrayLike(Uint8Array, 'be', 4)
    input.set(indexBytes, 32)
    input.set(eotp, 64)
    input.set(bytes, 96)
    const commitHash = ONEUtil.keccak(input)
    // console.log(input, bytes, commitHash)
    return { commitHash }
  },
  v6: ({ address, commitHashGenerator, neighbor, index, eotp, commitHashArgs }) => {
    const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
    const { hash: paramsHash } = commitHashGenerator({ ...commitHashArgs })
    return { commitHash, paramsHash }
  },
  v7: ({ address, commitHashGenerator, neighbor, index, eotp, commitHashArgs }) => {
    const { hash: commitHash } = ONE.computeCommitHash({ neighbor, index, eotp })
    const { hash: paramsHash } = commitHashGenerator({ ...commitHashArgs })
    const { hash: verificationHash } = ONE.computeVerificationHash({ eotp, paramsHash })
    return { commitHash, paramsHash, verificationHash }
  }
}

const Flows = {
  commitReveal: async ({
    otp, otp2, eotpBuilder = EotpBuilders.fromOtp,
    committer = Committer.legacy,
    recoverRandomness,
    wallet, layers, commitHashGenerator, commitHashArgs, prepareProof, prepareProofFailed,
    beforeCommit, afterCommit, onCommitError, onCommitFailure,
    revealAPI, revealArgs, onRevealFailure, onRevealSuccess, onRevealError, onRevealAttemptFailed,
    beforeReveal, index,
    maxTransferAttempts = 3, checkCommitInterval = 4000,
    message = messager,
  }) => {
    const { oldInfos, address, randomness, hseed, hasher } = wallet
    let { effectiveTime, root } = wallet
    if (!layers) {
      layers = await storage.getItem(root)
      if (!layers) {
        // look for old roots
        for (let info of oldInfos) {
          if (info.root && (info.effectiveTime + info.duration > Date.now())) {
            layers = await storage.getItem(info.root)
            effectiveTime = info.effectiveTime
            root = info.root
            if (layers) {
              break
            }
          }
        }
        if (!layers) {
          message.error('Cannot find pre-computed proofs for this wallet. Storage might be corrupted. Please restore the wallet from Google Authenticator.')
          return
        }
      }
    }
    prepareProof && prepareProof()
    index = index || ONEUtil.timeToIndex({ effectiveTime })
    if (index < 0) {
      index = layers[0].length / 32 - 1
    }
    let nonce // should get from blockchain, but omitted for now because all wallets have maxOperationsPerInterval set to 1.
    let rand
    if (randomness > 0) {
      const leaf = layers[0].subarray(index * 32, index * 32 + 32)
      if (recoverRandomness) {
        rand = await recoverRandomness({ randomness, hseed, otp, otp2, nonce, leaf, hasher })
      } else {
        const encodedOtp = ONEUtil.encodeNumericalOtp(otp)
        const encodedOtp2 = otp2 ? ONEUtil.encodeNumericalOtp(otp2) : undefined
        rand = await ONE.recoverRandomness({
          randomness,
          hseed: ONEUtil.hexToBytes(hseed),
          otp: encodedOtp,
          otp2: encodedOtp2,
          nonce,
          leaf,
          hasher: ONEUtil.getHasher(hasher)
        })
      }
      // console.log({ rand })
      if (rand === null) {
        message.error('Validation error. Code might be incorrect')
        prepareProofFailed && prepareProofFailed()
        return
      }
    }
    const eotp = await eotpBuilder({ otp, otp2, rand, wallet, layers })
    if (!eotp) {
      message.error('Local state verification failed.')
      return
    }
    beforeCommit && await beforeCommit()

    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]

    const { commitHash, paramsHash, verificationHash } = committer({
      address, commitHashGenerator, neighbor, index, eotp, commitHashArgs: typeof commitHashArgs === 'function' ? commitHashArgs({ neighbor, index, eotp }) : commitHashArgs })
    // console.log(commitHash, paramsHash)
    try {
      const { success, error } = await api.relayer.commit({
        address,
        hash: ONEUtil.hexString(commitHash),
        paramsHash: paramsHash && ONEUtil.hexString(paramsHash),
        verificationHash: verificationHash && ONEUtil.hexString(verificationHash)
      })
      if (!success) {
        onCommitFailure && await onCommitFailure(error)
        return
      }
    } catch (ex) {
      onCommitError && await onCommitError(ex)
    }
    afterCommit && await afterCommit(commitHash)

    let numAttemptsRemaining = maxTransferAttempts - 1
    const tryReveal = () => setTimeout(async () => {
      try {
        beforeReveal && await beforeReveal(commitHash, paramsHash, verificationHash)
        // TODO: should reveal only when commit is confirmed and viewable on-chain. This should be fixed before releasing it to 1k+ users
        // TODO: Prevent transfer more than maxOperationsPerInterval per interval (30 seconds)
        const { success, txId, error } = await revealAPI({
          neighbors: neighbors.map(n => ONEUtil.hexString(n)),
          index,
          eotp: ONEUtil.hexString(eotp),
          address,
          ...(typeof revealArgs === 'function' ? revealArgs({ neighbor, index, eotp }) : revealArgs)
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
  /**
   * require contract version between [3, 5]
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
      const commits = await api.blockchain.getCommitsV3({ address })
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
    beforeReveal = async (commitHash, paramsHash) => {
      _beforeReveal && _beforeReveal(commitHash, paramsHash)
      commitHash = ONEUtil.hexString(commitHash)
      paramsHash = ONEUtil.hexString(paramsHash)
      const { timestamp, completed, paramsHash: paramsHashCommitted } = await api.blockchain.findCommitV6({ address, commitHash })
      // console.log({ timestamp, completed })
      if (!(timestamp > 0)) {
        throw new Error('Commit not yet confirmed by blockchain')
      }
      if (!ONEUtil.bytesEqual(paramsHashCommitted, paramsHash)) {
        console.error(`Got ${ONEUtil.hexString(paramsHashCommitted)}, expected ${ONEUtil.hexString(paramsHash)}`)
        throw new Error('Commit hash is corrupted on blockchain')
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

const SecureFlowsV7 = {
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
    beforeReveal = async (commitHash, paramsHash, verificationHash) => {
      _beforeReveal && _beforeReveal(commitHash, paramsHash, verificationHash)
      commitHash = ONEUtil.hexString(commitHash)
      paramsHash = ONEUtil.hexString(paramsHash)
      verificationHash = ONEUtil.hexString(verificationHash)
      const commits = await api.blockchain.findCommit({ address, commitHash })
      if (!commits) {
        throw new Error('No commits retrieved')
      }
      // console.log({ commitHash, commits })
      const commit = commits.find(c => c.paramsHash === paramsHash && c.verificationHash === verificationHash)
      // console.log({ commit })
      if (!commit) {
        throw new Error('Commit not yet confirmed by blockchain')
      }
      if (!(commit.timestamp > 0)) {
        throw new Error('Commit has corrupted timestamp')
      }
      if (commit.completed) {
        throw new Error('Commit is already completed')
      }
    }
    return Flows.commitReveal({
      ...args, wallet, beforeReveal, committer: Committer.v7
    })
  }
}

const SmartFlows = {
  commitReveal: async ({ wallet, message = messager, ...args }) => {
    if (!wallet.majorVersion || !(wallet.majorVersion >= config.minWalletVersion)) {
      message.warning('You are using a terribly outdated version of 1wallet. Please create a new one and move your assets.', 15)
    }
    if (wallet.majorVersion >= 7) {
      return SecureFlowsV7.commitReveal({ ...args, wallet })
    }
    if (wallet.majorVersion >= 6) {
      message.warning('You are using an outdated wallet. It is prone to DoS attack.', 15)
      return SecureFlowsV6.commitReveal({ ...args, wallet })
    }
    message.warning('You are using a wallet version that is prone to man-in-the-middle attack. Please create a new wallet and migrate assets ASAP. See https://github.com/polymorpher/one-wallet/issues/47')
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
