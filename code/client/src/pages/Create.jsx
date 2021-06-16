import React, { useState, useEffect } from 'react'
import styled from 'styled-components'
import api from '../api'
import ONE from '../../../lib/onewallet'
import ONEUtil from '../../../lib/util'
import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator'
import { Card, Input, Button, Row, Space, Typography, Slider, Image, message } from 'antd'
import { RedoOutlined } from '@ant-design/icons'
import humanizeDuration from 'humanize-duration'
import { Transition } from 'react-transition-group'
import b32 from 'hi-base32'
import qrcode from 'qrcode'
const { Text, Link, Title } = Typography

const genName = () => uniqueNamesGenerator({
  dictionaries: [colors, animals],
  style: 'capital',
  separator: ' ',
  length: 1
})

const Section = styled(Card)`
  padding: 32px;
  position: absolute;
`

const Question = styled(Title).attrs(() => ({ level: 2 }))`
  //font-size: 24px;
  //color: #1f1f1f;
`

const Hint = styled(Text).attrs(() => ({ type: 'secondary' }))`
  font-size: 16px;
  color: #888888;
`

const InputBox = styled(Input).attrs((props) => ({ size: props.size || 'large' }))`
  width: ${props => props.width || '400px'};
  //font-size: 24px;
  //border-radius: 10px;
  margin-top: ${props => props.margin || '32px'};
  margin-bottom: ${props => props.margin || '32px'};
  border: none;
  border-bottom: 1px dashed black;
  &:hover{
    border-bottom: 1px dashed black;
  }
`

const defaultStyle = {
  transition: 'opacity 300ms ease-in-out',
  opacity: 0,
}

const transitionStyles = {
  entering: { opacity: 1 },
  entered: { opacity: 1, zIndex: 1 },
  exiting: { opacity: 0 },
  exited: { opacity: 0, zIndex: 0 },
}

