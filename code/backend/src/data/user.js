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
    // console.log(u)
    if (!u || (u.passwordHash !== passwordHash) || (u.username !== username)) {
      return false
    }
    return u
  }
})

module.exports = { User }
