import React, { useState, useEffect } from 'react'
import { useHistory } from 'react-router'
import { Heading, Hint } from '../components/Text'
import AnimatedSection from '../components/AnimatedSection'
import { Space, Progress, Button, Divider } from 'antd'
import message from '../message'
import api from '../api'
import ONEUtil from '../../../lib/util'
import WalletConstants from '../constants/wallet'
import storage from '../storage'
import { useDispatch, useSelector } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { balanceActions } from '../state/modules/balance'
import util, { useWindowDimensions } from '../util'
import { handleAddressError } from '../handler'
import Paths from '../constants/paths'
import * as Sentry from '@sentry/browser'
import AddressInput from '../components/AddressInput'
import QrCodeScanner from '../components/QrCodeScanner'
import ScanGASteps from '../components/ScanGASteps'
import { parseOAuthOTP, parseMigrationPayload, parseAuthAccountName } from '../components/OtpTools'
import WalletCreateProgress from '../components/WalletCreateProgress'
import RestoreByCodes from './Restore/RestoreByCodes'
import SyncRecoveryFile from './Restore/SyncRecoveryFile'
import SetupNewCode from './Restore/SetupNewCode'
import LocalImport from '../components/LocalImport'

const Sections = {
  Choose: 0,
  ScanQR: 1,
  SyncRecoveryFile: 2,
  SetupNewCode: 3,
  RecoveryCode: 4,
}

