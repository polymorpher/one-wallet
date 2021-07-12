import 'dotenv/config'
import baseConfig from '../../lib/config/common'
import { merge } from 'lodash'
import path from 'path'
const config = merge({}, baseConfig, {
  defaultStorePath: process.env.DEFAULT_STORE_PATH || path.join(process.cwd(), 'wallets'),
  defaults: {
  },
  debug: process.env.DEBUG,
})
export default config
