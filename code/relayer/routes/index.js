const { values, mapValues } = require('lodash')
const config = require('../config')
const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const blockchain = require('../blockchain')
const BN = require('bn.js')

router.use((req, res, next) => {
  const s = req.header('X-ONEWALLET-RELAYER-SECRET')
  if (s !== config.secret) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: `Invalid X-ONEWALLET-RELAYER-SECRET: ${s}` })
  }
  const network = req.header('X-NETWORK')
  if (!network) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Must selected network in header X-NETWORK' })
  }
  if (!blockchain.getNetworks().includes(network)) {
    return res.status(StatusCodes.NOT_IMPLEMENTED).json({ error: `Unsupported network ${network}` })
  }
  req.network = network
  req.contract = blockchain.getContract(network)
  req.provider = blockchain.getProvider(network)
  next()
})

router.post('/new', async (req, res) => {
  let { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit } = req.body
  // root is hex string, 32 bytes
  height = parseInt(height)
  interval = parseInt(interval)
  t0 = parseInt(t0)
  lifespan = parseInt(lifespan)
  slotSize = parseInt(slotSize)
  // lastResortAddress is hex string, 20 bytes
  // dailyLimit is a BN in string form
  if (config.debug || config.verbose) {
    console.log(`[/new] `, { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit })
  }
  const params = mapValues({ root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit }, e => e === undefined ? null : e)

  if (values(params).includes(undefined) || values(params).includes(null)) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Some parameters are missing', params })
  }
  try {
    const wallet = await req.contract.new(root, height, interval, t0, lifespan, slotSize, lastResortAddress, new BN(dailyLimit, 10))
    return res.json({ success: true, address: wallet.address })
  } catch (ex) {
    console.error(ex)
    return { error: ex.toString() }
  }
})

module.exports = router
