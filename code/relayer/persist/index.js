const { Client } = require('@elastic/elasticsearch')
const config = require('../config')
const { Logger } = require('../logger')

let client
const Persist = {
  States: {
    SUCCESS: 'success',
    ERROR: 'error',
    FAILURE: 'failure',
  },
  init: () => {
    if (!config.es.node || !config.es.enabled) {
      Logger.log('ES is not enabled or node is empty')
      return
    }
    client = new Client({
      node: config.es.node,
      auth: { username: config.es.username, password: config.es.password },
      tls: {
        rejectUnauthorized: false
      }
    })
    return client
  },
  add: ({ index, ...props }) => {
    if (!client) return
    return client.index({
      index,
      document: {
        time: Date.now(),
        ...props
      }
    })
  },
  client: () => client,

  count: async ({ index, before, after }) => {
    if (!client) return
    const body = { index }
    if (before && after) {
      body.query = { range: { time: { lte: before, gte: after } } }
    } else if (after) {
      body.query = { range: { time: { lte: after } } }
    } else if (before) {
      body.query = { range: { time: { lte: before } } }
    }
    const res = await client.count(body)
    return res?.count
  },

  recent: async ({ index, after, limit }) => {
    if (!client) return
    const body = { index }
    if (after) {
      body.query = { range: { time: { after } } }
    }
    if (limit) {
      body.size = limit
    }
    body.sort = 'time:desc'
    const res = await client.search(body)
    return res?.hits?.hits
  }

}
module.exports = { Persist }
