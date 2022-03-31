const config = require('../config')
const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const blockchain = require('../blockchain')
const ONEConstants = require('../../lib/constants')
const { rpc } = require('../rpc')
const SushiData = require('../../data/sushiswap.json')
const BN = require('bn.js')
const { generalLimiter, walletAddressLimiter, rootHashLimiter, globalLimiter } = require('./rl')
const { parseTx, parseError, checkParams } = require('./util')
const { transfer, recover, setRecoveryAddress, tokenOperation } = require('./v5')
router.get('/health', generalLimiter(), async (req, res) => {
  console.log(req.fingerprint)
  res.send('OK').end()
})

router.use((req, res, next) => {
  const s = req.header('X-ONEWALLET-RELAYER-SECRET')
  if (config.secret && (s !== config.secret)) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: `Invalid X-ONEWALLET-RELAYER-SECRET: ${s}`, code: 0 })
  }
  const network = req.header('X-NETWORK')
  if (!network) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Must selected network in header X-NETWORK', code: 1 })
  }
  if (!blockchain.getNetworks().includes(network)) {
    return res.status(StatusCodes.NOT_IMPLEMENTED).json({ error: `Unsupported network ${network}` })
  }
  const majorVersion = req?.body?.majorVersion || req.header('X-MAJOR-VERSION')
  const minorVersion = req?.body?.minorVersion || req.header('X-MINOR-VERSION')
  req.network = network
  req.majorVersion = parseInt(majorVersion || 0)
  req.minorVersion = parseInt(minorVersion || 0)
  console.log(`Address: ${req.body.address}; network: ${req.network}; majorVersion: ${req.majorVersion}; minorVersion: ${req.minorVersion}`)
  // TODO: differentiate <v5 and >=v6 contracts
  if (!(req.majorVersion >= 6)) {
    req.contract = blockchain.getWalletContract(network, 5)
  } else if (req.majorVersion === 6) {
    req.contract = blockchain.getWalletContract(network, 6)
  } else {
    req.contract = blockchain.getWalletContract(network)
  }
  req.provider = blockchain.getProvider(network)
  next()
})

// TODO: rate limiting + fingerprinting + delay with backoff

router.post('/new', rootHashLimiter({ max: 60 }), generalLimiter({ max: 10 }), globalLimiter({ max: 250 }), async (req, res) => {
  let { root, height, interval, t0, lifespan, slotSize, lastResortAddress,
    spendingLimit, spentAmount, lastSpendingInterval, spendingInterval, lastLimitAdjustmentTime, highestSpendingLimit, backlinks, oldCores, innerCores, identificationKeys } = req.body
  // root is hex string, 32 bytes
  height = parseInt(height)
  interval = parseInt(interval)
  t0 = parseInt(t0)
  lifespan = parseInt(lifespan)
  slotSize = parseInt(slotSize)
  spendingInterval = parseInt(spendingInterval)
  backlinks = backlinks || []
  lastResortAddress = lastResortAddress || config.nullAddress
  oldCores = oldCores || []
  spentAmount = spentAmount || 0
  lastSpendingInterval = lastSpendingInterval || 0
  lastLimitAdjustmentTime = lastLimitAdjustmentTime || 0
  highestSpendingLimit = highestSpendingLimit || spendingLimit
  // lastResortAddress is hex string, 20 bytes
  // dailyLimit is a BN in string form
  if (config.debug || config.verbose) {
    console.log(`[/new] `, { core: { root, height, interval, t0, lifespan, slotSize },
      spending: { spendingLimit, spentAmount, lastSpendingInterval, spendingInterval, lastLimitAdjustmentTime, highestSpendingLimit },
      lastResortAddress,
      identificationKeys,
      backlinks,
      oldCores,
      innerCores,
    })
  }

  if (!checkParams({
    root,
    height,
    interval,
    t0,
    lifespan,
    slotSize,
    lastResortAddress,
    spendingLimit,
    spentAmount,
    lastSpendingInterval,
    spendingInterval,
    lastLimitAdjustmentTime,
    highestSpendingLimit,
    identificationKeys,
    backlinks,
    oldCores,
    innerCores
  }, res)) {
    return
  }
  if (spendingLimit === 0) {
    // since we renamed dailyLimit to spendingLimit we must make sure client is not using the old name / format
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'spendingLimit cannot be 0' })
  }
  const oldCoreTransformed = []
  for (let oldCore of oldCores) {
    const { root: oldRoot, height: oldHeight, interval: oldInterval, t0: oldT0, lifespan: oldLifespan, slotSize: oldSlotSize } = oldCore
    oldCoreTransformed.push([oldRoot, oldHeight, oldInterval, oldT0, oldLifespan, oldSlotSize])
    if (!oldRoot) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: `old core has empty root: ${JSON.stringify(oldCore)}` })
    }
  }
  const innerCoreTransformed = []
  for (let innerCore of innerCores) {
    if (innerCore.length > 0) {
      innerCoreTransformed.push([...innerCore])
      continue
    }
    const { root: innerRoot, height: innerHeight, interval: innerInterval, t0: innerT0, lifespan: innertLifespan, slotSize: innerSlotSize } = innerCore
    innerCoreTransformed.push([innerRoot, innerHeight, innerInterval, innerT0, innertLifespan, innerSlotSize])
    if (!innerRoot) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: `inner core has empty root: ${JSON.stringify(innerCore)}` })
    }
  }
  // TODO parameter verification
  try {
    const initArgs = [
      [root, height, interval, t0, lifespan, slotSize],
      [ new BN(spendingLimit), new BN(spentAmount), new BN(lastSpendingInterval), new BN(spendingInterval), new BN(lastLimitAdjustmentTime), new BN(highestSpendingLimit) ],
      lastResortAddress,
      backlinks,
      oldCoreTransformed,
      innerCoreTransformed,
      identificationKeys,
    ]
    const logger = (...args) => console.log(`[/new]`, ...args)
    const executor = blockchain.prepareExecute(req.network, logger)
    const { receipt, predictedAddress } = await executor(async txArgs => {
      const c = blockchain.getFactory(req.network)
      const predictedAddress = await c.predict.call(identificationKeys[0], txArgs)
      const code = await rpc.getCode({ address: predictedAddress, network: req.network })
      if (code.length > 0) {
        const ex = new Error('already deployed')
        ex.abort = true
        ex.extra = { predictedAddress }
        throw ex
      }
      try {
        const receipt = await c.deploy(initArgs, txArgs)
        return { predictedAddress, receipt }
      } catch (ex) {
        ex.extra = { predictedAddress }
        throw ex
      }
    })
    console.log(JSON.stringify(receipt, null, 2))
    const { logs } = receipt
    const successLog = logs.find(log => log.event === 'ONEWalletDeploySuccess')
    if (!successLog) {
      return res.status(StatusCodes.NOT_ACCEPTABLE).json({ predictedAddress, receipt })
    }
    const address = successLog.args['addr']
    return res.json({ success: true, address, receipt })
  } catch (ex) {
    console.error(ex)
    const { code, error, success, extra } = parseError(ex)
    return res.status(code).json({ error, success, extra })
  }
})

