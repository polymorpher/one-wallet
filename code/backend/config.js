require('dotenv').config()
const DEBUG = process.env['RELAYER_DEBUG'] === 'true' || process.env['RELAYER_DEBUG'] === '1'
const config = {
  debug: DEBUG,
  dev: !(process.env.NODE_ENV === 'production'),
  verbose: process.env['VERBOSE'] === 'true' || process.env['VERBOSE'] === '1',
  https: {
    only: process.env['HTTPS_ONLY'] === 'true' || process.env['HTTPS_ONLY'] === '1',
    key: DEBUG ? './certs/test.key' : './certs/privkey.pem',
    cert: DEBUG ? './certs/test.cert' : './certs/fullchain.pem'
  },
  corsOrigins: process.env['CORS'],
  secret: process.env['SECRET'],
  datastore: {
    gceProjectId: process.env.GCP_PROJECT,
    cred: !process.env.GCP_CRED_PATH ? {} : require(process.env.GCP_CRED_PATH),
    mock: !process.env.GCP_CRED_PATH,
    mockPort: 9000,
    namespace: 'backend'
  },
}
module.exports = config
