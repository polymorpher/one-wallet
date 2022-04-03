import React, { useEffect, useState } from 'react'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import { Hint, InputBox, Label, Text, Title } from '../../../components/Text'
import AddressInput from '../../../components/AddressInput'
import { CommitRevealProgress } from '../../../components/CommitRevealProgress'
import util, { autoWalletNameHint } from '../../../util'
import BN from 'bn.js'
import ShowUtils from '../show-util'
import { useSelector } from 'react-redux'
import { SmartFlows } from '../../../../../lib/api/flow'
import ONE from '../../../../../lib/onewallet'
import ONEConstants from '../../../../../lib/constants'
import { api } from '../../../../../lib/api'
import Paths from '../../../constants/paths'
import { OtpStack } from '../../../components/OtpStack'
import { useOps } from '../../../components/Common'
import { useHistory } from 'react-router'
import querystring from 'query-string'
import { StakeCommon } from './StakeCommon'
import { Link } from 'react-router-dom'

const Unstake = ({
  address,
  onClose, // optional
  onSuccess, // optional
  prefillAmount, // string, number of tokens, in whole amount (not wei)
  prefillDest, // string, hex format
}) => {
  const qs = querystring.parse(location.search)
  const initValidatorAddress = util.safeNormalizedAddress(qs.validator)
  prefillDest = prefillDest || initValidatorAddress
  const [maxUndelegateAmount, setMaxUndelegateAmount] = useState(new BN(0))
  const history = useHistory()
  const {
    wallet, forwardWallet, network, stage, setStage,
    resetWorker, recoverRandomness, otpState, isMobile,
  } = useOps({ address })
  const doubleOtp = wallet.doubleOtp
  const { otpInput, otp2Input, resetOtp } = otpState

  const balance = useSelector(state => state.balance?.[address]?.balance || 0)
  const price = useSelector(state => state.global.price)

  const { formatted } = util.computeBalance(balance, price)
  if (prefillDest) {
    prefillDest = util.safeNormalizedAddress(prefillDest)
  }

  const [validatorAddress, setValidatorAddress] = useState({ value: prefillDest || '', label: prefillDest ? util.oneAddress(prefillDest) : '' })
  const [inputAmount, setInputAmount] = useState(prefillAmount || '')

  const { formatted: spendingLimitFormatted } = util.computeBalance(maxUndelegateAmount.toString(), price)

  const {
    balance: stakingAmount,
    fiatFormatted: stakingFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price)

  useEffect(() => {
    async function init () {
      const result = await api.staking.getDelegations({ address })
      const oneValidatorAddress = util.safeOneAddress(prefillDest)
      console.log(result)
      const totalAmount = result.filter(e => e.validatorAddress === oneValidatorAddress).map(e => String(e.amount)).reduce((a, b) => a.add(new BN(b)), new BN(0))
      setMaxUndelegateAmount(totalAmount)
    }
    init()
  }, [address, validatorAddress])

  onClose = onClose || (() => history.push(Paths.showAddress(address, 'stake')))

  const useMaxAmount = () => {
    if (new BN(balance, 10).gt(new BN(maxUndelegateAmount, 10))) {
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
      setTimeout(onClose, 2000)
    }
  })

  const doUndelegate = () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp, transferTo: validatorAddress, inputAmount, transferAmount: stakingAmount }
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    SmartFlows.commitReveal({
      wallet,
      forwardWallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeTransferHash,
      commitHashArgs: { dest, amount },
      revealAPI: api.relayer.revealTransferLike,
      revealArgs: { dest, amount, operationType: ONEConstants.OperationType.UNDELEGATE },
      ...handlers,
    })
  }

  return (
    <StakeCommon isMobile={isMobile} network={network} onClose={onClose} address={address} titleSuffix='Undelegate'>
      <Row align='middle' style={{ marginBottom: '32px' }}>
        <Text>
          After you undelegate, the ONEs you undelegated can be re-delegated to another validator in the next epoch (about 18.2 hours). However, the funds will only become available for spending in your wallet after 7 epochs (about 5.3 days). Learn more at <Link href='https://docs.harmony.one/home/network/delegator/staking/staking-faq#9.-i-want-to-undelegate-my-token-how-long-do-i-have-to-wait' target='_blank' rel='noreferrer'>Staking FAQ</Link>.
        </Text>
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
          <Title level={4} style={{ marginBottom: 0, display: 'inline-block' }}>
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
            onComplete={doUndelegate}
            action='confirm undelegation'
          />
        </Col>
      </Row>
      <CommitRevealProgress stage={stage} />
    </StakeCommon>
  )
}

export default Unstake
