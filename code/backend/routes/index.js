const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { Logger } = require('../logger')
const { body, validationResult } = require('express-validator')
const { User } = require('../src/data/user')
const rateLimit = require('express-rate-limit')
const config = require('../config')

const limiter = (args) => rateLimit({
  windowMs: 1000 * 60,
  max: 60,
  keyGenerator: req => req.fingerprint?.hash || '',
  ...args,

})

router.get('/health', async (req, res) => {
  Logger.log('[/health]', req.fingerprint)
  res.send('OK').end()
})

router.post('/signup',
  limiter(),
  body('username').isLength({ min: 4, max: 256 }).trim().matches(/[a-z0-9_-]+/),
  body('email').isEmail().toLowerCase().matches(/[a-z0-9_\-+@.]+/).trim().escape(),
  body('password').isLength({ min: 8, max: 64 }),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }
    const { username, password, email } = req.body
    try {
      const u = await User.addNew({ username, password, email })
      if (!u) {
        return res.json({ success: false, error: 'user already exists' })
      }
      Logger.log(`[/signup]`, u)
      res.json({ success: true, user: { username, email } })
    } catch (ex) {
      console.error(ex)
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'internal' })
    }
  })

router.post('/login', limiter(), async (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'need username,password' })
  }
  try {
    const u = await User.verify({ username, password })
    if (!u) {
      return res.status(StatusCodes.NOT_FOUND).send()
    }
    const { email } = u
    return res.json({ success: true, user: { email, username } })
  } catch (ex) {
    console.error(ex)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'internal' })
  }
})

module.exports = router
