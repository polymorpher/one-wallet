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


const LocalImport = ({onSuccess}) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const wallets = useSelector(state => state.wallet.wallets)
  const [fileUploading, setFileUploading] = useState(false)

  const getDataFromFile = file =>
    new Promise(resolve => {
      const reader = new FileReader()
      reader.addEventListener('load', () => resolve(reader.result.split('\r\n')))
      reader.readAsText(file)
    })

  const handleImport = async info => {
    if (info.file.status === 'uploading') {
      setFileUploading(true)
    }

    if (info.file.status === 'done') {
      try {
        const [walletString, ...buffer] = await getDataFromFile(info.file.originFileObj)
        const wallet = JSON.parse(walletString)
        const layers = buffer.map(b => new Uint8Array(b.split(',')))

        if (!util.isValidWallet(wallet)) { throw new Error('Wallet is invalid') }
        if (util.isWalletExisted(wallets, wallet)) { throw new Error('Wallet is existed') }

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

  const beforeUpload = file => {
    const isTextFile = file.type === 'text/plain'
    if (!isTextFile) {
      message.error('You can only upload text file')
    }

    return isTextFile
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
