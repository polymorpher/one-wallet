const ONEUtil = require('../util')
const ONEConstants = require('../constants')
const ONE = require('../onewallet')
const config = require('../config/provider').getConfig()
const storage = require('./storage').getStorage()
const messager = require('./message').getMessage()
const { api } = require('./index')
const { parseTxLog } = require('../parser')
const BN = require('bn.js')
const { Command } = require('./command')

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

const EOTPDerivation = {
  deriveEOTP: async ({
    otp, otp2, wallet, eotpBuilder = EotpBuilders.fromOtp,
    recoverRandomness = null, prepareProof = null, prepareProofFailed = null,
    layers = null, index = null,
    message = messager,
  }) => {
    const { oldInfos, randomness, hseed, hasher, identificationKeys, localIdentificationKey } = wallet
    let { effectiveTime, root } = wallet
    if (!layers) {
      if (localIdentificationKey && identificationKeys) {
        const idKeyIndex = identificationKeys.filter(e => e.length >= 130).findIndex(e => e === localIdentificationKey)
        if (idKeyIndex === -1) {
          message.debug('Cannot identify tree to use because of identification key mismatch. Falling back to brute force search')
          layers = await storage.getItem(root)
        } else {
          message.debug(`Identified tree via localIdentificationKey=${localIdentificationKey}`)
          if (idKeyIndex === identificationKeys.length - 1) {
            layers = await storage.getItem(root)
          } else {
            const info = oldInfos[idKeyIndex] ? oldInfos[idKeyIndex] : wallet
            layers = await storage.getItem(info.root)
            effectiveTime = info.effectiveTime
            root = info.root
          }
        }
      } else {
        layers = await storage.getItem(root)
      }
      if (!layers) {
        message.debug(`Did not find root ${root}. Looking up storage for old roots`)
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
      } else {
        message.debug(`Found root ${root}`)
      }
    }

    prepareProof && prepareProof()
    index = index || ONEUtil.timeToIndex({ effectiveTime })
    if (index < 0) {
      index = layers[0].length / 32 - 1
      message.debug(`[RECOVERY] Setting index to be last leaf at position ${index}`)
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
        return {}
      }
    }
    const eotp = await eotpBuilder({ otp, otp2, rand, wallet, nonce, layers })
    message.debug(`eotp=${ONEUtil.hexString(eotp)} index=${index}`)
    return { eotp, index, layers }
  },

  // otp,
  // otp2,
  // eotpBuilder,
  // recoverRandomness,
  // prepareProof,
  // prepareProofFailed,
  // wallet,
  // layers,
  // index,
  // message

  deriveSuperEOTP: async ({ otp, wallet, effectiveTime = null, innerTrees = null, prepareProof, prepareProofFailed, message = messager }) => {
    const { innerRoots } = wallet
    prepareProof && prepareProof()
    const effectiveTimes = effectiveTime ? [effectiveTime] : [ wallet.effectiveTime, ...wallet?.oldInfos?.map(o => o.effectiveTime) ]
    innerTrees = innerTrees || (await Promise.all(innerRoots.map(r => storage.getItem(r))))
    if (!innerTrees || innerTrees.includes(null)) {
      message.error('Wallet storage is inconsistent. Please delete this wallet then restore it.')
      prepareProofFailed && prepareProofFailed()
      return
    }
    const eotp = await EotpBuilders.restore({ otp })
    const expectedLeaf = ONEUtil.sha256(eotp)
    // console.log({ expectedLeaf, eotp })
    let index = null
    let treeIndex = null
    const search = () => {
      for (const [eind, effectiveTime] of effectiveTimes.entries()) {
        const maxIndex = ONEUtil.timeToIndex({ effectiveTime, interval: ONEConstants.INTERVAL6 })
        // const treeIndex = ONEUtil.timeToIndex({ effectiveTime: wallet.effectiveTime }) % innerTrees.length
        const maxIndexAcrossTrees = Math.max(...innerTrees.map(t => t[0].length / 32))
        message.debug(`[eind=${eind} effectiveTime=${effectiveTime}] maxIndex:${maxIndex}, maxIndexAcrossTrees:${maxIndexAcrossTrees} }`)
        for (let i = Math.min(maxIndexAcrossTrees - 1, maxIndex + 1); i >= 0; i--) {
          // for (let i = 0; i < maxIndexAcrossTrees; i++) {
          for (const [ind, innerTree] of innerTrees.entries()) {
            const layer = innerTree[0]
            const b = new Uint8Array(layer.subarray(i * 32, i * 32 + 32))
            if (ONEUtil.bytesEqual(b, expectedLeaf)) {
              index = i
              treeIndex = ind
              console.log(`Matching tree index ${treeIndex} at position ${index}`)
              return
              // console.log(`Matching index: ${ind} (expected ${treeIndex}), at ${i} (expected ${index})`)
            }
          }
        }
      }
    }
    search()

    if (index === null || treeIndex === null) {
      message.error('Code is incorrect. Please start over.')
      prepareProofFailed && prepareProofFailed()
      return
    }
    const layers = innerTrees[treeIndex]
    return { index, layers, eotp }
  }
}

