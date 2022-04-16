const axios = require('axios')
const config = require('./config')
const BN = require('bn.js')
const ONEUtil = require('../lib/util')

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
  },
  getCode: async ({ address, network, qualifier = 'latest' }) => {
    const { data: { result } } = await axios.post(config.networks[network].url, {
      'jsonrpc': '2.0',
      'method': 'eth_getCode',
      'params': [
        address,
        qualifier
      ],
      'id': 1
    })
    return ONEUtil.hexStringToBytes(result)
  },

  gasPrice: async ({ network }) => {
    const url = config.networks[network].url
    const { data: { result } } = await axios.post(url, {
      'jsonrpc': '2.0',
      'method': 'hmy_gasPrice', // eth_getAccountNonce also works but is nonstandard (Harmony only)
      'params': [],
      'id': 1
    })
    const bn = new BN(result.slice(2), 16)
    return bn.toNumber()
  },

  latestHeader: async ({ network, beacon = false }) => {
    const url = beacon ? config.networks[network].beacon : config.networks[network].url
    const { data: { result } } = await axios.post(url, {
      'jsonrpc': '2.0',
      'method': 'hmy_latestHeader', // eth_getAccountNonce also works but is nonstandard (Harmony only)
      'params': [],
      'id': 1
    })
    const bn = new BN(result.slice(2), 16)
    return bn.toNumber()
  },
}

module.exports = { rpc }
