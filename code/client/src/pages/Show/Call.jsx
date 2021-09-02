import React, { useState } from 'react'
import { Button, Row, Space, Typography, message, Input } from 'antd'
import { CheckCircleOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import { Hint, InputBox, Label } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util from '../../util'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { useDispatch, useSelector } from 'react-redux'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import { Chaining } from '../../api/flow'
import ONEConstants from '../../../../lib/constants'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
const { Title } = Typography
const { TextArea } = Input

const Call = ({
  address,
  show,
  onClose, // optional
  onSuccess, // optional
  prefillAmount, // string, number of tokens, in whole amount (not wei)
  prefillDest, // contract address, string, hex format
  prefillMethod, // function signature, (abi selector) https://docs.soliditylang.org/en/develop/abi-spec.html#function-selector
  prefillData, // array of values corresponding to parameters in function signature
}) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.wallet.network)

  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const [stage, setStage] = useState(-1)

  const { resetWorker, recoverRandomness } = useRandomWorker()

  const balances = useSelector(state => state.wallet.balances)
  const price = useSelector(state => state.wallet.price)
  const { balance, formatted } = util.computeBalance(balances[address] || 0, price)

  const [transferTo, setTransferTo] = useState({ value: prefillDest || '', label: prefillDest ? util.oneAddress(prefillDest) : '' })
  const [inputAmount, setInputAmount] = useState(prefillAmount || '')

  const [method, setMethod] = useState(prefillMethod || '')
  const [dataInput, setDataInput] = useState(JSON.stringify(prefillData || {}, null, 2))

  const { dailyLimit } = wallet
  const { formatted: dailyLimitFormatted } = util.computeBalance(dailyLimit, price)

  const {
    balance: transferAmount,
    fiatFormatted: transferFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price)

  const useMaxAmount = () => {
    if (new BN(balance, 10).gt(new BN(dailyLimit, 10))) {
      setInputAmount(dailyLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }

  const { prepareValidation, onRevealSuccess, ...errorHandlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const doSend = () => {
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo, inputAmount, transferAmount }
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    let data
    try {
      data = JSON.parse(dataInput)
    } catch (ex) {
      message.error('Unable to parse data input. Please check again')
      console.error(ex)
      return
    }
    let encodedData
    try {
      encodedData = ONEUtil.encodeCalldata(method, data)
      if (!encodedData) {
        message.error('Malformed data or method')
        return
      }
    } catch (ex) {
      message.error(`Unable to encode data. Error: ${ex.toString()}`)
      console.error(ex)
      return
    }

    const args = { amount, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: dest, tokenId: 0, dest: ONEConstants.EmptyAddress, data: encodedData }
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitHashArgs: args,
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: args,
      onRevealSuccess: (txId) => {
        onRevealSuccess(txId)
        onSuccess && onSuccess(txId)
        Chaining.refreshBalance({ dispatch, addresses: [address] })
      },
      ...errorHandlers
    })
  }

  return (
    <AnimatedSection
      style={{ width: 720 }}
      show={show} title={<Title level={2}>Call Contract Function</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Space direction='vertical' size='large'>
        <Space align='baseline' size='large'>
          <Label><Hint>To</Hint></Label>
          <AddressInput
            addressValue={transferTo}
            setAddressCallback={setTransferTo}
            currentWallet={wallet}
            disabled={!!prefillDest}
          />
        </Space>
        <Space align='baseline' size='large'>
          <Label><Hint>Amount</Hint></Label>
          <InputBox margin='auto' width={200} value={inputAmount} onChange={({ target: { value } }) => setInputAmount(value)} disabled={!!prefillAmount} />
          <Hint>ONE</Hint>
          <Button type='secondary' shape='round' onClick={useMaxAmount} disabled={!!prefillAmount}>max</Button>
        </Space>

        <Space align='end' size='large'>
          <Label><Hint /></Label>
          <Title
            level={4}
            style={{ width: 200, textAlign: 'right', marginBottom: 0 }}
          >≈ ${transferFiatAmountFormatted}
          </Title>
          <Hint>USD</Hint>
        </Space>
        <OtpStack walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} />
        <Space align='baseline' size='large'>
          <Label><Hint>Method</Hint></Label>
          <InputBox margin='auto' width={500} value={method} onChange={({ target: { value } }) => setMethod(value)} disabled={!!prefillMethod} />
        </Space>
        <Space align='baseline' size='large'>
          <Label><Hint>Args</Hint></Label>
          <TextArea style={{ border: '1px dashed black', margin: 'auto', width: 500 }} autoSize value={dataInput} onChange={({ target: { value } }) => setDataInput(value)} disabled={!!prefillData} />
        </Space>
      </Space>
      <Row justify='end' style={{ marginTop: 24 }}>
        <Space>
          {stage >= 0 && stage < 3 && <LoadingOutlined />}
          {stage === 3 && <CheckCircleOutlined />}
          <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doSend}>Confirm</Button>
        </Space>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default Call
