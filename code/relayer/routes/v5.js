const BN = require('bn.js')
const { parseTx, parseError } = require('./util')
const blockchain = require('../blockchain')
module.exports = {
  transfer: async ({ req, res, address, neighbors, index, eotp, dest, amount }) => {
    try {
      const nonce = blockchain.incrementNonce(req.network)
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealTransfer(neighbors, index, eotp, dest, new BN(amount, 10), { nonce })
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  recover: async ({ req, res, address, neighbors, index, eotp }) => {
    try {
      const nonce = blockchain.incrementNonce(req.network)
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealRecovery(neighbors, index, eotp, { nonce })
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  setRecoveryAddress: async ({ req, res, address, neighbors, index, eotp, lastResortAddress }) => {
    try {
      const nonce = blockchain.incrementNonce(req.network)
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealSetLastResortAddress(neighbors, index, eotp, lastResortAddress, { nonce })
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  },
  tokenOperation: async ({ req, res, address, neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data }) => {
    try {
      const nonce = blockchain.incrementNonce(req.network)
      const wallet = await req.contract.at(address)
      const tx = await wallet.revealTokenOperation(neighbors, index, eotp, operationType, tokenType, contractAddress, tokenId, dest, amount, data, { nonce })
      return res.json(parseTx(tx))
    } catch (ex) {
      console.error(ex)
      const { code, error, success } = parseError(ex)
      return res.status(code).json({ error, success })
    }
  }
}
