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
  download: async ({ email, username, password, encrypted }) => {
    const { data } = await backendBase.post('/backup/download', { email, username, password, encrypted }, { responseType: 'blob' })
    return data
  },
  downloadPublic: async ({ username }) => {
    const { data } = await backendBase.post('/backup/download-public', { username }, { responseType: 'blob' })
    return data
  },
  list: async ({ email, username, password }) => {
    const { data: { plain, encrypted } } = await backendBase.post('/backup/list', { email, username, password })
    return { plain, encrypted }
  }

}
module.exports = backendApis
