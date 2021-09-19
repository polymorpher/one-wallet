import React, { useEffect, useRef, useState } from 'react'
import { message, Row, Select } from 'antd'
import QrReader from 'react-qr-reader'
import { useWindowDimensions } from '../util'

const QrCodeScanner = ({ onScan, shouldInit, style }) => {
  const ref = useRef()
  const { isMobile } = useWindowDimensions()
  const [videoDevices, setVideoDevices] = useState([])
  const [device, setDevice] = useState()

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
      // console.log(cams)
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
    </>
  )
}

export default QrCodeScanner
