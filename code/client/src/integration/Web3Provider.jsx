import api from '../api'
import util from '../util'
import { useEffect, useState } from 'react'

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
    console.log(`Cancelling ${id}`, error, r)
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
export const SimpleWeb3Provider = ({ defaultAddress } = {}) => {
  // For testing
  // useEffect(() => {
  //   Web3ProviderCommunicator.enqueueRequest({
  //     id: 1704163097860232,
  //     action: 'call',
  //     address: '0x3864615fA0a8bc759f4EF4c9b9e746D271b6D2Bb',
  //     tx: {
  //       gas: 251410,
  //       gasPrice: '0x174876e800',
  //       from: '0x3864615fa0a8bc759f4ef4c9b9e746d271b6d2bb',
  //       to: '0xc22834581ebc8527d974f8a1c97e1bea4ef910bc',
  //       data: '0x1688f0b9000000000000000000000000fb1bffc9d739b8d520daf37df666da4c687191ea00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000018cc7e547c90000000000000000000000000000000000000000000000000000000000000164b63e800d0000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000017062a1de2fe6b99be3d9d37841fed19f57380400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000003864615fa0a8bc759f4ef4c9b9e746d271b6d2bb000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
  //       value: '0'
  //     }
  //   })
  // }, [])
  const send = async (method, params, id, address) => {
    address = address ?? defaultAddress
    console.log('Web3Provider send', { id, method, params, address })
    if (!address) {
      throw new Error('address is not set')
    }
    if (method === 'eth_accounts') {
      return [address]
    } else if (method === 'net_version' || method === 'eth_chainId') {
      const { chainId } = api.blockchain.getChainInfo()
      return chainId
    } else if (method === 'personal_sign') {
      const [message, requestedAddress] = params
      if (address.toLowerCase() !== requestedAddress?.toLowerCase()) {
        throw new Error('Requested address is not wallet address')
      }
      return new Promise((resolve, reject) => {
        const callback = commonSignatureCallback(resolve, reject)
        const request = { id, action: 'sign', message, address, callback }
        Web3ProviderCommunicator.enqueueRequest(request)
      })
    } else if (method === 'eth_sign') {
      const [requestedAddress, messageHash] = params
      if (address.toLowerCase() !== requestedAddress?.toLowerCase()) {
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
      if (requestedAddress.toLowerCase() !== address.toLowerCase()) {
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
