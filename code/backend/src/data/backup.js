const { GenericBuilder } = require('./generic')
const BackupPrototype = GenericBuilder('backup')
const Backup = ({
  ...BackupPrototype,
  addNew: async ({ address, username, email, isPublic, root }) => {
    address = address?.toLowerCase()
    if (!address) {
      return
    }

    const details = {
      username,
      email,
      root,
      isPublic: !!isPublic
    }
    return BackupPrototype.add(address, details)
  },
  hasDuplicate: async ({ address, root }) => {
    if (!address || !root) {
      return true
    }
    const u = await BackupPrototype.find(['address', address], ['root', root])
    if (u) {
      return true
    }
    return false
  },
  lookupByEmail: async ({ email }) => {
    if (!email) {
      return []
    }
    return BackupPrototype.find(['email', email])
  },
  lookupByUsername: async ({ username }) => {
    if (!username) {
      return []
    }
    return BackupPrototype.find(['username', username])
  },
  checkAddressByEmail: async ({ email, address }) => {
    if (!email || !address) {
      return null
    }
    const [u] = await BackupPrototype.find(['email', email], ['address', address])
    if (!u) {
      return null
    }
    return u
  },
  checkAddressByUsername: async ({ username, address }) => {
    if (!username || !address) {
      return null
    }
    const [u] = await BackupPrototype.find(['username', username], ['address', address])
    if (!u) {
      return null
    }
    return u
  },
})

module.exports = { Backup }
