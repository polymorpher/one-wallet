const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { User } = require('../src/data/user')
const config = require('../config')
const Storage = require('../src/data/storage').client()
const Multer = require('multer')
const path = require('path')
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // no larger than 500mb, you can change as needed.
  },
})

const bucket = Storage.bucket(config.storage.bucket)

const authed = async (req, res, next) => {
  req.auth = req.auth || {}
  let { email, username, password } = req.body
  if (!username) {
    const users = await User.verifyByEmail({ email, password })
    if (!(users?.length > 0)) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'not found' })
    }
    req.auth.users = users
    req.auth.email = email
    req.auth.fromEmail = true
    return next()
  }
  const u = await User.verify({ username, password })
  if (!u) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'username/password not found' })
  }
  if (email && (u.email !== email)) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'email not matching' })
  }
  req.auth.users = [u]
  req.auth.email = u.email
  next()
}

router.post('/upload', authed, multer.single('file'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.')
    return
  }
  const { encrypted } = req.body
  const [{ email, username }] = req.auth.users
  const publicSuffix = encrypted ? ':public' : ''
  const blob = bucket.file(`${email}:${username}${publicSuffix}.backup`)
  const s = blob.createWriteStream()
  s.on('error', err => next(err))
  s.on('finish', () => res.json({ success: true }))
  s.end(req.file.buffer)
})

const streamDownload = (filename, res) => {
  const s = bucket.file(filename).createReadStream()
  s.on('error', error => {
    console.error(error)
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ error: 'internal' })
  })
  s.on('end', () => res.end())
  s.pipe(res)
}

router.post('/download', authed, async (req, res) => {
  const { encrypted } = req.body
  const [{ email, username }] = req.auth.users
  const publicSuffix = encrypted ? ':public' : ''
  const filename = `${email}:${username}${publicSuffix}.backup`
  streamDownload(filename, res)
})

router.post('/download-public', async (req, res) => {
  const { username } = req.body
  const [u] = await User.find(['username', username])
  if (!u) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'user does not exist', username })
  }
  const filename = `${u.email}:${username}:public.backup`
  const [exists] = await bucket.file(filename).exists()
  if (!exists) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'backup does not exist', username })
  }
  streamDownload(filename, res)
})

router.post('/list', authed, async (req, res) => {
  const prefix = req.auth.email
  const [files] = await bucket.getFiles({ prefix })
  const usernameMap = Object.fromEntries(req.auth.users.map(u => [u.username, true]))
  const parsedFiles = files.map(e => {
    const ext = path.extname(e.name)
    const base = path.basename(e.name, ext)
    const [email, username, encrypted] = base.split(':')
    return { email, username, encrypted, file: e }
  })
  const plain = parsedFiles.filter(e => usernameMap[e.username] && !e.encrypted)
  const encrypted = parsedFiles.filter(e => usernameMap[e.username] && e.encrypted)
  return res.json({
    plain: plain.map(e => e.username),
    encrypted: encrypted.map(e => e.username),
  })
})

module.exports = router
