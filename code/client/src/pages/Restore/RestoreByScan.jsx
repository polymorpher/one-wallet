import { parseAuthAccountName, parseMigrationPayload, parseOAuthOTP } from '../../components/OtpTools'
import message from '../../message'
import * as Sentry from '@sentry/browser'
import { Heading, Hint } from '../../components/Text'
import ScanGASteps from '../../components/ScanGASteps'
import QrCodeScanner from '../../components/QrCodeScanner'
import { Button, Progress, Space } from 'antd'
import AddressInput from '../../components/AddressInput'
import WalletCreateProgress from '../../components/WalletCreateProgress'
import React, { useEffect, useState } from 'react'
import ONEUtil from '../../../../lib/util'
import storage from '../../storage'
import walletActions from '../../state/modules/wallet/actions'
import { balanceActions } from '../../state/modules/balance'
import Paths from '../../constants/paths'
import WalletConstants from '../../constants/wallet'
import { useDispatch, useSelector } from 'react-redux'
import util, { useWindowDimensions } from '../../util'
import { handleAddressError } from '../../handler'
import { retrieveWalletInfoFromAddress } from './Common'

const RestoreByScan = ({ isActive, onComplete, onCancel }) => {
  const { isMobile } = useWindowDimensions()
  const [secret, setSecret] = useState()
  const [secret2, setSecret2] = useState()
  const [name, setName] = useState()
  const [address, setAddress] = useState()
  const [addressInput, setAddressInput] = useState({ value: '', label: '' })
  const dispatch = useDispatch()
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [walletInfo, setWalletInfo] = useState()
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)

  useEffect(() => {
    const f = async () => {
      if (!addressInput.value || addressInput.value.length < 42) {
        return
      }
      const normalizedAddress = util.safeExec(util.normalizedAddress, [addressInput.value], handleAddressError)
      if (!normalizedAddress) {
        return
      }
      if (wallets[normalizedAddress]) {
        message.error(`Wallet ${normalizedAddress} already exists locally`)
        return
      }
      const { wallet } = await retrieveWalletInfoFromAddress(normalizedAddress)
      setAddress(normalizedAddress)
      setWalletInfo(wallet)
    }
    f()
  }, [addressInput])

  const onScan = async (e) => {
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
        console.log(parsed)
        const { secret2, secret, name: rawName } = parsed
        const bundle = parseAuthAccountName(rawName)
        if (!bundle) {
          message.error('Authenticator code account name is ill-formatted. Expecting three-word name, optionally followed by address')
          return
        }
        const { name, address } = bundle
        setSecret2(secret2)
        setSecret(secret)
        setName(name)
        if (address) {
          const { wallet } = await retrieveWalletInfoFromAddress(address)
          setAddress(address)
          setWalletInfo(wallet)
        }
      } catch (ex) {
        Sentry.captureException(ex)
        console.error(ex)
        message.error(`Failed to parse QR code. Error: ${ex.toString()}`)
      }
    }
  }

  const onRestore = (ignoreDoubleOtp) => {
    if (!walletInfo?.root) {
      console.error('Root is not set. Abort.')
      return
    }
    try {
      const securityParameters = ONEUtil.securityParameters(walletInfo)
      const worker = new Worker('ONEWalletWorker.js')
      worker.onmessage = (event) => {
        const { status, current, total, stage, result } = event.data
        if (status === 'working') {
          setProgress(Math.round(current / total * 100))
          setProgressStage(stage)
        }
        if (status === 'done') {
          const { hseed, root: computedRoot, layers, doubleOtp } = result
          if (!ONEUtil.bytesEqual(ONEUtil.hexToBytes(walletInfo.root), computedRoot)) {
            console.error('Roots are not equal', walletInfo.root, ONEUtil.hexString(computedRoot))
            if (!ignoreDoubleOtp && doubleOtp) {
              message.error('Verification failed. Retrying using single authenticator code...')
              onRestore(true)
              return
            }
            message.error('Verification failed. Your authenticator QR code might correspond to a different contract address.')
            return
          }
          storage.setItem(walletInfo.root, layers)
          const wallet = {
            _merge: true,
            name,
            ...walletInfo,
            hseed: ONEUtil.hexView(hseed),
            doubleOtp,
            network,
            ...securityParameters,
          }
          dispatch(walletActions.updateWallet(wallet))
          dispatch(balanceActions.fetchBalance({ address }))
          console.log('Completed wallet restoration', wallet)
          message.success(`Wallet ${name} (${address}) is restored!`)
          onComplete && onComplete()
          setTimeout(() => history.push(Paths.showAddress(address)), 1500)
        }
      }
      console.log('[Restore] Posting to worker')
      worker && worker.postMessage({
        seed: secret,
        seed2: !ignoreDoubleOtp && secret2,
        effectiveTime: walletInfo.effectiveTime,
        duration: walletInfo.duration,
        slotSize: walletInfo.slotSize,
        interval: WalletConstants.interval,
        ...securityParameters
      })
    } catch (ex) {
      Sentry.captureException(ex)
      console.error(ex)
      message.error(`Unexpected error during restoration: ${ex.toString()}`)
      onCancel && onCancel()
    }
  }

  useEffect(() => {
    if (secret && name) {
      onRestore()
    }
  }, [secret, name])

  return (
    <Space direction='vertical' size='large'>
      <Heading>Restore your wallet from Google Authenticator</Heading>
      {!secret &&
        <>
          <ScanGASteps />
          <QrCodeScanner shouldInit={isActive} onScan={onScan} />
        </>}
      {secret && !address &&
        <Space direction='vertical' size='large'>
          <Heading>What is the address of the wallet?</Heading>
          <AddressInput
            addressValue={addressInput}
            setAddressCallback={setAddressInput}
          />
          <Hint>Your wallet was created prior to v15. We need the address to restore the wallet. You can usually find the address using the saved QR code, or look at transaction history from other wallets that sent money to the wallet.</Hint>
        </Space>}
      {secret && address &&
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
      <Button size='large' type='text' onClick={onCancel} danger>Cancel</Button>
    </Space>
  )
}

export default RestoreByScan
