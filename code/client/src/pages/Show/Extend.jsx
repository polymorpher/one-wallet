import React, { useEffect, useState } from 'react'
import { Button, Row, Space, Typography, Input, Col, Radio } from 'antd'
import message from '../../message'
import { CloseOutlined } from '@ant-design/icons'
import { Hint, InputBox, Label, Warning } from '../../components/Text'
import { AverageRow, TallRow } from '../../components/Grid'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { generateOtpSeed, useWindowDimensions } from '../../util'
import BN from 'bn.js'
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
import { parseMigrationPayload, parseOAuthOTP } from '../../components/OtpTools'
import * as Sentry from '@sentry/browser'
import storage from '../../storage'
import walletActions from '../../state/modules/wallet/actions'
import Paths from '../../constants/paths'
import WalletConstants from '../../constants/wallet'
import WalletCreateProgress from '../../components/WalletCreateProgress'
const { Title, Text } = Typography
const { TextArea } = Input

const Extend = ({
  address,
  onClose,
  show,
  headless
}) => {
  const {
    dispatch, wallets, wallet, network, stage, setStage,
    resetWorker, recoverRandomness, otpState, isMobile,
  } = useOps(address)
  const { majorVersion } = wallet
  const [method, setMethod] = useState()
  const [seed, setSeed] = useState()
  const [seed2, setSeed2] = useState()

  const [root, setRoot] = useState()
  const [effectiveTime, setEffectiveTime] = useState()
  const [duration, setDuration] = useState(WalletConstants.defaultDuration)
  const [hseed, setHseed] = useState()
  const [layers, setLayers] = useState()
  const [slotSize, setSlotSize] = useState(1)
  const [doubleOtp, setDoubleOtp] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const securityParameters = ONEUtil.securityParameters(wallet)
  const [computeInProgress, setComputeInProgress] = useState(false)

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({
    setStage,
    otpState,
    network,
    resetWorker,
    onSuccess: () => {
      storage.setItem(root, layers)
      const wallet = {
        _merge: true,
        address,
        root,
        duration,
        effectiveTime,
        hseed: ONEUtil.hexView(hseed),
        doubleOtp,
        network,
        ...securityParameters,
      }
      dispatch(walletActions.updateWallet(wallet))
      message.success(`Wallet ${wallet.name} (${address}) expiry date is extended to ${new Date(effectiveTime + duration).toLocaleDateString()}`)
      setTimeout(() => history.push(Paths.showAddress(address)), 1500)
    }
  })

  const doReplace = () => {
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({
      state: { ...otpState }, checkAmount: false, checkDest: false,
    }) || {}

    // eslint-disable-next-line no-useless-return
    if (invalidOtp || invalidOtp2) return

    if (!root) {
      console.error('Root is not set')
      return
    }

    console.log('TODO')

    // const args = { amount, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: dest, tokenId: 0, dest: ONEConstants.EmptyAddress }
    // SmartFlows.commitReveal({
    //   wallet,
    //   otp,
    //   otp2,
    //   recoverRandomness,
    //   commitHashGenerator: ONE.computeGeneralOperationHash,
    //   commitHashArgs: { ...args, data: ONEUtil.hexStringToBytes(encodedData) },
    //   prepareProof: () => setStage(0),
    //   beforeCommit: () => setStage(1),
    //   afterCommit: () => setStage(2),
    //   revealAPI: api.relayer.reveal,
    //   revealArgs: { ...args, data: encodedData },
    //   ...handlers
    // })
  }
  useEffect(() => {
    if (!seed) {
      return
    }
    const worker = new Worker('/ONEWalletWorker.js')
    const effectiveTime = Date.now()
    const duration = WalletConstants.defaultDuration
    const slotSize = wallet.slotSize
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
    setHseed(null)
    setRoot(null)
    setLayers(null)
    setDoubleOtp(null)
    setEffectiveTime(0)
    if (method === 'new') {
      setSeed(generateOtpSeed())
      setSeed2(generateOtpSeed())
    } else if (method === 'scan') {
      setSeed(null)
      setSeed2(null)
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
        const { secret2, secret } = parsed
        setSeed2(secret2)
        setSeed(secret)
      } catch (ex) {
        Sentry.captureException(ex)
        console.error(ex)
        message.error(`Failed to parse QR code. Error: ${ex.toString()}`)
      }
    }
  }

  let inner
  if (majorVersion < 14) {
    inner = <Warning>Your wallet is too old. Please use a wallet that is at least version 14.1</Warning>
  } else {
    inner = (
      <>
        <Space direction='vertical' style={{ width: '100%' }}>
          <Text>You can extend the expiry time of your wallet by:</Text>
          <Radio.Group value={method} onChange={({ target: { value } }) => setMethod(value)} disabled={!!computeInProgress}>
            <Space direction='vertical'>
              <Radio value='scan'>Scan exported Google Authenticator QR Code</Radio>
              <Radio value='new'>Set up a new Google Authenticator entry</Radio>
            </Space>
          </Radio.Group>
          {method === 'scan' &&
            <>
              <ScanGASteps />
              <QrCodeScanner shouldInit={method === 'scan'} onScan={onScan} />
            </>}
          {
            method === 'new' &&
              <>

              </>
          }

        </Space>
        {method && !root && <WalletCreateProgress title='Computing security parameters...' progress={progress} isMobile={isMobile} progressStage={progressStage} />}
        {method && (
          <>
            <AverageRow align='middle'>
              <Col span={24}>
                <OtpStack
                  walletName={wallet.name}
                  otpState={otpState}
                  onComplete={doReplace}
                  action='confirm'
                />
              </Col>
            </AverageRow>
          </>)}
        <TallRow justify='start' style={{ marginTop: 24 }}>
          <Button size='large' type='text' onClick={onClose} danger>Cancel</Button>
        </TallRow>
        <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
      </>
    )
  }

  if (headless) {
    return inner
  }
  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show} title={<Title level={2}>Extend Wallet Life</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      {inner}
    </AnimatedSection>
  )
}

export default Extend
