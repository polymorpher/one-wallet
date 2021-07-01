import { message } from 'antd'

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
}

export const handleAddressError = (err) => {
  if (!err) {
    return
  }
  console.trace(err)
  message.error('Invalid address. Please check and try again.')
}
