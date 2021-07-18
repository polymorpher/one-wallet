import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useRouteMatch, Redirect, useLocation, matchPath } from 'react-router'
import Paths from '../constants/paths'
import WalletConstants from '../constants/wallet'
import walletActions from '../state/modules/wallet/actions'
import util, { useWindowDimensions } from '../util'
import ONE from '../../../lib/onewallet'
import api from '../api'
import * as Sentry from '@sentry/browser'
import { message, Space, Row, Col, Typography, Button, Steps, Popconfirm, Tooltip } from 'antd'
import {
  DeleteOutlined,
  WarningOutlined,
  CloseOutlined,
  QuestionCircleOutlined,
  LoadingOutlined
} from '@ant-design/icons'
// import styled from 'styled-components'
import humanizeDuration from 'humanize-duration'
import AnimatedSection from '../components/AnimatedSection'

import { Hint, InputBox, Warning, Label, ExplorerLink } from '../components/Text'
import { TallRow } from '../components/Grid'
import { ERC20Grid } from '../components/ERC20Grid'
import { intersection } from 'lodash'
import storage from '../storage'
import BN from 'bn.js'
import config from '../config'
import OtpBox from '../components/OtpBox'
import { getAddress } from '@harmony-js/crypto'
import { handleAddressError } from '../handler'
import { SmartFlows, Chaining, EotpBuilders } from '../api/flow'
const { Title, Text, Link } = Typography
const { Step } = Steps

