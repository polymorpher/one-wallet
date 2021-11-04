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
  transak: {
    staging: {
      apiKey: '50f1c430-7807-4760-a337-57583de69f73',
      defaultCurrency: 'NZD',
      environment: 'STAGING'
    },
    production: {
      apiKey: '28c4ba82-b701-4d05-a44c-1466fbb99265',
      defaultCurrency: 'NZD',
      environment: 'PRODUCTION'
    },
    currencies: ['NZD', 'AUD', 'EUR', 'GBP', 'CHF', 'SEK', 'PLN', 'NOK', 'MXN', 'DKK', 'CAD', 'ARS', 'BRL', 'CLP', 'CRC', 'DOP', 'IDR', 'ILS', 'JPY', 'KRW', 'MYR', 'PYG', 'PEN', 'PHP', 'SGD', 'ZAR', 'TZS', 'THB', 'TRY', 'BBD', 'BMD', 'BGN', 'HRK', 'CZK', 'FKP', 'FJD', 'GIP', 'HUF', 'ISK', 'JMD', 'KES', 'MDL', 'RON'],
    countries: [
      'NZ', 'AU', 'EU', 'GB', 'CH', 'SE',
      'PL', 'NO', 'MX', 'DK', 'CA', 'AR',
      'BR', 'CL', 'CR', 'DO', 'ID', 'IL',
      'JP', 'KR', 'MY', 'PY', 'PE', 'PH',
      'SG', 'ZA', 'TZ', 'TH', 'TR', 'BB',
      'BM', 'BG', 'HR', 'CZ', 'FK', 'FJ',
      'GI', 'HU', 'IS', 'JM', 'KE', 'MD',
      'RO'
    ]

  }
})

export default config
