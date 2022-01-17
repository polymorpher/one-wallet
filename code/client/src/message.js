import notification from 'antd/es/notification'
import { isMobile } from './util'
import clientConfig from './config'

const show = ({ content, duration, icon, type, ...config }) => {
  const m = isMobile()
  const n = type ? notification[type] : notification.open
  return n({
    message: content,
    duration: duration || 5,
    description: config.detail,
    icon,
    placement: m ? 'bottomRight' : 'topLeft',
    ...config
  })
}

const message = {
  success: (content, duration, config) => {
    return show({ content, duration, type: 'success', ...config })
  },
  error: (content, duration, config) => {
    return show({ content, duration, type: 'error', ...config })
  },
  info: (content, duration, config) => {
    return show({ content, duration, type: 'info', ...config })
  },
  warning: (content, duration, config) => {
    return show({ content, duration, type: 'warning', ...config })
  },
  debug: (content, duration, config) => {
    if (!clientConfig.debug) {
      return
    }
    console.log('[DEBUG]', content)
    return show({ content, duration, type: 'info', ...config })
  }
}

export default message
