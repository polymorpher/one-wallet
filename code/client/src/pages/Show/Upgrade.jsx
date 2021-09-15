import { useDispatch, useSelector } from 'react-redux'
import React, { useState } from 'react'
import ONEConstants from '../../../../lib/constants'
import ONEUtil from '../../../../lib/util'
import util, { useWindowDimensions } from '../../util'
import config from '../../config'
import BN from 'bn.js'
import { Button, Card, Typography, Space, message, Row, Steps } from 'antd'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import ShowUtils from './show-util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { api } from '../../../../lib/api'
import { walletActions } from '../../state/modules/wallet'
import { useHistory } from 'react-router'
import Paths from '../../constants/paths'
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
  backdropFilter: 'blur(10px)'
}

const Upgrade = ({ address, onClose }) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const network = useSelector(state => state.wallet.network)
  const [confirmUpgradeVisible, setConfirmUpgradeVisible] = useState(false)
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const [skipUpdate, setSkipUpdate] = useState(false)
  const { majorVersion, minorVersion, lastResortAddress, doubleOtp } = wallet
  const requireUpdate = majorVersion && (!(parseInt(majorVersion) >= ONEConstants.MajorVersion) || parseInt(minorVersion) === 0)
  const canUpgrade = majorVersion >= config.minUpgradableVersion
  const latestVersion = { majorVersion: ONEConstants.MajorVersion, minorVersion: ONEConstants.MinorVersion }
  const maxSpend = util.getMaxSpending(wallet)
  const { formatted: maxSpendFormatted } = util.computeBalance(maxSpend)
  const balances = useSelector(state => state.wallet.balances)
  const { balance, formatted } = util.computeBalance(balances[address])
  const oneLastResort = util.safeOneAddress(lastResortAddress)
  const oneAddress = util.safeOneAddress(address)
  const balanceGreaterThanLimit = new BN(balance).gt(new BN(maxSpend))

  const excessBalance = balanceGreaterThanLimit ? new BN(balance).sub(new BN(maxSpend)) : new BN(0)
  const { formatted: excessBalanceFormatted } = util.computeBalance(excessBalance.toString())
  const { isMobile } = useWindowDimensions()

  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp
  const [stage, setStage] = useState(-1)
  const { resetWorker, recoverRandomness } = useRandomWorker()

  const { onCommitError, onCommitFailure, onRevealFailure, onRevealError, onRevealAttemptFailed, onRevealSuccess, prepareValidation, prepareProofFailed } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  const doUpgrade = async () => {
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

    const { address: newAddress } = await api.relayer.create({
      root,
      height,
      interval,
      t0,
      lifespan,
      slotSize: maxOperationsPerInterval,
      lastResortAddress,
      spendingLimit: spendingLimit.toString(),
      spendingInterval: spendingInterval.toString(),
      backlinks: [...backlinks, address]
    })
    const { otp, otp2, invalidOtp2, invalidOtp } = prepareValidation({ state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp }, checkAmount: false, checkDest: false }) || {}
    if (invalidOtp || invalidOtp2) return
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      prepareProofFailed,
      commitHashGenerator: ONE.computeForwardHash,
      commitHashArgs: { address: newAddress },
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      onCommitError,
      onCommitFailure,
      revealAPI: api.relayer.revealForward,
      revealArgs: { dest: newAddress },
      onRevealFailure,
      onRevealError,
      onRevealAttemptFailed,
      onRevealSuccess: async (txId) => {
        onRevealSuccess(txId)
        setStage(-1)
        resetOtp()
        resetWorker()
        const newWallet = {
          ...wallet,
          address: newAddress,
          backlinks
        }
        dispatch(walletActions.updateWallet(newWallet))
        dispatch(walletActions.deleteWallet(address))
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
  if (!requireUpdate || skipUpdate || !canUpgrade) {
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
          justifyContent: isMobile ? 'start' : 'center',
          display: 'flex'
        }}
      >
        {!confirmUpgradeVisible &&
          <>
            <Title level={isMobile ? 4 : 2}>An upgrade is available.</Title>
            <Text>Your wallet: v{ONEUtil.getVersion(wallet)}</Text>
            <Text>Latest version: v{ONEUtil.getVersion(latestVersion)}</Text>
            <Button type='primary' shape='round' size='large' onClick={() => setConfirmUpgradeVisible(true)}>Upgrade Now</Button>
            <Button type='text' danger onClick={skip}>Do it later</Button>
            <Text>For more details about this upgrade, see <Link target='_blank' href={util.releaseNotesUrl(latestVersion)} rel='noreferrer'> release notes for v{ONEUtil.getVersion(latestVersion)}</Link></Text>
          </>}
        {confirmUpgradeVisible &&
          <>
            <OtpStack walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} />
            <Button disabled={stage >= 0} type='primary' shape='round' size='large' onClick={doUpgrade}>Confirm Upgrade</Button>
            <Text type='secondary'>
              How it works:
              <ul>
                <li>Your will get a new wallet address. Everything else remains the same (e.g. authenticator)</li>
                <li>From now on, everything sent to your old address will be forwarded to the new address</li>
                <li>All your collectibles will be immediately transferred to your new address</li>
                <li>All tokens you sent (not swapped) at least once will be transferred to the new address </li>
                <li>Your new address can fully control your old address, and claim anything not transferred</li>
                {!balanceGreaterThanLimit && <li> All your funds ({formatted} ONE) will be immediately transferred to your new address</li>}
                <li>If there is anything not automatically transferred, you will be able to reclaim them after upgrade</li>
              </ul>
            </Text>
            {balanceGreaterThanLimit &&
              <Text type='danger'>
                You have a high value wallet. There are some extra steps for you:
                <ul>
                  <li> {maxSpendFormatted} ONE will be immediately transferred to your new address</li>
                  <li> You need to approve transferring the rest ({excessBalanceFormatted} ONE) by sending some ONE to the old address</li>
                  <li> Your recovery address is {oneLastResort}</li>
                  <li> Send any amount (except 1.0 ONE) to {oneAddress}</li>
                  <li> If you change your mind, you can still send 1.0 ONE from your recovery address to stop the upgrade and reclaim all funds</li>
                </ul>
              </Text>}
            {stage < 0 && <Button type='text' danger onClick={skip}>Do it later</Button>}
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
