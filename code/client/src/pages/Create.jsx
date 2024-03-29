import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
import api from '../api'
import ONEUtil from '../../../lib/util'
import ONEConstants from '../../../lib/constants'
import ONENames from '../../../lib/names'
import Row from 'antd/es/row'
import Tooltip from 'antd/es/tooltip'
import Button from 'antd/es/button'
import Space from 'antd/es/space'
import Spin from 'antd/es/spin'
import Card from 'antd/es/card'
import message from '../message'
import LoadingOutlined from '@ant-design/icons/LoadingOutlined'
import CheckOutlined from '@ant-design/icons/CheckOutlined'
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined'
import humanizeDuration from 'humanize-duration'
import AnimatedSection, { AnimatedSection2 } from '../components/AnimatedSection'
import qrcode from 'qrcode'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import { balanceActions } from '../state/modules/balance'
import WalletConstants from '../constants/wallet'
import util, { useWindowDimensions, OSType, generateOtpSeed } from '../util'
import { handleAPIError, handleAddressError } from '../handler'
import { Hint, Heading, InputBox, Warning, Text, Link, Paragraph, SiderLink } from '../components/Text'
import AddressInput from '../components/AddressInput'
import WalletCreateProgress from '../components/WalletCreateProgress'
import { TallRow } from '../components/Grid'
import { FlashyButton } from '../components/Buttons'
import { buildQRCodeComponent, getQRCodeUri, getSecondCodeName, OTPUriMode } from '../components/OtpTools'
import { OtpSetup, OtpSetup2, TwoCodeOption, TwoCodeOption2 } from '../components/OtpSetup'
import config from '../config'
import SignupAccount from './Create/SignupAccount'
import { useTheme, getColorPalette } from '../theme'
import { RedoOutlined } from '@ant-design/icons'
import Slider from 'antd/es/slider'

const getGoogleAuthenticatorUrl = (os) => {
  let link = 'https://apps.apple.com/us/app/google-authenticator/id388497605'
  if (os === OSType.Android) {
    link = 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2'
  }
  return link
}
const getGoogleAuthenticatorAppLink = (os) => {
  const link = getGoogleAuthenticatorUrl(os)
  return <Link href={link} target='_blank' rel='noreferrer'>authenticator</Link>
}

const sectionViews = {
  setupWalletDetails: 1, // not used
  setupOtp: 2,
  prepareWallet: 3,
  walletSetupDone: 4
}

const securityParameters = ONEUtil.securityParameters({
  majorVersion: ONEConstants.MajorVersion,
  minorVersion: ONEConstants.MinorVersion,
})