const Create = () => {
  const [name, setName] = useState(genName())
  const otpSeedBuffer = new Uint8Array(20)
  // eslint-disable-next-line no-unused-vars
  const [seed, setSeed] = useState(window.crypto.getRandomValues(otpSeedBuffer))
  const [lifespan, setLifespan] = useState(3600 * 1000 * 24 * 365)
  const [lastResortAddress, setLastResortAddress] = useState()
  const [dailyLimit, setDailyLimit] = useState(1000)

  const [worker, setWorker] = useState()
  const [root, setRoot] = useState()
  const [hseed, setHseed] = useState()
  const [layers, setLayers] = useState()
  const [slotSize, setSlotSize] = useState()
  const [progress, setProgress] = useState(0)

  const [lifespanVisible, setLifespanVisible] = useState(false)
  const [section, setSection] = useState(1)
  const [qrCodeData, setQRCodeData] = useState()
  const [showOtpVerification, setShowOtpVerification] = useState()
  const [otp, setOtp] = useState('')

  const getQRCodeUri = () => {
    // otpauth://TYPE/LABEL?PARAMETERS
    return `otpauth://totp/${name}?secret=${b32.encode(seed)}&issuer=ONE%20Wallet`
  }
  useEffect(() => {
    (async function () {
      const uri = getQRCodeUri()
      const data = await qrcode.toDataURL(uri, { errorCorrectionLevel: 'low', width: 400 })
      setQRCodeData(data)
    })()
  }, [name])

  useEffect(() => {
    if (section === 2) {
      console.log('posting to worker')
      worker && worker.postMessage({
        seed, effectiveTime: Date.now(), lifespan, slotSize
      })
    }
  }, [section])

  const verifyOtp = () => {
    const expected = ONEUtil.genOTP({ seed })
    const code = new DataView(expected.buffer).getUint32(0, false).toString()
    if (code.padStart(6, '0') !== otp.padStart(6, '0')) {
      message.error(`Code is incorrect. Expected: ${code}. Got: ${otp}`)
    } else {
      message.success('Nice! Your code is correct!')
      setSection(3)
    }
  }

  const deploy = async () => {
    api.relayer.create({})

    // const interval = 30
    // const t0 = Math.floor(Date.now() / (1000 * interval))
    // const slotSize = 1
    // const height = Math.ceil(Math.log2(lifespan / (1000 * interval) * slotSize)) + 1
    //
  }

  const storeLayers = async () => {

  }

  useEffect(() => {
    const worker = new Worker('ONEWalletWorker.js')
    worker.onmessage = (event) => {
      const { status, current, total, result } = event.data
      if (status === 'working') {
        console.log(`Completed ${(current / total * 100).toFixed(2)}%`)
        setProgress(Math.floor(current / total * 100))
      }
      if (status === 'done') {
        const { hseed, root, layers, maxOperationsPerInterval } = result
        setRoot(root)
        setHseed(hseed)
        setLayers(layers)
        setSlotSize(maxOperationsPerInterval)
        console.log('Received created wallet from worker:', result)
      }
    }
    setWorker(worker)
  }, [])

  return (
    <>
      <Transition in={section === 1} timeout={300}>
        {state => (
          <Section style={{ ...defaultStyle, ...transitionStyles[state] }}>
            <Question>What do you want to call your wallet?</Question>
            <Hint>This is stored on your computer only, to help you distinguish multiple wallets.</Hint>
            <Row align='middle'>
              <Space>
                <InputBox value={name} onChange={({ target: { value } }) => setName(value)} />
                <Button shape='circle' onClick={() => setName(genName())}><RedoOutlined /></Button>
              </Space>
            </Row>
            <Row style={{ marginBottom: 32 }}>
              <Button type='primary' shape='round' size='large' onClick={() => setSection(2)}>Next</Button>
            </Row>
            <Space direction='vertical'>
              <Hint>Next, we will set up a ONE Wallet that lasts for a year. You may re-create a new wallet after a year and transfer the funds, or have the funds to be withdrawn to a pre-assigned address.</Hint>
              <Link onClick={() => setLifespanVisible(true)}>Need more or less than a year?</Link>
              {lifespanVisible &&
                <Space>
                  <Slider
                    style={{ width: 200 }}
                    value={lifespan} tooltipVisible={false} onChange={(v) => setLifespan(v)}
                    min={3600 * 1000 * 24 * 120} max={3600 * 1000 * 24 * 365 * 2}
                  />
                  <Hint>{humanizeDuration(lifespan, { units: ['y', 'mo'], round: true })}</Hint>
                </Space>}
            </Space>
          </Section>)}
      </Transition>
      <Transition in={section === 2} timeout={300}>
        {state => (
          <Section style={{ ...defaultStyle, ...transitionStyles[state] }}>
            <Row>
              <Space direction='vertical'>
                <Question>Now, scan the QR code with your Google Authenticator</Question>
                <Hint>You will be asked to enter one-time passwords when you transfer funds from your wallet. If you lost the data on your computer, you can also restore your wallet from your Google Authenticator.</Hint>
                {qrCodeData && <Image src={qrCodeData} preview={false} width={400} />}
              </Space>
            </Row>
            <Row>
              <Space direction='vertical' size='large'>
                <Hint>After you are done, let's verify your one-time password</Hint>
                {!showOtpVerification && <Button type='primary' shape='round' size='large' onClick={() => setShowOtpVerification(true)}>I am ready</Button>}
                {showOtpVerification &&
                  <Space>
                    <InputBox value={otp} onChange={({ target: { value } }) => setOtp(value)} />
                    <Button type='primary' shape='round' size='large' onClick={verifyOtp}>Next</Button>
                  </Space>}
              </Space>
            </Row>
          </Section>
        )}
      </Transition>
      <Transition in={section === 3} timeout={300}>
        {state => (
          <Section style={{ ...defaultStyle, ...transitionStyles[state] }}>
            <Row>
              <Space direction='vertical'>
                <Question>Final step: deploy your ONE Wallet to blockchain</Question>
              </Space>
            </Row>
            <Row style={{ marginBottom: 16 }}>
              <Space direction='vertical' size='small'>
                <Hint>Set up a daily spending limit:</Hint>
                <InputBox margin={16} width={200} value={dailyLimit} onChange={({ target: { value } }) => setDailyLimit(parseInt(value || 0))} suffix='ONE' />
              </Space>
            </Row>
            <Row style={{ marginBottom: 48 }}>
              <Space direction='vertical' size='small'>
                <Hint>(Optional) Set up a fund recovery address:</Hint>
                <InputBox margin={16} value={lastResortAddress} onChange={({ target: { value } }) => setLastResortAddress(value)} placeholder='0x......' />
                <Hint>If you lost your authenticator, you can still transfer all your funds to that address</Hint>
              </Space>
            </Row>
            <Row style={{ marginBottom: 32 }}>
              <Button type='primary' shape='round' size='large' onClick={() => deploy()}>Let's do it</Button>
            </Row>
            <Row>
              <Space direction='vertical'>
                <Hint>No private key. No mnemonic. Simple and Secure. </Hint>
                <Hint>To learn more, visit <Link href='https://github.com/polymorpher/one-wallet/wiki'>ONE Wallet Wiki</Link></Hint>
              </Space>
            </Row>
          </Section>
        )}
      </Transition>
    </>
  )
}

export default Create
