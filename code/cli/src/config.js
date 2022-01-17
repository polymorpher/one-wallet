import 'dotenv/config'
import baseConfig from '../../lib/config/common'
import mergeAll from 'lodash/fp/mergeAll'
import path from 'path'
const config = mergeAll({}, baseConfig, {
  defaultStorePath: process.env.DEFAULT_STORE_PATH || path.join(process.cwd(), 'wallets'),
  defaults: {
  },
  debug: process.env.DEBUG,
})
export default config
