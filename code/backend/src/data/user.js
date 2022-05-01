const { v1: uuid } = require('uuid')
const config = require('../../config')
const ONEUtil = require('../../../lib/util')
const { GenericBuilder } = require('./generic')
const UserPrototype = GenericBuilder('user')
const User = ({
  ...UserPrototype,
  addNew: async ({ id, username, email, phone, password }) => {
    id = id || uuid()
    const [u] = await UserPrototype.find(['username', username])
    if (u) {
      return false
    }
    const passwordHash = ONEUtil.hexView(ONEUtil.keccak(`${password}|${config.secret}`))

    const details = {
      username,
      email,
      passwordHash,
      phone,
    }
    return UserPrototype.add(id, details)
  },
  verify: async ({ username, password }) => {
    if (!password || !username) {
      return false
    }
    const passwordHash = ONEUtil.hexView(ONEUtil.keccak(`${password}|${config.secret}`))
    const [u] = await UserPrototype.find(['username', username], ['passwordHash', passwordHash])
    if (!u || (u.passwordHash !== passwordHash) || (u.username !== username)) {
      return false
    }
    return u
  },
  verifyByEmail: async ({ email, password }) => {
    if (!password || !email) {
      return false
    }
    const passwordHash = ONEUtil.hexView(ONEUtil.keccak(`${password}|${config.secret}`))
    const users = await UserPrototype.find(['email', email], ['passwordHash', passwordHash])
    if (!(users.length > 0)) {
      return false
    }
    const malformedUsers = users.filter(u => u.passwordHash !== passwordHash || u.email !== email)
    if (malformedUsers.length > 0) {
      return false
    }
    return users
  }
})

module.exports = { User }
