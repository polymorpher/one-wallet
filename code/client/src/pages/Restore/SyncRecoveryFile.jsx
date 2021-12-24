import { Hint, Text, Title } from '../../components/Text'
import { Button, Upload, Space } from 'antd'
import { LoadingOutlined, UploadOutlined } from '@ant-design/icons'
import React, { useState } from 'react'
import message from '../../message'
import { SimpleWalletExport } from '../../proto/wallet'
import { getDataFromFile } from '../../components/Common'
import { useSelector } from 'react-redux'
import util from '../../util'
const SyncRecoveryFile = ({ onSynced, onCancel }) => {
  const wallets = useSelector(state => state.wallet)
  const [uploading, setSyncing] = useState(false)
  const beforeUpload = (file) => {
    const validExt = file.name.endsWith('.recover1wallet')
    if (!validExt) {
      message.error('Please only upload 1wallet recovery file ending with .recovery.1wallet')
      return false
    }
    return true
  }

  const onFileUploadChange = async (info) => {
    if (info.file.status === 'uploading') {
      setSyncing(true)
    }

    if (info.file.status === 'done') {
      // const addressSeg = info.file.name.split('.').find(e => e.startsWith('one1') || e.startsWith('0x'))
      // const address = util.safeNormalizedAddress(addressSeg)
      try {
        const data = await getDataFromFile(info.file.originFileObj)
        try {
          const { innerTrees, address, expert, name } = SimpleWalletExport.decode(new Uint8Array(data))
          if (wallets[address]) {
            message.error(`Wallet [${name}] already exists (${util.safeOneAddress(address)})`)
            return
          }
          onSynced && await onSynced({ address, innerTrees: innerTrees.map(t => t.layers), name, expert })
        } catch (ex) {
          console.error(ex.toString())
          message.error('Unable to parse the provided file as 1wallet recovery file')
        }
      } catch (ex) {
        console.error(ex)
        message.error('An error occurred while reading the file. Please try again.')
      } finally {
        setSyncing(false)
      }
    }
  }

  return (
    <Space direction='vertical' size='large'>
      <Title level={2}>Restore: Step 1/3</Title>
      <Upload
        name='recoveryFile'
        showUploadList={false}
        customRequest={({ onSuccess }) => { onSuccess('ok') }}
        beforeUpload={beforeUpload}
        onChange={onFileUploadChange}
      >
        <Button shape='round' size='large' icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}>Select your wallet recovery file</Button>
      </Upload>
      <Hint>Your wallet recovery file ends with file extension <Text style={{ color: 'red' }}>.recovery.1wallet</Text></Hint>
      <Button size='large' type='text' onClick={onCancel} danger>Cancel</Button>
    </Space>
  )
}

export default SyncRecoveryFile
