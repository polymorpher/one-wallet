import React, { useState } from 'react'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import Typography from 'antd/es/typography'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import { Hint, InputBox, Label, Text, Warning } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { autoWalletNameHint } from '../../util'
import BN from 'bn.js'
import ShowUtils, { retryUpgrade } from './show-util'
import { useDispatch, useSelector } from 'react-redux'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import { Chaining } from '../../api/flow'

import { OtpStack } from '../../components/OtpStack'
import { useOps } from '../../components/Common'
import { useHistory } from 'react-router'
const { Title, Link } = Typography

const Stake = ({
  address,
  onClose, // optional
  onSuccess, // optional
  prefillAmount, // string, number of tokens, in whole amount (not wei)
  prefillDest, // string, hex format
}) => {
  const history = useHistory()
  const {
    dispatch, wallet, network, stage, setStage,
    resetWorker, recoverRandomness, otpState, isMobile,
  } = useOps({ address })
  const doubleOtp = wallet.doubleOtp
  const { otpInput, otp2Input, resetOtp } = otpState

  const balance = useSelector(state => state.balance?.[address]?.balance || 0)
  const price = useSelector(state => state.global.price)

  const { formatted } = util.computeBalance(balance, price)

  const [validatorAddress, setValidatorAddress] = useState({ value: prefillDest || '', label: prefillDest ? util.oneAddress(prefillDest) : '' })
  const [inputAmount, setInputAmount] = useState(prefillAmount || '')
  console.log(balance, wallet)
  const maxSpending = BN.min(new BN(balance), util.getMaxSpending(wallet))
  const { formatted: spendingLimitFormatted } = util.computeBalance(maxSpending.toString(), price)

  const {
    balance: stakingAmount,
    fiatFormatted: stakingFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price)

  const useMaxAmount = () => {
    if (new BN(balance, 10).gt(new BN(maxSpending, 10))) {
      setInputAmount(spendingLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({
    setStage,
    otpState,
    network,
    resetOtp,
    resetWorker,
    onSuccess: async (txId) => {
      onSuccess && onSuccess(txId)
      Chaining.refreshBalance(dispatch, [address])
    }
  })

  const doSend = () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp, transferTo: validatorAddress, inputAmount, transferAmount: stakingAmount }
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeTransferHash,
      commitHashArgs: { dest, amount },
      revealAPI: api.relayer.revealTransfer,
      revealArgs: { dest, amount },
      ...handlers,
    })
  }

  if (!util.canStake(wallet)) {
    return (
      <AnimatedSection
        style={{ maxWidth: 720 }}
        title={
          <Title level={isMobile ? 5 : 2}>
            {isMobile ? '' : 'Staking '}
          </Title>
  }
        extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
        ]}
      >
        <Warning>Staking requires wallet at least version 16. Please <Link onClick={() => retryUpgrade({ dispatch, history, address })}>upgrade</Link> your wallet</Warning>
      </AnimatedSection>
    )
  }

  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      title={
        <Title level={isMobile ? 5 : 2}>
          {isMobile ? '' : 'Staking '}
        </Title>
      }
      extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Row align='middle' style={{ marginBottom: '32px' }}>
        <Col>
          <Text>Stake your ONEs with a validator through delegation. You can find a list of validators <Link href='https://staking.harmony.one/validators/mainnet' target='_blank' rel='noreferrer'>
            here
          </Link>. Copy the address of the validator below to stake with them.
          </Text>
        </Col>
      </Row>
      <Row align='baseline' style={{ marginBottom: '16px' }}>
        <Col xs={4}>
          <Label wide={!isMobile} style={{ fontSize: isMobile ? '12px' : undefined }}>
            <Hint>Validator</Hint>
          </Label>
        </Col>
        <Col xs={20}>
          <AddressInput
            addressValue={validatorAddress}
            setAddressCallback={setValidatorAddress}
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
        <Col sm={2} xs={4}><Hint>ONE</Hint></Col>
        <Col>
          <Button type='secondary' shape='round' onClick={useMaxAmount} disabled={!!prefillAmount}>max</Button>
        </Col>
      </Row>
      <Row align='middle' justify='end' style={{ marginBottom: isMobile ? 16 : 32, marginTop: isMobile ? 16 : 32, paddingRight: 80 }}>
        <Col>
          <Title
            level={4}
            style={{ marginBottom: 0, display: 'inline-block' }}
          >
            ≈ ${stakingFiatAmountFormatted}
          </Title>
              &nbsp;
          <Hint>USD</Hint>
        </Col>
      </Row>
      <Row align='middle'>
        <Col span={24}>
          <OtpStack
            walletName={autoWalletNameHint(wallet)}
            doubleOtp={doubleOtp}
            otpState={otpState}
            onComplete={doSend}
            action='confirm staking'
          />
        </Col>
      </Row>
      <CommitRevealProgress stage={stage} />
    </AnimatedSection>
  )
}

export default Stake
