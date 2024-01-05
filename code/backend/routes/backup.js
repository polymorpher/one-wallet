const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { User } = require('../src/data/user')
const config = require('../config')
const Storage = require('../src/data/storage').client()
const Multer = require('multer')
const path = require('path')
const { Backup } = require('../src/data/backup')
const { HttpStatusCode } = require('axios')
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // no larger than 500mb, you can change as needed.
  },
})

const bucket = Storage.bucket(config.storage.bucket)

const authed = (allowUsername = true, allowEmail = true) => async (req, res, next) => {
  req.auth = req.auth || {}
  let { email, username, password } = req.body
  email = email ?? req.header('X-ONEWALLET-EMAIL')
  username = username ?? req.header('X-ONEWALLET-USERNAME')
  password = password ?? req.header('X-ONEWALLET-PASSWORD')
  // console.log({ email, username, password })
  if (!username && allowEmail) {
    const users = await User.verifyByEmail({ email, password })
    if (!(users?.length > 0)) {
      return res.status(StatusCodes.NOT_FOUND).json({ error: 'not found by email', email })
    }
    req.auth.email = email
    req.auth.fromEmail = true
    return next()
  }
  if (!allowUsername) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'user not found by email' })
  }
  const u = await User.verifyByUsername({ username, password })
  if (!u) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'username/password not found' })
  }
  req.auth.user = u
  req.auth.email = u.email
  next()
}

router.post('/upload', authed(), multer.single('file'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).send('No file uploaded.')
    return
  }
  const address = req.header('X-ONEWALLET-ADDRESS')?.toLowerCase()
  if (!address) {
    res.status(400).send('No address provided.')
    return
  }
  const { isPublic } = req.body
  console.log({ isPublic, address, file: req.file })
  const email = req.auth.email
  const username = req.auth.fromEmail ? '' : req.auth.user.username
  const publicSuffix = isPublic ? ':public' : ''
  const blob = bucket.file(`${email}:${address}${publicSuffix}.backup`)
  const s = blob.createWriteStream()
  await Backup.addNew({ address, username, email, isPublic })
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

router.post('/download', authed(), async (req, res) => {
  const address = req.body?.address?.toLowerCase()
  if (req.auth.fromEmail && !address) {
    res.status(400).send('Requires address when username is not provided')
    return
  }
  let backup
  if (req.auth.fromEmail) {
    const email = req.auth.email
    backup = await Backup.checkAddressByEmail({ email, address })
    if (!backup) {
      res.status(HttpStatusCode.Unauthorized).json({ error: 'address and email does not match', address, email })
      return
    }
  } else {
    const username = req.auth.user.username
    backup = await Backup.checkAddressByUsername({ username, address })
    if (!backup) {
      res.status(HttpStatusCode.Unauthorized).json({ error: 'address and username does not match', address, username })
      return
    }
  }
  const publicSuffix = backup.isPublic ? ':public' : ''
  const filename = `${backup.email}:${address}${publicSuffix}.backup`
  streamDownload(filename, res)
})

router.post('/download-public', async (req, res) => {
  const { address } = req.body
  const backup = await Backup.get(address?.toLowerCase())
  if (!backup || !backup?.isPublic) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'backup at address does not exist or is not public', address })
  }
  const filename = `${backup.email}:${backup.address}:public.backup`
  const [exists] = await bucket.file(filename).exists()
  if (!exists) {
    return res.status(StatusCodes.NOT_FOUND).json({ error: 'backup does not exist', address })
  }
  streamDownload(filename, res)
})

// list by email
router.post('/list-files', authed(false), async (req, res) => {
  const prefix = req.auth.email
  const [files] = await bucket.getFiles({ prefix })
  const parsedFiles = files.map(e => {
    const ext = path.extname(e.name)
    const base = path.basename(e.name, ext)
    const [email, address, isPublic] = base.split(':')
    return { email, address, isPublic, file: e }
  })
  const publicBackups = parsedFiles.filter(e => !e.isPublic)
  const privateBackups = parsedFiles.filter(e => e.isPublic)
  return res.json({
    publicBackups: publicBackups.map(e => e.address),
    privateBackups: privateBackups.map(e => e.address),
  })
})

router.post('/list-by-email', authed(false), async (req, res) => {
  const email = req.auth.email
  const backups = await Backup.lookupByEmail({ email })
  res.json({ backups })
})

router.post('/list-by-username', authed(true, false), async (req, res) => {
  const username = req.auth.user.username
  const backups = await Backup.lookupByEmail({ username })
  res.json({ backups })
})

router.post('/info', async (req, res) => {
  let address = req.body.address?.toLowerCase()
  if (!address) {
    return res.status(StatusCodes.BAD_REQUEST).json({ error: 'address is missing', address })
  }
  const backup = await Backup.get(address)
  const { timeUpdated, isPublic } = backup
  res.json({ timeUpdated, isPublic })
})

module.exports = router
