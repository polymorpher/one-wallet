import { notification } from 'antd'
import { isMobile } from './util'

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
  }
}

export default message
