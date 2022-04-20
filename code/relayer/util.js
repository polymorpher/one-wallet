const { isString, pick } = require('lodash')
const UAParser = require('ua-parser-js')
const getIP = req => {
  let ip = isString(req) ? req : (req.headers['x-forwarded-for'] || req.connection.remoteAddress)
  ip = ip.replace('::ffff:', '')
  return { ip }
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
const getCoreObjects = cores => {
  return cores.map(core => {
    const [root, height, interval, t0, lifespan, slotSize] = core
    return { root, height, interval, t0, lifespan, slotSize }
  })
}

const getCoreArray = cores => {
  return cores.map(core => {
    if (core.length > 0) {
      return [...core]
    }
    const { root, height, interval, t0, lifespan, slotSize } = core
    return [ root, height, interval, t0, lifespan, slotSize ]
  })
}

const hasEmptyCoreRoot = cores => {
  return cores.map(e => e.length > 0 ? e[0] : e.root).filter(e => !e).length > 0
}

module.exports = { getUA, getIP, getCoreObjects, getCoreArray, hasEmptyCoreRoot }
