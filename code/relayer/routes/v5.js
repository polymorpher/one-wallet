const BN = require('bn.js')
const { parseTx, parseError } = require('./util')
const blockchain = require('../blockchain')
module.exports = {
  transfer: async ({ req, res, address, neighbors, index, eotp, dest, amount }) => {
    try {
      const executor = blockchain.prepareExecute(req.network)
      const wallet = await req.contract(address)
      const tx = await executor(nonce => wallet.revealTransfer(neighbors, index, eotp, dest, new BN(amount), { nonce }))
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  recover: async ({ req, res, address, neighbors, index, eotp }) => {
    try {
      const executor = blockchain.prepareExecute(req.network)
      const wallet = await req.contract(address)
      const tx = await executor(nonce => wallet.revealRecovery(neighbors, index, eotp, { nonce }))
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  setRecoveryAddress: async ({ req, res, address, neighbors, index, eotp, lastResortAddress }) => {
    try {
      const executor = blockchain.prepareExecute(req.network)
      const wallet = await req.contract(address)
      const tx = await executor(nonce => wallet.revealSetLastResortAddress(neighbors, index, eotp, lastResortAddress, { nonce }))
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  tokenOperation: async ({ req, res, address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data }) => {
    try {
      const executor = blockchain.prepareExecute(req.network)
      const wallet = await req.contract(address)

      const tx = await executor(nonce => wallet.revealTokenOperation(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data, { nonce }))
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  }
}
