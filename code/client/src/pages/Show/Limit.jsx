import { useDispatch, useSelector } from 'react-redux'
import util, { autoWalletNameHint, useWindowDimensions } from '../../util'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import React, { useState } from 'react'
import { useRandomWorker } from './randomWorker'
import BN from 'bn.js'
import ShowUtils, { retryUpgrade } from './show-util'
import { EOTPDerivation, SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import ONEConstants from '../../../../lib/constants'
import AnimatedSection from '../../components/AnimatedSection'
import Button from 'antd/es/button'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import Col from 'antd/es/col'
import { Warning, WideLabel, Link } from '../../components/Text'
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
  const spendingIntervalText = humanizeDuration(spendingInterval, { largest: 2, round: true })
  const currentSpendingLimit = new BN(spendingLimit)
  const { formatted: spendingLimitFormatted, fiatFormatted: spendingLimitFiatFormatted } = util.computeBalance(spendingLimit, price)
  const [targetSpendingLimitONE, setTargetSpendingLimitONE] = useState(parseFloat(spendingLimitFormatted))
  const targetSpendingLimit = ONEUtil.toFraction(targetSpendingLimitONE)
  const { fiatFormatted: targetSpendingLimitFiatFormatted } = util.computeBalance(targetSpendingLimit.toString(), price)

  const historicalHighSpendingLimit = new BN(highestSpendingLimit)
  const maxNormalTargetSpendingLimit = currentSpendingLimit.muln(2).add(ONEUtil.toFraction(1))
  const { formatted: maxNormalTargetSpendingLimitFormatted } = util.computeBalance(maxNormalTargetSpendingLimit.toString(), price)
  const { formatted: highestSpendingLimitFormatted, fiatFormatted: highestSpendingLimitFiatFormatted } = util.computeBalance(historicalHighSpendingLimit.toString(), price)
  const maxSliderValue = Math.max(parseFloat(highestSpendingLimitFormatted), parseFloat(maxNormalTargetSpendingLimitFormatted))
  // console.log({ targetSpendingLimit, maxSliderValue, highestSpendingLimitFormatted, maxNormalTargetSpendingLimitFormatted })

  const now = Date.now()
  const canUseRegularAdjust = lastLimitAdjustmentTime === 0 || (Math.floor(now / spendingInterval) > Math.floor(lastLimitAdjustmentTime / spendingInterval))
  const waitTimeForAdjustment = spendingInterval - (now % spendingInterval)
  const waitTimeForAdjustmentText = humanizeDuration(waitTimeForAdjustment, { largest: 2, round: true })

  const moreAuthRequired = targetSpendingLimit.gt(maxNormalTargetSpendingLimit) || (!canUseRegularAdjust && targetSpendingLimit.gt(currentSpendingLimit))
  const hasSuperOTP = wallet?.innerRoots?.length >= 1
  const impossibleToAdjust = (!canUseRegularAdjust && targetSpendingLimit.gt(historicalHighSpendingLimit)) ||
    (targetSpendingLimit.gt(BN.max(maxNormalTargetSpendingLimit, historicalHighSpendingLimit)))

  const marks = {
    0: '0 ONE',
    [spendingLimitFormatted]: {
      style: { color: 'green' },
      label: `${spendingLimitFormatted} ONE`
    },
    [maxSliderValue]: `${maxSliderValue} ONE`
  }
  if (!canUseRegularAdjust || historicalHighSpendingLimit.gt(maxNormalTargetSpendingLimit)) {
    marks[parseFloat(highestSpendingLimitFormatted)] = {
      style: { color: '#f00' },
      label: `${highestSpendingLimitFormatted} ONE`
    }
  }

  // console.log(marks)

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

  if (!(wallet.majorVersion >= 15)) {
    return (
      <AnimatedSection
        style={{ maxWidth: 720 }}
        title={<Title level={isMobile ? 5 : 2}>Change Spending Limit</Title>}
        extra={[<Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />]}
      >
        <Warning>
          Your wallet needs to be at least v15 to change spending limit. Please <Link onClick={() => retryUpgrade({ dispatch, history, address })}>upgrade your wallet</Link>.
        </Warning>
      </AnimatedSection>
    )
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
          <Text>- up to double the current limit + 1 ONE (once per {spendingIntervalText})</Text>
          <Text>- up to all-time-high limit, with 6x6 auth codes (anytime) </Text>
          <Divider />
          <Title level={4}>Decrease spending limit</Title>
          <Text>- to any amount below the current limit (anytime)</Text>
          <Text>- tips: decrease to 0 ONE to freeze wallet if you suspect hacks</Text>
          <Text>- tips: you can restore back to all-time-high later with 6x6 auth codes</Text>
        </Space>
      </AverageRow>
      <Divider />
      <AverageRow>
        <Space>
          <WideLabel><b>Current limit</b></WideLabel>
          <Text style={{ color: 'green' }}>{spendingLimitFormatted} ONE (≈ ${spendingLimitFiatFormatted} USD) per {spendingIntervalText} </Text>
        </Space>
      </AverageRow>
      <AverageRow>
        <Space>
          <WideLabel><b>All time high</b></WideLabel>
          <Text style={{ color: 'red' }}>{highestSpendingLimitFormatted} ONE (≈ ${highestSpendingLimitFiatFormatted} USD) </Text>
        </Space>
      </AverageRow>
      <AverageRow>
        <Space>
          <WideLabel><b>Last Change</b></WideLabel>
          <Text type='secondary'>{new Date(lastLimitAdjustmentTime).toLocaleString()} ({humanizeDuration(Date.now() - lastLimitAdjustmentTime, { largest: 2, round: true })} ago) </Text>
        </Space>
      </AverageRow>

      <AverageRow>
        <Space>
          <WideLabel><b>New limit</b></WideLabel>
          <Text style={{ color: 'steelblue' }}>{targetSpendingLimitONE} ONE (≈ ${targetSpendingLimitFiatFormatted} USD)</Text>
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
      <TallRow align='middle' style={{ marginTop: 64 }}>
        {impossibleToAdjust && <Warning style={{ marginTop: 48 }}>You cannot increase limit that much at the moment. You have to wait for {waitTimeForAdjustmentText}</Warning>}
        {!impossibleToAdjust &&
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
            {moreAuthRequired && !hasSuperOTP &&
              <Text>Restoring to all-time-high limit requires you to unlock v15 features, since your wallet was created prior to v15. Please <Link onClick={() => history.push(Paths.showAddress(address, 'extend'))}>renew your wallet</Link> to unlock them now.</Text>}
            {moreAuthRequired && hasSuperOTP &&
              <OtpSuperStack
                otpStates={otpStates}
                action='submit for validation'
                wideLabel={isMobile}
                shouldAutoFocus={moreAuthRequired}
                onComplete={doAdjust}
                isDisabled={stage >= 0}
              />}
          </Col>}
      </TallRow>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default Limit
