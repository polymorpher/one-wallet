import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Button, Row, Space, Typography, Col } from 'antd'
import message from '../../message'
import { Hint, Warning } from '../../components/Text'
import { AverageRow } from '../../components/Grid'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import { generateOtpSeed } from '../../util'
import ShowUtils from './show-util'
import { useSelector } from 'react-redux'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import ONEConstants from '../../../../lib/constants'
import { OtpStack } from '../../components/OtpStack'
import { useOps } from '../../components/Common'
import QrCodeScanner from '../../components/QrCodeScanner'
import ScanGASteps from '../../components/ScanGASteps'
import {
  buildQRCodeComponent,
  getQRCodeUri, getSecondCodeName,
  OTPUriMode,
  parseMigrationPayload,
  parseOAuthOTP
} from '../../components/OtpTools'
import * as Sentry from '@sentry/browser'
import storage from '../../storage'
import walletActions from '../../state/modules/wallet/actions'
import Paths from '../../constants/paths'
import WalletConstants from '../../constants/wallet'
import WalletCreateProgress from '../../components/WalletCreateProgress'
import qrcode from 'qrcode'
import { OtpSetup, TwoCodeOption } from '../../components/OtpSetup'
import WalletAddress from '../../components/WalletAddress'
import { useHistory } from 'react-router'
import ONENames from '../../../../lib/names'
const { Title, Text } = Typography

const Subsections = {
  init: 'init', // choose method,
  scan: 'scan', // scan an exported QR code from authenticator
  new: 'new', // use a new authenticator code
  confirm: 'confirm' // authorize with old authenticator code, confirm, finalize; show progress circle
}

