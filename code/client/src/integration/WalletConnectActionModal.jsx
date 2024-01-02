import { Web3ProviderCommunicator } from './Web3Provider'
import Modal from 'antd/es/modal'
import React, { useState, useEffect } from 'react'
import Sign from '../pages/Show/Sign'
import ONEUtil from '../../../lib/util'
import Call from '../pages/Show/Call'
const WalletConnectActionModal = () => {
  const [visible, setVisible] = useState(false)
  const [pendingRequests, setPendingRequests] = useState([])
  const activeRequest = pendingRequests[0]
  const { id, action, address, message, messageHash, typedData, tx } = activeRequest || {}

  useEffect(() => {
    const sid = Web3ProviderCommunicator.subscribe((request) => {
      // console.log('Received request', request)
      setPendingRequests(e => [...e, request])
    })
    // console.log(`Subscribed to Web3ProviderCommunicator. id=${sid}`)
    return () => {
      Web3ProviderCommunicator.unsubscribe(sid)
    }
  }, [])

  useEffect(() => {
    setVisible(!!activeRequest)
  }, [activeRequest])
  const onSignSuccess = (txId, { hash, signature }) => {
    const signatureStr = ONEUtil.hexString(signature)
    // console.log('WC sign completed', { action, hash, message, messageHash, typedData })
    Web3ProviderCommunicator.completeRequest(id, null, { signature: signatureStr })
  }
  const onCallSuccess = (txId) => {
    Web3ProviderCommunicator.completeRequest(id, null, txId)
    setPendingRequests(rqs => rqs.filter(e => e.id !== id))
  }
  const onClose = () => {
    Web3ProviderCommunicator.completeRequest(id, Error('Transaction was rejected: User cancelled'))
    setPendingRequests(rqs => rqs.filter(e => e.id !== id))
  }
  return (
    <Modal title={`Wallet Connect: ${action}`} visible={visible} onCancel={onClose} width={720} footer={null}>
      {action === 'sign' && (
        <Sign
          address={address}
          onClose={onClose}
          onSuccess={onSignSuccess}
          prefillMessageInput={message}
          prefillUseRawMessage={false}
          shouldAutoFocus
          headless
        />)}
      {action === 'signRaw' && (
        <Sign
          address={address}
          onClose={onClose}
          onSuccess={onSignSuccess}
          prefillMessageInput={messageHash}
          skipHash
          prefillUseRawMessage
          shouldAutoFocus
          headless
        />)}
      {action === 'signTyped' && (
        <Sign
          address={address}
          onClose={onClose}
          onSuccess={onSignSuccess}
          prefillEip712TypedData={typedData}
          headless
          shouldAutoFocus
        />)}
      {action === 'call' && (
        <Call
          address={address}
          onClose={onClose}
          onSuccess={onCallSuccess}
          prefillDest={tx.to}
          prefillHex={tx.data}
          prefillAmount={ONEUtil.toFraction(tx.value).toString()}
          headless
          shouldAutoFocus
        />)}
    </Modal>
  )
}

export default WalletConnectActionModal
