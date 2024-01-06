const { Storage: GCPStorage } = require('@google-cloud/storage')
const config = require('../../config')

let _storage = null

const Storage = {
  client: () => {
    if (_storage) {
      return _storage
    }
    // if (config.solo) {
    //   // TODO: mock it
    //   throw new Error('Not implemented')
    // }
    // TODO: separate buckets for dev
    _storage = new GCPStorage({
      projectId: config.storage.projectId,
      credentials: config.storage.cred
    })
    return _storage
  }
}

module.exports = Storage
