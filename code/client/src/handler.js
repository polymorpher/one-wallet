import message from './message'
import * as Sentry from '@sentry/browser'

// For UI Error handling

export const handleAPIError = (ex) => {
  console.trace(ex)
  const error = ex.response?.data?.error || ex.toString()
  const code = ex.response?.data?.code
  if (code === 0) {
    message.error('Relayer password is incorrect')
  } else if (code === 1) {
    message.error('Network is invalid')
  } else {
    message.error(`Connection Error: ${error}`)
  }
  Sentry.captureException(ex)
}

export const handleAddressError = (err) => {
  if (!err) {
    return
  }
  console.trace(err)
  message.error('Invalid address. Please check and try again.')
}
