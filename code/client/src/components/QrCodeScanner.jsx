import React, { useEffect, useRef, useState } from 'react'
import Button from 'antd/es/button'
import Row from 'antd/es/row'
import Select from 'antd/es/select'
import Upload from 'antd/es/upload'
import message from '../message'
import QrReader from 'react-qr-reader'
import { useWindowDimensions } from '../util'
import LoadingOutlined from '@ant-design/icons/LoadingOutlined'
import UploadOutlined from '@ant-design/icons/UploadOutlined'
import jsQR from 'jsqr'

const QrCodeScanner = ({ onScan, shouldInit, style }) => {
  const ref = useRef()
  const { isMobile } = useWindowDimensions()
  const [videoDevices, setVideoDevices] = useState([])
  const [device, setDevice] = useState()
  const [qrCodeImageUploading, setQrCodeImageUploading] = useState()

  useEffect(() => {
    const numAttempts = 0
    const f = async () => {
      const d = await navigator.mediaDevices.enumerateDevices()
      const cams = d.filter(e => e.kind === 'videoinput')
      if (cams.length <= 0) {
        return message.error('Restore requires a camera to scan the QR code. Please use a device that has a camera.', 15)
      }
      if (cams.length === 1 && !cams[0].label && numAttempts < 5) {
        setTimeout(() => f(), 2500)
        console.log('got empty labels. retrying in 2.5s')
      }
      setVideoDevices(cams)
      if (isMobile) {
        const backCam = cams.find(e => e.label.toLowerCase().indexOf('back') >= 0)
        setDevice(backCam || cams[0])
      } else {
        setDevice(cams[0])
      }
    }
    shouldInit && videoDevices.length === 0 && f()
  }, [shouldInit])

  useEffect(() => {
    if (device && shouldInit) {
      ref.current.initiate()
    }
  }, [device])

  const onChange = (v) => {
    const d = videoDevices.find(e => e.deviceId === v)
    setDevice(d)
  }

  const onError = (err) => {
    console.error(err)
    message.error(`Failed to parse QR code. Error: ${err}`)
  }

  const convertURIToImageData = (uri) => new Promise((resolve, reject) => {
    if (!uri) {
      onError('No URI detected')
      return reject(new Error('No URI detected'))
    }

    const canvas = document.createElement('canvas')

    const context = canvas.getContext('2d')

    const image = new Image()

    image.addEventListener('load', function () {
      canvas.width = image.width
      canvas.height = image.height
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      resolve(context.getImageData(0, 0, canvas.width, canvas.height))
    }, false)

    image.src = uri
  })

  const getBase64 = (img) => new Promise((resolve) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(reader.result))
    reader.readAsDataURL(img)
  })

  const onQrcodeChange = async (info) => {
    if (info.file.status === 'uploading') {
      setQrCodeImageUploading(true)
    }

    if (info.file.status === 'done') {
      const imageUri = await getBase64(info.file.originFileObj)
      const imageData = await convertURIToImageData(imageUri)
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height)
      if (!qrCode) {
        message.error('Fail to read the uploaded image.', 15)
        setQrCodeImageUploading(false)
        return
      }
      onScan(qrCode.data)
      setQrCodeImageUploading(false)
    }
  }

  const beforeUpload = (file) => {
    const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png'
    if (!isJpgOrPng) {
      message.error('You can only upload JPG/PNG file')
    }
    return isJpgOrPng
  }

  return (
    <>
      {
        videoDevices && device
          ? (
            <>
              <Row justify='end'>
                <Select style={{ }} bordered={false} value={device && device.label} onChange={onChange}>
                  {videoDevices.map(d => {
                    return <Select.Option key={d.label} value={d.deviceId}>{d.label} </Select.Option>
                  })}
                </Select>
              </Row>
              <QrReader
                ref={ref}
                deviceIdChooser={(_, devices) => {
                  if (device) {
                    return devices.filter(d => d.deviceId === device.deviceId)[0].deviceId
                  }
                  return devices[0].deviceId
                }}
                delay={300}
                onError={onError}
                onScan={onScan}
                style={{ width: '100%', ...style }}
              />
            </>
            )
          : <></>
      }
      <Row justify='center' style={{ marginTop: 16 }}>
        <Upload
          name='qrcode'
          showUploadList={false}
          customRequest={({ onSuccess }) => {
            onSuccess('ok')
          }}
          beforeUpload={beforeUpload}
          onChange={onQrcodeChange}
        >
          <Button shape='round' icon={qrCodeImageUploading ? <LoadingOutlined /> : <UploadOutlined />}>Use Image Instead</Button>
        </Upload>
      </Row>
    </>
  )
}

export default QrCodeScanner
