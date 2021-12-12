import React, { useState } from 'react'
import message from '../message'
import storage from '../storage'
import { Button, Modal, Typography } from 'antd'
import { ExportOutlined, LoadingOutlined } from '@ant-design/icons'
import { LocalExportMessage } from '../proto/localExportMessage'
import util from '../util'
const { Text, Link, Paragraph } = Typography

const LocalExport = ({ wallet }) => {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    let element
    try {
      setLoading(true)
      const oneAddress = util.safeOneAddress(wallet.address)
      const layers = await storage.getItem(wallet.root)
      const filename = `${wallet.name.toLowerCase().split(' ').join('-')}_[${oneAddress}].1wallet`
      const msg = new LocalExportMessage({ wallet: JSON.stringify(wallet), layers: layers })
      const buffer = LocalExportMessage.encode(msg).finish()
      const blob = new Blob([buffer])

      element = document.createElement('a')
      element.download = filename
      element.href = URL.createObjectURL(blob)
      document.body.appendChild(element)
      element.click()

      message.success(`Exported ${filename} Successfully`)
    } catch (err) {
      message.error(err?.message)
    } finally {
      if (element.href) URL.revokeObjectURL(element.href)
      if (element) {
        document.body.removeChild(element)
        element = undefined
      }
      setLoading(false)
    }
  }

  const showExportModal = () => {
    Modal.confirm({
      content: <Text><Paragraph>The exported file is meant for cross-device transfer. Please do not keep the exported file on your device for longer than necessary. </Paragraph><Paragraph>Doing so would make your wallet less secure, and opens up possibilities for an attacker to hack your wallet.</Paragraph><Paragraph>For more technical details, please read <Link href='https://github.com/polymorpher/one-wallet/wiki/Client-Security' target='_blank' rel='noreferrer'>Client Security in 1wallet wiki</Link></Paragraph></Text>,
      onOk: handleExport,
    })
  }

  return (
    <Button type='primary' shape='round' size='large' icon={loading ? <LoadingOutlined /> : <ExportOutlined />} onClick={showExportModal}>Export</Button>
  )
}

export default LocalExport
