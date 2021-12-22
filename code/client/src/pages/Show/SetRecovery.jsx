import { Button, Space, Typography } from 'antd'
import message from '../../message'
import { CloseOutlined } from '@ant-design/icons'
import { Hint, Label } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import React, { useState } from 'react'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import walletActions from '../../state/modules/wallet/actions'
import ShowUtils from './show-util'
import { useDispatch, useSelector } from 'react-redux'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import { useWindowDimensions } from '../../util'
import ONENames from '../../../../lib/names'
const { Title } = Typography

const SetRecovery = ({ address, onClose, show }) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.wallet.network)
  const [stage, setStage] = useState(-1)
  const [transferTo, setTransferTo] = useState({ value: '', label: '' })
  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { state: otpState } = useOtpState()
  const { isMobile } = useWindowDimensions()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const { prepareValidation, ...helpers } = ShowUtils.buildHelpers({
    setStage,
    resetOtp,
    network,
    resetWorker,
    onSuccess: () => {
      message.success('Recovery address set')
      dispatch(walletActions.fetchWallet({ address }))
      onClose()
    }
  })

  const doSetRecoveryAddress = async () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, dest } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo },
      checkAmount: false
    }) || {}
    if (invalidOtp || !dest || invalidOtp2) return

    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      commitHashGenerator: ONE.computeSetRecoveryAddressHash,
      commitHashArgs: { address: dest },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.revealSetRecoveryAddress,
      revealArgs: { lastResortAddress: dest },
      recoverRandomness,
      ...helpers,
    })
  }

  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show}
      title={<Title level={isMobile ? 5 : 2}>Set Recovery Address</Title>}
      extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Space direction='vertical' size='large'>
        <Hint>Note: You can only do this once!</Hint>
        <Space
          align={isMobile ? undefined : 'baseline'}
          size='large'
          direction={isMobile ? 'vertical' : 'horizontal'}
          style={{ width: '100%' }}
        >
          <Label><Hint>Address</Hint></Label>
          <AddressInput
            addressValue={transferTo}
            setAddressCallback={setTransferTo}
            currentWallet={wallet}
          />
        </Space>
        <OtpStack walletName={ONENames.nameWithTime(wallet.name, wallet.effectiveTime)} otpState={otpState} doubleOtp={wallet.doubleOtp} onComplete={doSetRecoveryAddress} action='confirm' />
      </Space>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default SetRecovery
