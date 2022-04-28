const express = require('express')
const router = express.Router()
const { StatusCodes } = require('http-status-codes')
const { Logger } = require('../logger')
const { body, validationResult } = require('express-validator')
const { User } = require('../src/data/user')
const rateLimit = require('express-rate-limit')
const config = require('../config')
const Multer = require('multer')
const multer = Multer({
  storage: Multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // no larger than 5mb, you can change as needed.
  },
})


module.exports = router
