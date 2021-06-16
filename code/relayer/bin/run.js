#!/usr/bin/env node
const apps = require('../app')
const httpsServer = apps.httpsServer
const httpServer = apps.httpServer
console.log('Starting web server...')

httpsServer.listen(process.env.HTTPS_PORT || 8443, () => {
  const addr = httpsServer.address()
  console.log(`HTTPS server listening on port ${addr.port} at ${addr.address}`)
})

httpServer.listen(process.env.PORT || 3001, () => {
  const addr = httpServer.address()
  console.log(`HTTP server listening on port ${addr.port} at ${addr.address}`)
})
