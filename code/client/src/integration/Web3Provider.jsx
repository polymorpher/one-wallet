import api from '../api'
import util from '../util'

const SimpleCommunicator = () => {
  const requests = {}
  const subscribers = {}
  const enqueueRequest = (request) => {
    requests[request.id] = request
    for (const callback of Object.values(subscribers)) {
      callback(request)
    }
  }
  const getAllRequests = () => {
    return requests
  }

  const completeRequest = async (id, error, result) => {
    const r = requests[id]
    if (!r) {
      throw new Error(`Request ${id} does not exist`)
    }
    await r.callback && r.callback(error, result)
    delete requests[r.id]
  }

  const subscribe = (callback) => {
    const id = Object.keys(subscribers).length + 1
    subscribers[id] = callback
    return id
  }

  const unsubscribe = (id) => {
    delete subscribers[id]
  }

  const getRequest = (id) => {
    return requests.get(id)
  }

  const getTopRequest = () => {
    const keys = Object.keys(requests)
    if (keys.length === 0) {
      return
    }
    let minId = keys[0]
    for (const k of Object.keys(requests)) {
      if (k < minId) {
        minId = k
      }
    }
    return requests[minId]
  }

  return {
    enqueueRequest,
    completeRequest,
    subscribe,
    unsubscribe,
    getTopRequest,
    getRequest,
    getAllRequests
  }
}

export const Web3ProviderCommunicator = SimpleCommunicator()
const commonSignatureCallback = (resolve, reject) => (error, result) => {
  if (error) {
    reject(error)
    return
  }
  const signature = 'signature' in result ? result.signature : undefined
  resolve(signature || '0x')
}
// see also https://eips.ethereum.org/EIPS/eip-1193
export const SimpleWeb3Provider = ({ onActiveModuleChange, address }) => {
  address = address?.toLowerCase()
  const send = async (method, params, id) => {
    console.log('web3Provider', { id, method, params })
    if (method === 'eth_accounts') {
      return [address]
    } else if (method === 'net_version' || method === 'eth_chainId') {
      const { chainId } = api.blockchain.getChainInfo()
      return chainId
    } else if (method === 'personal_sign') {
      const [message, requestedAddress] = params
      if (address !== requestedAddress?.toLowerCase()) {
        throw new Error('Requested address is not wallet address')
      }
      return new Promise((resolve, reject) => {
        const callback = commonSignatureCallback(resolve, reject)
        const request = { id, action: 'sign', message, address, callback }
        Web3ProviderCommunicator.enqueueRequest(request)
      })
    } else if (method === 'eth_sign') {
      const [requestedAddress, messageHash] = params
      if (address !== requestedAddress?.toLowerCase()) {
        throw new Error('Requested address is not wallet address')
      }
      return new Promise((resolve, reject) => {
        const callback = commonSignatureCallback(resolve, reject)
        const request = { id, action: 'signRaw', messageHash, address, callback }
        Web3ProviderCommunicator.enqueueRequest(request)
      })
    } else if (method === 'eth_signTypedData' || method === 'eth_signTypedData_v4') {
      const [requestedAddress, typedData] = params
      const parsedTypedData = typeof typedData === 'string' ? JSON.parse(typedData) : typedData
      if (requestedAddress.toLowerCase() !== address) {
        throw new Error('Requested address is not wallet address')
      }
      if (!util.isObjectEIP712TypedData(parsedTypedData)) {
        throw new Error('Request does not conform EIP712')
      }
      return new Promise((resolve, reject) => {
        const callback = commonSignatureCallback(resolve, reject)
        const request = { id, action: 'signTyped', typedData: parsedTypedData, address, callback }
        Web3ProviderCommunicator.enqueueRequest(request)
      })
    } else if (method === 'eth_sendTransaction') {
      const tx = {
        ...params[0],
        value: params[0].value || '0',
        data: params[0].data || '0x',
      }

      if (typeof tx.gas === 'string' && tx.gas.startsWith('0x')) {
        tx.gas = parseInt(tx.gas, 16)
      }
      return new Promise((resolve, reject) => {
        const callback = (error, result) => error ? reject(error) : resolve(result)
        const request = { id, action: 'call', tx, address, callback }
        Web3ProviderCommunicator.enqueueRequest(request)
      })
    } else if (method === 'eth_blockNumber') {
      return await api.rpc.getBlockNumber()
    } else if (method === 'eth_getBalance') {
      return await api.blockchain.getBalance({ address: params[0]?.toLowerCase(), blockNumber: params[1] })
    } else if (method === 'eth_getCode') {
      return await api.blockchain.getCode({ address: params[0]?.toLowerCase(), blockNumber: params[1] })
    } else if (method === 'eth_getTransactionCount') {
      return await api.rpc.getTransactionCount({ address: params[0]?.toLowerCase(), blockNumber: params[1] })
    } else if (method === 'eth_getStorageAt') {
      return await api.rpc.getStorageAt({ address: params[0]?.toLowerCase(), position: params[1], blockNumber: params[2] })
    } else if (method === 'eth_getBlockByNumber') {
      return await api.rpc.getBlockByNumber({ address: params[0]?.toLowerCase(), includeTransactionDetails: params[1] })
    } else if (method === 'eth_getBlockByHash') {
      return await api.rpc.getBlockByHash({ address: params[0]?.toLowerCase(), includeTransactionDetails: params[1] })
    } else if (method === 'eth_getTransactionByHash') {
      return await api.rpc.getTransaction(params[0])
    } else if (method === 'eth_getTransactionReceipt') {
      const hash = params[0]
      return await api.rpc.getTransactionReceipt(hash)
    } else if (method === 'eth_estimateGas') {
      return await api.rpc.getEstimateGas({ transaction: params[0] })
    } else if (method === 'eth_call') {
      return await api.rpc.simulateCall({ transaction: params[0] })
    } else if (method === 'eth_getLogs') {
      return await api.rpc.getLogs({ filter: params[0] })
    } else if (method === 'eth_gasPrice') {
      return await api.rpc.gasPrice()
    } else if (method === 'wallet_getPermissions') {
      // TODO: https://eips.ethereum.org/EIPS/eip-2255
      return []
    } else if (method === 'wallet_requestPermissions') {
      // TODO: https://eips.ethereum.org/EIPS/eip-2255
      return []
    } else {
      throw Error(`${method} is not implemented`)
    }
  }

  return {
    send
  }
}
