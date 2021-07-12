import React, { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
import api from '../api'
import ONEUtil from '../../../lib/util'
import ONENames from '../../../lib/names'
// import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator'
import { Button, Row, Space, Typography, Slider, Image, message, Progress, Timeline, Select } from 'antd'
import { RedoOutlined, LoadingOutlined, SearchOutlined } from '@ant-design/icons'
import humanizeDuration from 'humanize-duration'
import AnimatedSection from '../components/AnimatedSection'
import b32 from 'hi-base32'
import qrcode from 'qrcode'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import WalletConstants from '../constants/wallet'
import util, { useWindowDimensions } from '../util'
import { handleAPIError, handleAddressError } from '../handler'
import { Hint, Heading, InputBox } from '../components/Text'
import OtpBox from '../components/OtpBox'
import { getAddress } from '@harmony-js/crypto'
const { Text, Link } = Typography

// const genName = () => uniqueNamesGenerator({
//   dictionaries: [colors, animals],
//   style: 'capital',
//   separator: ' ',
//   length: 1
// })

const genName = (existingNames) => {
  const name = ONENames.randomWord()
  if (existingNames && existingNames.includes(name)) {
    return genName()
  }
  return name
}

const Create = () => {
  const { isMobile } = useWindowDimensions()
  const dispatch = useDispatch()
  const history = useHistory()
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const [name, setName] = useState(genName(Object.keys(wallets).map(k => wallets[k].name)))
  const otpSeedBuffer = new Uint8Array(20)
  // eslint-disable-next-line no-unused-vars
  const [seed, setSeed] = useState(window.crypto.getRandomValues(otpSeedBuffer))
  const [duration, setDuration] = useState(WalletConstants.defaultDuration)
  const [lastResortAddress, setLastResortAddress] = useState()
  const [dailyLimit] = useState(WalletConstants.defaultDailyLimit)

  const [worker, setWorker] = useState()
  const [root, setRoot] = useState()
  const [hseed, setHseed] = useState()
  const [layers, setLayers] = useState()
  const [slotSize, setSlotSize] = useState(1)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [address, setAddress] = useState() // '0x12345678901234567890'
  const [effectiveTime, setEffectiveTime] = useState()

  const [durationVisible, setDurationVisible] = useState(false)
  const [section, setSection] = useState(2)
  const [qrCodeData, setQRCodeData] = useState()
  const [otp, setOtp] = useState('')

  const [deploying, setDeploying] = useState()

  const getQRCodeUri = () => {
    // otpauth://TYPE/LABEL?PARAMETERS
    return `otpauth://totp/${name}?secret=${b32.encode(seed)}&issuer=Harmony`
  }
  useEffect(() => {
    (async function () {
      const uri = getQRCodeUri()
      const data = await qrcode.toDataURL(uri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setQRCodeData(data)
    })()
  }, [name])

  useEffect(() => {
    if (section === 2 && worker) {
      console.log('posting to worker')
      const t = Math.floor(Date.now() / WalletConstants.interval) * WalletConstants.interval
      setEffectiveTime(t)
      worker && worker.postMessage({
        seed, effectiveTime: t, duration, slotSize, interval: WalletConstants.interval
      })
    }
  }, [section, worker])

  useEffect(() => {
    if (otp.length !== 6) {
      return
    }
    const expected = ONEUtil.genOTP({ seed })
    const code = new DataView(expected.buffer).getUint32(0, false).toString()
    if (code.padStart(6, '0') !== otp.padStart(6, '0')) {
      console.log(`Expected: ${code}. Got: ${otp}`)
      message.error('Code is incorrect. Please try again.')
    } else {
      setSection(3)
    }
  }, [otp])

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

    let normalizedAddress = ''
    if (lastResortAddress !== '') {
      // Ensure valid address for both 0x and one1 formats
      normalizedAddress = util.safeExec(util.normalizedAddress, [lastResortAddress], handleAddressError)
      if (!normalizedAddress) {
        return
      }
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
        lastResortAddress: normalizedAddress,
        dailyLimit: ONEUtil.toFraction(dailyLimit).toString()
      })
      console.log('Deployed. Received contract address', address)
      const wallet = {
        name,
        address,
        root: ONEUtil.hexView(root),
        duration,
        slotSize,
        effectiveTime,
        lastResortAddress: normalizedAddress,
        dailyLimit: ONEUtil.toFraction(dailyLimit).toString(),
        hseed: ONEUtil.hexView(hseed),
        network,
      }
      await storeLayers()
      dispatch(walletActions.updateWallet(wallet))
      dispatch(walletActions.fetchBalanceSuccess({ address, balance: 0 }))
      setAddress(address)
      setDeploying(false)
      message.success('Your wallet is deployed!')
      history.push(Paths.showAddress(address))
      // setSection(4)
    } catch (ex) {
      handleAPIError(ex)
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
      <AnimatedSection show={section === 1} style={{ maxWidth: 640 }}>
        <Heading>What do you want to call your wallet?</Heading>
        <Hint>This is only stored on your computer to distinguish your wallets.</Hint>
        <Row align='middle' style={{ marginBottom: 32, marginTop: 16 }}>
          <Space size='large'>
            <InputBox
              prefix={<Button type='text' onClick={() => setName(genName())} style={{ }}><RedoOutlined /></Button>}
              value={name} onChange={({ target: { value } }) => setName(value)}
              style={{ padding: 0 }}
            />
            <Button type='primary' shape='round' size='large' onClick={() => setSection(2)}>Next</Button>
          </Space>
        </Row>

        <Space direction='vertical'>
          <Hint>Next, we will set up a ONE Wallet that expires in a year. When the wallet expires, you may create a new wallet and transfer the funds. The funds can also be recovered to an address you set later.</Hint>
          <Link onClick={() => setDurationVisible(true)}>Need more time?</Link>
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
      <AnimatedSection show={section === 2} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            {/* <Heading>Now, scan the QR code with your Google Authenticator</Heading> */}
            <Heading>Create Your ONE Wallet</Heading>
            <Hint>You need the 6-digit code from Google authenticator to transfer funds. You can restore your wallet using Google authenticator on any device.</Hint>
            <Row justify='center'>
              {qrCodeData && <Image src={qrCodeData} preview={false} width={isMobile ? 192 : 256} />}
            </Row>
          </Space>
        </Row>
        <Row>
          <Space direction='vertical' size='large' align='center'>
            <Hint>After you are done, type in the 6-digit code from Google authenticator.</Hint>
            <OtpBox
              shouldAutoFocus
              value={otp}
              onChange={setOtp}
            />
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === 3} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            <Heading>Prepare Your ONE Wallet</Heading>
          </Space>
        </Row>
        {/* <Row style={{ marginBottom: 16 }}> */}
        {/*  <Space direction='vertical' size='small'> */}
        {/*    <Hint>Set up a daily spending limit:</Hint> */}
        {/*    <InputBox margin={16} width={200} value={dailyLimit} onChange={({ target: { value } }) => setDailyLimit(parseInt(value || 0))} suffix='ONE' /> */}
        {/*  </Space> */}
        {/* </Row> */}
        <Row style={{ marginBottom: 48 }}>
          <Space direction='vertical' size='small'>
            <Hint>Set up a fund recovery address:</Hint>
            <Select
              suffixIcon={<SearchOutlined />}
              placeholder='one1......'
              style={{ width: isMobile ? '100%' : 500, borderBottom: '1px dashed black' }} bordered={false} showSearch onChange={(v) => setLastResortAddress(v)}
              value={lastResortAddress}
              onSearch={(v) => setLastResortAddress(v)}
            >
              {Object.keys(wallets).filter(k => wallets[k].network === network).map(k => {
                const addr = util.safeOneAddress(wallets[k].address)
                return (
                  <Select.Option key={k} value={util.safeOneAddress(wallets[k].address)}>
                    ({wallets[k].name}) {isMobile ? util.ellipsisAddress(addr) : addr}
                  </Select.Option>
                )
              })}
              {lastResortAddress && !wallets[util.safeNormalizedAddress(lastResortAddress)] && <Select.Option key={lastResortAddress} value={lastResortAddress}>{lastResortAddress}</Select.Option>}
              <Select.Option key='later' value=''> I want to do this later in my wallet </Select.Option>
            </Select>
            {/* <InputBox width={500} margin={16} value={lastResortAddress} onChange={({ target: { value } }) => setLastResortAddress(value)} placeholder='one1......' /> */}
            <Hint>If you lost your authenticator, your can recover funds to this address</Hint>
          </Space>
        </Row>
        <Row style={{ marginBottom: 32 }}>
          <Space direction='vertical'>
            <Space>
              <Button disabled={!root || deploying} type='primary' shape='round' size='large' onClick={() => deploy()}>Create Now</Button>
              {deploying && <LoadingOutlined />}
            </Space>
            {!root &&
              <>
                <Hint>One moment... we are still preparing your wallet</Hint>
                <Space size='large' direction={isMobile && 'vertical'}>
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
                      <Timeline.Item color={progressStage < 1 ? 'grey' : 'green'}>Securing the wallet</Timeline.Item>
                      <Timeline.Item color={progressStage < 2 ? 'grey' : 'green'}>Preparing signatures</Timeline.Item>
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
            <Hint>In Beta, your wallet is subject to a daily spending limit of {WalletConstants.defaultDailyLimit} ONE</Hint>
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === 4}>
        <Space direction='vertical'>
          <Heading>You are all set!</Heading>
          <Space direction='vertical' size='small'>
            <Hint>Wallet Address</Hint>
            <Text>{address && getAddress(address).bech32}</Text>
          </Space>
          <Button style={{ marginTop: 32 }} disabled={!address} type='primary' shape='round' size='large' onClick={() => history.push(Paths.showAddress(address))}>Go to My Wallet</Button>
        </Space>
      </AnimatedSection>
    </>
  )
}

export default Create
