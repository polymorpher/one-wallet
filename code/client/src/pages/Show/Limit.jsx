import { useDispatch, useSelector } from 'react-redux'
import util, { autoWalletNameHint, useWindowDimensions } from '../../util'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import React, { useState } from 'react'
import { useRandomWorker } from './randomWorker'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import { Chaining } from '../../api/flow'
import intersection from 'lodash/fp/intersection'
import ONEConstants from '../../../../lib/constants'
import AnimatedSection from '../../components/AnimatedSection'
import Button from 'antd/es/button'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import Row from 'antd/es/row'
import Col from 'antd/es/col'
import { Hint, InputBox, Label, Warning } from '../../components/Text'
import AddressInput from '../../components/AddressInput'
import ONENames from '../../../../lib/names'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import { AverageRow, TallRow } from '../../components/Grid'
import humanizeDuration from 'humanize-duration'
import Title from 'antd/es/typography/Title'
import Link from 'antd/es/typography/Link'
import Text from 'antd/es/typography/Text'
import Slider from 'antd/es/slider'
import WalletConstants from '../../constants/wallet'
import Space from 'antd/es/space'
import Paths from '../../constants/paths'
import ONEUtil from '../../../../lib/util'
import Divider from 'antd/es/divider'
import { OtpSuperStack } from '../../components/OtpSuperStack'