const Restore = () => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const [section, setSection] = useState(Sections.Choose)
  const network = useSelector(state => state.global.network)
  const wallets = useSelector(state => state.wallet)
  const dispatch = useDispatch()
  const [secret, setSecret] = useState()
  const [secret2, setSecret2] = useState()
  const [name, setName] = useState()
  const [address, setAddress] = useState()
  const [addressInput, setAddressInput] = useState({ value: '', label: '' })

  const [walletInfo, setWalletInfo] = useState()

  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [innerLayers, setInnerLayers] = useState()
  const [expert, setExpert] = useState()
  const [newCoreParams, setNewCoreParams] = useState()

  const retrieveWalletInfoFromAddress = async (address) => {
    const oneAddress = util.safeOneAddress(address)
    message.info(`Retrieving wallet information from ${oneAddress}`)
    try {
      const {
        root,
        effectiveTime,
        duration,
        slotSize,
        lastResortAddress,
        majorVersion,
        minorVersion,
        spendingLimit,
        spendingInterval,
        lastLimitAdjustmentTime,
        highestSpendingLimit,
      } = await api.blockchain.getWallet({ address })
      message.info('Wallet information retrieved from blockchain')

      const walletInfo = {
        address,
        root,
        effectiveTime,
        duration,
        slotSize,
        lastResortAddress,
        majorVersion,
        minorVersion,
        spendingLimit,
        spendingInterval,
        lastLimitAdjustmentTime,
        highestSpendingLimit,
      }
      console.log('Retrieved wallet:', walletInfo)
      setWalletInfo(walletInfo)
      setAddress(address)
    } catch (ex) {
      Sentry.captureException(ex)

      console.error(ex)

      const errorMessage = ex.toString()

      if (errorMessage.includes('no code at address')) {
        message.error('This is a wallet, but is not a 1wallet address')
      } else if (errorMessage.includes('Returned values aren\'t valid')) {
        message.error('This is a smart contract, but is not a 1wallet')
      } else {
        message.error(`Cannot retrieve 1wallet at address ${address}. Error: ${ex.toString()}`)
      }
    }
  }

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
        const { secret2, secret, name: rawName } = parsed
        const bundle = parseAuthAccountName(rawName)
        if (!bundle) {
          message.error('Authenticator code account name is ill-formatted. Expecting three-word name, optionally followed by address')
          return
        }
        const { name, address } = bundle
        retrieveWalletInfoFromAddress(address)
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

  const onRestore = async (ignoreDoubleOtp) => {
    if (!walletInfo.root) {
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
    }
  }

  useEffect(() => {
    const f = async () => {
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
      retrieveWalletInfoFromAddress(address)
    }
    f()
  }, [addressInput])

  useEffect(() => {
    if (secret && name) {
      onRestore()
    }
  }, [secret, name])

  const onSynced = async (address, layers, expert) => {
    try {
      await retrieveWalletInfoFromAddress(address)
      setExpert(expert)
      setInnerLayers(layers)
      setSection(Sections.SetupNewCode)
    } catch (ex) {
      console.error(ex)
      message.error('Please reselect recovery file and try again.')
    }
  }

  return (
    <>
      <AnimatedSection show={section === Sections.Choose}>
        <Space direction='vertical' size='large'>
          <Heading>Import a wallet file</Heading>
          <LocalImport />
          <Hint>This option best suits cross-device synchronization. This is the file that you exported under "About" tab. This option lets you share 1wallets across multiple devices, without having to export the seed from Google Authenticator as QR code.</Hint>
        </Space>
        <Divider><Hint>Or</Hint></Divider>
        <Space direction='vertical' size='large' style={{ width: '100%' }}>
          <Heading>Scan authenticator seed QR code</Heading>
          <Button shape='round' size='large' type='primary' onClick={() => setSection(Sections.ScanQR)}>Scan Now</Button>
          <Hint>Use your webcam to scan QR code exported from your Authenticator (Google and Aegis Authenticator only)</Hint>
        </Space>
        <Divider><Hint>Or</Hint></Divider>
        <Space direction='vertical' size='large' style={{ width: '100%' }}>
          <Heading>Use recovery file + 6 x 6-digit code</Heading>
          <Button shape='round' size='large' type='primary' onClick={() => setSection(Sections.RecoveryCode)}>Begin Now</Button>
          <Hint>Provide wallet recovery file, and 36 digit authenticator codes (6 each time) over the next 3 minutes. Setup a new authenticator code after that</Hint>
        </Space>
      </AnimatedSection>
      <AnimatedSection show={section === Sections.ScanQR}>
        <Space direction='vertical' size='large'>
          <Heading>Restore your wallet from Google Authenticator</Heading>
          {!secret &&
            <>
              <ScanGASteps />
              <QrCodeScanner shouldInit={section === Sections.ScanQR} onScan={onScan} />
            </>}
          {secret && !address &&
            <Space direction='vertical' size='large'>
              <Heading>What is the address of the wallet?</Heading>
              <AddressInput
                addressValue={addressInput}
                setAddressCallback={setAddressInput}
              />
              <Hint>Your wallet is created prior to v15. So we need its address to complete the restoration process. Newer wallet's address is self-contained and predictable.</Hint>
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
        </Space>

      </AnimatedSection>
      <AnimatedSection show={section === Sections.SyncRecoveryFile}>
        <SyncRecoveryFile
          onSynced={onSynced}
          onCancel={() => setSection(Sections.Choose)}
        />
      </AnimatedSection>
      <AnimatedSection show={section === Sections.SetupNewCode}>
        <SetupNewCode
          wallet={walletInfo}
          expert={expert}
          active={section === Sections.SetupNewCode}
          onComplete={() => setSection(Sections.RecoveryCode)}
          onCancel={() => setSection(Sections.Choose)}
          onProgressUpdate={({ progress, stage }) => { setProgress(progress); setProgressStage(stage) }}
          onComputedCoreParams={e => setNewCoreParams(e)}
        />
      </AnimatedSection>
      <AnimatedSection show={section === Sections.RecoveryCode}>
        <RestoreByCodes
          isActive={section === Sections.RecoveryCode}
          onComplete={() => setSection(Sections.SetupNewCode)}
          onCancel={() => setSection(Sections.Choose)}
          newCoreParams={newCoreParams}
          wallet={walletInfo}
          layers={innerLayers}
        />
      </AnimatedSection>
    </>
  )
}
export default Restore
