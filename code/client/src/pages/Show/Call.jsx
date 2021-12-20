import React, { useState } from 'react'
import { Button, Space, Typography, Input, Col } from 'antd'
import message from '../../message'
import { CloseOutlined } from '@ant-design/icons'
import { Hint, InputBox, Label, Warning } from '../../components/Text'
import { AverageRow, TallRow } from '../../components/Grid'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { useWindowDimensions } from '../../util'
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
const { Title } = Typography
const { TextArea } = Input

const Call = ({
  address,
  show,
  minimal, // optional
  onClose, // optional
  onSuccess, // optional
  prefillHex, // optional
  prefillAmount, // string, number of tokens, in whole amount (not wei)
  prefillDest, // contract address, string, hex format
  prefillMethod, // function signature, (abi selector) https://docs.soliditylang.org/en/develop/abi-spec.html#function-selector
  prefillData, // array of values corresponding to parameters in function signature
  shouldAutoFocus,
  headless,
}) => {
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const { majorVersion, minorVersion } = wallet
  const network = useSelector(state => state.wallet.network)

  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const [stage, setStage] = useState(-1)

  const { resetWorker, recoverRandomness } = useRandomWorker()

  const balances = useSelector(state => state.balance || {})
  const price = useSelector(state => state.global.price)
  const { balance, formatted } = util.computeBalance(balances[address]?.balance || 0, price)

  const [transferTo, setTransferTo] = useState({ value: prefillDest || '', label: prefillDest ? util.oneAddress(prefillDest) : '' })
  const [inputAmount, setInputAmount] = useState(prefillAmount || '')

  const [method, setMethod] = useState(prefillHex ? '(Direct Call By Bytes)' : (prefillMethod || ''))
  const [dataInput, setDataInput] = useState(prefillHex || JSON.stringify(prefillData || [], null, 2))

  const maxSpending = util.getMaxSpending(wallet)
  const { formatted: spendingLimitFormatted } = util.computeBalance(maxSpending, price)

  const {
    balance: transferAmount,
    fiatFormatted: transferFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price)

  const useMaxAmount = () => {
    if (new BN(balance, 10).gt(new BN(maxSpending, 10))) {
      setInputAmount(spendingLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker, onSuccess })

  const doCall = () => {
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo, inputAmount, transferAmount }, allowZero: true
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    let data
    if (!prefillHex) {
      try {
        data = JSON.parse(dataInput)
      } catch (ex) {
        message.error('Unable to parse data input. Please check again')
        console.error(ex)
        return
      }
    }
    let encodedData
    try {
      if (!prefillHex) {
        encodedData = ONEUtil.encodeCalldata(method, data)
      } else {
        encodedData = prefillHex
      }
      if (!encodedData) {
        message.error('Malformed data or method')
        return
      }
    } catch (ex) {
      message.error(`Unable to encode data. Error: ${ex.toString()}`)
      console.error(ex)
      return
    }

    const args = { amount, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: dest, tokenId: 0, dest: ONEConstants.EmptyAddress }
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitHashArgs: { ...args, data: ONEUtil.hexStringToBytes(encodedData) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...args, data: encodedData, majorVersion, minorVersion },
      ...handlers
    })
  }
  if (!(majorVersion > 10)) {
    return (
      <AnimatedSection
        style={{ maxWidth: 720 }}
        show={show} title={<Title level={2}>Call Contract Function</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
        ]}
      >
        <Warning>Your wallet is too old. Please use a wallet that is at least version 10.1</Warning>
      </AnimatedSection>
    )
  }

  const inner = (
    <>
      {!minimal &&
        <Space direction='vertical' size='large' style={{ width: '100%' }}>
          <AverageRow align='baseline'>
            <Col xs={4}>
              <Label wide={!isMobile} style={{ fontSize: isMobile ? '12px' : undefined }}>
                <Hint>To</Hint>
              </Label>
            </Col>
            <Col xs={20}>
              <AddressInput
                addressValue={transferTo}
                setAddressCallback={setTransferTo}
                currentWallet={wallet}
                disabled={!!prefillDest}
              />
            </Col>
          </AverageRow>
          <AverageRow align='middle' gutter={8} style={{ flexWrap: 'nowrap' }}>
            <Col xs={4}>
              <Label wide={!isMobile}>
                <Hint>{isMobile ? '' : 'Amount'}</Hint>
              </Label>
            </Col>
            <Col sm={16} flex={1}>
              <InputBox
                $decimal
                margin='auto'
                width='100%'
                value={inputAmount}
                onChange={({ target: { value } }) => setInputAmount(value)}
                disabled={!!prefillAmount}
              />
            </Col>
            <Col sm={2}><Hint>ONE</Hint></Col>
            <Col>
              <Button type='secondary' shape='round' onClick={useMaxAmount} disabled={!!prefillAmount}>max</Button>
            </Col>
          </AverageRow>

          <Space align='end' size='large'>
            <Label><Hint /></Label>
            <Title
              level={4}
              style={{ width: 200, textAlign: 'right', marginBottom: 0 }}
            >≈ ${transferFiatAmountFormatted}
            </Title>
            <Hint>USD</Hint>
          </Space>
          <AverageRow align='baseline' size='large' style={{ width: '100%' }}>
            <Label wide={!isMobile}><Hint>Method</Hint></Label>
            <InputBox
              margin='auto' width='auto' style={{ flex: 1 }} value={method}
              onChange={({ target: { value } }) => setMethod(value)} disabled={!!(prefillMethod || prefillHex)}
            />
          </AverageRow>
          <AverageRow align='start' size='large' style={{ width: '100%' }}>
            <Label wide={!isMobile}><Hint>Args</Hint></Label>
            <TextArea
              style={{ border: '1px dashed black', margin: 'auto', flex: 1 }}
              autoSize
              value={dataInput}
              onChange={({ target: { value } }) => setDataInput(value)} disabled={!!(prefillData || prefillHex)}
            />
          </AverageRow>
        </Space>}
      <AverageRow align='middle'>
        <Col span={24}>
          <OtpStack
            walletName={wallet.name}
            doubleOtp={doubleOtp}
            otpState={otpState}
            onComplete={doCall}
            shouldAutoFocus={shouldAutoFocus}
            action='confirm'
          />
        </Col>
      </AverageRow>
      <TallRow justify='start' style={{ marginTop: 24 }}>
        <Button size='large' type='text' onClick={onClose} danger>Cancel</Button>
      </TallRow>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </>
  )

  if (headless) {
    return inner
  }
  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show} title={!minimal && <Title level={2}>Call Contract Function</Title>} extra={!minimal && [
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      {inner}
    </AnimatedSection>
  )
}

export default Call
