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
  },

  formatNumber: (number, maxPrecision) => {
    maxPrecision = maxPrecision || 5
    number = parseFloat(number)
    if (number < 10 ** (-maxPrecision)) {
      return '0'
    }
    const order = Math.ceil(Math.log10(Math.max(number, 1)))
    const digits = Math.max(0, maxPrecision - order)
    return number.toFixed(digits)
  }
}
