import config from './config'
import { message } from 'antd'
import storage from './storage'
import { setMessage } from '../../lib/api/message'
import { setStorage } from '../../lib/api/storage'
import { setConfig } from '../../lib/config/provider'
setMessage(message)
setStorage(storage)
setConfig(config)
