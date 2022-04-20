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

  buildQuery: ({ before, after, query }) => {
    let q
    if (before && after) {
      q = { range: { time: { lte: before, gte: after } } }
    } else if (after) {
      q = { range: { time: { lte: after } } }
    } else if (before) {
      q = { range: { time: { lte: before } } }
    }
    if (query) {
      q = { bool: { must: q ? [query, q] : [query] } }
    }
    return q
  },

  count: async ({ index, before, after, query }) => {
    if (!client) return
    const body = { index, query: Persist.buildQuery({ before, after, query }) }
    const res = await client.count(body)
    return res?.count
  },

  stats: async ({ index, field, before, after, query }) => {
    if (!client) return
    const body = {
      index,
      query: Persist.buildQuery({ before, after, query }),
      size: 0,
      aggs: {
        percentile: {
          percentiles: {
            field
          }
        },
        average: {
          avg: {
            field
          }
        }
      }
    }
    const { aggregations: { percentile, average } } = await client.search(body)
    return { percentile: percentile.values, average: average.value }
  },

  recent: async ({ index, before, after, query, limit }) => {
    if (!client) return
    const body = { index, query: Persist.buildQuery({ before, after, query }), }

    if (limit) {
      body.size = limit
    }
    body.sort = 'time:desc'
    const res = await client.search(body)
    return res?.hits?.hits
  }

}
module.exports = { Persist }