const Flows = {
  commitReveal: async ({
    otp, otp2, eotpBuilder = EotpBuilders.fromOtp, wallet,
    commitHashGenerator, commitHashArgs, revealAPI, revealArgs, commitRevealArgs = null,
    deriver = EOTPDerivation.deriveEOTP, effectiveTime = null, innerTrees = null,
    recoverRandomness = null, prepareProof = null, prepareProofFailed = null,
    index = null,
    eotp = null,
    committer = Committer.legacy,
    layers = null,
    beforeCommit = null, afterCommit = null, onCommitError = null, onCommitFailure = null,
    onRevealFailure = null, onRevealSuccess = null, onRevealError = null, onRevealAttemptFailed = null,
    beforeReveal = null,
    maxTransferAttempts = 5, checkCommitInterval = 4000,
    message = messager,
    overrideVersion = false,
  }) => {
    const { address, majorVersion, minorVersion } = wallet

    if (!eotp) {
      const derived = await deriver({
        otp,
        otp2,
        eotpBuilder,
        recoverRandomness,
        prepareProof,
        prepareProofFailed,
        wallet,
        layers,
        index,
        effectiveTime,
        innerTrees,
        message })
      eotp = derived?.eotp
      index = (index < 0 || !index) ? derived?.index : index
      layers = layers || derived?.layers
    }
    if (!eotp) {
      message.error('Local state verification failed.')
      return
    }
    beforeCommit && await beforeCommit()

    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]

    // compute commitHashArgs with fallbacks
    if (typeof commitRevealArgs === 'function') {
      commitHashArgs = commitRevealArgs({ neighbor, index, eotp })
    } else if (commitRevealArgs) {
      commitHashArgs = commitRevealArgs
    } else if (typeof commitHashArgs === 'function') {
      commitHashArgs = commitHashArgs({ neighbor, index, eotp })
    }

    const { commitHash, paramsHash, verificationHash } = committer({
      address,
      commitHashGenerator,
      neighbor,
      index,
      eotp,
      commitHashArgs
    })
    // console.log(commitHash, paramsHash)
    try {
      const { success, error } = await api.relayer.commit({
        address,
        hash: ONEUtil.hexString(commitHash),
        paramsHash: paramsHash && ONEUtil.hexString(paramsHash),
        verificationHash: verificationHash && ONEUtil.hexString(verificationHash),
        ...(overrideVersion ? { majorVersion, minorVersion } : {})
      })
      if (!success) {
        onCommitFailure && await onCommitFailure(error)
        return
      }
    } catch (ex) {
      onCommitError && await onCommitError(ex)
      return
    }
    afterCommit && await afterCommit(commitHash)

    if (typeof commitRevealArgs === 'function') {
      revealArgs = commitRevealArgs({ neighbor, index, eotp })
    } else if (commitRevealArgs) {
      revealArgs = commitRevealArgs
    } else if (typeof revealArgs === 'function') {
      revealArgs = revealArgs({ neighbor, index, eotp })
    }

    let numAttemptsRemaining = maxTransferAttempts - 1
    const tryReveal = () => setTimeout(async () => {
      try {
        beforeReveal && await beforeReveal(commitHash, paramsHash, verificationHash)
        // TODO: should reveal only when commit is confirmed and viewable on-chain. This should be fixed before releasing it to 1k+ users
        // TODO: Prevent transfer more than maxOperationsPerInterval per interval (30 seconds)
        const { success, tx, txId, error } = await revealAPI({
          neighbors: neighbors.map(n => ONEUtil.hexString(n)),
          index,
          eotp: ONEUtil.hexString(eotp),
          address,
          ...(overrideVersion ? { majorVersion, minorVersion } : {}),
          ...(revealArgs)
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
        const events = parseTxLog(tx?.receipt?.rawLogs)
        // const messages = tx?.receipt?.rawLogs.flatMap(l => l.topics.map(t => EventMessage?.[EventMaps?.[t]])).filter(Boolean)
        onRevealSuccess && await onRevealSuccess(txId, events)
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
    }, (maxTransferAttempts - (numAttemptsRemaining + 1)) * 5000)
    return tryReveal()
  },
}

const SecureFlowsV3 = {
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

const SecureFlowsV16 = {
  commitReveal: async ({ wallet, forwardWallet, commitRevealArgs, message, ...params }) => {
    const { address, forwardAddress } = wallet
    // TODO: retrieve forwardAddress' version via api.blockchain.getVersion or via local state. This is not needed right now, but may be useful later
    if (ONEConstants.EmptyAddress !== forwardAddress && forwardWallet?.root && commitRevealArgs) {
      // This is a source wallet which already has a forwarded address. Must transform the parameters into COMMAND, orignated from target wallet
      message.debug(`Transforming to COMMAND from ${forwardAddress} on ${address}`)
      const command = Command({ backlinkAddress: address, wallet: forwardWallet })
      const args = command.transform(commitRevealArgs)
      message.debug(`Transformed ${JSON.stringify(commitRevealArgs)} to ${JSON.stringify(args.commitRevealArgs)}`, undefined, { console: true })
      commitRevealArgs = args.commitRevealArgs
      return SecureFlowsV7.commitReveal({
        wallet: forwardWallet, message, ...params, overrideVersion: false, commitRevealArgs })
    }
    return SecureFlowsV7.commitReveal({ wallet, commitRevealArgs, message, ...params })
  }
}

const SmartFlows = {
  commitReveal: async ({ wallet, message = messager, ...args }) => {
    if (!wallet.majorVersion || !(wallet.majorVersion >= config.minWalletVersion)) {
      message.warning('You are using a terribly outdated version of 1wallet. Please create a new one and move your assets.', 15)
    }
    if (wallet.majorVersion >= 16) {
      return SecureFlowsV16.commitReveal({ ...args, wallet, message })
    }
    if (wallet.majorVersion >= 7) {
      return SecureFlowsV7.commitReveal({ ...args, wallet, message })
    }
    if (wallet.majorVersion >= 6) {
      message.warning('You are using an outdated wallet. It is prone to DoS attack.', 15)
      return SecureFlowsV6.commitReveal({ ...args, wallet, message })
    }
    message.warning('You are using a wallet version that is prone to man-in-the-middle attack. Please create a new wallet and migrate assets ASAP. See https://github.com/polymorpher/one-wallet/issues/47')
    if (wallet.majorVersion >= 3) {
      return SecureFlowsV3.commitReveal({ ...args, wallet, message })
    }
    return Flows.commitReveal({
      ...args, wallet, committer: Committer.legacy
    })
  },
}

module.exports = {
  EotpBuilders,
  Flows,
  SmartFlows,
  EOTPDerivation
}
