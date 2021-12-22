import React, { useState } from 'react'
import { Button, Col, Row, Typography } from 'antd'
import { CloseOutlined } from '@ant-design/icons'
import { Hint, InputBox, Label, Warning } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { useWindowDimensions } from '../../util'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { useDispatch, useSelector } from 'react-redux'
import { HarmonyONE } from '../../components/TokenAssets'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import { Chaining } from '../../api/flow'
import { intersection } from 'lodash'
import ONEConstants from '../../../../lib/constants'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import { AverageRow } from '../../components/Grid'
import ONENames from '../../../../lib/names'
const { Title, Link } = Typography

const Send = ({
  address,
  show,
  onClose, // optional
  onSuccess, // optional
  overrideToken, // optional
  prefillAmount, // string, number of tokens, in whole amount (not wei)
  prefillDest, // string, hex format
}) => {
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.wallet.network)
  const { isMobile } = useWindowDimensions()

  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const [stage, setStage] = useState(-1)

  const { resetWorker, recoverRandomness } = useRandomWorker()

  const balances = useSelector(state => state.balance || {})
  const price = useSelector(state => state.global.price)
  const { balance = 0, tokenBalances = {} } = balances[address] || {}
  const selectedToken = overrideToken || wallet?.selectedToken || HarmonyONE
  const selectedTokenBalance = selectedToken.key === 'one' ? balance : (tokenBalances[selectedToken.key] || 0)
  const selectedTokenDecimals = selectedToken.decimals

  const { formatted } = util.computeBalance(selectedTokenBalance, price, selectedTokenDecimals)

  const [transferTo, setTransferTo] = useState({ value: prefillDest || '', label: prefillDest ? util.oneAddress(prefillDest) : '' })
  const [inputAmount, setInputAmount] = useState(prefillAmount || '')

  const isNFT = util.isNFT(selectedToken)
  const { metadata } = selectedToken
  const titleSuffix = isNFT ? 'Collectible' : `${selectedToken.name} (${selectedToken.symbol})`

  const maxSpending = selectedToken.key === 'one' ? BN.min(new BN(selectedTokenBalance), util.getMaxSpending(wallet)) : new BN(selectedTokenBalance)
  const { formatted: spendingLimitFormatted } = util.computeBalance(maxSpending.toString(), price)

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
    if (new BN(selectedTokenBalance, 10).gt(new BN(maxSpending, 10))) {
      setInputAmount(spendingLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }

  const { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation, prepareProofFailed } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const doSend = () => {
    if (stage >= 0) {
      return
    }
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
          onSuccess && onSuccess(txId)
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
        prepareProof: () => setStage(0),
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
          onSuccess && onSuccess(txId)
          Chaining.refreshTokenBalance({ dispatch, address, token: selectedToken })
        }
      })
    }
  }

  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show}
      title={
        <Title level={isMobile ? 5 : 2}>
          {
            isMobile ? '' : 'Send: '
          }
          {titleSuffix}
        </Title>
      }
      extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Row align='middle' style={{ marginBottom: '10px' }}>
        <Col>
          {isNFT && <Title level={4}>{metadata?.displayName}</Title>}
        </Col>
      </Row>
      <Row align='baseline' style={{ marginBottom: '10px' }}>
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
      </Row>
      <Row align='middle' style={{ marginBottom: '10px', flexWrap: 'nowrap' }}>
        <Col xs={4}>
          <Label wide={!isMobile}>
            <Hint>{isMobile ? '' : 'Amount'}</Hint>
          </Label>
        </Col>
        <Col sm={!isNFT ? 16 : 18} flex={1}>
          <InputBox
            $decimal
            margin='auto'
            width='100%'
            value={inputAmount}
            onChange={({ target: { value } }) => setInputAmount(value)}
            disabled={!!prefillAmount}
          />
        </Col>
        {
          !isNFT && <Col sm={2} xs={4}><Hint>{selectedToken.symbol}</Hint></Col>
        }
        <Col>
          <Button type='secondary' shape='round' onClick={useMaxAmount} disabled={!!prefillAmount}>max</Button>
        </Col>
      </Row>
      {
        selectedToken.key === 'one' &&
          <Row align='middle' justify='end' style={{ marginBottom: isMobile ? 16 : 32, marginTop: isMobile ? 16 : 32, paddingRight: 80 }}>
            <Col>
              <Title
                level={4}
                style={{ marginBottom: 0, display: 'inline-block' }}
              >
                ≈ ${transferFiatAmountFormatted}
              </Title>
              &nbsp;
              <Hint>USD</Hint>
            </Col>
          </Row>
        }
      <Row align='middle'>
        <Col span={24}>
          <OtpStack
            walletName={ONENames.nameWithTime(wallet.name, wallet.effectiveTime)}
            doubleOtp={doubleOtp}
            otpState={otpState}
            onComplete={doSend}
            action='send now'
          />
        </Col>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
      <AverageRow>
        <Warning>
          Please do not send funds to exchange-owned addresses such as Binance and crypto.com (custody wallet). Their automated system cannot detect deposits from smart contracts at the moment. They are still <Link href='https://github.com/polymorpher/one-wallet/issues/93' target='_blank' rel='noreferrer'>working on it</Link>.
        </Warning>
      </AverageRow>
    </AnimatedSection>
  )
}

export default Send
