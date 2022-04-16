const config = require('../config')
const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { rpc } = require('../rpc')

router.get('/block', async (req, res) => {
  const network = req.header('X-NETWORK') || config.defaultNetwork
  if (!config.networks[network]) {
    return res.status(StatusCodes.BAD_REQUEST).json({ network, error: 'invalid network' })
  }
  const pall = Promise.all([
    rpc.latestHeader({ network, beacon: true }),
    rpc.latestHeader({ network, beacon: false })
  ])
  const timeout = new Promise((resolve) => setTimeout(() => resolve([null, null]), 1000))
  let blockDiff = null
  try {
    const [h1, h2] = await Promise.race([pall, timeout])
    blockDiff = parseInt(h1.blockNumber) - parseInt(h2.blockNumber)
  } catch (ex) {
    console.error(ex)
  }
  return res.json({
    blockDiff,
    timeDiff: blockDiff * config.networks[network].blockTime,
  })
})

module.exports = router
