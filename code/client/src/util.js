import { message } from 'antd'

export default {
  handleError: (ex) => {
    console.trace(ex)
    const error = ex.response?.data?.error || ex.toString()
    const code = ex.response?.data?.code
    if (code === 0) {
      message.error('Relayer password is incorrect')
    } else if (code === 1) {
      message.error('Network is invalid')
    } else {
      message.error(`Failed to create wallet on blockchain. Error: ${error}`)
    }
  }
}