const Show = () => {
  const history = useHistory()
  const location = useLocation()
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const match = useRouteMatch(Paths.show)
  const { address: routeAddress, action } = match ? match.params : {}
  const oneAddress = util.safeOneAddress(routeAddress)
  const address = util.safeNormalizedAddress(routeAddress)
  const selectedAddress = useSelector(state => state.wallet.selected)

  const wallet = wallets[address] || {}
  const [section, setSection] = useState(action)
  const [stage, setStage] = useState(0)
  const network = useSelector(state => state.wallet.network)
  const [activeTab, setActiveTab] = useState('coins')

  const walletOutdated = util.isWalletOutdated(wallet)

  useEffect(() => {
    if (!wallet) {
      return history.push(Paths.wallets)
    }
    if (address && (address !== selectedAddress)) {
      dispatch(walletActions.selectWallet(address))
    }
    const fetch = () => dispatch(walletActions.fetchBalance({ address }))
    fetch()
    const handler = setInterval(() => fetch(), WalletConstants.fetchBalanceFrequency)
    dispatch(walletActions.fetchWallet({ address }))
    return () => { clearInterval(handler) }
  }, [])
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address] || 0
  const price = useSelector(state => state.wallet.price)
  const { formatted, fiatFormatted } = util.computeBalance(balance, price)
  const { dailyLimit, lastResortAddress } = wallet
  const oneLastResort = lastResortAddress && getAddress(lastResortAddress).bech32
  const { formatted: dailyLimitFormatted, fiatFormatted: dailyLimitFiatFormatted } = util.computeBalance(dailyLimit, price)

  useEffect(() => {
    const m = matchPath(location.pathname, { path: Paths.show })
    const { action } = m ? m.params : {}
    setSection(action)
  }, [location])

  const showTransfer = () => { history.push(Paths.showAddress(oneAddress, 'transfer')) }
  const showRecovery = () => { history.push(Paths.showAddress(oneAddress, 'recover')) }
  const showSetRecoveryAddress = () => { history.push(Paths.showAddress(oneAddress, 'setRecoveryAddress')) }
  const showStats = () => { history.push(Paths.showAddress(oneAddress)) }
  const onDeleteWallet = async () => {
    const { root, name } = wallet
    dispatch(walletActions.deleteWallet(address))
    try {
      await storage.removeItem(root)
      message.success(`Wallet ${name} is deleted`)
      history.push(Paths.wallets)
    } catch (ex) {
      console.error(ex)
      message.error(`Failed to delete wallet proofs. Error: ${ex}`)
    }
  }

  const [transferTo, setTransferTo] = useState('')
  const [inputAmount, setInputAmount] = useState('')
  const [otpInput, setOtpInput] = useState('')

  const {
    balance: transferAmount,
    fiatFormatted: transferFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price)

  const useMaxAmount = () => {
    if (new BN(balance, 10).gt(new BN(dailyLimit, 10))) {
      setInputAmount(dailyLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }
  const restart = () => {
    setStage(0)
    setOtpInput(0)
    setInputAmount(0)
  }

  // otp, wallet, layers, commitHashGenerator, commitHashArgs,
  //   beforeCommit, afterCommit, onCommitError, onCommitFailure,
  //   revealAPI, revealArgs, onRevealFailure, onRevealSuccess, onRevealError, onRevealAttemptFailed,
  //   beforeReveal

  const prepareValidation = ({ checkAmount = true, checkDest = true, checkOtp = true } = {}) => {
    // Ensure valid address for both 0x and one1 formats
    const dest = util.safeExec(util.normalizedAddress, [transferTo], handleAddressError)
    if (checkDest && !dest) {
      return
    }
    if (checkAmount && (!transferAmount || transferAmount.isZero() || transferAmount.isNeg())) {
      return message.error('Transfer amount is invalid')
    }
    const otp = util.parseOtp(otpInput)
    if (checkOtp && !otp) {
      message.error('Google Authenticator code is not valid')
      return
    }
    return { otp, dest, amount: transferAmount.toString() }
  }
  const onCommitError = (ex) => {
    Sentry.captureException(ex)
    console.error(ex)
    message.error('Failed to commit. Error: ' + ex.toString())
    setStage(0)
  }
  const onCommitFailure = (error) => {
    message.error(`Cannot commit transaction. Reason: ${error}`)
    setStage(0)
  }
  const onRevealFailure = (error) => {
    message.error(`Transaction Failed: ${error}`)
    setStage(0)
    setOtpInput('')
  }
  const onRevealError = (ex) => {
    Sentry.captureException(ex)
    message.error(`Failed to finalize transaction. Error: ${ex.toString()}`)
    setStage(0)
    setOtpInput('')
  }
  const onRevealAttemptFailed = (numAttemptsRemaining) => {
    message.error(`Failed to finalize transaction. Trying ${numAttemptsRemaining} more time`)
  }

  const onRevealSuccess = (txId) => {
    setStage(3)
    if (config.networks[network].explorer) {
      const link = config.networks[network].explorer.replaceAll('{{txId}}', txId)
      message.success(<Text>Done! View transaction <Link href={link} target='_blank' rel='noreferrer'>{util.ellipsisAddress(txId)}</Link></Text>, 10)
    } else {
      message.success(<Text>Transfer completed! Copy transaction id: <Text copyable={{ text: txId }}>{util.ellipsisAddress(txId)} </Text></Text>, 10)
    }
    setOtpInput('')
  }

  const doSend = async () => {
    const { otp, dest, amount } = prepareValidation() || {}
    if (!otp || !dest) return

    SmartFlows.commitReveal({
      wallet,
      otp,
      commitHashGenerator: ONE.computeTransferHash,
      commitHashArgs: { dest, amount },
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
        Chaining.refreshBalance(dispatch, intersection(Object.keys(wallets), [dest, address]))
      }
    })
  }

  const doRecovery = async () => {
    SmartFlows.commitReveal({
      wallet,
      eotpBuilder: EotpBuilders.recovery,
      commitHashGenerator: ONE.computeRecoveryHash,
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      onCommitError,
      onCommitFailure,
      revealAPI: api.relayer.revealRecovery,
      onRevealFailure,
      onRevealError,
      onRevealAttemptFailed,
      onRevealSuccess
    })
  }

  const doSetRecoveryAddress = async () => {
    const { otp, dest } = prepareValidation({ checkAmount: false }) || {}
    if (!otp || !dest) return

    SmartFlows.commitReveal({
      wallet,
      otp,
      commitHashGenerator: ONE.computeSetRecoveryAddressHash,
      commitHashArgs: { address: dest },
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      onCommitError,
      onCommitFailure,
      revealAPI: api.relayer.revealSetRecoveryAddress,
      revealArgs: { lastResortAddress: dest },
      onRevealFailure,
      onRevealError,
      onRevealAttemptFailed,
      onRevealSuccess: (txId) => {
        onRevealSuccess(txId)
        message.success(`Recovery address is set to ${transferTo}`)
        dispatch(walletActions.fetchWallet({ address }))
        showStats()
      }
    })
  }
  const { isMobile } = useWindowDimensions()
  // UI Rendering below
  if (!wallet || wallet.network !== network) {
    return <Redirect to={Paths.wallets} />
  }
  const title = (
    <Space size='large' align='baseline'>
      <Title level={2}>{wallet.name}</Title>
      <Text>
        <ExplorerLink copyable={{ text: oneAddress }} href={util.getNetworkExplorerUrl(wallet)}>
          {isMobile ? util.ellipsisAddress(oneAddress) : oneAddress}
        </ExplorerLink>
      </Text>
    </Space>
  )

  const AboutWallet = () => !section && (
    <>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Created On</Title></Col>
        <Col> <Text>{new Date(wallet.effectiveTime).toLocaleString()}</Text> </Col>
      </TallRow>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Expires In</Title></Col>
        <Col> <Text>{humanizeDuration(wallet.duration, { units: ['y', 'mo', 'd'], round: true })}</Text> </Col>
      </TallRow>
      <TallRow>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Daily Limit</Title></Col>
        <Col>
          <Space>
            <Text>{dailyLimitFormatted}</Text>
            <Text type='secondary'>ONE</Text>
            <Text>(≈ ${dailyLimitFiatFormatted}</Text>
            <Text type='secondary'>USD)</Text>
          </Space>
        </Col>
      </TallRow>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Recovery Address</Title></Col>
        {lastResortAddress && !util.isEmptyAddress(lastResortAddress) &&
          <Col>
            <Space>
              <Tooltip title={oneLastResort}>
                <ExplorerLink copyable={oneLastResort && { text: oneLastResort }} href={util.getNetworkExplorerUrl(wallet)}>
                  {util.ellipsisAddress(oneLastResort)}
                </ExplorerLink>
              </Tooltip>
            </Space>
          </Col>}
        {!(lastResortAddress && !util.isEmptyAddress(lastResortAddress)) &&
          <Col>
            <Button type='primary' size='large' shape='round' onClick={showSetRecoveryAddress}> Set </Button>
          </Col>}
      </TallRow>
      {wallet.majorVersion && wallet.minorVersion &&
        <TallRow align='middle'>
          <Col span={isMobile ? 24 : 12}> <Title level={3}>Wallet Version</Title></Col>
          <Col>
            <Text>{wallet.majorVersion}.{wallet.minorVersion}</Text>
          </Col>
        </TallRow>}
      <Row style={{ marginTop: 48 }}>
        <Button type='link' style={{ padding: 0 }} size='large' onClick={showRecovery} icon={<WarningOutlined />}>I lost my Google Authenticator</Button>
      </Row>
      <Row style={{ marginTop: 24 }}>
        <Popconfirm title='Are you sure？' onConfirm={onDeleteWallet}>
          <Button type='link' style={{ color: 'red', padding: 0 }} size='large' icon={<DeleteOutlined />}>Delete this wallet locally</Button>
        </Popconfirm>

      </Row>
    </>
  )
  const WalletBalance = () => (
    <>
      <Row style={{ marginTop: 16 }}>
        <Col span={isMobile ? 24 : 12}>
          <Title level={3} style={{ marginRight: 48 }}>Balance</Title>
        </Col>
        <Col>
          <Space>
            <Title level={3}>{formatted}</Title>
            <Text type='secondary'>ONE</Text>
          </Space>
        </Col>
      </Row>
      <Row>
        <Col span={isMobile ? 24 : 12} />
        <Col>
          <Space>
            <Title level={4}>≈ ${fiatFormatted}</Title>
            <Text type='secondary'>USD</Text>
          </Space>
        </Col>
      </Row>
      <Row style={{ marginTop: 16 }}>
        <Col span={isMobile ? 24 : 12} />
        <Col>
          <Button type='primary' size='large' shape='round' onClick={showTransfer}> Send </Button>
        </Col>
      </Row>
    </>
  )

  return (
    <>
      {/* <Space size='large' wrap align='start'> */}
      <AnimatedSection
        show={!section}
        title={title}
        style={{ minHeight: 320, maxWidth: 720 }}
        tabList={[{ key: 'coins', tab: 'Coins' }, { key: 'collectibles', tab: 'Collectibles' }, { key: 'about', tab: 'About' }]}
        activeTabKey={activeTab}
        onTabChange={key => setActiveTab(key)}
      >
        {walletOutdated && <Warning>Your wallet is outdated. Some information may be displayed incorrectly. Some features might not function. Your balance is still displayed correctly, and you can still send funds. <br /><br />Please create a new wallet and move your funds as soon as possible.</Warning>}
        {util.isEmptyAddress(wallet.lastResortAddress) && <Warning>You haven't set your recovery address. Please do it as soon as possible. Wallets created prior to July 13, 2021 without a recovery address are vulnerable to theft if recovery address is not set.</Warning>}

        {activeTab === 'about' && <AboutWallet />}
        {activeTab === 'coins' && <WalletBalance />}
        {activeTab === 'coins' && <ERC20Grid wallet={wallet} />}

      </AnimatedSection>
      <AnimatedSection
        style={{ width: 720 }}
        show={section === 'transfer'} title={<Title level={2}>Transfer</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={showStats} />
        ]}
      >
        <Space direction='vertical' size='large'>
          <Space align='baseline' size='large'>
            <Label><Hint>To</Hint></Label>
            <InputBox margin='auto' width={440} value={transferTo} onChange={({ target: { value } }) => setTransferTo(value)} placeholder='one1...' />
          </Space>
          <Space align='baseline' size='large'>
            <Label><Hint>Amount</Hint></Label>
            <InputBox margin='auto' width={200} value={inputAmount} onChange={({ target: { value } }) => setInputAmount(value)} />
            <Hint>ONE</Hint>
            <Button type='secondary' shape='round' onClick={useMaxAmount}>max</Button>
          </Space>
          <Space align='end' size='large'>
            <Label><Hint /></Label>
            <Title level={4} style={{ width: 200, textAlign: 'right', marginBottom: 0 }}>≈ ${transferFiatAmountFormatted}</Title>
            <Hint>USD</Hint>
          </Space>
          <Space align='baseline' size='large' style={{ marginTop: 16 }}>
            <Label><Hint>Code</Hint></Label>
            <OtpBox
              value={otpInput}
              onChange={setOtpInput}
            />
            <Tooltip title='from your Google Authenticator'>
              <QuestionCircleOutlined />
            </Tooltip>
          </Space>
        </Space>
        <Row justify='end' style={{ marginTop: 24 }}>
          <Space>
            {stage > 0 && stage < 3 && <LoadingOutlined />}
            {stage < 3 && <Button type='primary' size='large' shape='round' disabled={stage > 0} onClick={doSend}>Send</Button>}
            {stage === 3 && <Button type='secondary' size='large' shape='round' onClick={restart}>Restart</Button>}
          </Space>
        </Row>
        {stage > 0 && (
          <Row style={{ marginTop: 32 }}>
            <Steps current={stage}>
              <Step title='Prepare' description='Preparing signature' />
              <Step title='Commit' description='Locking-in operation' />
              <Step title='Finalize' description='Submitting proofs' />
            </Steps>
          </Row>)}
      </AnimatedSection>
      <AnimatedSection
        show={section === 'recover'}
        style={{ width: 720 }}
        title={<Title level={2}>Recover</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={showStats} />
        ]}
      >
        {lastResortAddress &&
          <>
            <Space direction='vertical' size='large'>
              <Title level={2}>Your funds are safe</Title>
              <Text>Since you already set a recover address, we can send all your remaining funds to that address.</Text>
              <Text>Do you want to proceed?</Text>
            </Space>
            <Row justify='end' style={{ marginTop: 48 }}>
              <Button type='primary' size='large' shape='round' disabled={stage > 0} onClick={doRecovery}>Sounds good!</Button>
            </Row>
            {stage > 0 && (
              <Row style={{ marginTop: 32 }}>
                <Steps current={stage}>
                  <Step title='Prepare' description='Preparing signature' />
                  <Step title='Commit' description='Locking-in operation' />
                  <Step title='Finalize' description='Submitting proofs' />
                </Steps>
              </Row>)}
          </>}
        {!lastResortAddress &&
          <Space direction='vertical' size='large'>
            <Title level={2}>Your funds are safe</Title>
            <Text>You did not set a recovery address. We can still set one, using pre-computed proofs stored in your browser</Text>
            <Text>Please go back and check again once you finished.</Text>
          </Space>}

      </AnimatedSection>
      <AnimatedSection
        style={{ width: 720 }}
        show={section === 'setRecoveryAddress'} title={<Title level={2}>Set Recovery Address</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={showStats} />
        ]}
      >
        <Space direction='vertical' size='large'>
          <Hint>Note: You can only do this once!</Hint>
          <Space align='baseline' size='large'>
            <Label><Hint>Address</Hint></Label>
            <InputBox margin='auto' width={440} value={transferTo} onChange={({ target: { value } }) => setTransferTo(value)} placeholder='one1...' />
          </Space>
          <Space align='baseline' size='large' style={{ marginTop: 16 }}>
            <Label><Hint>Code</Hint></Label>
            <OtpBox
              value={otpInput}
              onChange={setOtpInput}
            />
            <Tooltip title='from your Google Authenticator'>
              <QuestionCircleOutlined />
            </Tooltip>
          </Space>
        </Space>
        <Row justify='end' style={{ marginTop: 24 }}>
          <Space>
            {stage > 0 && stage < 3 && <LoadingOutlined />}
            <Button type='primary' size='large' shape='round' disabled={stage > 0} onClick={doSetRecoveryAddress}>Set</Button>
          </Space>
        </Row>
        {stage > 0 && (
          <Row style={{ marginTop: 32 }}>
            <Steps current={stage}>
              <Step title='Prepare' description='Preparing signature' />
              <Step title='Commit' description='Locking-in operation' />
              <Step title='Finalize' description='Submitting proofs' />
            </Steps>
          </Row>)}
      </AnimatedSection>
    </>
  )
}
export default Show
