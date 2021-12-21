import { Button, Space, Row } from 'antd'
import { Text, Title } from '../../components/Text'
import { OtpSuperStack } from '../../components/OtpSuperStack'
import React, { useEffect, useState } from 'react'
import { useWindowDimensions } from '../../util'
import ShowUtils from '../Show/show-util'
import ONEConstants from '../../../../lib/constants'
import { EotpBuilders, SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import { useSelector } from 'react-redux'
import { useOtpState } from '../../components/OtpStack'
import message from '../../message'
import WalletConstants from '../../constants/wallet'
import WalletCreateProgress from '../../components/WalletCreateProgress'

// new core params should be already computed, and wallet info already retrieved from blockchain
const RestoreByCodes = ({ isActive, wallet, innerTrees, newCoreParams, onComplete, onCancel, progressStage, progress }) => {
  const [stage, setStage] = useState(-1)
  const { isMobile } = useWindowDimensions()
  const network = useSelector(state => state.wallet.network)
  const otpStates = new Array(6).fill(0).map(() => useOtpState().state)
  const [otpComplete, setOtpComplete] = useState(false)

  const resetOtps = () => {
    for (let i = otpStates.length - 1; i >= 0; i--) {
      otpStates[i].resetOtp(i > 0)
    }
    setOtpComplete(false)
  }

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({
    setStage,
    resetOtp: resetOtps,
    network,
    onSuccess: () => {
      // TODO: saving new wallet locally, store layers and innerLayers spawned from newCore
      onComplete && onComplete()
    }
  })

  const doDisplace = () => {
    if (!newCoreParams) {
      console.error('Not ready yet: newCoreParams')
      return
    }
    const { core, innerCores, identificationKeys } = newCoreParams
    if (!newCoreParams) {
      message.error('Must generate new core first')
      return
    }
    console.log(newCoreParams)
    const data = ONE.encodeDisplaceDataHex({ core, innerCores, identificationKey: identificationKeys[0] })
    const otps = otpStates.map(({ otpInput }) => ONEUtil.encodeNumericalOtp(parseInt(otpInput)))
    const index = ONEUtil.timeToIndex({
      effectiveTime: wallet.effectiveTime, interval: WalletConstants.interval6
    })
    const treeIndex = ONEUtil.timeToIndex({ effectiveTime: wallet.effectiveTime }) % innerTrees.length
    const layers = innerTrees[treeIndex]
    console.log(treeIndex, layers)
    SmartFlows.commitReveal({
      wallet,
      otp: otps,
      eotpBuilder: EotpBuilders.restore,
      index,
      layers,
      commitHashGenerator: ONE.computeDataHash,
      commitHashArgs: { data: ONEUtil.hexStringToBytes(data) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...ONEConstants.NullOperationParams, data, operationType: ONEConstants.OperationType.DISPLACE },
      ...handlers
    })
  }

  useEffect(() => {
    if (!newCoreParams || !otpComplete) {
      return
    }
    doDisplace()
  }, [otpComplete, newCoreParams])

  return (
    <Space direction='vertical' size='large' style={{ width: '100%' }}>
      <Title level={2}>Restore: Step 3/3</Title>
      <Text>Please provide <b>the original</b> authenticator codes, 6-digit at a time, every time you get a new one. Please make sure you do not miss any (in which case you need to start over). Please make sure you use the original code, not the one you just scanned.</Text>
      <OtpSuperStack
        otpStates={otpStates}
        action='submit for validation'
        wideLabel={isMobile}
        shouldAutoFocus={isActive}
        onComplete={() => setOtpComplete(true)}
        isDisabled={stage >= 0}
      />
      {!newCoreParams && otpComplete && <WalletCreateProgress progress={progress} isMobile={isMobile} progressStage={progressStage} subtitle='Rebuilding your 1wallet' />}
      <Row justify='space-between'>
        <Button size='large' type='text' onClick={onCancel} danger>Cancel</Button>
        <Button size='large' type='default' shape='round' onClick={resetOtps}>Reset</Button>
        <span />
      </Row>
    </Space>
  )
}
export default RestoreByCodes
