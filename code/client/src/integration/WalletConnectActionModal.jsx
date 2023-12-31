import { Web3ProviderCommunicator } from './Web3Provider'
import Modal from 'antd/es/modal'
import React, { useState, useEffect } from 'react'
import Sign from '../pages/Show/Sign'
import ONEUtil from '../../lib/util'
import Call from '../pages/Show/Call'
const WalletConnectActionModal = () => {
  const [visible, setVisible] = useState(false)
  const [pendingRequests, setPendingRequests] = useState([])
  const activeRequest = pendingRequests[0]
  const { id, action, address, message, messageHash, typedData, tx } = activeRequest || {}

  useEffect(() => {
    const sid = Web3ProviderCommunicator.subscribe((request) => {
      setPendingRequests(e => [...e, request])
    })
    return () => {
      Web3ProviderCommunicator.unsubscribe(sid)
    }
  }, [])

  useEffect(() => {
    if (activeRequest >= 1) {
      setVisible(true)
    }
  }, [activeRequest])
  const onSignSuccess = (txId, { hash, signature }) => {
    const signatureStr = ONEUtil.hexString(signature)
    console.log('WC sign completed', { action, hash, message, messageHash, typedData })
    Web3ProviderCommunicator.completeRequest(id, null, { signature: signatureStr })
  }
  const onCallSuccess = (txId) => {
    Web3ProviderCommunicator.completeRequest(id, null, txId)
  }
  const onClose = () => Web3ProviderCommunicator.completeRequest(id, Error('User cancelled'))

  return (
    <Modal title='Relayer password' visible={visible} onCancel={() => setVisible(false)}>
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
