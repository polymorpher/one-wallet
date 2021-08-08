const { StatusCodes } = require('http-status-codes')
const { values, mapValues } = require('lodash')

const parseTx = (tx) => {
  const txId = tx?.tx
  const success = !!(txId)
  const stack = tx?.receipt?.stack || ''
  const nl = stack.indexOf('\n')
  const error = stack && (nl > 0 ? stack.slice(0, nl) : stack)
  return { success, txId, tx, error }
}

const REASON_GIVEN = 'Reason given: '
const parseError = (ex) => {
  let error = ex.toString()
  if (error && error.indexOf(REASON_GIVEN) > 0) {
    error = error.slice(error.indexOf(REASON_GIVEN) + REASON_GIVEN.length)
    return { success: false, code: StatusCodes.OK, error }
  }
  return { success: false, code: StatusCodes.INTERNAL_SERVER_ERROR, error }
}

const checkParams = (params, res) => {
  params = mapValues(params, e => e === undefined ? null : e)
  if (values(params).includes(undefined) || values(params).includes(null)) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: 'Some parameters are missing', params })
    return false
  }
  return true
}

module.exports = {
  checkParams,
  parseTx,
  parseError
}