const Create = ({ expertMode, showRecovery }) => {
  const { isMobile } = useWindowDimensions()
  const network = useSelector(state => state.global.network)
  const v2ui = useSelector(state => state.global.v2ui)
  const wallets = useSelector(state => state.wallet)

  const generateNewOtpName = () => ONENames.genName(Object.keys(wallets).map(k => wallets[k].name))

  // Configurations for creating the wallet - cannot be directly changed by the UI (right they cannot be changed at all)
  const setupConfig = useRef({
    seed: generateOtpSeed(),
    seed2: generateOtpSeed(),
  }).current

  // related to state variables that may change during or after the creation process
  const [walletState, setWalletState] = useState({
    predictedAddress: undefined,
    address: undefined,
    doubleOtp: false,
    otpQrCodeData: undefined,
    secondOtpQrCodeData: undefined,
    name: generateNewOtpName(),
    duration: WalletConstants.defaultDuration,
    customizeSettings: expertMode ? true : null
  })
  const [otpReady, setOtpReady] = useState(false)

  const code = useSelector(state => state.cache.code[network])

  const [worker, setWorker] = useState()

  // related to wallet core parameters (on smart contract) and local authentication parameters (not on smart contract)
  const [coreSettings, setCoreSettings] = useState({ effectiveTime: undefined, root: undefined, hseed: undefined, layers: undefined, innerTrees: undefined, slotSize: 1 })
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)

  const [section, setSection] = useState(sectionViews.setupOtp)
  const [qrCodeMode, setQrCodeMode] = useState(OTPUriMode.STANDARD)

  useEffect(() => {
    if (!code || !coreSettings.effectiveTime) {
      console.log({ code, effectiveTime: coreSettings.effectiveTime })
      return
    }
    (async function () {
      const factoryAddress = config.networks[network].deploy.factory
      const address = ONEUtil.predictAddress({ seed: setupConfig.seed, factoryAddress, code: ONEUtil.hexStringToBytes(code) })
      message.debug(`Predicting wallet address ${address} using parameters: ${JSON.stringify({ seed: ONEUtil.base32Encode(setupConfig.seed), deployerAddress: factoryAddress })}; code keccak hash=${ONEUtil.hexView(ONEUtil.keccak(code))}`, null, { console: true })
      const oneAddress = util.safeOneAddress(address)
      const otpDisplayName = `${ONENames.nameWithTime(walletState.name, coreSettings.effectiveTime)} [${oneAddress}]`
      const otpDisplayName2 = `${ONENames.nameWithTime(getSecondCodeName(walletState.name), coreSettings.effectiveTime)} [${oneAddress}]`
      const otpUri = getQRCodeUri(setupConfig.seed, otpDisplayName, qrCodeMode)
      const secondOtpUri = getQRCodeUri(setupConfig.seed2, otpDisplayName2, qrCodeMode)
      const color = qrCodeMode === OTPUriMode.MIGRATION ? { dark: '#00008B' } : {}
      const otpQrCodeData = await qrcode.toDataURL(otpUri, { color, errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      const secondOtpQrCodeData = await qrcode.toDataURL(secondOtpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setWalletState(s => ({ ...s, otpQrCodeData, secondOtpQrCodeData, predictedAddress: address }))
      setOtpReady(true)
    })()
  }, [code, network, coreSettings.effectiveTime, walletState.address, walletState.doubleOtp, walletState.name, qrCodeMode])

  useEffect(() => {
    if (section === sectionViews.setupOtp && worker && setupConfig.seed) {
      const t = Math.floor(Date.now() / WalletConstants.interval6) * WalletConstants.interval6
      const salt = ONEUtil.hexView(generateOtpSeed())
      setCoreSettings(c => ({ ...c, effectiveTime: t }))
      if (worker) {
        message.debug(`[Create] posting to worker salt=${salt}`)
        worker.postMessage({
          salt,
          seed: setupConfig.seed,
          seed2: walletState.doubleOtp && setupConfig.seed2,
          effectiveTime: t,
          duration: walletState.duration,
          slotSize: coreSettings.slotSize,
          interval: WalletConstants.interval,
          ...securityParameters,
        })
        setCoreSettings(c => ({ ...c, root: undefined, hseed: undefined, layers: undefined, innerTrees: undefined }))
        worker.onmessage = (event) => {
          const { status, current, total, stage, result, salt: workerSalt } = event.data
          if (workerSalt && workerSalt !== salt) {
            message.debug(`Discarding outdated worker result (salt=${workerSalt}, expected=${salt})`, null, { console: true })
            return
          }
          if (status === 'working') {
            // console.log(`Completed ${(current / total * 100).toFixed(2)}%`)
            setProgress(Math.round(current / total * 100))
            setProgressStage(stage)
          }
          if (status === 'done') {
            message.debug(`[Create] done salt=${salt}`)
            const { hseed, root, layers, maxOperationsPerInterval, innerTrees } = result
            setCoreSettings(c => ({ ...c, root, hseed, layers, slotSize: maxOperationsPerInterval, innerTrees }))
            // console.log('Received created wallet from worker:', result)
          }
        }
      }
    }
  }, [section, worker, walletState.doubleOtp, walletState.duration])

  useEffect(() => {
    if (!worker) {
      const worker = new Worker('/ONEWalletWorker.js')
      setWorker(worker)
    }
    return () => {
      if (worker) {
        worker.terminate()
      }
    }
  }, [])

  const wrapperStyle = v2ui ? { display: 'flex', justifyContent: 'center' } : {}

  return (
    <div style={wrapperStyle}>
      {section === sectionViews.setupOtp &&
        <SetupOtpSection
          setQrCodeMode={setQrCodeMode} qrCodeMode={qrCodeMode}
          expertMode={expertMode} otpReady={otpReady} effectiveTime={coreSettings.effectiveTime} walletState={walletState} setWalletState={setWalletState} setupConfig={setupConfig} setSection={setSection}
        />}
      {section === sectionViews.prepareWallet &&
        <PrepareWalletSection showRecovery={showRecovery} expertMode={expertMode} coreSettings={coreSettings} setupConfig={setupConfig} walletState={walletState} setWalletState={setWalletState} progress={progress} progressStage={progressStage} network={network} />}
      {section === sectionViews.walletSetupDone &&
        <DoneSection address={walletState.address} />}
    </div>
  )
}

const PrepareWalletSection = ({ expertMode, showRecovery, coreSettings, setupConfig, walletState, setWalletState, progress, progressStage, network }) => {
  const { isMobile } = useWindowDimensions()
  const dispatch = useDispatch()
  const history = useHistory()

  const defaultRecoveryAddress = { value: ONEConstants.TreasuryAddress, label: WalletConstants.defaultRecoveryAddressLabel }
  const [lastResortAddress, setLastResortAddress] = useState(defaultRecoveryAddress)
  const [spendingLimit, setSpendingLimit] = useState(WalletConstants.defaultSpendingLimit) // ONEs, number
  const [spendingInterval, setSpendingInterval] = useState(WalletConstants.defaultSpendingInterval) // seconds, number
  const [showRecoveryDetail, setShowRecoveryDetail] = useState(false)
  const [deploying, setDeploying] = useState()
  const [deployed, setDeployed] = useState(false)

  const autoDeploy = !walletState.customizeSettings && !showRecovery && !expertMode

  const storeLayers = async () => {
    if (!coreSettings.root) {
      message.error('Cannot store credentials of the wallet. Error: Root is not set')
      return
    }
    return storage.setItem(ONEUtil.hexView(coreSettings.root), coreSettings.layers)
  }

  const storeInnerLayers = async () => {
    if (!coreSettings.innerTrees || coreSettings.innerTrees.length === 0) {
      return Promise.resolve([])
    }
    const promises = []
    for (const { layers: innerLayers, root: innerRoot } of coreSettings.innerTrees) {
      promises.push(storage.setItem(ONEUtil.hexView(innerRoot), innerLayers))
    }
    return Promise.all(promises)
  }

  const deploy = async () => {
    if (!(coreSettings.root && coreSettings.hseed && coreSettings.layers && coreSettings.slotSize)) {
      message.error('Cannot deploy wallet. Error: root is not set.')
      return
    }
    // Ensure valid address for both 0x and one1 formats
    const normalizedAddress = util.safeExec(util.normalizedAddress, [lastResortAddress?.value], handleAddressError)
    if (!normalizedAddress) {
      return
    }
    setDeploying(true)

    const identificationKeys = [ONEUtil.getIdentificationKey(setupConfig.seed, true)]
    const innerCores = ONEUtil.makeInnerCores({ innerTrees: coreSettings.innerTrees, effectiveTime: coreSettings.effectiveTime, duration: walletState.duration, slotSize: coreSettings.slotSize, interval: WalletConstants.interval })

    try {
      const { address } = await api.relayer.create({
        root: ONEUtil.hexString(coreSettings.root),
        identificationKeys,
        innerCores,
        height: coreSettings.layers.length,
        interval: WalletConstants.interval / 1000,
        t0: coreSettings.effectiveTime / WalletConstants.interval,
        lifespan: walletState.duration / WalletConstants.interval,
        slotSize: coreSettings.slotSize,
        lastResortAddress: normalizedAddress,
        spendingLimit: ONEUtil.toFraction(spendingLimit).toString(),
        spendingInterval,
      })
      // console.log('Deployed. Received contract address', address)
      const wallet = {
        name: walletState.name,
        address,
        root: ONEUtil.hexView(coreSettings.root),
        duration: walletState.duration,
        slotSize: coreSettings.slotSize,
        effectiveTime: coreSettings.effectiveTime,
        lastResortAddress: normalizedAddress,
        spendingLimit: ONEUtil.toFraction(spendingLimit).toString(),
        hseed: ONEUtil.hexView(coreSettings.hseed),
        spendingInterval: spendingInterval * 1000,
        majorVersion: ONEConstants.MajorVersion,
        minorVersion: ONEConstants.MinorVersion,
        identificationKeys,
        localIdentificationKey: identificationKeys[0],
        network,
        doubleOtp: walletState.doubleOtp,
        innerRoots: coreSettings.innerTrees.map(({ root }) => ONEUtil.hexView(root)),
        ...securityParameters,
        expert: !!expertMode || walletState.customizeSettings,
      }
      await storeLayers()
      await storeInnerLayers()
      dispatch(walletActions.updateWallet(wallet))
      dispatch(balanceActions.fetchBalanceSuccess({ address, balance: 0 }))
      setWalletState(s => ({ ...s, address }))
      setDeploying(false)
      setDeployed(true)
      message.success('Your wallet is deployed!')
      setTimeout(() => {
        dispatch(walletActions.fetchWallet({ address }))
        history.push(Paths.showAddress(address))
      }, 2500)
    } catch (ex) {
      handleAPIError(ex)
      message.error(`Failed to deploy ${config.appName}. Please try again. If it keeps happening, please report this issue.`)
      setDeploying(false)
      setDeployed(false)
    }
  }

  useEffect(() => {
    if (autoDeploy &&
      coreSettings.root && coreSettings.hseed && coreSettings.slotSize && coreSettings.layers && coreSettings.innerTrees) {
      deploy()
    }
  }, [coreSettings, autoDeploy])

  return (
    <AnimatedSection>
      <Row>
        <Space direction='vertical'>
          <Heading>Prepare Your {config.appName}</Heading>
        </Space>
      </Row>
      {expertMode || walletState.customizeSettings &&
        <Row style={{ marginBottom: 16 }}>
          <Space direction='vertical' size='small'>
            <Hint>Set up a spending limit:</Hint>
            <Space align='baseline' direction={isMobile ? 'vertical' : 'horizontal'}>
              <InputBox
                $num
                margin={16} width={160} value={spendingLimit}
                onChange={({ target: { value } }) => setSpendingLimit(parseInt(value || 0))} suffix='ONE'
              />
              <Space align='baseline'>
                <Hint>per</Hint>
                <InputBox
                  $num
                  margin={16} width={128} value={spendingInterval}
                  onChange={({ target: { value } }) => setSpendingInterval(parseInt(value || 0))}
                />
                <Hint>seconds</Hint>
              </Space>
            </Space>
            <Row justify='end'>
              <Hint>≈ {humanizeDuration(spendingInterval * 1000, { largest: 2, round: true })}</Hint>
            </Row>

          </Space>
        </Row>}
      {showRecovery || walletState.customizeSettings &&
        <Row style={{ marginBottom: 24 }}>
          {!showRecoveryDetail &&
            <Space>
              <Button style={{ padding: 0 }} type='link' onClick={() => setShowRecoveryDetail(true)}>Set up a recovery address?</Button>
              <Tooltip title={`It is where you could send your money to if you lost the authenticator. You don't have to configure this. By default it goes to ${config.appName} DAO`}>
                <QuestionCircleOutlined />
              </Tooltip>

            </Space>}
          {showRecoveryDetail &&
            <Space direction='vertical' size='small' style={{ width: '100%' }}>
              <Hint>Set up a fund recovery address (it's public):</Hint>
              <AddressInput
                addressValue={lastResortAddress}
                setAddressCallback={setLastResortAddress}
                extraSelectOptions={[{
                  address: ONEConstants.TreasuryAddress,
                  label: WalletConstants.defaultRecoveryAddressLabel
                }]}
              />
              <Hint>
                {!util.isDefaultRecoveryAddress(lastResortAddress.value) && <span style={{ color: 'red' }}>This is permanent. </span>}
                If you lost access, you can still send your assets there or use <Link href='https://github.com/polymorpher/one-wallet/releases/tag/v0.2' target='_blank' rel='noreferrer'>auto-recovery</Link>
              </Hint>
              {util.isDefaultRecoveryAddress(lastResortAddress.value) &&
                <Warning style={{ marginTop: 24 }}>
                  {config.appName} DAO can be a last resort to recover your assets. You can also use your own address.
                </Warning>}
            </Space>}
        </Row>}
      <Row style={{ marginBottom: 32 }}>
        <Space direction='vertical'>
          {!autoDeploy &&
            <Space>
              <FlashyButton
                disabled={!coreSettings.root || deploying} type='primary' shape='round' size='large'
                onClick={() => deploy()}
              >Confirm: Create Now
              </FlashyButton>
              {deploying && <LoadingOutlined />}
            </Space>}
          {autoDeploy &&
            <TallRow>
              {(deploying || !coreSettings.root) && <Space><Text>Putting your {config.appName} on blockchain...</Text><LoadingOutlined /></Space>}
              {(!deploying && coreSettings.root && deployed) && <Text>Your {config.appName} is ready!</Text>}
              {(!deploying && coreSettings.root && deployed === false) && (
                <Space direction='vertical'>
                  <Text>There was an issue deploying your {config.appName}. </Text>
                  <Space>
                    <Button shape='round' danger onClick={() => (location.href = Paths.create)}>Restart</Button>
                    <Button shape='round' type='primary' onClick={() => deploy()}>Try Again</Button>
                  </Space>
                </Space>)}
            </TallRow>}
          {!expertMode && !walletState.customizeSettings && <Hint>In beta, you can only spend {WalletConstants.defaultSpendingLimit} ONE per day</Hint>}
          {!expertMode && !walletState.customizeSettings && (
            <Button
              type='link' onClick={() => {
                window.location.href = Paths.create2
              }} style={{ padding: 0 }}
            >I want to create a customized wallet with higher limit
            </Button>)}
          {!coreSettings.root && <WalletCreateProgress progress={progress} isMobile={isMobile} progressStage={progressStage} />}
        </Space>
      </Row>
      <Row>
        <Space direction='vertical'>
          <Hint>No private key. No mnemonic.</Hint>
          <Hint>Simple and Secure.</Hint>
          <Hint>To learn more, check out our <Link href='https://docs.otpwallet.xyz'>{config.appName} documentation</Link></Hint>
        </Space>
      </Row>
    </AnimatedSection>
  )
}

const SetupOtpSection = ({ expertMode, otpReady, setupConfig, walletState, setWalletState, effectiveTime, setSection, setQrCodeMode, qrCodeMode }) => {
  const { otpInputBackground, optInputTextColor } = getColorPalette(useTheme())
  const { isMobile, os } = useWindowDimensions()
  const v2ui = useSelector(state => state.global.v2ui)
  const history = useHistory()
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState(1) // 1 -> otp, optional 2 -> second otp
  const otpRef = useRef()
  const { seed, seed2 } = setupConfig
  const { name, duration } = walletState
  const { secondOtpQrCodeData, otpQrCodeData, doubleOtp } = walletState
  const [showAccount, setShowAccount] = useState(false)
  const [allowAutofill, setAllowAutoFill] = useState(false)
  const [visualDuration, setVisualDuration] = useState(duration)
  const toggleShowAccount = (e) => {
    e && e.preventDefault()
    setShowAccount(v => !v)
    return false
  }
  const enableExpertMode = () => {
    history.push(Paths.create2)
    message.success('Expert mode unlocked')
    setOtp('')
  }

  const disableExpertMode = () => {
    history.push(Paths.create)
    message.success('Expert mode disabled')
    setOtp('')
  }

  useEffect(() => {
    const settingUpSecondOtp = step === 2
    if (otp.length !== 6) {
      return
    }
    if (otp.toLowerCase() === '0x1337' || otp.toLowerCase() === 'expert') {
      enableExpertMode()
      return
    }
    if (expertMode && (otp === '0x0000' || otp === 'normal')) {
      disableExpertMode()
      return
    }
    const currentSeed = settingUpSecondOtp ? seed2 : seed
    const expected = ONEUtil.genOTP({ seed: currentSeed })
    const code = new DataView(expected.buffer).getUint32(0, false).toString()
    setOtp('')
    if (code.padStart(6, '0') !== otp.padStart(6, '0')) {
      message.error('Code is incorrect. Please try again.')
      message.debug(`Correct code is ${code.padStart(6, '0')}`)
      otpRef?.current?.focusInput(0)
    } else if (doubleOtp && !settingUpSecondOtp) {
      setStep(2)
      otpRef?.current?.focusInput(0)
    } else {
      setSection(sectionViews.prepareWallet)
    }
  }, [otp])

  useEffect(() => {
    if (walletState.customizeSettings && !walletState.defaultWalletName) {
      setWalletState(state => ({ ...state, defaultWalletName: state.name }))
    }
    if (walletState.customizeSettings !== null && !walletState.customizeSettings) {
      setWalletState(state => ({ ...state, duration: WalletConstants.defaultDuration, name: state.defaultWalletName || ONENames.genName() }))
    }
  }, [walletState.customizeSettings, walletState.defaultWalletName])

  if (!otpReady) {
    return (
      <AnimatedSection wide>
        <Space direction='vertical' style={{ width: '100%', textAlign: 'center' }} size='large'>
          <Spin size='large' />
          <Paragraph style={{ marginTop: 48, fontSize: 18 }}>Loading data from blockchain...</Paragraph>
          <Text>If this takes a long time, please check the network status</Text>
        </Space>
      </AnimatedSection>
    )
  }

  if (v2ui) {
    return (
      <AnimatedSection2 SectionEl={Card} bodyStyle={{ padding: 0 }}>
        <Space direction='vertical' style={{ width: '100%', padding: '32px 32px 16px 32px' }}>
          {step === 1 &&
            <>
              <Heading level={isMobile ? 4 : 2}>Create Your {config.appName}</Heading>
              <Hint>{isMobile ? 'Tap' : 'Scan'} the QR code to setup your {getGoogleAuthenticatorAppLink(os)}. {!v2ui && 'You need it to use the wallet'} </Hint>
              {buildQRCodeComponent({ seed, name: ONENames.nameWithTime(name, effectiveTime), os, isMobile, qrCodeData: otpQrCodeData })}
            </>}
          {step === 2 &&
            <>
              <Heading>Create Your {config.appName} (second code)</Heading>
              <Hint align='center'>{isMobile ? 'Tap' : 'Scan'} to setup the <b>second</b> code</Hint>
              {buildQRCodeComponent({ seed: seed2, name: ONENames.nameWithTime(getSecondCodeName(name), effectiveTime), os, isMobile, qrCodeData: secondOtpQrCodeData })}
            </>}
        </Space>
        <Space direction='vertical' size='large' align='center' style={{ width: '100%', background: otpInputBackground, color: optInputTextColor, borderRadius: '0 0 16px 16px', padding: '32px' }}>
          {step === 1 && (
            <>
              <OtpSetup2 isMobile={isMobile} otpRef={otpRef} otpValue={otp} setOtpValue={setOtp} name={ONENames.nameWithTime(name, effectiveTime)} />
              {expertMode && (
                <>
                  <TwoCodeOption2 isMobile={isMobile} setDoubleOtp={d => setWalletState(s => ({ ...s, doubleOtp: d }))} doubleOtp={doubleOtp} />
                  <Hint style={{ color: optInputTextColor, fontSize: '14px' }}>You can adjust spending limit in the next step</Hint>
                </>)}
            </>)}
          {step === 2 &&
            <OtpSetup2 isMobile={isMobile} otpRef={otpRef} otpValue={otp} setOtpValue={setOtp} name={ONENames.nameWithTime(getSecondCodeName(name), effectiveTime)} />}
        </Space>
      </AnimatedSection2>
    )
  }

  return (
    <AnimatedSection>
      <Space direction='vertical' style={{ width: '100%' }}>
        {step === 1 &&
          <>
            <Heading level={isMobile ? 4 : 2}>Create Your {config.appName}</Heading>
            <Hint>{isMobile ? 'Tap' : 'Scan'} the QR code to setup OTP {getGoogleAuthenticatorAppLink(os)} for the wallet</Hint>
            <Hint>Optional: <Link href='#' onClick={toggleShowAccount}>sign-up</Link> to enable backup, alerts, verification code autofill</Hint>
            {showAccount && <SignupAccount seed={seed} name={name} address={walletState.predictedAddress} effectiveTime={effectiveTime} setAllowOTPAutoFill={setAllowAutoFill} />}
            {buildQRCodeComponent({ seed, name: ONENames.nameWithTime(name, effectiveTime), os, isMobile, qrCodeData: otpQrCodeData, qrCodeMode })}
          </>}
        {step === 2 &&
          <>
            <Heading>Create Your {config.appName} (second code)</Heading>
            <Hint align='center'>{isMobile ? 'Tap' : 'Scan'} to setup the <b>second</b> code</Hint>
            {buildQRCodeComponent({ seed: seed2, name: ONENames.nameWithTime(getSecondCodeName(name), effectiveTime), os, isMobile, qrCodeData: secondOtpQrCodeData, qrCodeMode })}
          </>}
      </Space>
      {step === 1 && (
        <Space direction='vertical' size='large' align='center' style={{ width: '100%', marginTop: '16px' }}>
          <OtpSetup isMobile={isMobile} otpRef={otpRef} otpValue={otp} setOtpValue={setOtp} name={ONENames.nameWithTime(name, effectiveTime)} autofill={allowAutofill} />
          {expertMode && <TwoCodeOption isMobile={isMobile} setDoubleOtp={d => setWalletState(s => ({ ...s, doubleOtp: d }))} doubleOtp={doubleOtp} />}
          {expertMode && <Hint>You can adjust spending limit in the next step</Hint>}
        </Space>)}
      {step === 2 &&
        <OtpSetup isMobile={isMobile} otpRef={otpRef} otpValue={otp} setOtpValue={setOtp} name={ONENames.nameWithTime(getSecondCodeName(name), effectiveTime)} />}
      <Space style={{ marginTop: 32, justifyContent: 'space-between', display: 'flex' }}>
        <Hint>Default: wallet has random name, expires in 9 months</Hint>
        <Button
          shape='round'
          onClick={() => setWalletState(state => ({ ...state, customizeSettings: !state.customizeSettings }))}
        >
          {walletState.customizeSettings ? 'Use Default' : 'Customize'}
        </Button>
      </Space>
      {walletState.customizeSettings && (
        <Space direction='vertical' style={{ width: '100%' }}>
          <Row align='middle' style={{ width: '100%', columnGap: 16 }}>
            <Hint>Wallet Name</Hint>
            <InputBox
              prefix={<Button type='text' onClick={() => setWalletState(state => ({ ...state, name: ONENames.genName() }))}><RedoOutlined /></Button>}
              value={name} onChange={({ target: { value } }) => {
                console.log(ONENames.AllowedWalletNames.test(value))
                if (!ONENames.AllowedWalletNames.test(value)) {
                  message.error('Only letters, digits, - and _ symbols are allowed')
                  return
                }

                setWalletState(state => ({ ...state, name: value }))
              }}
              style={{ padding: 0, flex: 1 }}
            />
          </Row>
          <Row align='middle' style={{ width: '100%', columnGap: 16 }}>
            <Hint>Lifespan</Hint>
            <Slider
              style={{ flex: 1, minWidth: 160 }}
              value={visualDuration}
              onChange={(v) => setVisualDuration(v)}
              tooltipVisible={false}
              onAfterChange={(v) => setWalletState(state => ({ ...state, duration: v }))}
              min={WalletConstants.minDuration} max={WalletConstants.maxDuration}
            />
            <Hint style={{ width: 144 }}>{humanizeDuration(visualDuration, { units: ['y', 'mo'], round: true })}</Hint>
          </Row>
          <Hint>(longer is slower to create)</Hint>
        </Space>)}
      {isMobile && (
        <Space style={{ marginTop: 32, justifyContent: 'space-between', display: 'flex' }}>
          <Hint>Code prompting wrong authenticator app?</Hint>
          <Button
            style={{ color: 'darkblue' }}
            shape='round'
            onClick={() => setQrCodeMode(OTPUriMode.MIGRATION)} disabled={qrCodeMode === OTPUriMode.MIGRATION}
          >
            Use Google Auth QR {qrCodeMode === OTPUriMode.MIGRATION && <CheckOutlined />}
          </Button>
        </Space>)}
      {isMobile && (
        <Space style={{ marginTop: 32 }} direction='vertical'>
          <Hint>
            Or go to "Password Options" (after tapping the QR code) and switch verification code app to <SiderLink href={getGoogleAuthenticatorUrl(os)}>Google Authenticator</SiderLink>, or <SiderLink href='https://raivo-otp.com/'>Raivo</SiderLink>, or <SiderLink href='https://getaegis.app/'>Aegis</SiderLink>
          </Hint>
        </Space>
      )}
    </AnimatedSection>
  )
}

const DoneSection = ({ address }) => {
  return (
    <AnimatedSection>
      <Space direction='vertical'>
        <Heading>You are all set!</Heading>
        <Space direction='vertical' size='small'>
          <Hint>Wallet Address</Hint>
          <Text>{address && util.safeOneAddress(address)}</Text>
        </Space>
        <Button style={{ marginTop: 32 }} disabled={!address} type='primary' shape='round' size='large' onClick={() => history.push(Paths.showAddress(address))}>Go to My Wallet</Button>
      </Space>
    </AnimatedSection>
  )
}

export default Create
