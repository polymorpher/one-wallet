const _config = require('./common')
let config = _config
const setConfig = (newConfig) => {
  config = newConfig
}
const getConfig = () => config

module.exports = {
  setConfig,
  getConfig
}
