const { isString, pick } = require('lodash')
const UAParser = require('ua-parser-js')
const getIP = req => {
  return { ip: isString(req) ? req : (req.headers['x-forwarded-for'] || req.connection.remoteAddress) }
}
const undefinedReg = /undefined/gi
const getUA = req => {
  const ua = isString(req) ? UAParser(req) : UAParser(req.get('User-Agent'))
  const parsed = {
    ua: ua.ua,
    browser: `${ua.browser.name}`.replace(undefinedReg, '').trim(),
    browserVersion: `${ua.browser.version}`.replace(undefinedReg, '').trim(),
    engine: `${ua.engine.name}`.replace(undefinedReg, '').trim(),
    engineVersion: `${ua.engine.version}`.replace(undefinedReg, '').trim(),
    os: `${ua.os.name}`.replace(undefinedReg, '').trim(),
    osVersion: `${ua.os.version}`.replace(undefinedReg, '').trim(),
  }
  const keys = Object.keys(parsed).filter(e => parsed[e])
  return pick(parsed, keys)
}

module.exports = { getUA, getIP }
