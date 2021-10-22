import baseConfig from '../../lib/config/common'
import { merge } from 'lodash'
const config = merge({}, baseConfig, {
  priceRefreshInterval: 60 * 1000,
  defaults: {
    sentryDsn: process.env.SENTRY_DSN
  },
  debug: process.env.DEBUG,
  ipfs: {
    gateway: process.env.IPFS_GATEWAY || 'https://ipfs.infura.io/ipfs/{{hash}}'
    // gateway: process.env.IPFS_GATEWAY || 'https://dweb.link/ipfs/{{hash}}'
    // gateway: process.env.IPFS_GATEWAY || 'https://ipfs.io/ipfs/{{hash}}'
    // gateway: process.env.IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/{{hash}}'
    // gateway: process.env.IPFS_GATEWAY || 'https://1wallet.mypinata.cloud/ipfs/{{hash}}'
  },
  rootUrl: process.env.ROOT_URL || 'https://1wallet.crazy.one',
  transak:{
    staging: {
      apiKey: '50f1c430-7807-4760-a337-57583de69f73',
      defaultCurrency: 'AUD',
      environment: 'STAGING'
    },
    production: {
      apiKey: '28c4ba82-b701-4d05-a44c-1466fbb99265',
      defaultCurrency: 'AUD',
      environment: 'PRODUCTION'
    }
  }
})

export default config
