import { Hint, Text } from '../../components/Text'
import { Button, Upload } from 'antd'
import { LoadingOutlined, UploadOutlined } from '@ant-design/icons'
import React, { useState } from 'react'
import message from '../../message'
import { BasicWalletExport } from '../../proto/wallet'
const SyncRecoveryFile = ({ onSynced, onCancel }) => {
  const [uploading, setSyncing] = useState(false)
  const beforeUpload = (file) => {
    const validExt = file.name.endsWith('.recovery.1wallet')
    if (!validExt) {
      message.error('Please only upload 1wallet recovery file ending with .recovery.1wallet')
      return false
    }
    return true
    // const addressSeg = file.name.split('.').find(e => e.startsWith('one1') || e.startsWith('0x'))
    // const address = util.safeNormalizedAddress(addressSeg)
    // if (!address) {
    //   message.error('The filename contains invalid address segment')
    //   return false
    // }
    // return true
  }

  const onFileUploadChange = async (info) => {
    if (info.file.status === 'uploading') {
      setSyncing(true)
    }

    if (info.file.status === 'done') {
      // const addressSeg = info.file.name.split('.').find(e => e.startsWith('one1') || e.startsWith('0x'))
      // const address = util.safeNormalizedAddress(addressSeg)
      const reader = new FileReader()
      reader.readAsArrayBuffer(info.file.originFileObj)
      reader.onload = () => {
        try {
          const { layers, address, expert } = BasicWalletExport.decode(reader.result)
          onSynced && onSynced(address, layers, expert)
          setSyncing(false)
        } catch (ex) {
          console.error(ex.toString())
          message.error('Unable to parse the provided file as 1wallet recovery file')
          setSyncing(false)
        }
      }
      reader.onerror = () => {
        message.error('An error occurred while reading the file. Please try again.')
        setSyncing(false)
      }
      reader.onabort = () => {
        setSyncing(false)
      }
    }
  }

  return (
    <>
      <Text>Please upload your wallet recovery file (with extension .recovery.1wallet)</Text>
      <Upload
        name='recoveryFile'
        showUploadList={false}
        customRequest={({ onSuccess }) => { onSuccess('ok') }}
        beforeUpload={beforeUpload}
        onChange={onFileUploadChange}
      >
        <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}>Upload QR Code Image Instead</Button>
      </Upload>
      <Hint>(Coming soon: automatically store and synchronize your recovery file from cloud storage or IPFS)</Hint>
      <Button size='large' type='text' onClick={onCancel} danger>Cancel</Button>
    </>
  )
}

export default SyncRecoveryFile