router.post('/commit', generalLimiter({ max: 240 }), walletAddressLimiter({ max: 240 }), async (req, res) => {
  let { hash, paramsHash, verificationHash, address } = req.body
  if (config.debug || config.verbose) {
    console.log(`[/commit] `, { hash, paramsHash, verificationHash, address })
  }
  if (!hash || !address) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Hash or address is missing', params: { hash, paramsHash, verificationHash, address } })
  }
  if (hash.length !== 66) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'hash must be a hex string with length 64 starting with 0x (to represent 32 bytes)', hash })
  }
  if (req.majorVersion >= 6) {
    if (!paramsHash || paramsHash.length !== 66) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'paramsHash is missing or malformed', params: { hash, paramsHash, verificationHash, address } })
    }
  }
  if (req.majorVersion >= 7) {
    if (!verificationHash || verificationHash.length !== 66) {
      return res.status(StatusCodes.BAD_REQUEST).json({ error: 'verificationHash is missing or malformed', params: { hash, paramsHash, verificationHash, address } })
    }
  }
  try {
    // eslint-disable-next-line new-cap
    const wallet = new req.contract(address)
    let tx
    const logger = (...args) => console.log(`[/commit]`, ...args)
    const executor = blockchain.prepareExecute(req.network, logger)
    tx = await executor(txArgs => {
      if (req.majorVersion >= 7) {
        return wallet.commit(hash, paramsHash, verificationHash, txArgs)
        // tx = await wallet.sendTransaction(txreq)
      } else if (req.majorVersion >= 6) {
        return wallet.commit(hash, paramsHash, txArgs)
      } else {
        return wallet.commit(hash, txArgs)
      }
    })
    const parsedTx = parseTx(tx)
    return res.json(parsedTx)
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/reveal', generalLimiter({ max: 240 }), walletAddressLimiter({ max: 240 }), async (req, res) => {
  let { neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data } = req.body
  if (!checkParams({ neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data }, res)) {
    return
  }
  if (config.debug || config.verbose) {
    console.log(`[/reveal] `, { neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
  }
  if (!(req.majorVersion >= 6)) {
    operationType = parseInt(operationType || -1)
    if (!(operationType > 0)) {
      return res.status(StatusCodes.BAD_REQUEST).json(`Bad operationType: ${operationType}`)
    }
    if (operationType === ONEConstants.OperationType.TRANSFER) {
      return transfer({ req, res, address, neighbors, index, eotp, dest, amount })
    } else if (operationType === ONEConstants.OperationType.RECOVER) {
      return recover({ req, res, address, neighbors, index, eotp })
    } else if (operationType === ONEConstants.OperationType.SET_RECOVERY_ADDRESS) {
      return setRecoveryAddress({ req, res, address, neighbors, index, eotp, lastResortAddress: dest })
    } else {
      return tokenOperation({ req, res, address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
    }
  }
  // TODO parameter verification
  try {
    // eslint-disable-next-line new-cap
    const wallet = new req.contract(address)
    // console.log({ neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
    let tx = null
    const logger = (...args) => console.log(`[/reveal]`, ...args)
    const executor = blockchain.prepareExecute(req.network, logger)
    tx = await executor(txArgs => {
      if (!(req.majorVersion >= 14)) {
        return wallet.reveal(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data, txArgs)
      } else {
        return wallet.reveal(
          [neighbors, index, eotp],
          [operationType, tokenType, contractAddress, tokenId, dest, amount, data],
          txArgs
        )
      }
    })
    const parsedTx = parseTx(tx)
    return res.json(parsedTx)
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/retire', generalLimiter({ max: 6 }), walletAddressLimiter({ max: 6 }), async (req, res) => {
  let { address } = req.body
  if (!checkParams({ address }, res)) {
    return
  }
  // TODO parameter verification
  try {
    const wallet = await req.contract(address)
    const logger = (...args) => console.log(`[/retire]`, ...args)
    const executor = blockchain.prepareExecute(req.network, logger)
    const tx = await executor(txArgs => wallet.retire(txArgs))
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.get('/sushi', generalLimiter({ max: 120 }), walletAddressLimiter({ max: 120 }), async (req, res) => {
  res.json(SushiData)
})

module.exports = router
