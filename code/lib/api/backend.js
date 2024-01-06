const axios = require('axios')
const config = require('../config/provider').getConfig()

let backendBase = axios.create({
  baseURL: config.backend.url,
  timeout: 10000,
})

// currently, we require username (or email) and password to be present for every route behind auth-wall
const backendApis = {
  signup: async ({ username, password, email }) => {
    const { data: { success, user } } = await backendBase.post('/signup', { username, password, email })
    return { success, user }
  },
  login: async ({ username, password }) => {
    const { data: { success, user } } = await backendBase.post('/login', { username, password })
    return { success, user }
  },
  download: async ({ email, username, password, address, onDownloadProgress }) => {
    const { data } = await backendBase.post('/backup/download',
      { email, username, password, address },
      { responseType: 'blob', onDownloadProgress, timeout: 300000 })
    return data
  },
  downloadPublic: async ({ address, onDownloadProgress }) => {
    const { data } = await backendBase.post('/backup/download-public', { address },
      { responseType: 'blob', onDownloadProgress, timeout: 300000 })
    return data
  },
  listByEmail: async ({ email, password }) => {
    const { data } = await backendBase.post('/backup/list-by-email', { email, password })
    return data
  },
  listByUsername: async ({ username, password }) => {
    const { data } = await backendBase.post('/backup/list-by-username', { username, password })
    return data
  },
  info: async ({ address }) => {
    const { data: { exist, timeUpdated, isPublic, root } } = await backendBase.post('/backup/info', { address })
    return { exist, timeUpdated, isPublic, root }
  },
  // data should be FormData (native in browser, package form-data in node.js)
  upload: async ({ address, data, username, password, email, onUploadProgress }) => {
    return backendBase.post('/backup/upload', data, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...(username && { 'X-ONEWALLET-USERNAME': username }),
        ...(password && { 'X-ONEWALLET-PASSWORD': password }),
        ...(email && { 'X-ONEWALLET-EMAIL': email }),
        ...(address && { 'X-ONEWALLET-ADDRESS': address }),
      },
      onUploadProgress: onUploadProgress,
      timeout: 300000
    })
  },

}
module.exports = backendApis
