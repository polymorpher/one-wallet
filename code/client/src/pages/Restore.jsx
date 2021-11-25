import React, { useState, useEffect } from 'react'
import { useHistory } from 'react-router'
import { Heading, Hint } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import { Space, Progress, Timeline } from 'antd'
import message from '../message'
import api from '../api'
import ONEUtil from '../../../lib/util'
import WalletConstants from '../constants/wallet'
import storage from '../storage'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import util, { useWindowDimensions } from '../util'
import { handleAddressError } from '../handler'
import Paths from '../constants/paths'
import * as Sentry from '@sentry/browser'
import AddressInput from '../components/AddressInput'
import QrCodeScanner from '../components/QrCodeScanner'
import ScanGASteps from '../components/ScanGASteps'
import { parseOAuthOTP, parseMigrationPayload } from '../components/OtpTools'
import WalletCreateProgress from '../components/WalletCreateProgress'

const Restore = () => {
  const { isMobile, os } = useWindowDimensions()
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
        let parsed
        if (e.startsWith('otpauth://totp')) {
          parsed = parseOAuthOTP(e)
        } else {
          parsed = parseMigrationPayload(e)
        }
        if (!parsed) {
          return
        }
        const { secret2, secret, name } = parsed
        setSecret2(secret2)
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
      <AnimatedSection show={section === 1}>
        <Space direction='vertical' size='large'>
          <Heading>What is the address of the wallet?</Heading>
          <AddressInput
            addressValue={addressInput}
            setAddressCallback={setAddressInput}
          />
          <Hint>Next, we will ask for your permission to use your computer's camera. We need that to scan the QR code exported from your Google Authenticator.</Hint>
        </Space>
      </AnimatedSection>
      <AnimatedSection show={section === 2}>
        <Space direction='vertical' size='large'>
          <Heading>Restore your wallet from Google Authenticator</Heading>
          {!secret &&
            <>
              <ScanGASteps />
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
                <WalletCreateProgress progress={progress} isMobile={isMobile} progressStage={progressStage} subtitle='Rebuilding your 1wallet' />
              </Space>
            </>}
        </Space>

      </AnimatedSection>
    </>
  )
}
export default Restore
