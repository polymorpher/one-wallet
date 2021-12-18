import { Button, Space } from 'antd'
import { Hint, Text } from '../../components/Text'
import { OtpSuperStack } from '../../components/OtpSuperStack'
import React, { useState } from 'react'
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

// new core params should be already computed, and wallet info already retrieved from blockchain
const RestoreByCodes = ({ isActive, wallet, layers, newCoreParams, onComplete, onCancel }) => {
  const [stage, setStage] = useState(-1)
  const { isMobile } = useWindowDimensions()
  const network = useSelector(state => state.global.network)
  const otpStates = new Array(6).map(() => useOtpState())

  const resetOtps = () => { otpStates.forEach(({ resetOtp }) => resetOtp()) }
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
    const { core, innerCores, identificationKey } = newCoreParams
    if (!newCoreParams) {
      message.error('Must generate new core first')
      return
    }
    const data = ONE.encodeDisplaceDataHex({ core, innerCores, identificationKey })
    const otps = otpStates.map(({ otpInput }) => ONEUtil.encodeNumericalOtp(parseInt(otpInput)))
    const index = ONEUtil.timeToIndex({
      effectiveTime: wallet.effectiveTime, interval: WalletConstants.interval6
    })
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
      revealArgs: { data, operationType: ONEConstants.OperationType.DISPLACE },
      ...handlers
    })
  }

  return (
    <Space direction='vertical' size='large' style={{ width: '100%' }} align='center'>
      <Text>You need 3 minutes to complete this process. Please type in your 6-digit authenticator code every time you get a new one, for the next three minutes. If you miss any, you would have to start over. In the end, you should have typed 36 digits in total.</Text>
      <OtpSuperStack
        otpStates={otpStates}
        action='(submit for validation)'
        wideLabel={isMobile}
        shouldAutoFocus={isActive}
        walletName={wallet?.name}
        onComplete={doDisplace}
        isDisabled={stage >= 0}
      />
      <Button size='large' type='text' onClick={onCancel} danger>Cancel</Button>
    </Space>
  )
}
export default RestoreByCodes
