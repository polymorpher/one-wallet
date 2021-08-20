import { useSelector } from 'react-redux'
import React, { useState } from 'react'
import ONEConstants from '../../../../lib/constants'
import ONEUtil from '../../../../lib/util'
import util from '../../util'
import config from '../../config'
import BN from 'bn.js'
import { Button, Card, Typography, Space } from 'antd'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
const { Title, Text, Link } = Typography

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
  const [confirmUpgradeVisible, setConfirmUpgradeVisible] = useState(false)
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const [skipUpdate, setSkipUpdate] = useState(false)
  const { majorVersion, minorVersion, lastResortAddress, doubleOtp } = wallet
  const requireUpdate = majorVersion && (!(parseInt(majorVersion) >= ONEConstants.MajorVersion) || parseInt(minorVersion) === 0)
  const canUpgrade = majorVersion >= config.minUpgradableVersion
  const latestVersion = { majorVersion: ONEConstants.MajorVersion, minorVersion: ONEConstants.MinorVersion }
  const { dailyLimit } = wallet
  const { formatted: dailyLimitFormatted } = util.computeBalance(dailyLimit)
  const balances = useSelector(state => state.wallet.balances)
  const { balance, formatted } = util.computeBalance(balances[address])
  const oneLastResort = util.safeOneAddress(lastResortAddress)
  const oneAddress = util.safeOneAddress(address)
  const balanceGreaterThanLimit = new BN(balance).gt(new BN(dailyLimit))
  const excessBalance = balanceGreaterThanLimit ? new BN(balance).sub(new BN(dailyLimit)) : new BN(0)
  const { formatted: excessBalanceFormatted } = util.computeBalance(excessBalance)

  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp
  const [stage, setStage] = useState(-1)
  const { resetWorker, recoverRandomness } = useRandomWorker()

  const doUpgrade = () => {

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
      <Space direction='vertical' align='center' size='large' style={{ height: '100%', justifyContent: 'center', display: 'flex' }}>
        {!confirmUpgradeVisible &&
          <>
            <Title>An upgrade is available.</Title>
            <Text>Your wallet: v{ONEUtil.getVersion(wallet)}</Text>
            <Text>Latest version: v{ONEUtil.getVersion(latestVersion)}</Text>
            <Button type='primary' shape='round' size='large' onClick={() => setConfirmUpgradeVisible(true)}>Upgrade Now</Button>
            <Button type='text' danger onClick={skip}>Do it later</Button>
            <Text>For more details about this upgrade, see <Link target='_blank' href={util.releaseNotesUrl(latestVersion)} rel='noreferrer'> release notes for v{ONEUtil.getVersion(latestVersion)}</Link></Text>
          </>}
        {confirmUpgradeVisible &&
          <>
            <OtpStack walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} />
            <Button type='primary' shape='round' size='large' onClick={doUpgrade}>Confirm Upgrade</Button>
            <Text type='secondary'>
              How it works:
              <ul>
                <li>Your will get a new wallet address. Everything else remains the same (e.g. authenticator)</li>
                <li>From now on, everything sent to your old address will be forwarded to the new address</li>
                <li>All your collectibles will be immediately transferred to your new address</li>
                <li>All tracked tokens will be immediately transferred to the new address </li>
                <li>Your new address can fully control your old address, and claim anything not transferred</li>
                {!balanceGreaterThanLimit && <li> All your funds ({formatted} ONE) will be immediately transferred to your new address</li>}
              </ul>
            </Text>
            {balanceGreaterThanLimit &&
              <Text type='danger'>
                You have a high value wallet. There are some extra steps for you:
                <ul>
                  <li> {dailyLimitFormatted} ONE will be immediately transferred to your new address</li>
                  <li> You need to approve transferring the rest ({excessBalanceFormatted} ONE) by sending some ONE to the old address</li>
                  <li> Your recovery address is {oneLastResort}</li>
                  <li> Send any amount (except 1.0 ONE) to {oneAddress}</li>
                  <li> If you change your mind, you can still send 1.0 ONE from your recovery address to stop the upgrade and reclaim all funds</li>
                </ul>
              </Text>}
            <Button type='text' danger onClick={skip}>Do it later</Button>
          </>}
      </Space>
    </Card>

  )
}
export default Upgrade
