const ds = require('./datastore').client()
const appConfig = require('../../config')
const _ = require('lodash')

const mergeNonEmpty = (a, b) => {
  return _.mergeWith(a, b, (original, newValue) => {
    if (_.isUndefined(newValue) || _.isNull(newValue) || _.isNaN(newValue)) {
      return original
    }
    return undefined
  })
}

const GenericBuilder = (inKind) => {
  const kind = appConfig.debug ? `${inKind}_dev` : `${inKind}`
  const get = async (id) => {
    if (!id) {
      return Promise.resolve(null)
    }
    const key = ds.key([kind, id])
    return new Promise((resolve, reject) => {
      ds.get(key, async (err, project) => {
        if (err) {
          return reject(err)
        }
        if (!project) {
          return resolve(null)
        }

        return resolve(project)
      })
    })
  }
  const find = async (...predicates) => {
    let query = ds.createQuery(kind)
    predicates.filter(e => e).forEach(p => {
      if (_.isArray(p)) {
        const [ field, value ] = p
        query = query.filter(field, value)
      } else {
        const { field, operator, value } = p
        if (operator) {
          query = query.filter(field, operator, value)
        } else {
          query = query.filter(field, value)
        }
      }
    })
    return new Promise((resolve, reject) => {
      ds.runQuery(query, (err, entities) => {
        if (err) {
          return reject(err)
        }
        resolve(entities.map(u => _.omit(u, [ds.KEY])))
      })
    })
  }
  const add = async (id, details) => {
    const entry = await get(id)
    if (entry) {
      throw new Error('already exists')
    }
    const timestamp = Date.now()
    const key = ds.key([kind, id])
    const data = {
      creationTime: timestamp,
      timeUpdated: timestamp,
      id,
      ...details
    }
    return new Promise((resolve, reject) => {
      ds.insert({ key, data }, err => err ? reject(err) : resolve(data))
    })
  }
  const batchAddEntities = async (entities) => {
    const [items] = await ds.get(entities.map(e => e.key))
    if (items && items.length > 0) {
      throw new Error('Entities already exist')
    }
    return new Promise((resolve, reject) => {
      ds.insert(entities, err => err ? reject(err) : resolve(entities))
    })
  }
  const batchDelete = async (ids) => {
    const keys = ids.map(id => ds.key([kind, id]))
    return new Promise((resolve, reject) => {
      ds.delete(keys, err => err ? reject(err) : resolve(ids))
    })
  }
  const batchGet = async (ids) => {
    if (!ids || !ids.length) {
      return Promise.resolve(null)
    }
    const keys = ids.map(id => ds.key([kind, id]))
    return new Promise((resolve, reject) => {
      ds.get(keys, async (err, items) => {
        if (err) {
          return reject(err)
        }
        const filtered = items.map(u => _.omit(u, [ds.KEY]))
        return resolve(filtered)
      })
    })
  }
  const list = async ({ order, start, limit, filters }) => {
    let query = ds.createQuery(kind)

    if (order && order.property) {
      query = query.order(order.property, _.pick(order, ['descending']))
    }
    query = query.offset(start).limit(limit)

    if (filters) {
      filters.forEach(filter => {
        query = query.filter(filter.key, filter.operator || '=', filter.value)
      })
    }

    return new Promise((resolve, reject) => {
      ds.runQuery(query, (err, response) => {
        // console.log(err, response);
        if (err) {
          return reject(err)
        }
        // const rr = response.map(r => Object.assign({}, r, {"_key": r[ds.KEY]}));
        const rr = response.map(u => _.omit(u, [ds.KEY]))
        resolve(rr)
      })
    })
  }

  const update = async (id, details, override) => {
    const install = await get(id)
    if (!install) {
      return null
    }
    let newData = override ? details : mergeNonEmpty(install, details)
    newData = _.omit(newData, [ds.KEY])
    newData = _.assign({}, newData, { timeUpdated: Date.now() })
    const key = install[ds.KEY]
    return new Promise(async (resolve, reject) => {
      ds.update({ key, data: newData }, err => err ? reject(err) : resolve(newData))
    })
  }
  const remove = async (id) => {
    const install = await get(id)
    if (!install) {
      return null
    }
    const key = install[ds.KEY]
    return new Promise(async (resolve, reject) => {
      ds.delete(key, err => err ? reject(err) : resolve(install))
    })
  }

  const upsert = async (id, details) => {
    const install = await get(id)
    if (install) {
      return update(id, details)
    } else {
      return add(id, details)
    }
  }
  const key = (id) => {
    return ds.key([kind, id])
  }

  return {
    get,
    list,
    find,
    add,
    update,
    remove,
    upsert,
    batchGet,
    batchAddEntities,
    batchDelete,
    key

  }
}

module.exports = { GenericBuilder }
