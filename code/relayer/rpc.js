const axios = require('axios')
const config = require('./config')
const BN = require('bn.js')
const rpc = {
  getNonce: async ({ address, network, qualifier = 'latest' }) => {
    // console.log('nonce from', config.networks[network].url, address)
    const { data: { result } } = await axios.post(config.networks[network].url, {
      'jsonrpc': '2.0',
      'method': 'eth_getTransactionCount', // eth_getAccountNonce also works but is nonstandard (Harmony only)
      'params': [
        address,
        qualifier
      ],
      'id': 1
    })
    const bn = new BN(result.slice(2), 16)
    return bn.toNumber()
  }
}

module.exports = { rpc }
