import { useDispatch, useSelector } from 'react-redux'
import util, { autoWalletNameHint, useWindowDimensions } from '../../util'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import React, { useState } from 'react'
import { useRandomWorker } from './randomWorker'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { EOTPDerivation, SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import ONEConstants from '../../../../lib/constants'
import AnimatedSection from '../../components/AnimatedSection'
import Button from 'antd/es/button'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import Col from 'antd/es/col'
import { WideLabel } from '../../components/Text'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import { AverageRow, TallRow } from '../../components/Grid'
import humanizeDuration from 'humanize-duration'
import Title from 'antd/es/typography/Title'
import Text from 'antd/es/typography/Text'
import Slider from 'antd/es/slider'
import Space from 'antd/es/space'
import Paths from '../../constants/paths'
import ONEUtil from '../../../../lib/util'
import Divider from 'antd/es/divider'
import { OtpSuperStack } from '../../components/OtpSuperStack'
import message from '../../message'
import { walletActions } from '../../state/modules/wallet'
import { useHistory } from 'react-router'

const Limit = ({
  address,
  onClose, // optional
  onSuccess, // optional
}) => {
  const history = useHistory()
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
  const [targetSpendingLimitONE, setTargetSpendingLimitONE] = useState(parseFloat(spendingLimitFormatted))
  const targetSpendingLimit = ONEUtil.toFraction(targetSpendingLimitONE)
  const { fiatFormatted: targetSpendingLimitFiatFormatted } = util.computeBalance(targetSpendingLimit.toString(), price)

  const maxNormalTargetSpendingLimit = new BN(spendingLimit).muln(2).add(ONEUtil.toFraction(1))
  const { formatted: maxNormalTargetSpendingLimitFormatted } = util.computeBalance(maxNormalTargetSpendingLimit.toString(), price)
  const { formatted: highestSpendingLimitFormatted } = util.computeBalance(highestSpendingLimit.toString(), price)
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
  const moreAuthRequired = targetSpendingLimit.gt(maxNormalTargetSpendingLimit)
  const now = Date.now()
  const canAdjustNow = true || lastLimitAdjustmentTime === 0 || (Math.floor(now / spendingInterval) > Math.floor(lastLimitAdjustmentTime / spendingInterval))
  const waitTimeForAdjustment = spendingInterval - (now % spendingInterval)
  const waitTimeForAdjustmentText = humanizeDuration(waitTimeForAdjustment, { largest: 2, round: true })

  const resetOtps = () => {
    for (let i = otpStates.length - 1; i >= 0; i--) {
      otpStates[i].resetOtp(i > 0)
    }
    setStage(-1)
  }

  const { prepareValidation, ...helpers } = ShowUtils.buildHelpers({
    setStage,
    resetOtp: moreAuthRequired ? resetOtps : resetOtp,
    network,
    resetWorker,
    onSuccess: () => {
      message.success(`Limited adjusted to ${targetSpendingLimitONE} ONE (≈ ${targetSpendingLimitFiatFormatted} USD)`)
      dispatch(walletActions.fetchWallet({ address }))
      setTimeout(() => history.push(Paths.showAddress(address)))
    }
  })

  const doAdjust = async () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferAmount: targetSpendingLimit }, checkDest: false, checkOtp: !moreAuthRequired
    }) || {}
    if (!amount) {
      message.error('Invalid amount')
      return
    }
    if (!moreAuthRequired) {
      if (invalidOtp || invalidOtp2) return
    }
    SmartFlows.commitReveal({
      wallet,
      ...(moreAuthRequired
        ? {
            deriver: EOTPDerivation.deriveSuperEOTP,
            otp: otpStates.map(({ otpInput }) => parseInt(otpInput)),
          }
        : {
            otp,
            otp2,
            recoverRandomness,
          }),
      commitHashGenerator: ONE.computeAmountHash,
      commitHashArgs: { amount },
      revealAPI: api.relayer.reveal,
      revealArgs: { ...ONEConstants.NullOperationParams, amount, operationType: moreAuthRequired ? ONEConstants.OperationType.JUMP_SPENDING_LIMIT : ONEConstants.OperationType.CHANGE_SPENDING_LIMIT },
      ...helpers,
    })
  }

  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      title={<Title level={isMobile ? 5 : 2}>Change Spending Limit</Title>}
      extra={[<Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />]}
    >
      <AverageRow>
        <Space direction='vertical' size='small'>
          <Title level={4}>Increase spending limit</Title>
          <Text>- up to double the current limit + 1 ONE, or</Text>
          <Text>- to wallet historical highest, but requires 36-digits auth codes (6 each time) </Text>
          <Divider />
          <Title level={4}>Decrease spending limit</Title>
          <Text>- to any amount below the current limit, even to 0 ONE (i.e. freeze the wallet)</Text>
          <Text>- you can later restore to the highest limit you set before</Text>
          <Text>- but it may require more auth codes (see above) </Text>
          <Divider />
          <Text>
            You can only adjust limit once per {humanizeDuration(spendingInterval, { largest: 2, round: true })} for this wallet
          </Text>
        </Space>
      </AverageRow>
      <AverageRow>
        <Space>
          <WideLabel><b>Current limit</b></WideLabel>
          <Text type='secondary'>{spendingLimitFormatted} ONE (≈ ${spendingLimitFiatFormatted} USD) per {humanizeDuration(spendingInterval, { largest: 2, round: true })} </Text>
        </Space>
      </AverageRow>
      {!canAdjustNow &&
        <Text color='red'>You cannot adjust limit now. You have to wait for {waitTimeForAdjustmentText}</Text>}
      {canAdjustNow &&
        <>
          <AverageRow>
            <Space>
              <WideLabel><b>New limit</b></WideLabel>
              <Text type='secondary'>{targetSpendingLimitONE} ONE (≈ ${targetSpendingLimitFiatFormatted} USD)</Text>
            </Space>
          </AverageRow>
          <TallRow justify='center'>
            <Slider
              min={0}
              max={maxSliderValue}
              style={{ width: '100%', margin: '0 16px' }} step={1}
              value={targetSpendingLimitONE}
              onChange={(v) => setTargetSpendingLimitONE(v)}
              tooltipVisible={false}
              marks={marks}
            />
          </TallRow>
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