const Extend = ({
  address,
  onClose: onCloseOuter,
}) => {
  const history = useHistory()
  const {
    dispatch, wallet, network, stage, setStage,
    resetWorker, recoverRandomness, otpState, isMobile, os
  } = useOps({ address })
  const dev = useSelector(state => state.global.dev)
  const { majorVersion, name, expert } = wallet
  const [method, setMethod] = useState()
  const [seed, setSeed] = useState()
  const [seed2, setSeed2] = useState()

  const [section, setSection] = useState(Subsections.init)

  const [root, setRoot] = useState() // Uint8Array
  const [effectiveTime, setEffectiveTime] = useState()
  const [hseed, setHseed] = useState()
  const [layers, setLayers] = useState()
  const [doubleOtp, setDoubleOtp] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const securityParameters = ONEUtil.securityParameters(wallet)
  // eslint-disable-next-line no-unused-vars
  const [computeInProgress, setComputeInProgress] = useState(false)

  const [confirmName, setConfirmName] = useState()

  const [qrCodeData, setQRCodeData] = useState()
  const [secondOtpQrCodeData, setSecondOtpQrCodeData] = useState()

  const [validationOtp, setValidationOtp] = useState()
  const validationOtpRef = useRef()
  const [showSecondCode, setShowSecondCode] = useState()
  const duration = WalletConstants.defaultDuration
  const slotSize = wallet.slotSize

  const reset = () => {
    setHseed(null)
    setRoot(null)
    setLayers(null)
    setEffectiveTime(0)
    setProgressStage(0)
    setProgress(0)
  }
  const onClose = () => {
    reset()
    setSection(Subsections.init)
    setSeed(null)
    setSeed2(null)
    setQRCodeData(null)
    setShowSecondCode(null)
    setSecondOtpQrCodeData(null)
    setConfirmName(null)
    setValidationOtp(null)
    setDoubleOtp(false)
    setMethod(null)
    onCloseOuter()
  }

  useEffect(() => {
    if (!seed || method !== 'new') {
      return
    }
    const f = async function () {
      const otpUri = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
      const otpQrCodeData = await qrcode.toDataURL(otpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setQRCodeData(otpQrCodeData)
    }
    f()
  }, [name, method, seed])
  useEffect(() => {
    if (!doubleOtp || !seed2 || method !== 'new') {
      return
    }
    const f = async function () {
      const secondOtpUri = getQRCodeUri(seed2, getSecondCodeName(name), OTPUriMode.MIGRATION)
      const secondOtpQrCodeData = await qrcode.toDataURL(secondOtpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setSecondOtpQrCodeData(secondOtpQrCodeData)
    }
    f()
  }, [name, method, seed2, doubleOtp])

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({
    setStage,
    otpState,
    network,
    resetWorker,
    onSuccess: () => {
      const rootHexView = ONEUtil.hexView(root)
      storage.setItem(rootHexView, layers)
      // TODO: validate tx receipt log events and remove old root/layers from storage
      const newWallet = {
        _merge: true,
        address,
        root: rootHexView,
        duration,
        effectiveTime,
        hseed: ONEUtil.hexView(hseed),
        doubleOtp,
        network,
        acknowledgedNewRoot: rootHexView,
        ...securityParameters,
      }
      dispatch(walletActions.updateWallet(newWallet))
      message.success(`Wallet ${wallet.name} (${address}) expiry date is renewed to ${new Date(effectiveTime + duration).toLocaleDateString()}`)
      setTimeout(() => history.push(Paths.showAddress(address)), 1500)
    }
  })

  const doReplace = async () => {
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({
      state: { ...otpState }, checkAmount: false, checkDest: false,
    }) || {}

    if (invalidOtp || invalidOtp2) return

    if (!root) {
      console.error('Root is not set')
      return
    }

    // struct CoreSetting {
    //   /// Some variables can be immutable, but doing so would increase contract size. We are at threshold at the moment (~24KiB) so until we separate the contracts, we will do everything to minimize contract size
    //   bytes32 root;
    //   uint8 height; // including the root. e.g. for a tree with 4 leaves, the height is 3.
    //   uint8 interval; // otp interval in seconds, default is 30
    //   uint32 t0; // starting time block (effectiveTime (in ms) / interval)
    //   uint32 lifespan;  // in number of block (e.g. 1 block per [interval] seconds)
    //   uint8 maxOperationsPerInterval; // number of transactions permitted per OTP interval. Each transaction shall have a unique nonce. The nonce is auto-incremented within each interval
    // }
    const tuple = [
      ONEUtil.hexString(root), layers.length, WalletConstants.interval / 1000, Math.floor(effectiveTime / WalletConstants.interval), Math.floor(duration / WalletConstants.interval), slotSize
    ]
    const encodedData = ONEUtil.abi.encodeParameters(['tuple(bytes32,uint8,uint8,uint32,uint32,uint8)'], [tuple])
    const args = { ...ONEConstants.NullOperationParams, data: encodedData, operationType: ONEConstants.OperationType.DISPLACE }
    await SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeDataHash,
      commitHashArgs: { ...args, data: ONEUtil.hexStringToBytes(encodedData) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...args, data: encodedData },
      ...handlers
    })
  }

  useEffect(() => {
    if (validationOtp?.length !== 6) {
      return
    }
    const currentSeed = showSecondCode ? seed2 : seed
    const expected = ONEUtil.genOTP({ seed: currentSeed })
    const code = new DataView(expected.buffer).getUint32(0, false).toString()
    setValidationOtp('')
    if (code.padStart(6, '0') !== validationOtp.padStart(6, '0')) {
      message.error('Code is incorrect. Please try again.')
      validationOtpRef?.current?.focusInput(0)
    } else if (doubleOtp && !showSecondCode) {
      setShowSecondCode(true)
      validationOtpRef?.current?.focusInput(0)
    } else {
      setSection(Subsections.confirm)
    }
  }, [validationOtp])

  useEffect(() => {
    if (!seed) {
      return
    }
    const worker = new Worker('/ONEWalletWorker.js')
    const effectiveTime = Date.now()
    const salt = ONEUtil.hexView(generateOtpSeed())
    worker.onmessage = (event) => {
      const { status, current, total, stage, result, salt: workerSalt } = event.data
      if (workerSalt && workerSalt !== salt) {
        // console.log(`[Extend] Discarding outdated worker result (salt=${workerSalt}, expected=${salt})`)
        return
      }
      if (status === 'working') {
        setProgress(Math.round(current / total * 100))
        setProgressStage(stage)
      }
      if (status === 'done') {
        const { hseed, root, layers, doubleOtp } = result
        setHseed(hseed)
        setRoot(root)
        setLayers(layers)
        setDoubleOtp(doubleOtp)
        setEffectiveTime(effectiveTime)
        setComputeInProgress(false)
      }
    }
    console.log('[Extend] Posting to worker')
    worker && worker.postMessage({
      seed,
      salt,
      seed2: doubleOtp && seed2,
      effectiveTime,
      duration,
      slotSize,
      interval: WalletConstants.interval,
      ...securityParameters
    })
    setComputeInProgress(true)
  }, [seed, method, doubleOtp])

  useEffect(() => {
    reset()
    if (method === 'new') {
      setSeed(generateOtpSeed())
      setSeed2(generateOtpSeed())
      setSection(Subsections.new)
    } else if (method === 'scan') {
      setSeed(null)
      setSeed2(null)
      setSection(Subsections.scan)
    }
  }, [method])

  const onScan = (e) => {
    if (e && !seed) {
      try {
        let parsed
        if (e.startsWith('otpauth://totp')) {
          parsed = parseOAuthOTP(e)
        } else {
          parsed = parseMigrationPayload(e)
        }

        if (!parsed) {
          return
        }
        // console.log(parsed)
        const { secret2, secret, name } = parsed
        setSeed(secret)
        if (secret2) {
          setSeed2(secret2)
          setDoubleOtp(true)
        }
        if (name !== wallet.name) {
          setConfirmName(name)
          return
        }
        setSection(Subsections.confirm)
      } catch (ex) {
        Sentry.captureException(ex)
        console.error(ex)
        message.error(`Failed to parse QR code. Error: ${ex.toString()}`)
      }
    }
  }
  const confirmUseName = () => {
    setSection(Subsections.confirm)
  }
  const cancelUseName = () => {
    setConfirmName(null)
    setSeed(null)
    setSeed2(null)
  }

  const Subsection = useCallback(({ show, children }) => {
    return (
      <AnimatedSection
        show={show} title={
          <Space direction='vertical'>
            <Title level={3}>Renew Wallet</Title>
            <WalletAddress showLabel alwaysShowOptions address={address} addressStyle={{ padding: 0 }} />
          </Space>
        }
      >
        {children}
        <Row justify='start' style={{ marginTop: 48 }}>
          <Button size='large' type='link' onClick={onClose} danger style={{ padding: 0 }}>Cancel</Button>
        </Row>
      </AnimatedSection>
    )
  }, [address])

  if (majorVersion < 14) {
    console.log(majorVersion, name)
    return (
      <Subsection show onClose={onClose}>
        <Warning>Your wallet is too old to use this feature. Please use a wallet that is at least version 14.1</Warning>
      </Subsection>
    )
  }

  return (
    <>
      <Subsection onClose={onClose} show={section === Subsections.init}>
        <AverageRow>
          <Title level={3}>Set up a new authenticator code?</Title>
        </AverageRow>
        <AverageRow gutter={24}>
          <Col span={isMobile ? 24 : 12}>
            <Space direction='vertical' size='large' style={{ width: '100%' }} align='center'>
              <Button shape='round' type='primary' onClick={() => setMethod('scan')}>Use the same</Button>
              <Hint>You will need to export the Google Authenticator QR Code and scan it using a camera</Hint>
            </Space>
          </Col>
          <Col span={isMobile ? 24 : 12}>
            <Space direction='vertical' size='large' style={{ width: '100%' }} align='center'>
              <Button shape='round' type='primary' onClick={() => setMethod('new')}>Setup a new one</Button>
              <Hint>You will setup a new authenticator code. Both your new and old authenticator code work simultaneously.</Hint>
            </Space>
          </Col>
        </AverageRow>
      </Subsection>
      <Subsection onClose={onClose} show={section === Subsections.scan}>
        {!confirmName &&
          <Space direction='vertical'>
            <ScanGASteps />
            <QrCodeScanner shouldInit={section === Subsections.scan} onScan={onScan} />
          </Space>}
        {confirmName &&
          <Space direction='vertical'>
            <AverageRow>
              <Text>You scanned a code for wallet <b>{confirmName}</b>, but your wallet's name is <b>{wallet.name}</b>. This means you might have scanned the wrong code.</Text>
            </AverageRow>
            <AverageRow>
              <Text style={{ color: 'red' }}> Are you sure to allow using this code from now on for this wallet?</Text>
            </AverageRow>
            <AverageRow justify='space-between'>
              <Button shape='round' onClick={cancelUseName}>Scan again</Button>
              <Button shape='round' type='primary' onClick={confirmUseName}>Yes, I understand</Button>
            </AverageRow>
          </Space>}

      </Subsection>
      <Subsection onClose={onClose} show={section === Subsections.new}>
        <Space direction='vertical' align='center' style={{ width: '100%' }}>
          <Hint>Scan or tap the QR code to setup a new authenticator code</Hint>
          {!showSecondCode &&
            <>
              {buildQRCodeComponent({ seed, name, os, isMobile, qrCodeData })}
              <OtpSetup isMobile={isMobile} otpRef={validationOtpRef} otpValue={validationOtp} setOtpValue={setValidationOtp} name={name} />
              {(dev || expert) && <TwoCodeOption isMobile={isMobile} setDoubleOtp={setDoubleOtp} doubleOtp={doubleOtp} />}
            </>}
          {showSecondCode &&
            <>
              {buildQRCodeComponent({ seed, name, os, isMobile, qrCodeData: secondOtpQrCodeData })}
              <OtpSetup isMobile={isMobile} otpRef={validationOtpRef} otpValue={validationOtp} setOtpValue={setValidationOtp} name={getSecondCodeName(name)} />
            </>}
        </Space>
      </Subsection>
      <Subsection onClose={onClose} show={section === Subsections.confirm}>
        <AverageRow>
          <Hint>If you have this wallet on other devices, the wallet can only be used up until its original expiry time on those devices. To fix that, open the wallet on those devices, follow the instructions, delete and "Restore" the wallet there. </Hint>
        </AverageRow>
        <AverageRow>
          {method === 'new' &&
            <Text style={{ color: 'red' }}>
              Both your new and old authenticator codes will work for this wallet from now on. Use your old authenticator code to confirm this operation.
            </Text>}
        </AverageRow>
        {!root && <WalletCreateProgress title='Computing security parameters...' progress={progress} isMobile={isMobile} progressStage={progressStage} />}
        <AverageRow align='middle'>
          <Col span={24}>
            <OtpStack
              isDisabled={!root}
              walletName={ONENames.nameWithTime(wallet.name, wallet.effectiveTime)}
              otpState={otpState}
              onComplete={doReplace}
              action={`confirm ${method === 'new' ? '[using old authenticator code]' : ''}`}
            />
          </Col>
        </AverageRow>
        <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
      </Subsection>
    </>

  )
}

export default Extend
