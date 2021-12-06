import React from 'react'
import protobuf from 'protobufjs/light'
import message from '../message'
import storage from '../storage'
import { Button } from 'antd'
import { ExportOutlined, LoadingOutlined } from '@ant-design/icons'
import { useState } from 'react'

const Field = protobuf.Field

export function LocalExportMessage (properties) {
  protobuf.Message.call(this, properties)
}

Field.d(1, 'string')(LocalExportMessage.prototype, 'wallet')
Field.d(2, 'bytes', 'repeated')(LocalExportMessage.prototype, 'layers')

const LocalExport = ({ wallet }) => {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    try {
      setLoading(true)

      const layers = await storage.getItem(wallet.root)
      const filename = `1wallet-${wallet.name.toLowerCase().split(' ').join('-')}.txt`
      const msg = new LocalExportMessage({ wallet: JSON.stringify(wallet), layers: layers })
      const buffer = LocalExportMessage.encode(msg).finish()
      const blob = new Blob([buffer], { type: 'text/plain' })
      const element = document.createElement('a')

      element.href = URL.createObjectURL(blob)
      element.download = filename
      document.body.appendChild(element)
      element.click()

      URL.revokeObjectURL(element.href)
      message.success(`Exported ${filename} Successfully`)
    } catch(err) {
      message.error(err?.message)
    } finally {
      setLoading(false)
    }
  }

  return <Button type='primary' shape='round' size='large' icon={loading ? <LoadingOutlined /> : <ExportOutlined />} onClick={handleExport}>Export locally</Button>
}

export default LocalExport
