const BN = require('bn.js')
const { parseTx, parseError } = require('./util')

module.exports = {
  transfer: async ({ req, res, address, neighbors, index, eotp, dest, amount }) => {
    try {
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealTransfer(neighbors, index, eotp, dest, new BN(amount, 10))
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  recover: async ({ req, res, address, neighbors, index, eotp }) => {
    try {
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealRecovery(neighbors, index, eotp)
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  setRecoveryAddress: async ({ req, res, address, neighbors, index, eotp, lastResortAddress }) => {
    try {
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealSetLastResortAddress(neighbors, index, eotp, lastResortAddress)
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  tokenOperation: async ({ req, res, address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data }) => {
    try {
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealTokenOperation(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data)
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  }
}
