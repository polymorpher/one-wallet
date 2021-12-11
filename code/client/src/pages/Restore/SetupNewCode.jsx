import { Button, Space } from 'antd'
import { Hint } from '../../components/Text'
import { buildQRCodeComponent, getQRCodeUri, getSecondCodeName, OTPUriMode } from '../../components/OtpTools'
import { OtpSetup, TwoCodeOption } from '../../components/OtpSetup'
import React, { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { generateOtpSeed, useWindowDimensions } from '../../util'
import qrcode from 'qrcode'
import ONEUtil from '../../../../lib/util'
import WalletConstants from '../../constants/wallet'
import message from '../../message'

const SetupNewCode = ({ expert, active, wallet, onComplete, onCancel, onComputedCoreParams, onProgressUpdate }) => {
  const { name } = wallet
  const [showSecondCode, setShowSecondCode] = useState()
  const [qrCodeData, setQRCodeData] = useState()
  const [secondOtpQrCodeData, setSecondOtpQrCodeData] = useState()
  const [validationOtp, setValidationOtp] = useState()
  const validationOtpRef = useRef()
  const dev = useSelector(state => state.wallet.dev)
  const [seed, setSeed] = useState(generateOtpSeed())
  const [seed2, setSeed2] = useState(generateOtpSeed())
  const { isMobile, os } = useWindowDimensions()
  const [doubleOtp, setDoubleOtp] = useState(false)

  const [innerTrees, setInnerTrees] = useState()
  const [root, setRoot] = useState() // Uint8Array
  const [effectiveTime, setEffectiveTime] = useState()
  const [layers, setLayers] = useState()
  const securityParameters = ONEUtil.securityParameters(wallet)
  const duration = WalletConstants.defaultDuration
  const slotSize = wallet.slotSize

  const onClose = () => {
    setRoot(null)
    setLayers(null)
    setEffectiveTime(0)
    setValidationOtp(null)
    setDoubleOtp(false)
    onCancel && onCancel()
  }

  useEffect(() => {
    if (!seed) {
      return
    }
    const f = async function () {
      const otpUri = getQRCodeUri(seed, name, OTPUriMode.MIGRATION)
      const otpQrCodeData = await qrcode.toDataURL(otpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setQRCodeData(otpQrCodeData)
    }
    f()
  }, [name])
  useEffect(() => {
    if (!doubleOtp || !seed2) {
      return
    }
    const f = async function () {
      const secondOtpUri = getQRCodeUri(seed2, getSecondCodeName(name), OTPUriMode.MIGRATION)
      const secondOtpQrCodeData = await qrcode.toDataURL(secondOtpUri, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      setSecondOtpQrCodeData(secondOtpQrCodeData)
    }
    f()
  }, [name, doubleOtp])

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
      onComplete && onComplete()
    }
  }, [validationOtp])

  useEffect(() => {
    if (!seed || !active) {
      return
    }
    const worker = new Worker('/ONEWalletWorker.js')
    const effectiveTime = Math.floor(Date.now() / WalletConstants.interval6) * WalletConstants.interval6
    const salt = ONEUtil.hexView(generateOtpSeed())
    worker.onmessage = (event) => {
      const { status, current, total, stage, result, salt: workerSalt } = event.data
      if (workerSalt && workerSalt !== salt) {
        return
      }
      if (status === 'working') {
        const progress = Math.round(current / total * 100)
        onProgressUpdate && onProgressUpdate({ progress, stage })
      }
      if (status === 'done') {
        const { root, layers, doubleOtp, innerTrees } = result
        setRoot(root)
        setLayers(layers)
        setDoubleOtp(doubleOtp)
        setEffectiveTime(effectiveTime)
        setInnerTrees(innerTrees)
        onProgressUpdate && onProgressUpdate({ computing: false })
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
    onProgressUpdate && onProgressUpdate({ computing: true })
  }, [seed, active, doubleOtp])

  useEffect(() => {
    if (!root || !innerTrees) {
      return
    }
    const identificationKeys = [ONEUtil.getIdentificationKey(seed, true)]
    const innerCores = ONEUtil.makeInnerCores({ innerTrees, effectiveTime, duration, slotSize, interval: WalletConstants.interval })
    const core = ONEUtil.makeCore({ effectiveTime, duration, interval: WalletConstants.interval, height: layers.length, slotSize })
    setSeed(null)
    setSeed2(null)
    onComputedCoreParams && onComputedCoreParams({ core, innerCores, identificationKeys })
  }, [root, innerTrees])

  return (
    <Space direction='vertical' align='center' style={{ width: '100%' }}>
      <Hint>{isMobile ? 'Tap' : 'Scan'} the QR code to setup a new authenticator code, which will only work for this device. Your old code will still work on other devices.</Hint>
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
      <Button size='large' type='text' onClick={onClose} danger>Cancel</Button>
    </Space>
  )
}
export default SetupNewCode
