const config = require('../config')
const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const blockchain = require('../blockchain')
const ONEConstants = require('../../lib/constants')
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
  const majorVersion = req.header('X-MAJOR-VERSION')
  const minorVersion = req.header('X-MINOR-VERSION')
  req.network = network
  req.majorVersion = parseInt(majorVersion || 0)
  req.minorVersion = parseInt(minorVersion || 0)
  console.log(`Address: ${req.body.address}; majorVersion: ${req.majorVersion}; minorVersion: ${req.minorVersion}`)
  // TODO: differentiate <v5 and >=v6 contracts
  if (!(req.majorVersion >= 6)) {
    req.contract = blockchain.getContractV5(network)
  } else if (req.majorVersion === 6) {
    req.contract = blockchain.getContractV6(network)
  } else {
    req.contract = blockchain.getContract(network)
  }
  req.provider = blockchain.getProvider(network)
  next()
})

// TODO: rate limiting + fingerprinting + delay with backoff

router.post('/new', rootHashLimiter({ max: 60 }), generalLimiter({ max: 10 }), globalLimiter({ max: 250 }), async (req, res) => {
  let { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit, backlinks } = req.body
  // root is hex string, 32 bytes
  height = parseInt(height)
  interval = parseInt(interval)
  t0 = parseInt(t0)
  lifespan = parseInt(lifespan)
  slotSize = parseInt(slotSize)
  backlinks = backlinks || []
  lastResortAddress = lastResortAddress || config.nullAddress
  // lastResortAddress is hex string, 20 bytes
  // dailyLimit is a BN in string form
  if (config.debug || config.verbose) {
    console.log(`[/new] `, { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit, backlinks })
  }
  if (!checkParams({ root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit, backlinks }, res)) {
    return
  }

  // TODO parameter verification
  try {
    const wallet = await blockchain.getContract(req.network).new(root, height, interval, t0, lifespan, slotSize, lastResortAddress, new BN(dailyLimit, 10), backlinks)
    return res.json({ success: true, address: wallet.address })
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/commit', generalLimiter({ max: 60 }), walletAddressLimiter({ max: 60 }), async (req, res) => {
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
    const wallet = await req.contract.at(address)
    let tx
    if (req.majorVersion >= 7) {
      tx = await wallet.commit(hash, paramsHash, verificationHash)
    } else if (req.majorVersion >= 6) {
      tx = await wallet.commit(hash, paramsHash)
    } else {
      tx = await wallet.commit(hash)
    }
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/reveal', generalLimiter({ max: 120 }), walletAddressLimiter({ max: 120 }), async (req, res) => {
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
    const wallet = await req.contract.at(address)
    // console.log({ neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
    const tx = await wallet.reveal(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data)
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

// TODO: deprecate in the next version
router.post('/reveal/transfer', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, dest, amount, address } = req.body
  if (!checkParams({ neighbors, index, eotp, dest, amount, address }, res)) {
    return
  }
  transfer({ req, res, address, neighbors, index, eotp, dest, amount })
})

// TODO: deprecate in the next version
router.post('/reveal/recovery', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, address } = req.body
  if (!checkParams({ neighbors, index, eotp, address }, res)) {
    return
  }
  recover({ req, res, address, neighbors, index, eotp })
})

// TODO: deprecate in the next version
router.post('/reveal/set-recovery-address', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, address, lastResortAddress } = req.body
  if (!checkParams({ neighbors, index, eotp, address, lastResortAddress }, res)) {
    return
  }
  setRecoveryAddress({ req, res, address, neighbors, index, eotp, lastResortAddress })
})

// TODO: deprecate in the next version
router.post('/reveal/token', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data } = req.body
  if (!checkParams({ neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data }, res)) {
    return
  }
  tokenOperation({ req, res, address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data })
})

router.post('/retire', generalLimiter({ max: 6 }), walletAddressLimiter({ max: 6 }), async (req, res) => {
  let { address } = req.body
  if (!checkParams({ address }, res)) {
    return
  }
  // TODO parameter verification
  try {
    const wallet = await req.contract.at(address)
    const tx = await wallet.retire()
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

module.exports = router
