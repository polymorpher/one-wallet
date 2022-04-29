const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { Logger } = require('../logger')
const { body, validationResult } = require('express-validator')
const { User } = require('../src/data/user')
const rateLimit = require('express-rate-limit')
const config = require('../config')
const Storage = require('../src/data/storage').client()
const Multer = require('multer')
const path = require('path')
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // no larger than 5mb, you can change as needed.
  },
})

const bucket = Storage.bucket(config.storage.bucket)

router.post('/upload', multer.single('file'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.')
    return
  }
  const { email, username, password } = req.body
  const u = await User.verify({ username, password })
  if (!u) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'username/password not found' })
  }
  if (u.email !== email) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'email not found' })
  }
  const blob = bucket.file(`${email}:${username}.backup`)
  const blobStream = blob.createWriteStream()
  blobStream.on('error', err => next(err))
  blobStream.on('finish', () => res.json({ success: true }))
  blobStream.end(req.file.buffer)
})

router.post('/download', async (req, res) => {
  const { username, password } = req.body
  const u = await User.verify({ username, password })
  if (!u) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'username/password not found' })
  }
})

module.exports = router
