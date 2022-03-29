import { parseAuthAccountName, parseMigrationPayload, parseOAuthOTP } from '../../components/OtpTools'
import message from '../../message'
import * as Sentry from '@sentry/browser'
import { Heading, Hint, Text } from '../../components/Text'
import ScanGASteps from '../../components/ScanGASteps'
import QrCodeScanner from '../../components/QrCodeScanner'
import Button from 'antd/es/button'
import Space from 'antd/es/space'
import AddressInput from '../../components/AddressInput'
import WalletCreateProgress from '../../components/WalletCreateProgress'
import React, { useEffect, useState, useRef } from 'react'
import ONEUtil from '../../../../lib/util'
import storage from '../../storage'
import walletActions from '../../state/modules/wallet/actions'
import { balanceActions } from '../../state/modules/balance'
import Paths from '../../constants/paths'
import WalletConstants from '../../constants/wallet'
import { useDispatch, useSelector } from 'react-redux'
import util, { useWindowDimensions } from '../../util'
import config from '../../config'
import { handleAddressError } from '../../handler'
import { retrieveWalletInfoFromAddress } from './Common'
import { api } from '../../../../lib/api'
import { useHistory } from 'react-router'

const RestoreByScan = ({ isActive, onComplete, onCancel }) => {
  const history = useHistory()
  const { isMobile } = useWindowDimensions()
  const [secret, setSecret] = useState()
  const [secret2, setSecret2] = useState()
  const [name, setName] = useState()
  const [address, setAddress] = useState()
  const [retrievingAddress, setRetrievingAddress] = useState(false)
  const [innerCores, setInnerCores] = useState()
  const [identificationKeys, setIdentificationKeys] = useState()
  const [oldCores, setOldCores] = useState()
  const [addressInput, setAddressInput] = useState({ value: '', label: '' })
  const dispatch = useDispatch()
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [walletInfo, setWalletInfo] = useState()
  const network = useSelector(state => state.global.network)
  const wallets = useSelector(state => state.wallet)
  const control = useRef({ lastScan: 0, restoring: false }).current

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
      try {
        const { wallet } = await retrieveWalletInfoFromAddress(normalizedAddress, addressInput.label)

        if (wallet.majorVersion >= 15) {
          const [oldCores, innerCores, idKeys] = await Promise.all([
            api.blockchain.getOldInfos({ address: normalizedAddress }),
            api.blockchain.getInnerCores({ address: normalizedAddress }),
            api.blockchain.getIdentificationKeys({ address: normalizedAddress })
          ])
          setOldCores(oldCores)
          setInnerCores(innerCores)
          setIdentificationKeys(idKeys)
        } else if (wallet.majorVersion >= 14) {
          const oldCores = await api.blockchain.getOldInfos({ address: normalizedAddress })
          setOldCores(oldCores)
          setInnerCores([])
          setIdentificationKeys([])
        } else {
          setOldCores([])
          setInnerCores([])
          setIdentificationKeys([])
        }
        setWalletInfo(wallet)
        setAddress(normalizedAddress)
      } catch (ex) {
        console.error(ex)
      } finally {
        setRetrievingAddress(false)
      }
    }
    f()
  }, [addressInput])

  const onScan = async (e, isJson) => {
    if (e && !secret) {
      const now = performance.now()
      if (!(now - control.lastScan > config.scanDelay)) {
        return
      }
      control.lastScan = now
      try {
        let parsed
        if (isJson) {
          parsed = e
        } else if (e.startsWith('otpauth://totp')) {
          parsed = parseOAuthOTP(e)
        } else {
          parsed = parseMigrationPayload(e)
        }
        if (!parsed) {
          return
        }
        const { secret2, secret, name: rawName } = parsed
        message.debug(`Scanned name: ${rawName} | secret: ${secret && ONEUtil.base32Encode(secret)} | secret2: ${secret2 && ONEUtil.base32Encode(secret2)}`)
        const bundle = parseAuthAccountName(rawName)
        if (!bundle) {
          message.error('Bad authenticator account name. Expecting name, followed by time and address (optional)')
          return
        }
        const { name, address: oneAddress } = bundle
        const address = util.safeNormalizedAddress(oneAddress)
        if (address) {
          setRetrievingAddress(true)
          setAddressInput({ value: address, label: name })
        }
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

  const onSave = async ({ layers, root, hseed, innerTrees, doubleOtp, securityParameters, oldInfos, identificationKeys, localIdentificationKey }) => {
    message.info('Saving your wallet...')
    const promises = [storage.setItem(root, layers)]
    for (const { layers: innerLayers, root: innerRoot } of innerTrees) {
      promises.push(storage.setItem(ONEUtil.hexView(innerRoot), innerLayers))
    }
    await Promise.all(promises)

    const wallet = {
      _merge: true,
      name,
      ...walletInfo,
      hseed: ONEUtil.hexView(hseed),
      innerRoots: innerTrees.map(({ root }) => ONEUtil.hexView(root)),
      doubleOtp,
      network,
      oldInfos,
      identificationKeys,
      localIdentificationKey,
      ...securityParameters,
    }
    dispatch(walletActions.updateWallet(wallet))
    dispatch(balanceActions.fetchBalance({ address }))
    console.log('Completed wallet restoration', wallet)
    message.success(`Wallet ${name} (${address}) is restored! Redirecting to your wallet in 2 seconds...`)
    onComplete && onComplete()
    setTimeout(() => history.push(Paths.showAddress(address)), 2000)
  }
  const onRestore = (ignoreDoubleOtp) => {
    if (control.restoring) {
      return
    }
    if (!walletInfo?.root) {
      console.error('Root is not set. Abort.')
      return
    }
    try {
      control.restoring = true
      const expectedIdKey = ONEUtil.getIdentificationKey(ONEUtil.processOtpSeed(secret), true)
      const allRoots = [...oldCores.map(e => ONEUtil.hexStringToBytes(e.root)), ONEUtil.hexToBytes(walletInfo.root)]
      let idKeyIndex = -1
      if (identificationKeys.filter(e => e.length >= 130).length > 0) {
        idKeyIndex = identificationKeys.findIndex(e => e === expectedIdKey)
        if (idKeyIndex === -1) {
          message.error('Seed QR code does not match 1wallet identification key at the address. If this is unexpected, please report this bug to us.')
          return
        }
      }

      let effectiveTime, duration, slotSize, root
      if (idKeyIndex === -1 || idKeyIndex === identificationKeys.length - 1) {
        effectiveTime = walletInfo.effectiveTime
        duration = walletInfo.duration
        slotSize = walletInfo.slotSize
        root = walletInfo.root
      } else {
        effectiveTime = oldCores[idKeyIndex].effectiveTime
        duration = oldCores[idKeyIndex].duration
        slotSize = oldCores[idKeyIndex].slotSize
        root = oldCores[idKeyIndex].root
      }
      console.log(idKeyIndex, { effectiveTime, duration, slotSize })

      const securityParameters = ONEUtil.securityParameters(walletInfo)
      const worker = new Worker('ONEWalletWorker.js')
      worker.onmessage = (event) => {
        const { status, current, total, stage, result } = event.data
        if (status === 'working') {
          setProgress(Math.round(current / total * 100))
          setProgressStage(stage)
        }
        if (status === 'done') {
          const { hseed, root: computedRoot, layers, doubleOtp, innerTrees } = result
          // console.log(layers)
          const matchedRoot = allRoots.find(e => ONEUtil.bytesEqual(e, computedRoot))
          console.log({ allRoots, matchedRoot })
          if (!matchedRoot) {
            console.error('Root not found', ONEUtil.hexView(computedRoot), '| candidates', allRoots.map(e => ONEUtil.hexView(e)))
            if (!ignoreDoubleOtp && doubleOtp) {
              message.error('Verification failed. Retrying using single authenticator code...')
              return onRestore(true)
            }
            message.error('Verification failed. Your authenticator QR code might correspond to a different contract address.')
            return
          }
          onSave({
            layers, hseed, innerTrees, doubleOtp, securityParameters, oldInfos: oldCores, root, identificationKeys, localIdentificationKey: idKeyIndex >= 0 ? identificationKeys[idKeyIndex] : null
          }).catch(ex => console.error(ex))
        }
      }
      // let secretProcessed =  secret
      console.log('[Restore] Posting to worker')
      worker && worker.postMessage({
        seed: secret,
        seed2: !ignoreDoubleOtp && secret2,
        effectiveTime,
        duration,
        slotSize,
        interval: WalletConstants.interval,
        buildInnerTrees: innerCores && innerCores.length > 0,
        ...securityParameters
      })
    } catch (ex) {
      Sentry.captureException(ex)
      console.error(ex)
      message.error(`Unexpected error during restoration: ${ex.toString()}`)
      onCancel && onCancel()
    } finally {
      control.restoring = false
    }
  }

  useEffect(() => {
    if (secret && name && walletInfo?.root && address && oldCores && innerCores && identificationKeys) {
      onRestore()
    }
  }, [secret, name, walletInfo, address, secret2, oldCores, innerCores, identificationKeys])

  return (
    <Space direction='vertical' size='large'>
      <Heading>Restore 1wallet by Scanning</Heading>
      {(!secret || retrievingAddress) &&
        <>
          <ScanGASteps />
          {!retrievingAddress && <QrCodeScanner shouldInit={isActive} onScan={onScan} />}
          {retrievingAddress && <Text>Scan successful for: <br /><b>{addressInput.label ? addressInput.label : ''} ({addressInput.value})</b><br />Processing...</Text>}
        </>}
      {secret && !address && !retrievingAddress &&
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
          <WalletCreateProgress progress={progress} isMobile={isMobile} progressStage={progressStage} subtitle='Rebuilding your 1wallet' />
        </>}
      <Button size='large' type='text' onClick={onCancel} danger>Cancel</Button>
    </Space>
  )
}

export default RestoreByScan
