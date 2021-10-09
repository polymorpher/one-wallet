import React, { useState } from 'react'
import { Button, Row, Space, Typography, Input, Checkbox, Tooltip, Slider } from 'antd'
import { CheckCircleOutlined, CloseOutlined, LoadingOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import { Hint, Label, Warning } from '../../components/Text'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { useSelector } from 'react-redux'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import ONEConstants from '../../../../lib/constants'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import humanizeDuration from 'humanize-duration'
const { Title } = Typography
const { TextArea } = Input

const Sign = ({
  address,
  show,
  onClose, // optional
  onSuccess, // optional
  prefillMessageInput, // optional string, the message itself
  prefillUseRawMessage, // optional boolean, whether or not eth signing header should be attached. True means not to attach header
  prefillDuration, // optional string that can be parsed into an integer, the number of milliseconds of the validity of the signature
}) => {
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.wallet.network)

  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const [stage, setStage] = useState(-1)

  const { resetWorker, recoverRandomness } = useRandomWorker()

  const [messageInput, setMessageInput] = useState(prefillMessageInput)
  const [useRawMessage, setUseRawMessage] = useState(prefillUseRawMessage)

  prefillDuration = parseInt(prefillDuration)
  const [duration, setDuration] = useState(prefillDuration)
  const [noExpiry, setNoExpiry] = useState(isNaN(prefillDuration) ? true : (prefillDuration === 0))

  const { prepareValidation, onRevealSuccess, ...handlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker, onSuccess })

  const doSign = () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp }, checkAmount: false, checkDest: false
    }) || {}

    if (invalidOtp || invalidOtp2) return

    let message = messageInput
    if (!useRawMessage) {
      message = ONEUtil.ethMessage(message)
    }
    const hash = ONEUtil.keccak(message)
    const tokenId = new BN(hash)

    const expiryAt = noExpiry ? 0xffffffff : Math.floor(((Date.now() + duration) / 1000))
    const expiryAtBytes = new BN(expiryAt).toArrayLike(Uint8Array, 'be', 4)
    const encodedExpiryAt = new Uint8Array(20)
    encodedExpiryAt.set(expiryAtBytes)
    const args = { operationType: ONEConstants.OperationType.SIGN, tokenType: ONEConstants.TokenType.NONE, contractAddress: ONEConstants.EmptyAddress, tokenId, dest: ONEUtil.hexString(encodedExpiryAt) }
    let signature
    const commitHashArgs = ({ eotp }) => {
      const buf = ONEUtil.bytesConcat(eotp, hash)
      signature = ONEUtil.keccak(buf)
      return { amount: signature, ...args }
    }
    const revealArgs = ({ eotp }) => {
      const { amount: signature, tokenId, ...args } = commitHashArgs({ eotp })
      return { amount: ONEUtil.hexString(signature), tokenId: ONEUtil.hexString(tokenId.toArrayLike(Uint8Array, 'be', 32)), ...args }
    }

    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitHashArgs,
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs,
      onRevealSuccess: (txId) => {
        onRevealSuccess(txId)
        onSuccess && onSuccess(txId, { hash, signature })
      },
      ...handlers
    })
  }
  if (!(wallet.majorVersion > 10)) {
    return (
      <AnimatedSection
        style={{ maxWidth: 720 }}
        show={show} title={<Title level={2}>Sign Message</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
        ]}
      >
        <Warning>Your wallet is too old. Please use a wallet that is at least version 10.1</Warning>
      </AnimatedSection>
    )
  }
  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show} title={<Title level={2}>Sign Message</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Space direction='vertical' size='large'>
        <Space align='baseline' size='large'>
          <Label wide><Hint>Message</Hint></Label>
          <TextArea
            style={{ border: '1px dashed black', margin: 'auto', width: 424 }} autoSize value={messageInput} onChange={({ target: { value } }) => setMessageInput(value)}
            disabled={typeof prefillMessageInput !== 'undefined'}
          />
        </Space>
        <Space align='baseline' size='large'>
          <Label wide><Hint>Header</Hint></Label>
          <Checkbox checked={!useRawMessage} onChange={({ target: { checked } }) => setUseRawMessage(!checked)} disabled={typeof prefillUseRawMessage !== 'undefined'} />
          <Tooltip title={'If checked, messages would be prepended with the standard Ethereum message header: "\\x19Ethereum Signed Message:\\n" followed by the message\'s length'}>
            <QuestionCircleOutlined />
          </Tooltip>
        </Space>
        <Space align='baseline' size='large'>
          <Label wide><Hint>Permanent</Hint></Label>
          <Checkbox checked={noExpiry} onChange={({ target: { checked } }) => setNoExpiry(checked)} disabled={!isNaN(prefillDuration)} />
          <Tooltip title='Whether the signature is effective permanently or for limited duration'>
            <QuestionCircleOutlined />
          </Tooltip>
        </Space>
        {!noExpiry &&
          <Space align='center' size='large'>
            <Label wide><Hint>Expire in</Hint></Label>
            <Slider
              style={{ width: 200 }}
              value={duration} tooltipVisible={false} onChange={(v) => setDuration(v)}
              min={1000} max={Math.max(prefillDuration || 0, wallet.duration)}
              disabled={!isNaN(prefillDuration)}
            />
            <Hint>{humanizeDuration(duration, { largest: 2, round: true })}</Hint>
          </Space>}
        <OtpStack wideLabel walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} onComplete={doSign} action='confirm' />
      </Space>
      <Row justify='start' style={{ marginTop: 24 }}>
        <Button size='large' type='text' onClick={onClose} danger>Cancel</Button>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default Sign
