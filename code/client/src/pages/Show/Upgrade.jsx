import { useDispatch, useSelector } from 'react-redux'
import React, { useState } from 'react'
import ONEConstants from '../../../../lib/constants'
import ONEUtil from '../../../../lib/util'
import util, { useWindowDimensions } from '../../util'
import config from '../../config'
import BN from 'bn.js'
import { Button, Card, Typography, Space, Row, Steps, Timeline } from 'antd'
import message from '../../message'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import ShowUtils from './show-util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import { walletActions } from '../../state/modules/wallet'
import { useHistory } from 'react-router'
import Paths from '../../constants/paths'
import WalletAddress from '../../components/WalletAddress'
const { Title, Text, Link } = Typography
const { Step } = Steps
const CardStyle = {
  backgroundColor: 'rgba(0,0,0,0.15)',
  position: 'absolute',
  width: '100%',
  height: '100%',
  left: 0,
  top: 0,
  zIndex: 100,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)'
}

const Upgrade = ({ address, onClose }) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const network = useSelector(state => state.global.network)
  const [confirmUpgradeVisible, setConfirmUpgradeVisible] = useState(false)
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const [skipUpdate, setSkipUpdate] = useState(false)
  const { majorVersion, minorVersion, lastResortAddress, doubleOtp, forwardAddress, temp } = wallet
  const requireUpdate = majorVersion && (!(parseInt(majorVersion) >= ONEConstants.MajorVersion) || parseInt(minorVersion) === 0)
  const canUpgrade = majorVersion >= config.minUpgradableVersion
  const latestVersion = { majorVersion: ONEConstants.MajorVersion, minorVersion: ONEConstants.MinorVersion }
  const balances = useSelector(state => state.balance || {})
  const { balance } = util.computeBalance(balances[address]?.balance || 0)
  const maxSpend = BN.min(util.getMaxSpending(wallet), new BN(balance))
  const { formatted: maxSpendFormatted } = util.computeBalance(maxSpend.toString())
  const balanceGreaterThanLimit = new BN(balance).gt(new BN(maxSpend))
  const needSetRecoveryAddressFirst = balanceGreaterThanLimit && util.isDefaultRecoveryAddress(lastResortAddress)
  const needSpecialSteps = balanceGreaterThanLimit && !util.isDefaultRecoveryAddress(lastResortAddress)
  const [minTransferGas] = useState(100000)
  const { isMobile } = useWindowDimensions()

  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp
  const [stage, setStage] = useState(-1)
  const { resetWorker, recoverRandomness } = useRandomWorker()

  const { prepareValidation, onRevealSuccess, ...helpers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const doUpgrade = async () => {
    if (stage >= 0) {
      return
    }
    setStage(0)
    const {
      root,
      height,
      interval,
      t0,
      lifespan,
      maxOperationsPerInterval,
      lastResortAddress,
      spendingLimit,
      spendingInterval
    } = await api.blockchain.getWallet({ address, raw: true })
    const backlinks = await api.blockchain.getBacklinks({ address })
    let oldCores = []
    if (majorVersion >= 14) {
      oldCores = await api.blockchain.getOldInfos({ address, raw: true })
    }
    const transformedLastResortAddress = util.isDefaultRecoveryAddress(lastResortAddress) ? ONEConstants.TreasuryAddress : lastResortAddress
    const { address: newAddress } = await api.relayer.create({
      root,
      height,
      interval,
      t0,
      lifespan,
      slotSize: maxOperationsPerInterval,
      lastResortAddress: transformedLastResortAddress,
      spendingLimit: spendingLimit.toString(),
      spendingInterval: spendingInterval.toString(),
      backlinks: [...backlinks, address],
      oldCores
    })
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({ state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp }, checkAmount: false, checkDest: false }) || {}
    if (invalidOtp || invalidOtp2) return
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeForwardHash,
      commitHashArgs: { address: newAddress },
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.revealForward,
      revealArgs: { dest: newAddress },
      ...helpers,
      onRevealSuccess: async (txId) => {
        onRevealSuccess(txId)
        setStage(-1)
        resetOtp()
        resetWorker()
        const newWallet = {
          ...wallet,
          address: newAddress,
          backlinks,
          _merge: true
        }
        const oldWallet = {
          ...wallet,
          temp: wallet.effectiveTime + wallet.duration,
          forwardAddress: newAddress,
          _merge: true
        }
        dispatch(walletActions.updateWallet(newWallet))
        dispatch(walletActions.updateWallet(oldWallet))
        dispatch(walletActions.fetchWallet({ address: newAddress }))
        setTimeout(() => history.push(Paths.showAddress(util.safeOneAddress(newAddress))), 1000)
        message.success('Upgrade completed!')
      }
    })
  }
  const skip = () => {
    setConfirmUpgradeVisible(false)
    setSkipUpdate(true)
    onClose && onClose()
  }
  const skipVersion = () => {
    dispatch(walletActions.userSkipVersion({ address, version: ONEUtil.getVersion(latestVersion) }))
    skip()
  }
  if (!requireUpdate || skipUpdate || !canUpgrade || temp || !util.isEmptyAddress(forwardAddress) || wallet.skipVersion === ONEUtil.getVersion(latestVersion)) {
    return <></>
  }

  return (
    <Card style={CardStyle} bodyStyle={{ height: '100%' }}>
      <Space
        direction='vertical'
        align='center'
        size='large'
        style={{
          height: '100%',
          justifyContent: 'start',
          paddingTop: isMobile ? 32 : 192,
          paddingLeft: isMobile ? 16 : 64,
          paddingRight: isMobile ? 16 : 64,
          display: 'flex'
        }}
      >
        {!confirmUpgradeVisible &&
          <>
            <Title level={isMobile ? 4 : 2}>An upgrade is available</Title>
            <Text>Your wallet: v{ONEUtil.getVersion(wallet)}</Text>
            <Text>Latest version: v{ONEUtil.getVersion(latestVersion)}</Text>
            <Button type='primary' shape='round' size='large' onClick={() => setConfirmUpgradeVisible(true)}>Upgrade Now</Button>
            <Button size='large' shape='round' onClick={skip}>Do it later</Button>
            <Button type='text' danger onClick={skipVersion}>Skip this version</Button>
            <Text>For more details about this upgrade, see <Link target='_blank' href={util.releaseNotesUrl(latestVersion)} rel='noreferrer'> release notes for v{ONEUtil.getVersion(latestVersion)}</Link></Text>
          </>}
        {confirmUpgradeVisible &&
          <>
            {needSetRecoveryAddressFirst &&
              <>
                <Title level={4}>
                  You have a high value wallet.
                </Title>
                <Title level={4}>
                  Please set a recovery address first.
                </Title>
                <Button size='large' type='primary' shape='round' onClick={() => { skip(); history.push(Paths.showAddress(address, 'help')) }}>Set Now</Button>
              </>}
            {needSpecialSteps &&
              <>
                <Title type='danger' level={4}>
                  You have a high value wallet. Follow these steps:
                </Title>
                <Steps current={0} direction='vertical'>
                  <Step title='Confirm the upgrade' description={`You will get a new address. Only ${maxSpendFormatted} ONE will there. Don't panic.`} />
                  <Step
                    title='Approve asset transfer'
                    description={(
                      <Space direction='vertical'>
                        <Text>Send 0.1 ONE from your recovery address</Text>
                        <WalletAddress address={lastResortAddress} showLabel alwaysShowOptions />
                        <Text>to the current address <b>(use at least {minTransferGas} gas limit)</b></Text>
                        <WalletAddress address={address} showLabel alwaysShowOptions />
                        <Text>(To abort upgrade, recover assets, and deprecate the wallet, send 1.0 ONE instead)</Text>
                      </Space>)}
                  />
                </Steps>

              </>}
            {!needSetRecoveryAddressFirst &&
              <>
                <OtpStack shouldAutoFocus walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} onComplete={doUpgrade} action='confirm upgrade' />

                <Title level={3}>
                  How upgrade works:
                </Title>
                <Timeline>
                  <Timeline.Item>Each upgrade gives you a new address</Timeline.Item>
                  <Timeline.Item>Your old address auto-forward assets to new address</Timeline.Item>
                  <Timeline.Item>In rare cases, some assets may be left over (e.g. ERC20 tokens)</Timeline.Item>
                  <Timeline.Item>You can take control of old addresses (under "About" tab)</Timeline.Item>
                  <Timeline.Item>You can inspect and reclaim what's left there at any time</Timeline.Item>
                </Timeline>
              </>}
            {stage < 0 && <Button size='large' shape='round' onClick={skip}>Do it later</Button>}
            {stage < 0 && <Button type='text' danger onClick={skipVersion}>Skip this version</Button>}

          </>}
        {stage >= 0 && (
          <Row>
            <Steps current={stage}>
              <Step title='Clone' description='Cloning to new version' />
              <Step title='Prepare' description='Preparing for transfer' />
              <Step title='Link' description='Linking two versions' />
            </Steps>
          </Row>)}
      </Space>
    </Card>

  )
}
export default Upgrade
