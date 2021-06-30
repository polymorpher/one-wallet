import React, { useState, useEffect, useRef } from 'react'
import { Heading, Hint, InputBox } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import { Space, Typography, Steps, Row, Select, message, Progress, Timeline } from 'antd'
import QrReader from 'react-qr-reader'
import { MigrationPayload } from '../proto/oauthMigration'
import api from '../api'
import ONEUtil from '../../../lib/util'
import WalletConstants from '../constants/wallet'
import storage from '../storage'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { fromBech32, HarmonyAddress, toBech32 } from '@harmony-js/crypto'

const { Text } = Typography
const { Step } = Steps

const Restore = () => {
  const [section, setSection] = useState(1)
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const dispatch = useDispatch()
  const [videoDevices, setVideoDevices] = useState([])
  const [secret, setSecret] = useState()
  const [name, setName] = useState()
  const [device, setDevice] = useState()
  const ref = useRef()
  useEffect(() => {
    const f = async () => {
      const d = await navigator.mediaDevices.enumerateDevices()
      const cams = d.filter(e => e.kind === 'videoinput')
      setVideoDevices(cams)
      setDevice(cams[0])
    }
    f()
  }, [])
  const onChange = (v) => {
    const d = videoDevices.find(e => e.deviceId === v)
    setDevice(d)
  }
  useEffect(() => {
    if (device && section === 2) {
      ref.current.initiate()
    }
  }, [device])
  const onScan = (e) => {
    if (e && !secret) {
      try {
        const data = new URL(e).searchParams.get('data')
        const params = MigrationPayload.decode(Buffer.from(data, 'base64')).otpParameters
        const filteredParams = params.filter(e => e.issuer === 'ONE Wallet')
        if (filteredParams.length > 1) {
          message.error('You selected more than 1 ONE Wallet code to export. Please reselect on Google Authenticator')
          return
        }
        const { secret, name } = filteredParams[0]
        setSecret(secret)
        setName(name)
      } catch (ex) {
        console.error(ex)
        message.error(`Failed to parse QR code. Error: ${ex.toString()}`)
      }
    }
  }
  const onError = (err) => {
    console.error(err)
    message.error(`Failed to parse QR code. Error: ${err}`)
  }
  const [addressInput, setAddressInput] = useState()
  const [address, setAddress] = useState()
  const [root, setRoot] = useState()
  const [effectiveTime, setEffectiveTime] = useState()
  const [duration, setDuration] = useState()
  const [slotSize, setSlotSize] = useState()
  const [lastResortAddress, setLastResortAddress] = useState()
  const [dailyLimit, setDailyLimit] = useState()

  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)

  const onRestore = async () => {
    if (!root) {
      console.error('Root is not set. Abort.')
      return
    }
    try {
      const worker = new Worker('ONEWalletWorker.js')
      worker.onmessage = (event) => {
        const { status, current, total, stage, result } = event.data
        if (status === 'working') {
          setProgress(Math.round(current / total * 100))
          setProgressStage(stage)
        }
        if (status === 'done') {
          const { hseed, root: computedRoot, layers } = result
          if (!ONEUtil.bytesEqual(ONEUtil.hexToBytes(root), computedRoot)) {
            console.error('Roots are not equal', root, ONEUtil.hexString(computedRoot))
            message.error('Verification failed. Please try again or report the issue on Github')
            return
          }
          storage.setItem(root, layers)
          const wallet = {
            name,
            address,
            root,
            duration,
            effectiveTime,
            lastResortAddress,
            dailyLimit,
            hseed: ONEUtil.hexView(hseed),
            network
          }
          dispatch(walletActions.updateWallet(wallet))
          dispatch(walletActions.fetchBalance({ address }))
          console.log('Completed wallet restoration', wallet)
          message.success(`Wallet ${name} (${address}) is restored!`)
        }
      }
      console.log('[Restore] Posting to worker')
      worker && worker.postMessage({
        seed: secret, effectiveTime, duration, slotSize, interval: WalletConstants.interval
      })
    } catch (ex) {
      console.error(ex)
      message.error(`Unexpected error during restoration: ${ex.toString()}`)
    }
  }

  useEffect(() => {
    const f = async () => {
      try {
        let address = addressInput
        if (!address) {
          return
        }
        if (address.startsWith('one')) {
          if (!HarmonyAddress.isValidBech32(address)) {
            console.error(`Invalid address: ${address}`)
            return
          }
          address = fromBech32(address)
        } else if (address.startsWith('0x')) {
          if (!HarmonyAddress.isValidBech32(toBech32(address))) {
            console.error(`Invalid address: ${address}`)
            return
          }
        } else {
          console.error(`Invalid address: ${address}`)
          return
        }
        if (wallets[address]) {
          message.error(`Wallet ${address} already exists locally`)
          return
        }
        const {
          root,
          t0,
          lifespan,
          maxOperationsPerInterval,
          lastResortAddress,
          dailyLimit
        } = await api.blockchain.getWallet({ address })
        console.log('Retrieved wallet:', {
          root,
          t0,
          lifespan,
          maxOperationsPerInterval,
          lastResortAddress,
          dailyLimit
        })
        setAddress(address)
        setRoot(root.slice(2))
        setEffectiveTime(t0 * WalletConstants.interval)
        setDuration(lifespan * WalletConstants.interval)
        setSlotSize(maxOperationsPerInterval)
        setLastResortAddress(lastResortAddress)
        setDailyLimit(dailyLimit)
        setSection(2)
      } catch (ex) {
        console.error(ex)
        message.error(`Cannot retrieve wallet at address ${address}. Error: ${ex.toString()}`)
      }
    }
    f()
  }, [addressInput])
  useEffect(() => {
    if (secret && name) {
      onRestore()
    }
  }, [secret, name])

  return (
    <>
      <AnimatedSection show={section === 1} style={{ maxWidth: 640 }}>
        <Space direction='vertical' size='large'>
          <Heading>What is the address of the wallet?</Heading>
          <InputBox margin='auto' width={440} value={addressInput} onChange={({ target: { value } }) => setAddressInput(value)} placeholder='one1...' />
        </Space>
      </AnimatedSection>
      <AnimatedSection show={section === 2} style={{ maxWidth: 640 }}>
        <Space direction='vertical' size='large'>
          <Heading>Restore your wallet from Google Authenticator</Heading>
          {!secret &&
            <>
              <Steps current={0} direction='vertical'>
                <Step title='Open Google Authenticator' description='Go to Google Authenticator, tap ... -> Export accounts on the top right corner' />
                <Step title='Select Your Wallet' description='Make sure your wallet is selected. Unselect other accounts.' />
                <Step title='Scan the QR code' description='Scan the exported QR code on your Google Authenticator app' />
              </Steps>
              <Row justify='end'>
                <Select style={{ }} bordered={false} value={device && device.label} onChange={onChange}>
                  {videoDevices.map(d => {
                    return <Select.Option key={d.label} value={d.deviceId}>{d.label} </Select.Option>
                  })}
                </Select>
              </Row>
              {videoDevices && device &&
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
                  style={{ width: '100%' }}
                />}
            </>}
          {secret &&
            <>
              <Hint>Restoring your wallet...</Hint>
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
                  <Timeline pending={progressStage < 2 && 'Rebuilding your ONE Wallet'}>
                    <Timeline.Item color={progressStage < 1 ? 'grey' : 'green'}>Recomputing proofs for each time interval</Timeline.Item>
                    <Timeline.Item color={progressStage < 2 ? 'grey' : 'green'}>Preparing hashes for verification</Timeline.Item>
                  </Timeline>
                </Space>
              </Space>
            </>}
        </Space>

      </AnimatedSection>
    </>
  )
}
export default Restore
