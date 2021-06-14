const _ = require('lodash')
const config = require('../config')
const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const blockchain = require('../blockchain')
router.use((req, res, next) => {
  const s = req.header('X-ONEWALLET-RELAYER-SECRET')
  if (s !== config.secret) {
    return res.status(StatusCodes.UNAUTHORIZED).json({ error: `Invalid secret: ${s}` })
  }
  const network = req.header('X-NETWORK')
  if (!network) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Must selected network in header X-NETWORK' })
  }
  if (!blockchain.getNetworks().includes(network)) {
    return res.status(StatusCodes.NOT_IMPLEMENTED).json({ error: `Unsupported network${network}` })
  }
  req.network = network
  req.contract = blockchain.getContract(network)
  req.provider = blockchain.getProvider(network)
  next()
})

router.post('/new', async (req, res) => {
  const { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit } = req.body
  if (config.debug || config.verbose) {
    console.log(`[/new] `, { root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit })
  }
  const params = [root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit]
  if (params.includes(undefined) || params.includes(null)) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'Some parameters are missing', params })
  }
  try {
    const wallet = await req.contract.new(root, height, interval, t0, lifespan, slotSize, lastResortAddress, dailyLimit)
    return res.json({ success: true, address: wallet.address })
  } catch (ex) {
    console.error(ex)
    return { error: ex.toString() }
  }
})

module.exports = router
