import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
import api from '../api'
import ONEUtil from '../../../lib/util'
import ONEConstants from '../../../lib/constants'
import ONENames from '../../../lib/names'
import { MigrationPayload } from '../proto/oauthMigration'
// import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator'
import {
  Button,
  Row,
  Space,
  Typography,
  Slider,
  Image,
  message,
  Progress,
  Timeline,
  Checkbox,
  Tooltip
} from 'antd'
import { RedoOutlined, LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import humanizeDuration from 'humanize-duration'
import AnimatedSection from '../components/AnimatedSection'
import b32 from 'hi-base32'
import qrcode from 'qrcode'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import WalletConstants from '../constants/wallet'
import util, { useWindowDimensions, OSType } from '../util'
import { handleAPIError, handleAddressError } from '../handler'
import { Hint, Heading, InputBox, Warning } from '../components/Text'
import OtpBox from '../components/OtpBox'
import { getAddress } from '@harmony-js/crypto'
import AddressInput from '../components/AddressInput'
const { Text, Link } = Typography

// const genName = () => uniqueNamesGenerator({
//   dictionaries: [colors, animals],
//   style: 'capital',
//   separator: ' ',
//   length: 1
// })

const genName = (existingNames) => {
  const name = `${ONENames.randomWord()} ${ONENames.randomWord()} ${ONENames.randomWord()}`
  if (existingNames && existingNames.includes(name)) {
    return genName()
  }
  return name
}

const generateOtpSeed = () => {
  const otpSeedBuffer = new Uint8Array(20)
  return window.crypto.getRandomValues(otpSeedBuffer)
}

const OTPUriMode = {
  STANDARD: 0,
  MIGRATION: 1,
  TOTP: 2, // seems deprecated, should not use unless it is for testing
}

const getQRCodeUri = (otpSeed, otpDisplayName, mode = OTPUriMode.STANDARD) => {
  if (mode === OTPUriMode.STANDARD) {
    // otpauth://TYPE/LABEL?PARAMETERS
    return `otpauth://totp/${otpDisplayName}?secret=${b32.encode(otpSeed)}&issuer=Harmony`
  }
  if (mode === OTPUriMode.MIGRATION) {
    const payload = MigrationPayload.create({ otp_parameters: [{ issuer: 'Harmony', secret: otpSeed, name: otpDisplayName }] })
    const encoded = MigrationPayload.encode(payload).finish().toString('base64')
    console.log(encoded)
    return `otpauth-migration://offline?data=${encoded}`
  }
  return null
}

const getSecondCodeName = (name) => `${name} - 2nd`

// not constructing qrCodeData on the fly (from seed) because generating a PNG takes noticeable amount of time. Caller needs to make sure qrCodeData is consistent with seed
const buildQRCodeComponent = ({ seed, name, os, isMobile, qrCodeData }) => {
  const image = <Image src={qrCodeData} preview={false} width={isMobile ? 192 : 256} />
  let href
  if (os === OSType.iOS) {
    href = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
  } else if (os === OSType.Android) {
    href = getQRCodeUri(seed, name, OTPUriMode.STANDARD)
  } else if (isMobile) {
    // To test in more devices
    href = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
  }

  return (
    <Row justify='center'>
      {isMobile && qrCodeData && <Link href={href} target='_blank' rel='noreferrer'>{image}</Link>}
      {!isMobile && qrCodeData && image}
    </Row>
  )
}

const sectionViews = {
  setupWalletDetails: 1,
  setupOtp: 2,
  setupSecondOtp: 3,
  prepareWallet: 4,
  walletSetupDone: 5
}

const Create = () => {
  const generateNewOtpName = () => genName(Object.keys(wallets).map(k => wallets[k].name))

  const { isMobile, os } = useWindowDimensions()
  const dispatch = useDispatch()
  const history = useHistory()
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const [name, setName] = useState(generateNewOtpName())
  // eslint-disable-next-line no-unused-vars
  const [seed, setSeed] = useState(generateOtpSeed())
  // eslint-disable-next-line no-unused-vars
  const [seed2, setSeed2] = useState(generateOtpSeed())
  const [duration, setDuration] = useState(WalletConstants.defaultDuration)

  // Used for Recovery address setup. Only used when user does not choose a Recovery address.
  const oneWalletTreasurySelectOption = {
    value: WalletConstants.oneWalletTreasury.address,
    label: `(1wallet Treasury) ${util.safeOneAddress(WalletConstants.oneWalletTreasury.address)}`
  }

  // A valid wallet of user's wallets in the network can be used as default recovery wallet.
  const defaultRecoveryWallet = Object.keys(wallets)
    .map((address) => ({ ...wallets[address], oneAddress: util.safeOneAddress(wallets[address].address) }))
    .find((wallet) => util.safeOneAddress(wallet.address) && wallet.network === network)

  const defaultRecoveryAddress = defaultRecoveryWallet
    ? {
        value: defaultRecoveryWallet.oneAddress,
        label: `(${defaultRecoveryWallet.name}) ${defaultRecoveryWallet.oneAddress}`
      }
    : oneWalletTreasurySelectOption

  const [lastResortAddress, setLastResortAddress] = useState(defaultRecoveryAddress)
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
  const [doubleOtp, setDoubleOtp] = useState(false)

  const [durationVisible, setDurationVisible] = useState(false)
  const [section, setSection] = useState(sectionViews.setupOtp)
  const [qrCodeData, setQRCodeData] = useState()
  const [secondOtpQrCodeData, setSecondOtpQrCodeData] = useState()
  const [otp, setOtp] = useState('')

  const [deploying, setDeploying] = useState()

  const otpRef = useRef()

  const securityParameters = ONEUtil.securityParameters({
    majorVersion: ONEConstants.MajorVersion,
    minorVersion: ONEConstants.MinorVersion,
  })

  useEffect(() => {
    (async function () {
      const otpUri = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
      const secondOtpUri = getQRCodeUri(seed2, getSecondCodeName(name), OTPUriMode.MIGRATION)
      const otpQrCodeData = await qrcode.toDataURL(otpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      const secondOtpQrCodeData = await qrcode.toDataURL(secondOtpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setQRCodeData(otpQrCodeData)
      setSecondOtpQrCodeData(secondOtpQrCodeData)
    })()
  }, [name])

  useEffect(() => {
    if (section === sectionViews.setupOtp && worker) {
      // console.log('Posting to worker. Security parameters:', securityParameters)
      const t = Math.floor(Date.now() / WalletConstants.interval) * WalletConstants.interval
      setEffectiveTime(t)
      worker && worker.postMessage({
        seed,
        seed2: doubleOtp && seed2,
        effectiveTime: t,
        duration,
        slotSize,
        interval: WalletConstants.interval,
        ...securityParameters,
      })
    }
  }, [section, worker])

  useEffect(() => {
    const settingUpSecondOtp = section === sectionViews.setupSecondOtp
    if (otp.length !== 6) {
      return
    }
    const currentSeed = settingUpSecondOtp ? seed2 : seed
    const expected = ONEUtil.genOTP({ seed: currentSeed })
    const code = new DataView(expected.buffer).getUint32(0, false).toString()
    setOtp('')
    if (code.padStart(6, '0') !== otp.padStart(6, '0')) {
      message.error('Code is incorrect. Please try again.')
      otpRef?.current?.focusInput(0)
    } else if (doubleOtp && !settingUpSecondOtp) {
      setSection(sectionViews.setupSecondOtp)
      otpRef?.current?.focusInput(0)
    } else {
      setSection(sectionViews.prepareWallet)
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

    // Ensure valid address for both 0x and one1 formats
    const normalizedAddress = util.safeExec(util.normalizedAddress, [lastResortAddress?.value], handleAddressError)

    if (!normalizedAddress) {
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
        lastResortAddress: normalizedAddress,
        dailyLimit: ONEUtil.toFraction(dailyLimit).toString()
      })
      // console.log('Deployed. Received contract address', address)
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
        doubleOtp,
        ...securityParameters,
      }
      await storeLayers()
      dispatch(walletActions.updateWallet(wallet))
      dispatch(walletActions.fetchBalanceSuccess({ address, balance: 0 }))
      setAddress(address)
      setDeploying(false)
      message.success('Your wallet is deployed!')
      setTimeout(() => {
        dispatch(walletActions.fetchWallet({ address }))
        history.push(Paths.showAddress(address))
      }, 2500)
      // setSection(4)
    } catch (ex) {
      handleAPIError(ex)
      setDeploying(false)
    }
  }

  useEffect(() => {
    const worker = new Worker('/ONEWalletWorker.js')
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
        // console.log('Received created wallet from worker:', result)
      }
    }
    setWorker(worker)
  }, [])

  return (
    <>
      <AnimatedSection show={section === sectionViews.setupWalletDetails} style={{ maxWidth: 640 }}>
        <Heading>What do you want to call your wallet?</Heading>
        <Hint>This is only stored on your computer to distinguish your wallets.</Hint>
        <Row align='middle' style={{ marginBottom: 32, marginTop: 16 }}>
          <Space size='large'>
            <InputBox
              prefix={<Button type='text' onClick={() => setName(genName())} style={{ }}><RedoOutlined /></Button>}
              value={name} onChange={({ target: { value } }) => setName(value)}
              style={{ padding: 0 }}
            />
            <Button type='primary' shape='round' size='large' onClick={() => setSection(sectionViews.setupOtp)}>Next</Button>
          </Space>
        </Row>
        <Space direction='vertical'>
          <Hint>Next, we will set up a 1wallet that expires in a year. When the wallet expires, you may create a new wallet and transfer the funds. The funds can also be recovered to an address you set later.</Hint>
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
      <AnimatedSection show={section === sectionViews.setupOtp} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            {/* <Heading>Now, scan the QR code with your Google Authenticator</Heading> */}
            <Heading level={isMobile ? 4 : 2}>Create Your 1wallet</Heading>
            <Hint>You need the 6-digit code from Google authenticator to transfer funds. You can restore your wallet using Google authenticator on any device.</Hint>
            {buildQRCodeComponent({seed, name, os, isMobile, qrCodeData})}
          </Space>
        </Row>
        <Row>
          <Space direction='vertical' size='large' align='center'>
            <Hint>After you are done, type in the 6-digit code from Google authenticator</Hint>
            <Hint style={{ fontSize: isMobile ? 12 : undefined }}>
              Code for <b>Harmony ({name})</b>
            </Hint>
            <OtpBox
              shouldAutoFocus={!isMobile}
              ref={otpRef}
              value={otp}
              onChange={setOtp}
            />
            <Checkbox onChange={() => setDoubleOtp(!doubleOtp)}>
              <Space>
                <Hint style={{ fontSize: isMobile ? 12 : undefined }}>
                  Use two codes to enhance security
                </Hint>
                <Tooltip title={<div>You will need to scan another QR-code on the next page. Each time you make a transaction, you will need to type in two 6-digit codes, which are shown simultaneously next to each other on your Google authenticator.<br /><br />This is advisable if you intend to make larger transactions with this wallet</div>}>
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            </Checkbox>
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === sectionViews.setupSecondOtp} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            <Heading>Create Your 1wallet (second code)</Heading>
            <Hint align='center'>Scan with your Google Authenticator to setup the <b>second</b> code</Hint>
            {buildQRCodeComponent({seed2, getSecondCodeName(name), os, isMobile, secondOtpQrCodeData})}
          </Space>
        </Row>
        <Row>
          <Space direction='vertical' size='large' align='center'>
            <Hint>Type in the <b>second</b> 6-digit code from Google authenticator</Hint>
            <Hint style={{ fontSize: isMobile ? 12 : undefined }}>Code for <b>Harmony ({getSecondCodeName(name)})</b></Hint>
            <OtpBox
              shouldAutoFocus={!isMobile}
              ref={otpRef}
              value={otp}
              onChange={setOtp}
            />
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === sectionViews.prepareWallet} style={{ maxWidth: 640 }}>
        <Row>
          <Space direction='vertical'>
            <Heading>Prepare Your 1wallet</Heading>
          </Space>
        </Row>
        {/* <Row style={{ marginBottom: 16 }}> */}
        {/*  <Space direction='vertical' size='small'> */}
        {/*    <Hint>Set up a daily spending limit:</Hint> */}
        {/*    <InputBox margin={16} width={200} value={dailyLimit} onChange={({ target: { value } }) => setDailyLimit(parseInt(value || 0))} suffix='ONE' /> */}
        {/*  </Space> */}
        {/* </Row> */}
        <Row style={{ marginBottom: 48 }}>
          <Space direction='vertical' size='small' style={{ width: '100%' }}>
            <Hint>Set up a fund recovery address:</Hint>
            <AddressInput
              addressValue={lastResortAddress}
              setAddressCallback={setLastResortAddress}
              extraSelectOptions={[{
                address: WalletConstants.oneWalletTreasury.address,
                label: '1wallet treasury'
              }]}
            />
            <Hint>
              {lastResortAddress.value !== WalletConstants.oneWalletTreasury.address && <span style={{ color: 'red' }}>You cannot change this later. </span>}
              If you lost your authenticator, your can recover funds to this address. You can also send 1.0 ONE from the recovery address to trigger auto-recovery. You can use any wallet address as a recovery address. It does not need to be a 1wallet.
            </Hint>
            {lastResortAddress.value === WalletConstants.oneWalletTreasury.address &&
              <Warning style={{ marginTop: 24 }}>
                We suggest you choose your own address, such as an account from Harmony CLI wallet or Chrome Extension wallet. <br /><br /> 1wallet treasury generally cannot recover your funds except in rare cases which many users are affected by software bugs. <br /><br /> 1wallet treasury is managed by 5 reputable owners and requires a majority vote to make any transfer.<br /><br />If you choose 1wallet treasury as the recovery address, you have an opportunity to change it later in your wallet.
              </Warning>}
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
                    <Timeline pending={progressStage < 2 && 'Securing your keyless 1wallet'}>
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
            <Hint>To learn more, visit <Link href='https://github.com/polymorpher/one-wallet/wiki'>1wallet Wiki</Link></Hint>
            <Hint>In Beta, your wallet is subject to a daily spending limit of {WalletConstants.defaultDailyLimit} ONE</Hint>
          </Space>
        </Row>
      </AnimatedSection>
      <AnimatedSection show={section === sectionViews.walletSetupDone}>
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