const Limit = ({
  address,
  onClose, // optional
  onSuccess, // optional
}) => {
  const price = useSelector(state => state.global.price)

  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.global.network)
  const { isMobile } = useWindowDimensions()

  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input, resetOtp } = otpState

  const otpStates = new Array(6).fill(0).map(() => useOtpState().state)

  const [stage, setStage] = useState(-1)

  const { resetWorker, recoverRandomness } = useRandomWorker()

  const { spendingLimit, spendingInterval = 1, doubleOtp, highestSpendingLimit, lastLimitAdjustmentTime } = wallet
  const { formatted: spendingLimitFormatted, fiatFormatted: spendingLimitFiatFormatted } = util.computeBalance(spendingLimit, price)
  const [targetSpendingLimit, setTargetSpendingLimit] = useState(parseFloat(spendingLimitFormatted))
  const spendLimitRemaining = util.getMaxSpending(wallet)
  const { formatted: spendLimitRemainingFormatted, fiatFormatted: spendLimitRemainingFiatFormatted } = util.computeBalance(spendLimitRemaining.toString(), price)
  const nextSpendTimeText = '...'

  const maxNormalTargetSpendingLimit = new BN(spendingLimit).muln(2).add(ONEUtil.toFraction(1))
  const { formatted: maxNormalTargetSpendingLimitFormatted, fiatFormatted: maxNormalTargetSpendingLimitFiatFormatted } = util.computeBalance(maxNormalTargetSpendingLimit.toString(), price)
  const { formatted: highestSpendingLimitFormatted, fiatFormatted: highestSpendingLimitFiatFormatted } = util.computeBalance(highestSpendingLimit.toString(), price)
  const maxSliderValue = Math.max(parseFloat(highestSpendingLimitFormatted), parseFloat(maxNormalTargetSpendingLimitFormatted))
  // console.log({ targetSpendingLimit, maxSliderValue, highestSpendingLimitFormatted, maxNormalTargetSpendingLimitFormatted })
  const marks = {
    0: '0 ONE',
    [parseFloat(maxNormalTargetSpendingLimitFormatted)]: `${maxNormalTargetSpendingLimitFormatted} ONE`,
    ...(new BN(highestSpendingLimit).gt(maxNormalTargetSpendingLimit)
      ? {
          [parseFloat(highestSpendingLimitFormatted)]: {
            style: {
              color: '#f00'
            },
            label: `${highestSpendingLimitFormatted} ONE`
          }
        }
      : {}),
    [maxSliderValue]: `${maxSliderValue} ONE`
  }
  // console.log(marks)
  const moreAuthRequired = new BN(targetSpendingLimit).gt(maxNormalTargetSpendingLimit)
  const now = Date.now()
  const canAdjustNow = lastLimitAdjustmentTime === 0 || (Math.floor(now / spendingInterval) > Math.floor(lastLimitAdjustmentTime / spendingInterval))
  const waitTimeForAdjustment = spendingInterval - (now % spendingInterval)
  const waitTimeForAdjustmentText = humanizeDuration(waitTimeForAdjustment, { largest: 2, round: true })

  const resetOtps = () => {
    for (let i = otpStates.length - 1; i >= 0; i--) {
      otpStates[i].resetOtp(i > 0)
    }
    setStage(-1)
  }

  const { ...helpers } = ShowUtils.buildHelpers({
    setStage,
    resetOtp: moreAuthRequired ? resetOtps : resetOtp,
    network,
    resetWorker
  })

  const doAdjust = () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, selectedToken, transferTo, inputAmount, transferAmount }
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    const a = 1 + 1
    // SmartFlows.commitReveal({
    //   wallet,
    //   otp,
    //   otp2,
    //   recoverRandomness,
    //   commitHashGenerator: ONE.computeGeneralOperationHash,
    //   commitHashArgs: { dest, amount, operationType: ONEConstants.OperationType.CHANGE_SPENDING_LIMIT, tokenType: selectedToken.tokenType, contractAddress: selectedToken.contractAddress, tokenId: selectedToken.tokenId },
    //   revealAPI: api.relayer.revealTokenOperation,
    //   revealArgs: { dest, amount, operationType: ONEConstants.OperationType.TRANSFER_TOKEN, tokenType: selectedToken.tokenType, contractAddress: selectedToken.contractAddress, tokenId: selectedToken.tokenId },
    //   ...helpers,
    // })
  }

  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      title={<Title level={isMobile ? 5 : 2}>Change Spending Limit</Title>}
      extra={[<Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />]}
    >
      <AverageRow>
        <Space direction='vertical' size='large'>
          <Title level={4}>Increase spending limit</Title>
          <Text>- up to double the current limit + 1 ONE, or</Text>
          <Text>- to wallet historical highest, but requires 36-digits auth codes (6 each time) </Text>
          <Divider><Hint>Or</Hint></Divider>
          <Title level={4}>Decrease spending limit</Title>
          <Text>- to any amount (below current limit), with a minimum of 0 ONE (i.e. freeze the wallet)</Text>
          <Text>- you can restore to previous highest limit later, but it requires more auth codes (see above) </Text>
          <Divider />
          <Text>
            You can only adjust limit once per {humanizeDuration(spendingInterval, { largest: 2, round: true })} for this wallet
          </Text>
        </Space>
      </AverageRow>
      <AverageRow>
        <Space>
          <Text>Current limit:</Text>
          <Text type='secondary'>{spendingLimitFormatted} ONE (≈ ${spendingLimitFiatFormatted} USD)</Text>
        </Space>
      </AverageRow>
      {!canAdjustNow &&
        <Text color='red'>You cannot adjust limit now. You have to wait for {waitTimeForAdjustmentText}</Text>}
      {canAdjustNow &&
        <>
          <AverageRow>
            <Space>
              <Text>New limit: </Text>
              <Text>{targetSpendingLimit} ONE</Text>
            </Space>
          </AverageRow>
          <AverageRow align='middle' justifyContent='center' style={{ gap: '16px' }}>
            <Slider
              min={0}
              max={maxSliderValue}
              style={{ width: '100%', margin: '0 16px' }} step={1}
              value={targetSpendingLimit}
              onChange={(v) => setTargetSpendingLimit(v)}
              tooltipVisible={false}
              marks={marks}
            />
          </AverageRow>
          <TallRow align='middle'>
            <Col span={24}>
              {!moreAuthRequired &&
                <OtpStack
                  walletName={autoWalletNameHint(wallet)}
                  doubleOtp={doubleOtp}
                  otpState={otpState}
                  onComplete={doAdjust}
                  shouldAutoFocus={!moreAuthRequired}
                  action='change limit now'
                />}
              {moreAuthRequired &&
                <OtpSuperStack
                  otpStates={otpStates}
                  action='submit for validation'
                  wideLabel={isMobile}
                  shouldAutoFocus={moreAuthRequired}
                  onComplete={doAdjust}
                  isDisabled={stage >= 0}
                />}
            </Col>
          </TallRow>
          <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
        </>}

    </AnimatedSection>
  )
}

export default Limit
