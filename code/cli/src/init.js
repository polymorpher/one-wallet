import config from './config'
import storage from './storage'
import { setMessage } from '../../lib/api/message'
import { setStorage } from '../../lib/api/storage'
import { setConfig } from '../../lib/config/provider'
const message = () => ({
  error: (m) => console.error('[ERROR  ]', m),
  warning: (m) => console.log('[WARNING]', m),
  info: (m) => console.log('[INFO   ]', m),
  success: (m) => console.log('[SUCCESS]', m),
})
setConfig(config)
setMessage(message)
setStorage(storage)
