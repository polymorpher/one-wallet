import baseConfig from '../../lib/config/common'
import { merge } from 'lodash'
const config = merge({}, baseConfig, {
  priceRefreshInterval: 60 * 1000,
  defaults: {
    sentryDsn: process.env.SENTRY_DSN
  },
  debug: process.env.DEBUG,
  ipfs: {
    gateway: process.env.IPFS_GATEWAY || 'https://{{hash}}.ipfs.dweb.link'
  }
})

export default config
