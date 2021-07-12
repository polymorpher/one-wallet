let storage
const setStorage = (newStorage) => {
  storage = newStorage
}
const getStorage = () => storage

module.exports = {
  setStorage,
  getStorage
}
