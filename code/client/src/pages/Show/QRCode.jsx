import qrcode from 'qrcode'
import React, { useEffect, useState, useRef } from 'react'
import config from '../../config'
import html2canvas from 'html2canvas'
import { Button, Image, Row, Space, Typography } from 'antd'
import util from '../../util'
const { Text } = Typography

const QRCode = ({ address, name }) => {
  const [qrCodeData, setQRCodeData] = useState()
  const ref = useRef()
  useEffect(() => {
    const f = async () => {
      const uri = `${config.rootUrl}/to/${address}`
      const data = await qrcode.toDataURL(uri, { errorCorrectionLevel: 'low', width: 512 })
      setQRCodeData(data)
    }
    f()
  }, [])
  const capture = async () => {
    const canvas = await html2canvas(ref.current)
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(blob => { resolve(blob) })
      } catch (err) {
        reject(err)
      }
    })
  }
  const onCapture = async () => {
    const blob = await capture()
    const element = document.createElement('a')
    element.href = URL.createObjectURL(blob)
    element.download = `1wallet-${util.safeOneAddress(address)}.png`
    document.body.appendChild(element)
    element.click()
    URL.revokeObjectURL(element.href)
  }
  return (
    <>
      <Row style={{ width: '100%', marginTop: 16 }} justify='center'>
        <Space direction='vertical' style={{ textAlign: 'center' }}>
          <Text>Others can scan your QR code to send you assets</Text>
          <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Image
              src={qrCodeData}
              preview={false}
              width='100%'
              style={{ maxWidth: 400 }}
            />
            <Text>Your 1wallet: {name}</Text>
            <Text>{util.safeOneAddress(address)}</Text>
          </div>
          <Button type='primary' shape='round' onClick={onCapture}>Save Image</Button>
        </Space>
      </Row>
    </>
  )
}

export default QRCode
