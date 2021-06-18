import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
import api from '../api'
import ONEUtil from '../../../lib/util'
import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator'
import { Button, Row, Space, Typography, Slider, Image, message, Progress, Timeline } from 'antd'
import { RedoOutlined, LoadingOutlined } from '@ant-design/icons'
import humanizeDuration from 'humanize-duration'
import AnimatedSection from '../components/AnimatedSection'
import b32 from 'hi-base32'
import qrcode from 'qrcode'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import WalletConstants from '../constants/wallet'
import util from '../util'
import { Hint, Heading, InputBox } from '../components/Text'
const { Text, Link } = Typography

const genName = () => uniqueNamesGenerator({
  dictionaries: [colors, animals],
  style: 'capital',
  separator: ' ',
  length: 1
})

const Create = () => {
  const dispatch = useDispatch()
  const history = useHistory()
  const network = useSelector(state => state.wallet.network)
  const [name, setName] = useState(genName())
  const otpSeedBuffer = new Uint8Array(20)
  // eslint-disable-next-line no-unused-vars
  const [seed, setSeed] = useState(window.crypto.getRandomValues(otpSeedBuffer))
  const [duration, setDuration] = useState(WalletConstants.defaultDuration)
  const [lastResortAddress, setLastResortAddress] = useState()
  const [dailyLimit, setDailyLimit] = useState(WalletConstants.defaultDailyLimit)

  const [worker, setWorker] = useState()
  const [root, setRoot] = useState()
  const [hseed, setHseed] = useState()
  const [layers, setLayers] = useState()
  const [slotSize, setSlotSize] = useState()
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [address, setAddress] = useState() // '0x12345678901234567890'
  const [effectiveTime, setEffectiveTime] = useState()

  const [durationVisible, setDurationVisible] = useState(false)
  const [section, setSection] = useState(1)
  const [qrCodeData, setQRCodeData] = useState()
  const [showOtpVerification, setShowOtpVerification] = useState()
  const [otp, setOtp] = useState('')

  const [deploying, setDeploying] = useState()

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
      const t = Math.floor(Date.now() / WalletConstants.interval) * WalletConstants.interval
      setEffectiveTime(t)
      worker && worker.postMessage({
        seed, effectiveTime: t, duration, slotSize, interval: WalletConstants.interval
      })
    }
  }, [section])

  const verifyOtp = () => {
    const expected = ONEUtil.genOTP({ seed })
    const code = new DataView(expected.buffer).getUint32(0, false).toString()
    if (code.padStart(6, '0') !== otp.padStart(6, '0')) {
      console.log(`Expected: ${code}. Got: ${otp}`)
      message.error('Code is incorrect. Please try again.')
    } else {
      message.success('Nice! Your code is correct!')
      setSection(3)
    }
  }

  const storeLayers = async () => {
    if (!root) {
      message.error('Cannot store credentials of the wallet. Error: Root is not set')
      return
    }
    return storage.setItem(ONEUtil.hexView(root), layers)
  }

  const deploy = async () => {
    if (!root) {
      message.error('Cannot deploy wallet. Error: root is not set.')
      return
    }
    setDeploying(true)
    try {
      const { address } = await api.relayer.create({
        root: ONEUtil.hexString(root),
        height: layers.length,
        interval: WalletConstants.interval / 1000,
        t0: effectiveTime / WalletConstants.interval,
        lifespan: duration / WalletConstants.interval,
        slotSize,
        lastResortAddress,
        dailyLimit: ONEUtil.toFraction(dailyLimit).toString()
      })
      console.log('Deployed. Received contract address', address)
      const wallet = {
        name,
        address,
        root: ONEUtil.hexView(root),
        duration,
        effectiveTime,
        lastResortAddress,
        dailyLimit: ONEUtil.toFraction(dailyLimit).toString(),
        hseed: ONEUtil.hexView(hseed),
        network
      }
      await storeLayers()
      dispatch(walletActions.updateWallet(wallet))
      dispatch(walletActions.fetchBalanceSuccess({ address, balance: 0 }))
      setAddress(address)
      setDeploying(false)
      message.success('Your wallet is deployed!')
      setSection(4)
    } catch (ex) {
      util.handleError(ex)
      setDeploying(false)
    }
  }

  useEffect(() => {
    const worker = new Worker('ONEWalletWorker.js')
    worker.onmessage = (event) => {
      const { status, current, total, stage, result } = event.data
      if (status === 'working') {
        // console.log(`Completed ${(current / total * 100).toFixed(2)}%`)
        setProgress(Math.round(current / total * 100))
        setProgressStage(stage)
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
      <AnimatedSection show={section === 1}>
        <Heading>What do you want to call your wallet?</Heading>
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
          <Link onClick={() => setDurationVisible(true)}>Need more or less than a year?</Link>
          {durationVisible &&
            <Space>
              <Slider
                style={{ width: 200 }}
                value={duration} tooltipVisible={false} onChange={(v) => setDuration(v)}
                min={WalletConstants.minDuration} max={WalletConstants.maxDuration}
              />
              <Hint>{humanizeDuration(duration, { units: ['y', 'mo'], round: true })}</Hint>
            </Space>}
        </Space>
      </AnimatedSection>
      <AnimatedSection show={section === 2}>
        <Row>
          <Space direction='vertical'>
            <Heading>Now, scan the QR code with your Google Authenticator</Heading>
            <Hint>You can restore your wallet from your Google Authenticator if you lost the data on your computer.</Hint>
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
      </AnimatedSection>
      <AnimatedSection show={section === 3}>
        <Row>
          <Space direction='vertical'>
            <Heading>Final step: deploy your ONE Wallet to blockchain</Heading>
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
            <InputBox width={500} margin={16} value={lastResortAddress} onChange={({ target: { value } }) => setLastResortAddress(value)} placeholder='0x......' />
            <Hint>If you lost your authenticator, you can still transfer all your funds to that address</Hint>
          </Space>
        </Row>
        <Row style={{ marginBottom: 32 }}>
          <Space direction='vertical'>
            <Space>
              <Button disabled={!root || !deploying} type='primary' shape='round' size='large' onClick={() => deploy()}>Let's do it</Button>
              {deploying && <LoadingOutlined />}
            </Space>
            {!root &&
              <>
                <Hint>One moment... we are still preparing your wallet</Hint>
                <Space size='large'>
                  <Progress
                    type='circle'
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#87d068',
                    }}
                    percent={progress}
                  />
                  <Space direction='vertical'>
                    <Timeline pending={progressStage < 2 && 'Securing your keyless ONE Wallet'}>
                      <Timeline.Item color={progressStage < 1 ? 'grey' : 'green'}>Computing one-time password proofs</Timeline.Item>
                      <Timeline.Item color={progressStage < 2 ? 'grey' : 'green'}>Hashing proofs as layers for blockchain</Timeline.Item>
                    </Timeline>
                  </Space>
                </Space>
              </>}
          </Space>
        </Row>
        <Row>
          <Space direction='vertical'>
            <Hint>No private key. No mnemonic. Simple and Secure. </Hint>
            <Hint>To learn more, visit <Link href='https://github.com/polymorpher/one-wallet/wiki'>ONE Wallet Wiki</Link></Hint>
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === 4}>
        <Space direction='vertical'>
          <Heading>You are all set!</Heading>
          <Space direction='vertical' size='small'>
            <Hint>Wallet Address</Hint>
            <Text>{address}</Text>
          </Space>
          <Button style={{ marginTop: 32 }} disabled={!address} type='primary' shape='round' size='large' onClick={() => history.push(Paths.showAddress(address))}>Go to My Wallet</Button>
        </Space>
      </AnimatedSection>
    </>
  )
}

export default Create
