const BN = require('bn.js')
const { parseTx, parseError } = require('./util')
const blockchain = require('../blockchain')
module.exports = {
  transfer: async ({ req, res, address, neighbors, index, eotp, dest, amount }) => {
    try {
      const executor = blockchain.prepareExecute(req.network)
      const wallet = await req.contract(address)
      const tx = await executor(txArgs => wallet.revealTransfer(neighbors, index, eotp, dest, new BN(amount), txArgs))
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
      const tx = await executor(txArgs => wallet.revealRecovery(neighbors, index, eotp, txArgs))
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
      const tx = await executor(txArgs => wallet.revealSetLastResortAddress(neighbors, index, eotp, lastResortAddress, txArgs))
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

      const tx = await executor(txArgs => wallet.revealTokenOperation(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data, txArgs))
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  }
}
