const rateLimit = require('express-rate-limit')

const generalLimiter = (args) => rateLimit({
  windowMs: 1000 * 60,
  max: 6,
  keyGenerator: req => req.fingerprint?.hash || '',
  ...args,

})

const walletAddressLimiter = (args) => rateLimit({
  windowMs: 1000 * 60,
  keyGenerator: req => req.body.address || '',
  ...args,

})

const rootHashLimiter = args => rateLimit({
  windowMs: 1000 * 60,
  keyGenerator: req => req.body.root || '',
  ...args,
})

const globalLimiter = args => rateLimit({
  windowMs: 1000 * 60,
  keyGenerator: req => '',
  ...args,
})

module.exports = { generalLimiter, walletAddressLimiter, rootHashLimiter, globalLimiter }
