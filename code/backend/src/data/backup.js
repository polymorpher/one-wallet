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
    const u = await BackupPrototype.get(address)
    if (!u) {
      return false
    }
    if (u.root === root) {
      return true
    }
    return false
  },
  lookupByEmail: async ({ email }) => {
    if (!email) {
      return []
    }
    const backups = await BackupPrototype.find(['email', email])
    return backups.map(b => ({ ...b, address: b.id }))
  },
  lookupByUsername: async ({ username }) => {
    if (!username) {
      return []
    }
    const backups = await BackupPrototype.find(['username', username])
    return backups.map(b => ({ ...b, address: b.id }))
  },
  checkAddressByEmail: async ({ email, address }) => {
    if (!email || !address) {
      return null
    }
    const u = await BackupPrototype.get(address)
    if (!u) {
      return null
    }
    if (u.email !== email) {
      return null
    }
    return u
  },
  checkAddressByUsername: async ({ username, address }) => {
    if (!username || !address) {
      return null
    }
    const u = await BackupPrototype.get(address)
    if (!u) {
      return null
    }
    if (u.username !== username) {
      return null
    }
    return u
  },
})

module.exports = { Backup }
