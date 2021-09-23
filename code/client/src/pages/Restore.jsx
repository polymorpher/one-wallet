import React, { useState, useEffect } from 'react'
import { useHistory } from 'react-router'
import { Heading, Hint } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import { Space, Steps, message, Progress, Timeline } from 'antd'
import { MigrationPayload } from '../proto/oauthMigration'
import api from '../api'
import ONEUtil from '../../../lib/util'
import WalletConstants from '../constants/wallet'
import storage from '../storage'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import util from '../util'
import { handleAddressError } from '../handler'
import Paths from '../constants/paths'
import * as Sentry from '@sentry/browser'
import AddressInput from '../components/AddressInput'
import QrCodeScanner from '../components/QrCodeScanner'

const { Step } = Steps

const Restore = () => {
  const history = useHistory()
  const [section, setSection] = useState(1)
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const dispatch = useDispatch()
  const [secret, setSecret] = useState()
  const [secret2, setSecret2] = useState()
  const [name, setName] = useState()
  const [majorVersion, setMajorVersion] = useState()
  const [minorVersion, setMinorVersion] = useState()

  const onScan = (e) => {
    if (e && !secret) {
      try {
        const data = new URL(e).searchParams.get('data')
        const decoded = MigrationPayload.decode(Buffer.from(data, 'base64'))
        // console.log(decoded)
        const params = decoded.otpParameters
        const filteredParams = params.filter(e => e.issuer === 'ONE Wallet' || e.issuer === 'Harmony')
        if (filteredParams.length > 2) {
          message.error('You selected more than one authenticator entry to export. Please reselect on Google Authenticator')
          return
        }
        if (filteredParams.length === 2) {
          const names = filteredParams.map(e => e.name.split('-')[0].trim()).map(e => e.split('(')[0].trim())
          if (names[0] !== names[1]) {
            message.error('You selected two wallets with different names. If you want to select two entries belonging to the same wallet, make sure they have the same name and the second one has "- 2nd" in the end')
            return
          }
          const { secret } = filteredParams[1]
          setSecret2(secret)
        }
        const { secret, name } = filteredParams[0]
        setSecret(secret)
        setName(name)
      } catch (ex) {
        Sentry.captureException(ex)
        console.error(ex)
        message.error(`Failed to parse QR code. Error: ${ex.toString()}`)
      }
    }
  }

  const [addressInput, setAddressInput] = useState({ value: '', label: '' })
  const [address, setAddress] = useState()
  const [root, setRoot] = useState()
  const [effectiveTime, setEffectiveTime] = useState()
  const [duration, setDuration] = useState()
  const [slotSize, setSlotSize] = useState()
  const [lastResortAddress, setLastResortAddress] = useState()
  const [spendingLimit, setSpendingLimit] = useState()
  const [spendingInterval, setSpendingInterval] = useState()

  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)

  const onRestore = async (ignoreDoubleOtp) => {
    if (!root) {
      console.error('Root is not set. Abort.')
      return
    }
    try {
      const securityParameters = ONEUtil.securityParameters({ majorVersion, minorVersion })
      const worker = new Worker('ONEWalletWorker.js')
      worker.onmessage = (event) => {
        const { status, current, total, stage, result } = event.data
        if (status === 'working') {
          setProgress(Math.round(current / total * 100))
          setProgressStage(stage)
        }
        if (status === 'done') {
          const { hseed, root: computedRoot, layers, doubleOtp } = result
          if (!ONEUtil.bytesEqual(ONEUtil.hexToBytes(root), computedRoot)) {
            console.error('Roots are not equal', root, ONEUtil.hexString(computedRoot))
            // console.error('Roots are not equal', root, ONEUtil.hexString(computedRoot), {
            //   hseed,
            //   doubleOtp,
            //   secret,
            //   secret2,
            //   ignoreDoubleOtp,
            //   ...securityParameters,
            //   majorVersion,
            //   minorVersion,
            //   effectiveTime,
            //   duration,
            //   slotSize,
            // })
            if (!ignoreDoubleOtp && doubleOtp) {
              message.error('Verification failed. Retrying using single authenticator code...')
              onRestore(true)
              return
            }
            message.error('Verification failed. Your authenticator QR code might correspond to a different contract address.')
            return
          }
          storage.setItem(root, layers)
          const wallet = {
            _merge: true,
            name,
            address,
            root,
            duration,
            effectiveTime,
            lastResortAddress,
            hseed: ONEUtil.hexView(hseed),
            majorVersion,
            minorVersion,
            doubleOtp,
            network,
            ...securityParameters,
            spendingLimit,
            spendingInterval
          }
          dispatch(walletActions.updateWallet(wallet))
          dispatch(walletActions.fetchBalance({ address }))
          console.log('Completed wallet restoration', wallet)
          message.success(`Wallet ${name} (${address}) is restored!`)
          setTimeout(() => history.push(Paths.showAddress(address)), 1500)
        }
      }
      console.log('[Restore] Posting to worker')
      worker && worker.postMessage({
        seed: secret,
        seed2: !ignoreDoubleOtp && secret2,
        effectiveTime,
        duration,
        slotSize,
        interval: WalletConstants.interval,
        ...securityParameters
      })
    } catch (ex) {
      Sentry.captureException(ex)
      console.error(ex)
      message.error(`Unexpected error during restoration: ${ex.toString()}`)
    }
  }

  useEffect(() => {
    const f = async () => {
      try {
        if (!addressInput.value || addressInput.value.length < 42) {
          return
        }
        const address = util.safeExec(util.normalizedAddress, [addressInput.value], handleAddressError)
        if (!address) {
          return
        }
        if (wallets[address]) {
          message.error(`Wallet ${address} already exists locally`)
          return
        }
        const {
          root,
          effectiveTime,
          duration,
          slotSize,
          lastResortAddress,
          majorVersion,
          minorVersion,
          spendingLimit,
          spendingInterval
        } = await api.blockchain.getWallet({ address })
        console.log('Retrieved wallet:', {
          root,
          effectiveTime,
          duration,
          slotSize,
          lastResortAddress,
          majorVersion,
          minorVersion,
          spendingLimit,
          spendingInterval
        })
        setAddress(address)
        setRoot(root)
        setEffectiveTime(effectiveTime)
        setDuration(duration)
        setSlotSize(slotSize)
        setLastResortAddress(lastResortAddress)
        setSpendingLimit(spendingLimit)
        setSpendingInterval(spendingInterval)
        setSection(2)
        setMajorVersion(majorVersion)
        setMinorVersion(minorVersion)
      } catch (ex) {
        Sentry.captureException(ex)

        console.error(ex)

        const errorMessage = ex.toString()

        if (errorMessage.includes('no code at address')) {
          message.error('This is a wallet, but is not a 1wallet address')
        } else if (errorMessage.includes('Returned values aren\'t valid')) {
          message.error('This is a smart contract, but is not a 1wallet address')
        } else {
          message.error(`Cannot retrieve wallet at address ${address}. Error: ${ex.toString()}`)
        }
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
          <AddressInput
            addressValue={addressInput}
            setAddressCallback={setAddressInput}
          />
          <Hint>Next, we will ask for your permission to use your computer's camera. We need that to scan the QR code exported from your Google Authenticator.</Hint>
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
              <QrCodeScanner shouldInit={section === 2} onScan={onScan} />
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
                  <Timeline pending={progressStage < 2 && 'Rebuilding your 1wallet'}>
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
