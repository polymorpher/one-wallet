import React, { useState } from 'react'
import { Button, Row, Space, Typography } from 'antd'
import { CheckCircleOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import { Hint, InputBox, Label } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util from '../../util'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { useDispatch, useSelector } from 'react-redux'
import { HarmonyONE } from '../../components/TokenAssets'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import api from '../../../../lib/api'
import { Chaining } from '../../api/flow'
import { intersection } from 'lodash'
import ONEConstants from '../../../../lib/constants'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import { useHistory } from 'react-router'
const { Title } = Typography

const Send = ({
  address,
  show,
  onClose,
}) => {
  const history = useHistory()
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
  const tokenBalances = wallet.tokenBalances || []
  const selectedToken = wallet?.selectedToken || HarmonyONE
  const selectedTokenBalance = selectedToken.key === 'one' ? (balances[address] || 0) : (tokenBalances[selectedToken.key] || 0)
  const selectedTokenDecimals = selectedToken.decimals

  const { formatted } = util.computeBalance(selectedTokenBalance, price, selectedTokenDecimals)

  const [transferTo, setTransferTo] = useState({ value: '', label: '' })
  const [inputAmount, setInputAmount] = useState('')

  const isNFT = util.isNFT(selectedToken)
  const { metadata } = selectedToken
  const titleSuffix = isNFT ? 'Collectible' : `${selectedToken.name} (${selectedToken.symbol})`

  const { dailyLimit } = wallet
  const { formatted: dailyLimitFormatted } = util.computeBalance(dailyLimit, price)

  const restart = () => {
    setStage(-1)
    resetOtp()
    setInputAmount(0)
  }

  const {
    balance: transferAmount,
    fiatFormatted: transferFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price, selectedTokenDecimals)
  // console.log(transferAmount.toString(), selectedTokenDecimals)

  const useMaxAmount = () => {
    if (util.isNFT(selectedToken)) {
      setInputAmount(selectedTokenBalance.toString())
      return
    }
    if (new BN(selectedTokenBalance, 10).gt(new BN(dailyLimit, 10))) {
      setInputAmount(dailyLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }

  const prepareProofFailed = () => {
    setStage(-1)
    resetOtp()
    resetWorker()
  }

  const { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation } = ShowUtils.buildHelpers({ setStage, resetOtp, network, restart })

  const doSend = () => {
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, selectedToken, transferTo, inputAmount, transferAmount }
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    if (selectedToken.key === 'one') {
      SmartFlows.commitReveal({
        wallet,
        otp,
        otp2,
        recoverRandomness,
        prepareProofFailed,
        commitHashGenerator: ONE.computeTransferHash,
        commitHashArgs: { dest, amount },
        prepareProof: () => setStage(0),
        beforeCommit: () => setStage(1),
        afterCommit: () => setStage(2),
        onCommitError,
        onCommitFailure,
        revealAPI: api.relayer.revealTransfer,
        revealArgs: { dest, amount },
        onRevealFailure,
        onRevealError,
        onRevealAttemptFailed,
        onRevealSuccess: (txId) => {
          onRevealSuccess(txId)
          Chaining.refreshBalance(dispatch, intersection(Object.keys(wallets), [dest, address]))
        }
      })
    } else {
      SmartFlows.commitReveal({
        wallet,
        otp,
        otp2,
        recoverRandomness,
        prepareProofFailed,
        commitHashGenerator: ONE.computeGeneralOperationHash,
        commitHashArgs: { dest, amount, operationType: ONEConstants.OperationType.TRANSFER_TOKEN, tokenType: selectedToken.tokenType, contractAddress: selectedToken.contractAddress, tokenId: selectedToken.tokenId },
        beforeCommit: () => setStage(1),
        afterCommit: () => setStage(2),
        onCommitError,
        onCommitFailure,
        revealAPI: api.relayer.revealTokenOperation,
        revealArgs: { dest, amount, operationType: ONEConstants.OperationType.TRANSFER_TOKEN, tokenType: selectedToken.tokenType, contractAddress: selectedToken.contractAddress, tokenId: selectedToken.tokenId },
        onRevealFailure,
        onRevealError,
        onRevealAttemptFailed,
        onRevealSuccess: (txId) => {
          onRevealSuccess(txId)
          Chaining.refreshTokenBalance({ dispatch, address, token: selectedToken })
        }
      })
    }
  }

  return (
    <AnimatedSection
      style={{ width: 720 }}
      show={show} title={<Title level={2}>Send: {titleSuffix}</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Space direction='vertical' size='large'>
        {isNFT && <Title level={4}>{metadata?.displayName}</Title>}
        <Space align='baseline' size='large'>
          <Label><Hint>To</Hint></Label>
          <AddressInput
            addressValue={transferTo}
            setAddressCallback={setTransferTo}
            currentWallet={wallet}
          />
        </Space>
        <Space align='baseline' size='large'>
          <Label><Hint>Amount</Hint></Label>
          <InputBox margin='auto' width={200} value={inputAmount} onChange={({ target: { value } }) => setInputAmount(value)} />
          {!isNFT && <Hint>{selectedToken.symbol}</Hint>}
          <Button type='secondary' shape='round' onClick={useMaxAmount}>max</Button>
        </Space>
        {selectedToken.key === 'one' &&
          <Space align='end' size='large'>
            <Label><Hint /></Label>
            <Title
              level={4}
              style={{ width: 200, textAlign: 'right', marginBottom: 0 }}
            >≈ ${transferFiatAmountFormatted}
            </Title>
            <Hint>USD</Hint>
          </Space>}
        <OtpStack walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} />
      </Space>
      <Row justify='end' style={{ marginTop: 24 }}>
        <Space>
          {stage >= 0 && stage < 3 && <LoadingOutlined />}
          {stage === 3 && <CheckCircleOutlined />}
          <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doSend}>Send</Button>
        </Space>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default Send
