import React, { useEffect, useState } from 'react'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import { Hint, InputBox, Label, Text, Title, Link } from '../../../components/Text'
import AddressInput from '../../../components/AddressInput'
import { CommitRevealProgress } from '../../../components/CommitRevealProgress'
import util, { autoWalletNameHint } from '../../../util'
import BN from 'bn.js'
import ShowUtils from '../show-util'
import { useSelector } from 'react-redux'
import { SmartFlows } from '../../../../../lib/api/flow'
import ONE from '../../../../../lib/onewallet'
import ONEUtil from '../../../../../lib/util'
import ONEConstants from '../../../../../lib/constants'
import { api } from '../../../../../lib/api'
import { Chaining } from '../../../api/flow'
import Paths from '../../../constants/paths'
import { OtpStack } from '../../../components/OtpStack'
import { useOps } from '../../../components/Common'
import { useHistory } from 'react-router'
import Divider from 'antd/es/divider'
import Table from 'antd/es/table'
import { TallRow } from '../../../components/Grid'
import Space from 'antd/es/space'
import Spin from 'antd/es/spin'
import Tooltip from 'antd/es/tooltip'
import flatten from 'lodash/fp/flatten'
import humanizeDuration from 'humanize-duration'
import { StakeCommon, RewardPanel } from './StakeCommon'

const Stake = ({
  address,
  onClose, // optional
  onSuccess, // optional
  prefillAmount, // string, number of tokens, in whole amount (not wei)
  prefillDest, // string, hex format
}) => {
  const [delegations, setDelegations] = useState(null)
  const [undelegations, setUndelegations] = useState(null)
  const [reward, setReward] = useState(null)
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

  const maxSpending = BN.min(new BN(balance), util.getMaxSpending(wallet))
  const { formatted: spendingLimitFormatted } = util.computeBalance(maxSpending.toString(), price)

  const {
    balance: stakingAmount,
    fiatFormatted: stakingFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price)

  useEffect(() => {
    async function init () {
      const result = await api.staking.getDelegations({ address })
      const blockNumber = await api.staking.getBlockNumber()
      const epoch = await api.staking.getEpoch()
      const networkInfo = await api.staking.getNetworkInfo()
      setDelegations(result.map((e, i) => ({ ...e, key: `${i}` })))
      const totalReward = result.map(e => String(e.reward)).reduce((a, b) => a.add(new BN(b)), new BN(0))
      setReward(util.computeBalance(totalReward.toString(), price))
      const undelegations = flatten(result.map(e => e.undelegations.map(({ Amount, Epoch }) => ({
        amount: Amount,
        blocks: (7 - (epoch - Epoch)) * 32768 + (networkInfo.epochLastBlock - blockNumber),
        validatorAddress: e.validatorAddress
      }))))
      setUndelegations(undelegations.map((e, i) => ({ ...e, key: `${i}` })))
    }
    init()
  }, [address])

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

  const doDelegate = () => {
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
      revealAPI: api.relayer.revealTransferLike,
      revealArgs: { dest, amount, operationType: ONEConstants.OperationType.DELEGATE },
      ...handlers,
    })
  }

  const columns = [
    {
      title: 'Validator',
      dataIndex: 'validatorAddress',
      key: 'validator',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        const oneAddress = util.safeOneAddress(record.validatorAddress)
        return (
          <Link href={`https://staking.harmony.one/validators/mainnet/${oneAddress}`}>
            <Tooltip title={oneAddress}>{util.ellipsisAddress(oneAddress)}</Tooltip>
          </Link>
        )
      }
    }, {
      title: 'Staked (ONE)',
      dataIndex: 'amount',
      key: 'amount',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        return util.formatNumber(ONEUtil.toOne(String(record.amount) || 0))
      }
    }, {
      title: 'Reward (ONE)',
      dataIndex: 'reward',
      key: 'reward',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        return util.formatNumber(ONEUtil.toOne(String(record.reward) || 0))
      }
    }, {
      title: 'Action',
      key: 'action',
      // eslint-disable-next-line react/display-name
      render: (text, record) =>
        (
          <Button
            type='primary' size='small' shape='round' onClick={() =>
              history.push(Paths.showAddress(address, `unstake?validator=${record.validatorAddress}`))}
          > Undelegate
          </Button>
        )
    }
  ]

  const undelegationColumns = [
    {
      title: 'Validator',
      dataIndex: 'validatorAddress',
      key: 'validator',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        const oneAddress = util.safeOneAddress(record.validatorAddress)
        return (
          <Link href={`https://staking.harmony.one/validators/mainnet/${oneAddress}`}>
            <Tooltip title={oneAddress}>{util.ellipsisAddress(oneAddress)}</Tooltip>
          </Link>
        )
      }
    }, {
      title: 'Amount (ONE)',
      dataIndex: 'amount',
      key: 'amount',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        return util.formatNumber(ONEUtil.toOne(String(record.amount) || 0))
      }
    }, {
      title: 'Complete In',
      dataIndex: 'blocks',
      key: 'blocks',
      // eslint-disable-next-line react/display-name
      render: (text, record) => {
        return `~ ${humanizeDuration(record.blocks * 2 * 1000, { largest: 2, round: true })}`
      }
    }
  ]

  return (
    <StakeCommon isMobile={isMobile} network={network} onClose={onClose} address={address}>
      <Row align='middle' style={{ marginBottom: '32px' }}>
        <Text>
          <Link href='https://docs.harmony.one/home/network/validators/definitions' target='_blank' rel='noreferrer'>Staking</Link> lets you earn rewards (in ONE) over time. You cannot spend the ONEs you staked, until you unstake them (which usually take 7 days).
          <br /><br />
        </Text>
        <Text>You can stake by delegating ONEs to a validator. You can find&nbsp;
          <Link href='https://staking.harmony.one/validators/mainnet' target='_blank' rel='noreferrer'>
            a list of validators here
          </Link> along with their expected rewards. Copy the address of the validator below to stake with them.
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
            onComplete={doDelegate}
            action='confirm staking'
          />
        </Col>
      </Row>
      <CommitRevealProgress stage={stage} />
      <Divider />
      <Title level={3}>Your Stakes</Title>
      <RewardPanel isMobile={isMobile} address={address} totalReward={reward} showCollectReward />
      <Table dataSource={delegations} columns={columns} loading={delegations === null} />
      <TallRow align='start'>
        <Title level={5}>Undelegations in progress</Title>
      </TallRow>
      <Table dataSource={undelegations} columns={undelegationColumns} loading={undelegations === null} />
    </StakeCommon>
  )
}

export default Stake
