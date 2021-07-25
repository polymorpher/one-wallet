const { values, mapValues } = require('lodash')
const config = require('../config')
const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const blockchain = require('../blockchain')
const BN = require('bn.js')
const rateLimit = require('express-rate-limit')

const checkParams = (params, res) => {
  params = mapValues(params, e => e === undefined ? null : e)
  if (values(params).includes(undefined) || values(params).includes(null)) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: 'Some parameters are missing', params })
    return false
  }
  return true
}

const parseTx = (tx) => {
  const txId = tx?.tx
  const success = !!(txId)
  const stack = tx?.receipt?.stack || ''
  const nl = stack.indexOf('\n')
  const error = stack && (nl > 0 ? stack.slice(0, nl) : stack)
  return { success, txId, tx, error }
}

const REASON_GIVEN = 'Reason given: '
const parseError = (ex) => {
  let error = ex.toString()
  if (error && error.indexOf(REASON_GIVEN) > 0) {
    error = error.slice(error.indexOf(REASON_GIVEN) + REASON_GIVEN.length)
    return { success: false, code: StatusCodes.OK, error }
  }
  return { success: false, code: StatusCodes.INTERNAL_SERVER_ERROR, error }
}

const generalLimiter = (args) => rateLimit({
  windowMs: 1000 * 60,
  max: 6,
  keyGenerator: req => req.fingerprint?.hash || '',
  ...args,

})

const walletAddressLimiter = (args) => rateLimit({
  windowMs: 1000 * 60,
  keyGenerator: req => req.body.address || '',
  ...args,

})

const rootHashLimiter = args => rateLimit({
  windowMs: 1000 * 60,
  keyGenerator: req => req.body.root || '',
  ...args,
})

const globalLimiter = args => rateLimit({
  windowMs: 1000 * 60,
  keyGenerator: req => '',
  ...args,
})

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
  req.network = network
  // TODO: differentiate <v5 and >=v6 contracts
  req.contract = blockchain.getContract(network)
  req.provider = blockchain.getProvider(network)
  next()
})

// TODO: rate limiting + fingerprinting + delay with backoff

router.post('/new', rootHashLimiter({ max: 6 }), generalLimiter({ max: 1 }), globalLimiter({ max: 250 }), async (req, res) => {
  let { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit } = req.body
  // root is hex string, 32 bytes
  height = parseInt(height)
  interval = parseInt(interval)
  t0 = parseInt(t0)
  lifespan = parseInt(lifespan)
  slotSize = parseInt(slotSize)
  lastResortAddress = lastResortAddress || config.nullAddress
  // lastResortAddress is hex string, 20 bytes
  // dailyLimit is a BN in string form
  if (config.debug || config.verbose) {
    console.log(`[/new] `, { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit })
  }
  if (!checkParams({ root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit }, res)) {
    return
  }

  // TODO parameter verification
  try {
    const wallet = await req.contract.new(root, height, interval, t0, lifespan, slotSize, lastResortAddress, new BN(dailyLimit, 10))
    return res.json({ success: true, address: wallet.address })
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/commit', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { hash, address } = req.body
  if (config.debug || config.verbose) {
    console.log(`[/commit] `, { hash, address })
  }
  if (!hash || !address) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Hash or address is missing', params: { hash, address } })
  }
  if (hash.length !== 66) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'hash must be a hex string with length 64 starting with 0x (to represent 32 bytes)', hash })
  }
  try {
    const wallet = await req.contract.at(address)
    const tx = await wallet.commit(hash)
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/reveal', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data } = req.body
  if (!checkParams({ neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data }, res)) {
    return
  }
  // TODO parameter verification
  try {
    const wallet = await req.contract.at(address)
    const tx = await wallet.reveal(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data)
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/reveal/transfer', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, dest, amount, address } = req.body
  if (!checkParams({ neighbors, index, eotp, dest, amount, address }, res)) {
    return
  }
  // TODO parameter verification
  try {
    const wallet = await req.contract.at(address)
    const tx = await wallet.revealTransfer(neighbors, index, eotp, dest, new BN(amount, 10))
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/reveal/recovery', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, address } = req.body
  if (!checkParams({ neighbors, index, eotp, address }, res)) {
    return
  }
  // TODO parameter verification
  try {
    const wallet = await req.contract.at(address)
    const tx = await wallet.revealRecovery(neighbors, index, eotp)
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/reveal/set-recovery-address', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, address, lastResortAddress } = req.body
  if (!checkParams({ neighbors, index, eotp, address, lastResortAddress }, res)) {
    return
  }
  // TODO parameter verification
  try {
    const wallet = await req.contract.at(address)
    const tx = await wallet.revealSetLastResortAddress(neighbors, index, eotp, lastResortAddress)
    return res.json(parseTx(tx))
  } catch (ex) {
    console.error(ex)
    const { code, error, success } = parseError(ex)
    return res.status(code).json({ error, success })
  }
})

router.post('/reveal/token', generalLimiter({ max: 30 }), walletAddressLimiter({ max: 30 }), async (req, res) => {
  let { neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data } = req.body
  if (!checkParams({ neighbors, index, eotp, address, operationType, tokenType, contractAddress, tokenId, dest, amount, data }, res)) {
    return
  }
  // TODO parameter verification
  try {
    const wallet = await req.contract.at(address)
    const tx = await wallet.revealTokenOperation(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data)
    return res.json(parseTx(tx))
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
