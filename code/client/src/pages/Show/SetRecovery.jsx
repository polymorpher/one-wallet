import { Button, message, Row, Space, Typography } from 'antd'
import { CloseOutlined, LoadingOutlined } from '@ant-design/icons'
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

  const { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation, prepareProofFailed } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const doSetRecoveryAddress = async () => {
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
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      onCommitError,
      onCommitFailure,
      revealAPI: api.relayer.revealSetRecoveryAddress,
      revealArgs: { lastResortAddress: dest },
      prepareProofFailed,
      recoverRandomness,
      onRevealFailure,
      onRevealError,
      onRevealAttemptFailed,
      onRevealSuccess: (txId) => {
        onRevealSuccess(txId)
        message.success(`Recovery address is set to ${dest}`)
        dispatch(walletActions.fetchWallet({ address }))
        onClose()
      }
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
        <OtpStack walletName={wallet.name} otpState={otpState} doubleOtp={wallet.doubleOtp} />
      </Space>
      <Row justify='end' style={{ marginTop: 24 }}>
        <Space>
          {stage >= 0 && stage < 3 && <LoadingOutlined />}
          <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doSetRecoveryAddress}>Set</Button>
        </Space>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default SetRecovery
