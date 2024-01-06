import { Hint, SiderLink, Text, Title } from '../../components/Text'
import Button from 'antd/es/button'
import Upload from 'antd/es/upload'
import Space from 'antd/es/space'
import LoadingOutlined from '@ant-design/icons/LoadingOutlined'
import UploadOutlined from '@ant-design/icons/UploadOutlined'
import React, { useState } from 'react'
import message from '../../message'
import { SimpleWalletExport } from '../../proto/wallet'
import { getDataFromFile } from '../../components/Common'
import { useSelector } from 'react-redux'
import util from '../../util'
import Paths from '../../constants/paths'
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
      <Hint>Your wallet recovery file ends with file extension <Text style={{ color: 'red' }}>.recover1wallet</Text></Hint>
      <Hint>If you backed up your recovery file to the cloud before, you may download your backup files after <SiderLink href={Paths.backup}>login here</SiderLink></Hint>
      <Button size='large' shape='round' type='text' onClick={onCancel} style={{ marginLeft: -24, marginTop: 32 }} danger>Cancel</Button>
    </Space>
  )
}

export default SyncRecoveryFile
