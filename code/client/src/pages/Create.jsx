import React, { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
import api from '../api'
import ONEUtil from '../../../lib/util'
import ONEConstants from '../../../lib/constants'
import ONENames from '../../../lib/names'
// import { uniqueNamesGenerator, colors, animals } from 'unique-names-generator'
import {
  Button,
  Row,
  Space,
  Typography,
  Slider,
  Tooltip
} from 'antd'
import message from '../message'
import { RedoOutlined, LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import humanizeDuration from 'humanize-duration'
import AnimatedSection from '../components/AnimatedSection'
import qrcode from 'qrcode'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import { balanceActions } from '../state/modules/balance'
import cacheActions from '../state/modules/cache/actions'
import WalletConstants from '../constants/wallet'
import util, { useWindowDimensions, OSType, generateOtpSeed } from '../util'
import { handleAPIError, handleAddressError } from '../handler'
import { Hint, Heading, InputBox, Warning } from '../components/Text'
import { getAddress } from '@harmony-js/crypto'
import AddressInput from '../components/AddressInput'
import WalletCreateProgress from '../components/WalletCreateProgress'
import { TallRow } from '../components/Grid'
import { FlashyButton } from '../components/Buttons'
import { buildQRCodeComponent, getQRCodeUri, getSecondCodeName, OTPUriMode } from '../components/OtpTools'
import { OtpSetup, TwoCodeOption } from '../components/OtpSetup'
import config from '../config'
const { Text, Link } = Typography

// const genName = () => uniqueNamesGenerator({
//   dictionaries: [colors, animals],
//   style: 'capital',
//   separator: ' ',
//   length: 1
// })

const getGoogleAuthenticatorAppLink = (os) => {
  let link = 'https://apps.apple.com/us/app/google-authenticator/id388497605'
  if (os === OSType.Android) {
    link = 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2'
  }
  return <Link href={link} target='_blank' rel='noreferrer'>Google Authenticator</Link>
}

const sectionViews = {
  setupWalletDetails: 1,
  setupOtp: 2,
  setupSecondOtp: 3,
  prepareWallet: 4,
  walletSetupDone: 5
}

const Create = ({ expertMode, showRecovery }) => {
  // eslint-disable-next-line no-unused-vars
  const dev = useSelector(state => state.global.dev)
  const { isMobile, os } = useWindowDimensions()
  const dispatch = useDispatch()
  const history = useHistory()
  const network = useSelector(state => state.global.network)
  const wallets = useSelector(state => state.wallet)

  const [effectiveTime, setEffectiveTime] = useState()

  const generateNewOtpName = () => ONENames.genName(Object.keys(wallets).map(k => wallets[k].name))
  const [name, setName] = useState(generateNewOtpName())
  // eslint-disable-next-line no-unused-vars
  const [seed, setSeed] = useState(generateOtpSeed())
  // eslint-disable-next-line no-unused-vars
  const [seed2, setSeed2] = useState(generateOtpSeed())
  const [duration, setDuration] = useState(WalletConstants.defaultDuration)
  const [showRecoveryDetail, setShowRecoveryDetail] = useState(false)
  const code = useSelector(state => state.cache.code[network])


  const defaultRecoveryAddress = { value: ONEConstants.TreasuryAddress, label: WalletConstants.defaultRecoveryAddressLabel }

  const [lastResortAddress, setLastResortAddress] = useState(defaultRecoveryAddress)
  const [spendingLimit, setSpendingLimit] = useState(WalletConstants.defaultSpendingLimit) // ONEs, number
  const [spendingInterval, setSpendingInterval] = useState(WalletConstants.defaultSpendingInterval) // seconds, number

  const [worker, setWorker] = useState()
  const [root, setRoot] = useState()
  const [hseed, setHseed] = useState()
  const [layers, setLayers] = useState()
  const [innerTrees, setInnerTrees] = useState()
  const [slotSize, setSlotSize] = useState(1)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [address, setAddress] = useState() // '0x12345678901234567890'

  const [doubleOtp, setDoubleOtp] = useState(false)

  const [durationVisible, setDurationVisible] = useState(false)
  const [section, setSection] = useState(sectionViews.setupOtp)
  const [qrCodeData, setQRCodeData] = useState()
  const [secondOtpQrCodeData, setSecondOtpQrCodeData] = useState()
  const [otp, setOtp] = useState('')
  const [deploying, setDeploying] = useState()
  const [deployed, setDeployed] = useState(false)

  const otpRef = useRef()

  const securityParameters = ONEUtil.securityParameters({
    majorVersion: ONEConstants.MajorVersion,
    minorVersion: ONEConstants.MinorVersion,
  })

  useEffect(() => {
    if (!code || !name || !effectiveTime) {
      return
    }
    (async function () {
      const deployerAddress = config.networks[network].deploy.factory
      const address = ONEUtil.predictAddress({ seed, deployerAddress, code: ONEUtil.hexStringToBytes(code) })
      message.debug(`Predicting wallet address ${address} using parameters: ${JSON.stringify({ seed: ONEUtil.base32Encode(seed), deployerAddress })}; code keccak hash=${ONEUtil.hexView(ONEUtil.keccak(code))}`)
      const oneAddress = util.safeOneAddress(address)
      const otpDisplayName = `${ONENames.nameWithTime(name, effectiveTime)} [${oneAddress}]`
      const otpDisplayName2 = `${ONENames.nameWithTime(getSecondCodeName(name), effectiveTime)} [${oneAddress}]`
      const otpUri = getQRCodeUri(seed, otpDisplayName, OTPUriMode.MIGRATION)
      const secondOtpUri = getQRCodeUri(seed2, otpDisplayName2, OTPUriMode.MIGRATION)
      const otpQrCodeData = await qrcode.toDataURL(otpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      const secondOtpQrCodeData = await qrcode.toDataURL(secondOtpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setQRCodeData(otpQrCodeData)
      setSecondOtpQrCodeData(secondOtpQrCodeData)
    })()
  }, [name, code, network, effectiveTime])

  useEffect(() => {
    if (section === sectionViews.setupOtp && worker) {
      // console.log('Posting to worker. Security parameters:', securityParameters)
      const t = Math.floor(Date.now() / WalletConstants.interval6) * WalletConstants.interval6
      const salt = ONEUtil.hexView(generateOtpSeed())
      setEffectiveTime(t)
      if (worker) {
        worker.postMessage({
          salt,
          seed,
          seed2: doubleOtp && seed2,
          effectiveTime: t,
          duration,
          slotSize,
          interval: WalletConstants.interval,
          ...securityParameters,
        })
        setRoot(undefined)
        setHseed(undefined)
        setLayers(undefined)
        setSlotSize(1)
        worker.onmessage = (event) => {
          const { status, current, total, stage, result, salt: workerSalt } = event.data
          if (workerSalt && workerSalt !== salt) {
            // console.log(`Discarding outdated worker result (salt=${workerSalt}, expected=${salt})`)
            return
          }
          if (status === 'working') {
            // console.log(`Completed ${(current / total * 100).toFixed(2)}%`)
            setProgress(Math.round(current / total * 100))
            setProgressStage(stage)
          }
          if (status === 'done') {
            const { hseed, root, layers, maxOperationsPerInterval, innerTrees } = result
            setRoot(root)
            setHseed(hseed)
            setLayers(layers)
            setSlotSize(maxOperationsPerInterval)
            setInnerTrees(innerTrees)
            // console.log('Received created wallet from worker:', result)
          }
        }
      }
    }
  }, [section, worker, doubleOtp])

  const enableExpertMode = (refresh) => {
    if (refresh) {
      window.location.href = Paths.create2
      return
    }
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
    const settingUpSecondOtp = section === sectionViews.setupSecondOtp
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

  const storeInnerLayers = async () => {
    if (!innerTrees || innerTrees.length === 0) {
      return Promise.resolve([])
    }
    const promises = []
    for (const { layers: innerLayers, root: innerRoot } of innerTrees) {
      promises.push(storage.setItem(ONEUtil.hexView(innerRoot), innerLayers))
    }
    return Promise.all(promises)
  }

  const deploy = async () => {
    if (!(root && hseed && layers && slotSize)) {
      message.error('Cannot deploy wallet. Error: root is not set.')
      return
    }
    // Ensure valid address for both 0x and one1 formats
    const normalizedAddress = util.safeExec(util.normalizedAddress, [lastResortAddress?.value], handleAddressError)
    if (!normalizedAddress) {
      return
    }
    setDeploying(true)

    const identificationKeys = [ONEUtil.getIdentificationKey(seed, true)]
    const innerCores = ONEUtil.makeInnerCores({ innerTrees, effectiveTime, duration, slotSize, interval: WalletConstants.interval })

    try {
      const { address } = await api.relayer.create({
        root: ONEUtil.hexString(root),
        identificationKeys,
        innerCores,
        height: layers.length,
        interval: WalletConstants.interval / 1000,
        t0: effectiveTime / WalletConstants.interval,
        lifespan: duration / WalletConstants.interval,
        slotSize,
        lastResortAddress: normalizedAddress,
        spendingLimit: ONEUtil.toFraction(spendingLimit).toString(),
        spendingInterval,
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
        spendingLimit: ONEUtil.toFraction(spendingLimit).toString(),
        hseed: ONEUtil.hexView(hseed),
        spendingInterval: spendingInterval * 1000,
        majorVersion: ONEConstants.MajorVersion,
        minorVersion: ONEConstants.MinorVersion,
        identificationKeys,
        localIdentificationKey: identificationKeys[0],
        network,
        doubleOtp,
        innerRoots: innerTrees.map(({ root }) => ONEUtil.hexView(root)),
        ...securityParameters,
        expert: !!expertMode,
      }
      await storeLayers()
      await storeInnerLayers()
      dispatch(walletActions.updateWallet(wallet))
      dispatch(balanceActions.fetchBalanceSuccess({ address, balance: 0 }))
      setAddress(address)
      setDeploying(false)
      setDeployed(true)
      message.success('Your wallet is deployed!')
      setTimeout(() => {
        dispatch(walletActions.fetchWallet({ address }))
        history.push(Paths.showAddress(address))
      }, 2500)
      // setSection(4)
    } catch (ex) {
      handleAPIError(ex)
      message.error('Failed to deploy 1wallet. Please try again. If it keeps happening, please report this issue.')
      setDeploying(false)
      setDeployed(false)
    }
  }

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

  useEffect(() => {
    if (section === sectionViews.prepareWallet && !showRecovery &&
      root && hseed && slotSize && layers && innerTrees) {
      deploy()
    }
  }, [section, root, hseed, layers, slotSize, innerTrees])

  return (
    <>
      {section === sectionViews.setupWalletDetails &&
        <AnimatedSection>
          <Heading>What do you want to call your wallet?</Heading>
          <Hint>This is only stored on your computer to distinguish your wallets.</Hint>
          <Row align='middle' style={{ marginBottom: 32, marginTop: 16 }}>
            <Space size='large'>
              <InputBox
                prefix={<Button type='text' onClick={() => setName(generateNewOtpName())} style={{ }}><RedoOutlined /></Button>}
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
        </AnimatedSection>}
      {section === sectionViews.setupOtp &&
        <AnimatedSection>
          <Row>
            <Space direction='vertical'>
              {/* <Heading>Now, scan the QR code with your Google Authenticator</Heading> */}
              <Heading level={isMobile ? 4 : 2}>Create Your 1wallet</Heading>
              {!isMobile && <Hint>Scan the QR code to setup {getGoogleAuthenticatorAppLink(os)}. You need it to use the wallet </Hint>}
              {isMobile && <Hint>Tap QR code to setup {getGoogleAuthenticatorAppLink(os)}. You need it to use the wallet</Hint>}
              {buildQRCodeComponent({ seed, name: ONENames.nameWithTime(name, effectiveTime), os, isMobile, qrCodeData })}
            </Space>
          </Row>
          <Row style={{ marginTop: 16 }}>
            <Space direction='vertical' size='large' align='center' style={{ width: '100%' }}>
              <OtpSetup isMobile={isMobile} otpRef={otpRef} otpValue={otp} setOtpValue={setOtp} name={ONENames.nameWithTime(name, effectiveTime)} />
              {expertMode && <TwoCodeOption isMobile={isMobile} setDoubleOtp={setDoubleOtp} doubleOtp={doubleOtp} />}
              {expertMode && <Hint>You can adjust spending limit in the next step</Hint>}
            </Space>
          </Row>
        </AnimatedSection>}
      {section === sectionViews.setupSecondOtp &&
        <AnimatedSection>
          <Row>
            <Space direction='vertical'>
              <Heading>Create Your 1wallet (second code)</Heading>
              <Hint align='center'>{isMobile ? 'Tap' : 'Scan'} to setup the <b>second</b> code</Hint>
              {buildQRCodeComponent({ seed: seed2, name: ONENames.nameWithTime(getSecondCodeName(name), effectiveTime), os, isMobile, qrCodeData: secondOtpQrCodeData })}
            </Space>
          </Row>
          <Row>
            <OtpSetup isMobile={isMobile} otpRef={otpRef} otpValue={otp} setOtpValue={setOtp} name={ONENames.nameWithTime(getSecondCodeName(name), effectiveTime)} />
          </Row>
        </AnimatedSection>}
      {section === sectionViews.prepareWallet &&
        <AnimatedSection>
          <Row>
            <Space direction='vertical'>
              <Heading>Prepare Your 1wallet</Heading>
            </Space>
          </Row>
          {expertMode &&
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
          {showRecovery &&
            <Row style={{ marginBottom: 24 }}>
              {!showRecoveryDetail &&
                <Space>
                  <Button style={{ padding: 0 }} type='link' onClick={() => setShowRecoveryDetail(true)}>Set up a recovery address?</Button>
                  <Tooltip title={'It is where you could send your money to if you lost the authenticator. You don\'t have to configure this. By default it goes to 1wallet DAO'}>
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
                      1wallet DAO can be a last resort to recover your assets. You can also use your own address.
                    </Warning>}
                </Space>}
            </Row>}
          <Row style={{ marginBottom: 32 }}>
            <Space direction='vertical'>
              {showRecovery &&
                <Space>
                  <FlashyButton
                    disabled={!root || deploying} type='primary' shape='round' size='large'
                    onClick={() => deploy()}
                  >Confirm: Create Now
                  </FlashyButton>
                  {deploying && <LoadingOutlined />}
                </Space>}
              {!showRecovery &&
                <TallRow>
                  {(deploying || !root) && <Space><Text>Working on your 1wallet...</Text><LoadingOutlined /></Space>}
                  {(!deploying && root && deployed) && <Text>Your 1wallet is ready!</Text>}
                  {(!deploying && root && deployed === false) && <Text>There was an issue deploying your 1wallet. <Button type='link' onClick={() => (location.href = Paths.create)}>Try again</Button>?</Text>}
                </TallRow>}
              {!expertMode && <Hint>In beta, you can only spend {WalletConstants.defaultSpendingLimit} ONE per day</Hint>}
              {!expertMode && <Button type='link' onClick={() => enableExpertMode(true)} style={{ padding: 0 }}>I want to create a higher limit wallet instead</Button>}
              {!root && <WalletCreateProgress progress={progress} isMobile={isMobile} progressStage={progressStage} />}
            </Space>
          </Row>
          <Row>
            <Space direction='vertical'>
              <Hint>No private key. No mnemonic.</Hint>
              <Hint>Simple and Secure.</Hint>
              <Hint>To learn more, visit <Link href='https://github.com/polymorpher/one-wallet/wiki'>1wallet Wiki</Link></Hint>
            </Space>
          </Row>
        </AnimatedSection>}
      {section === sectionViews.walletSetupDone &&
        <AnimatedSection>
          <Space direction='vertical'>
            <Heading>You are all set!</Heading>
            <Space direction='vertical' size='small'>
              <Hint>Wallet Address</Hint>
              <Text>{address && getAddress(address).bech32}</Text>
            </Space>
            <Button style={{ marginTop: 32 }} disabled={!address} type='primary' shape='round' size='large' onClick={() => history.push(Paths.showAddress(address))}>Go to My Wallet</Button>
          </Space>
        </AnimatedSection>}
    </>
  )
}

export default Create
