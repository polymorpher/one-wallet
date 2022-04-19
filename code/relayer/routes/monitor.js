const config = require('../config')
const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { rpc } = require('../rpc')
const { Persist } = require('../persist/index')
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

router.get('/stats', async (req, res) => {
  const timeout = new Promise((resolve) => setTimeout(() => resolve([null, null, null, null]), 1000))
  const pAll = Promise.all([
    Persist.count({ index: 'new-requests' }),
    Persist.count({ index: 'commit-requests' }),
    Persist.count({ index: 'reveal-requests' }),
    Persist.count({ index: 'other-requests' }),
  ])
  const [numNewRequests, numCommitRequests, numRevealRequests, numOtherRequests] = await Promise.race([timeout, pAll])

  const timeout2 = new Promise((resolve) => setTimeout(() => resolve([null, null, null, null]), 1000))
  const pAll2 = Promise.all([
    Persist.count({ index: 'new-requests', query: { term: { state: Persist.States.SUCCESS } } }),
    Persist.count({ index: 'commit-requests', query: { term: { state: Persist.States.SUCCESS } } }),
    Persist.count({ index: 'reveal-requests', query: { term: { state: Persist.States.SUCCESS } } }),
    Persist.count({ index: 'other-requests', query: { term: { state: Persist.States.SUCCESS } } }),
  ])

  const [numNewRequestsSuccess, numCommitRequestsSuccess, numRevealRequestsSuccess, numOtherRequestsSuccess] = await Promise.race([timeout2, pAll2])

  const timeout3 = new Promise((resolve) => setTimeout(() => resolve([null, null, null, null]), 1000))
  const pAll3 = Promise.all([
    Persist.stats({ index: 'new-requests', field: 'responseTime', query: { term: { state: Persist.States.SUCCESS } } }),
    Persist.stats({ index: 'commit-requests', field: 'responseTime', query: { term: { state: Persist.States.SUCCESS } } }),
    Persist.stats({ index: 'reveal-requests', field: 'responseTime', query: { term: { state: Persist.States.SUCCESS } } }),
    Persist.stats({ index: 'other-requests', field: 'responseTime', query: { term: { state: Persist.States.SUCCESS } } }),
  ])

  const [newRequestsSuccessStats, commitRequestsSuccessStats, revealRequestsSuccessStats, otherRequestsSuccessStats] = await Promise.race([timeout3, pAll3])

  res.json({
    new: {
      num: numNewRequests,
      success: numNewRequestsSuccess,
      stats: newRequestsSuccessStats,
    },
    commit: {
      num: numCommitRequests,
      success: numCommitRequestsSuccess,
      stats: commitRequestsSuccessStats,
    },
    reveal: {
      num: numRevealRequests,
      success: numRevealRequestsSuccess,
      stats: revealRequestsSuccessStats,
    },
    other: {
      num: numOtherRequests,
      success: numOtherRequestsSuccess,
      stats: otherRequestsSuccessStats,
    }
  })
})

module.exports = router
