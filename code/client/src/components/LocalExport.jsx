import React from 'react'
import message from '../message'
import storage from '../storage'
import { Button } from 'antd'
import { ExportOutlined, LoadingOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { LocalExportMessage } from '../proto/localExportMessage'

const LocalExport = ({ wallet }) => {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    let element
    try {
      setLoading(true)
      
      const layers = await storage.getItem(wallet.root)
      const filename = `${wallet.name.toLowerCase().split(' ').join('-')}.1wallet`
      const msg = new LocalExportMessage({ wallet: JSON.stringify(wallet), layers: layers })
      const buffer = LocalExportMessage.encode(msg).finish()
      const blob = new Blob([buffer])

      element = document.createElement('a')
      element.download = filename
      element.href = URL.createObjectURL(blob)
      document.body.appendChild(element)
      element.click()

      message.success(`Exported ${filename} Successfully`)
    } catch(err) {
      message.error(err?.message)
    } finally {
      if(element.href) URL.revokeObjectURL(element.href)
      if(element) {
        document.body.removeChild(element)
        element = undefined
      }
      setLoading(false)
    }
  }

  return <Button type='primary' shape='round' size='large' icon={loading ? <LoadingOutlined /> : <ExportOutlined />} onClick={handleExport}>Export locally</Button>
}

export default LocalExport
