const Datastore = require('@google-cloud/datastore').Datastore
const spawn = require('child_process').spawn
const config = require('../../config')

const dsArgs = `beta emulators datastore start --host-port=127.0.0.1:${config.datastore.mockPort}`.split(' ')

let client, server

module.exports = {
  mock () {
    if (!server) {
      server = spawn('gcloud', dsArgs)
      const f = data => {
        // console.log(data.toString());
        if (data.includes('Dev App Server is now running')) {
          console.log('Mock DS started!')
        }
      }
      server.stdout.on('data', f)
      server.stderr.on('data', f)
      server.on('close', data => console.log('Mock DS is shutting down. If this is unintended please run cmd manually to debug'))
      server.on('error', err => console.log(`Mock DS error: ${err}`))
      process.on('exit', module.exports.shut)
      process.on('uncaughtException', err => {
        console.error(`UncaughtException [${err}].`)
        module.exports.shut()
      })
    }
  },

  shut () {
    if (!server) return
    process.kill(-server.pid)
    server = null
  },

  client () {
    if (client) {
      return client
    }
    const clientConf = {
      projectId: config.datastore.cred['project_id'],
      credentials: config.datastore.cred,
      namespace: config.datastore.namespace
    }

    if (config.datastore.mock) {
      this.mock()
      clientConf.apiEndpoint = `127.0.0.1:${config.datastore.mockPort}`
      clientConf.projectId = 'mock'
    }
    console.log(`constructing datastore client: projectId=${clientConf.projectId}, namespace=${clientConf.namespace}, apiEndPoint=${clientConf.apiEndpoint || 'GCP'}`)
    client = new Datastore(clientConf)
    return client
  }
}
