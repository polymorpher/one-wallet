import React, { useState } from 'react'
import { ImportOutlined, LoadingOutlined } from '@ant-design/icons'
import { Button, Upload } from 'antd'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import message from '../message'
import storage from '../storage'
import util from '../util'
import ONEUtil from '../../../lib/util'
import { walletActions } from '../state/modules/wallet'
import Paths from '../constants/paths'
import { LocalExportMessage } from '../proto/localExportMessage'

const LocalImport = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const wallets = useSelector(state => state.wallet.wallets)
  const [fileUploading, setFileUploading] = useState(false)

  const getDataFromFile = file =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener('load', () => resolve(reader.result))
      reader.addEventListener('error', () => reject(reader.error))
      reader.readAsArrayBuffer(file)
    })

  const handleImport = async info => {
    if (info.file.status === 'uploading') {
      setFileUploading(true)
    }

    if (info.file.status === 'done') {
      try {
        const data = await getDataFromFile(info.file.originFileObj)
        const decoded = LocalExportMessage.decode(new Uint8Array(data))
        const wallet = JSON.parse(decoded.wallet)
        const layers = decoded.layers

        if (!util.isValidWallet(wallet)) { throw new Error('Wallet is invalid') }
        if (wallets[wallet.address]) { throw new Error('Wallet is existed') }

        dispatch(walletActions.updateWallet(wallet))
        storage.setItem(wallet.root, layers)
        message.success(`Wallet ${wallet.name} (${wallet.address}) is restored!`)
        setTimeout(() => history.push(Paths.showAddress(wallet.address)), 1500)
      } catch (err) {
        message.error(err?.message || 'Import file is corrupted')
      } finally {
        setFileUploading(false)
      }
    }
  }

  const beforeUpload = (file) => {
    const filename = file.name.split('.')
    const is1walletExt = filename[filename.length - 1] === '1wallet'

    if (!is1walletExt) {
      message.error('You can only upload 1wallet file')
    }

    return is1walletExt
  }

  return (
    <Upload
      name='walletjson'
      showUploadList={false}
      customRequest={({ onSuccess }) => { onSuccess('ok') }}
      beforeUpload={beforeUpload}
      onChange={handleImport}
    >
      <Button
        type='primary'
        shape='round'
        size='large'
        icon={fileUploading ? <LoadingOutlined /> : <ImportOutlined />}
      >
        Import locally
      </Button>
    </Upload>
  )
}

export default LocalImport
