import React, { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useRouteMatch, Redirect, useLocation, matchPath } from 'react-router'
import Paths from '../constants/paths'
import WalletConstants from '../constants/wallet'
import walletActions from '../state/modules/wallet/actions'
import util, { useWindowDimensions } from '../util'
import ONE from '../../../lib/onewallet'
import ONEUtil from '../../../lib/util'
import ONEConstants from '../../../lib/constants'
import api from '../api'
import * as Sentry from '@sentry/browser'
import { message, Space, Row, Col, Typography, Button, Popconfirm, Tooltip } from 'antd'
import {
  DeleteOutlined,
  WarningOutlined,
  CloseOutlined,
  QuestionCircleOutlined,
  LoadingOutlined,
  CheckCircleOutlined
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
import { CommitRevealProgress } from '../components/CommitRevealProgress'
import { HarmonyONE } from '../components/TokenAssets'
import { NFTGrid } from '../components/NFTGrid'
import WalletAddress from '../components/WalletAddress'
import AddressInput from '../components/AddressInput'

const { Title, Text, Link } = Typography
const tabList = [{ key: 'coins', tab: 'Coins' }, { key: 'nft', tab: 'Collectibles' }, { key: 'about', tab: 'About' }, { key: 'help', tab: 'Recover' }]
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
  const [stage, setStage] = useState(-1)
  const network = useSelector(state => state.wallet.network)
  const [activeTab, setActiveTab] = useState('coins')
  const walletOutdated = util.isWalletOutdated(wallet)
  const [worker, setWorker] = useState()
  const workerRef = useRef({ promise: null }).current
  const resetWorkerPromise = (newWorker) => {
    workerRef.promise = new Promise((resolve, reject) => {
      newWorker.onmessage = (event) => {
        const { status, error, result } = event.data
        // console.log('Received: ', { status, result, error })
        if (status === 'rand') {
          const { rand } = result
          resolve(rand)
        } else if (status === 'error') {
          reject(error)
        }
      }
    })
  }
  useEffect(() => {
    const worker = new Worker('/ONEWalletWorker.js')
    setWorker(worker)
  }, [])
  useEffect(() => {
    worker && resetWorkerPromise(worker)
  }, [worker])

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
  const price = useSelector(state => state.wallet.price)
  const tokenBalances = wallet.tokenBalances || []
  const selectedToken = wallet?.selectedToken || HarmonyONE
  const selectedTokenBalance = selectedToken.key === 'one' ? (balances[address] || 0) : (tokenBalances[selectedToken.key] || 0)
  const selectedTokenDecimals = selectedToken.decimals

  const { formatted, fiatFormatted } = util.computeBalance(selectedTokenBalance, price, selectedTokenDecimals)
  const { dailyLimit, lastResortAddress } = wallet
  const oneLastResort = lastResortAddress && getAddress(lastResortAddress).bech32
  const { formatted: dailyLimitFormatted, fiatFormatted: dailyLimitFiatFormatted } = util.computeBalance(dailyLimit, price)

  useEffect(() => {
    const m = matchPath(location.pathname, { path: Paths.show })
    const { action } = m ? m.params : {}
    if (action !== 'nft' && action !== 'transfer' && selectedToken.key !== 'one' && selectedToken.tokenType !== ONEConstants.TokenType.ERC20) {
      dispatch(walletActions.setSelectedToken({ token: null, address }))
    }
    if (tabList.find(t => t.key === action)) {
      setSection(undefined)
      setActiveTab(action)
      return
    }
    setSection(action)

    // Reset TOP input boxes on location change to make sure the input boxes are cleared.
    resetOtp()
  }, [location])

  const showTab = (tab) => { history.push(Paths.showAddress(oneAddress, tab)) }
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
  const [otp2Input, setOtp2Input] = useState('')
  const otpRef = useRef()
  const otp2Ref = useRef()

  useEffect(() => {
    // Focus on OTP 2 input box when first OTP input box is filled.
    if (otpInput.length === 6 && wallet.doubleOtp) {
      // For some reason if the OTP input never been focused or touched by user before, it cannot be focused
      // to index 0 programmatically, however focus to index 1 is fine. So as a workaround we focus on next input first then focus to
      // index 0 box. Adding setTimeout 0 to make focus on index 0 run asynchronously, which gives browser just enough
      // time to react the previous focus before we set the focus on index 0.
      otp2Ref?.current?.focusNextInput()
      setTimeout(() => otp2Ref?.current?.focusInput(0), 0)
    }
  }, [otpInput])

  const {
    balance: transferAmount,
    fiatFormatted: transferFiatAmountFormatted
  } = util.toBalance(inputAmount || 0, price, selectedTokenDecimals)
  // console.log(transferAmount.toString(), selectedTokenDecimals)

  const useMaxAmount = () => {
    if (util.isNFT(selectedToken)) {
      setInputAmount(selectedTokenBalance.toString())
      return
    }
    if (new BN(selectedTokenBalance, 10).gt(new BN(dailyLimit, 10))) {
      setInputAmount(dailyLimitFormatted)
    } else {
      setInputAmount(formatted)
    }
  }

  const resetOtp = () => {
    setOtpInput('')
    setOtp2Input('')
    otpRef?.current?.focusInput(0)
  }

  const restart = () => {
    setStage(-1)
    resetOtp()
    setInputAmount(0)
  }

  // otp, wallet, layers, commitHashGenerator, commitHashArgs,
  //   beforeCommit, afterCommit, onCommitError, onCommitFailure,
  //   revealAPI, revealArgs, onRevealFailure, onRevealSuccess, onRevealError, onRevealAttemptFailed,
  //   beforeReveal

  const prepareValidation = ({ checkAmount = true, checkDest = true, checkOtp = true } = {}) => {
    let rawAmount
    const otp = util.parseOtp(otpInput)
    const otp2 = util.parseOtp(otp2Input)
    const invalidOtp = !otp
    const invalidOtp2 = wallet.doubleOtp && !otp2
    // Ensure valid address for both 0x and one1 formats
    const dest = util.safeExec(util.normalizedAddress, [transferTo], handleAddressError)
    if (checkDest && !dest) {
      return
    }

    if (checkAmount) {
      if (selectedToken && util.isNFT(selectedToken)) {
        try {
          rawAmount = new BN(inputAmount)
        } catch (ex) {
          console.error(ex)
          message.error('Amount cannot be parsed')
          return
        }
        if (rawAmount.isZero() || rawAmount.isNeg()) {
          return message.error('Amount is invalid')
        }
      } else if (!transferAmount || transferAmount.isZero() || transferAmount.isNeg()) {
        return message.error('Transfer amount is invalid')
      }
    }

    if (checkOtp && (invalidOtp || invalidOtp2)) {
      message.error('Google Authenticator code is not valid', 10)
      resetOtp()
      return
    }

    return {
      otp,
      otp2,
      dest,
      invalidOtp,
      invalidOtp2,
      amount: selectedToken && util.isNFT(selectedToken) ? rawAmount.toString() : transferAmount.toString()
    }
  }

  const onCommitError = (ex) => {
    Sentry.captureException(ex)
    console.error(ex)
    message.error('Failed to commit. Error: ' + ex.toString())
    setStage(-1)
    resetOtp()
  }

  const onCommitFailure = (error) => {
    message.error(`Cannot commit transaction. Reason: ${error}`)
    setStage(-1)
    resetOtp()
  }

  const onRevealFailure = (error) => {
    message.error(`Transaction Failed: ${error}`)
    setStage(-1)
    resetOtp()
  }

  const onRevealError = (ex) => {
    Sentry.captureException(ex)
    message.error(`Failed to finalize transaction. Error: ${ex.toString()}`)
    setStage(-1)
    resetOtp()
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
    setTimeout(restart, 3000)
  }

  const prepareProofFailed = () => {
    setStage(-1)
    resetOtp()
    resetWorkerPromise(worker)
  }

  const doSend = () => {
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation() || {}

    if (invalidOtp || !dest || invalidOtp2) return

    const recoverRandomness = async (args) => {
      worker && worker.postMessage({
        action: 'recoverRandomness',
        ...args
      })
      return workerRef.promise
    }

    if (selectedToken.key === 'one') {
      SmartFlows.commitReveal({
        wallet,
        otp,
        otp2,
        recoverRandomness,
        prepareProofFailed,
        commitHashGenerator: ONE.computeTransferHash,
        commitHashArgs: { dest, amount },
        prepareProof: () => setStage(0),
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
    } else {
      SmartFlows.commitReveal({
        wallet,
        otp,
        otp2,
        recoverRandomness,
        prepareProofFailed,
        commitHashGenerator: ONE.computeTokenOperationHash,
        commitHashArgs: { dest, amount, operationType: ONEConstants.OperationType.TRANSFER_TOKEN, tokenType: selectedToken.tokenType, contractAddress: selectedToken.contractAddress, tokenId: selectedToken.tokenId },
        beforeCommit: () => setStage(1),
        afterCommit: () => setStage(2),
        onCommitError,
        onCommitFailure,
        revealAPI: api.relayer.revealTokenOperation,
        revealArgs: { dest, amount, operationType: ONEConstants.OperationType.TRANSFER_TOKEN, tokenType: selectedToken.tokenType, contractAddress: selectedToken.contractAddress, tokenId: selectedToken.tokenId },
        onRevealFailure,
        onRevealError,
        onRevealAttemptFailed,
        onRevealSuccess: (txId) => {
          onRevealSuccess(txId)
          Chaining.refreshTokenBalance({ dispatch, address, token: selectedToken })
        }
      })
    }
  }

  const doRecovery = async () => {
    let { hash, bytes } = ONE.computeRecoveryHash({ hseed: ONEUtil.hexToBytes(wallet.hseed) })
    if (!(wallet.majorVersion >= 8)) {
      // contracts <= v7 rely on paramsHash = bytes32(0) for recover, so we must handle this special case here
      hash = new Uint8Array(32)
    }
    const eotpBuilder = wallet.majorVersion >= 8 ? EotpBuilders.recovery : EotpBuilders.legacyRecovery
    const data = ONEUtil.hexString(bytes)
    SmartFlows.commitReveal({
      wallet,
      eotpBuilder,
      index: -1,
      commitHashGenerator: () => ({ hash, bytes: new Uint8Array(0) }), // Only legacy committer uses `bytes`. It mingles them with other parameters to produce hash. legacy recover has no parameters, therefore `bytes` should be empty byte array
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      onCommitError,
      onCommitFailure,
      revealAPI: api.relayer.revealRecovery,
      revealArgs: { data },
      onRevealFailure,
      onRevealError,
      onRevealAttemptFailed,
      onRevealSuccess
    })
  }

  const doSetRecoveryAddress = async () => {
    const { otp, otp2, invalidOtp2, invalidOtp, dest } = prepareValidation({ checkAmount: false }) || {}
    if (invalidOtp || !dest || invalidOtp2) return

    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
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
      <WalletAddress
        wallet={wallet}
        network={network}
        isMobile={isMobile}
      />
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
        <Col> <Text>{humanizeDuration(wallet.duration + wallet.effectiveTime - Date.now(), { units: ['y', 'mo', 'd'], round: true })}</Text> </Col>
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
      {wallet.majorVersion &&
        <TallRow align='middle'>
          <Col span={isMobile ? 24 : 12}> <Title level={3}>Wallet Version</Title></Col>
          <Col>
            <Text>{wallet.majorVersion}.{wallet.minorVersion}</Text>
          </Col>
        </TallRow>}
      <Row style={{ marginTop: 24 }}>
        <Popconfirm title='Are you sure？' onConfirm={onDeleteWallet}>
          <Button type='primary' shape='round' danger size='large' icon={<DeleteOutlined />}>Delete locally</Button>
        </Popconfirm>
      </Row>
    </>
  )
  const RecoverWallet = () => {
    return (
      <>
        <TallRow align='middle'>
          <Col span={isMobile ? 24 : 12}> <Title level={3}>Recovery Address</Title></Col>
          {lastResortAddress && !util.isEmptyAddress(lastResortAddress) &&
            <Col>
              <Space>
                <WalletAddress
                  wallet={wallet}
                  network={network}
                  isMobile={isMobile}
                  addressOverride={oneLastResort}
                  shortAddress
                />
              </Space>
            </Col>}
          {!(lastResortAddress && !util.isEmptyAddress(lastResortAddress)) &&
            <Col>
              <Button type='primary' size='large' shape='round' onClick={showSetRecoveryAddress}> Set </Button>
            </Col>}
        </TallRow>
        <Row style={{ marginTop: 48 }}>
          <Button type='primary' size='large' shape='round' onClick={showRecovery} icon={<WarningOutlined />}>Recover funds</Button>
        </Row>
      </>
    )
  }
  const selectedTokenBech32Address = util.safeOneAddress(selectedToken.contractAddress)
  const WalletBalance = () => (
    <>
      {selectedToken.key !== 'one' &&
        <Row style={{ marginTop: 16 }}>
          <Space size='large' align='baseline'>
            <Title level={3}>{selectedToken.name}</Title>
            <ExplorerLink style={{ opacity: 0.5 }} copyable={{ text: selectedTokenBech32Address }} href={util.getNetworkExplorerUrl(selectedTokenBech32Address, network)}>
              {util.ellipsisAddress(selectedTokenBech32Address)}
            </ExplorerLink>
          </Space>
        </Row>}
      <Row style={{ marginTop: 16 }}>
        <Col span={isMobile ? 24 : 12}>
          <Title level={3} style={{ marginRight: 48 }}>Balance</Title>
        </Col>
        <Col>
          <Space>
            <Title level={3}>{formatted}</Title>
            <Text type='secondary'>{selectedToken.symbol}</Text>
          </Space>
        </Col>
      </Row>
      {selectedToken.key === 'one' &&
        <Row>
          <Col span={isMobile ? 24 : 12} />
          <Col>
            <Space>
              <Title level={4}>≈ ${fiatFormatted}</Title>
              <Text type='secondary'>USD</Text>
            </Space>
          </Col>
        </Row>}
      <Row style={{ marginTop: 16 }}>
        <Col span={isMobile ? 24 : 12} />
        <Col>
          <Button type='primary' size='large' shape='round' onClick={showTransfer} disabled={!util.isNonZeroBalance(selectedTokenBalance)}> Send </Button>
        </Col>
      </Row>
    </>
  )

  const { metadata } = selectedToken
  const isNFT = util.isNFT(selectedToken)
  const titleSuffix = isNFT ? 'Collectible' : `${selectedToken.name} (${selectedToken.symbol})`

  return (
    <>
      {/* <Space size='large' wrap align='start'> */}
      <AnimatedSection
        show={!section}
        title={title}
        style={{ minHeight: 320, maxWidth: 720 }}
        tabList={tabList}
        activeTabKey={activeTab}
        onTabChange={key => showTab(key)}
      >
        {walletOutdated && <Warning>Your wallet is too outdated. Please create a new wallet and move your friends.</Warning>}
        {util.isEmptyAddress(wallet.lastResortAddress) && <Warning>You haven't set your recovery address. Please do it as soon as possible.</Warning>}
        {ONEUtil.getVersion(wallet) === '8.0' && !wallet.doubleOtp &&
          <Warning>
            DO NOT use this version of the wallet. Funds may be unspendable and unrecoverable. Please create a new wallet. Learn more at <Link href='https://github.com/polymorpher/one-wallet/issues/72' target='_blank' rel='noreferrer'>https://github.com/polymorpher/one-wallet/issues/72</Link>
          </Warning>}

        {activeTab === 'about' && <AboutWallet />}
        {activeTab === 'coins' && <WalletBalance />}
        {activeTab === 'coins' && <ERC20Grid address={address} />}
        {activeTab === 'nft' && <NFTGrid address={address} />}
        {activeTab === 'help' && <RecoverWallet />}

      </AnimatedSection>
      <AnimatedSection
        style={{ width: 720 }}
        show={section === 'transfer'} title={<Title level={2}>Send: {titleSuffix}</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={showStats} />
        ]}
      >
        <Space direction='vertical' size='large'>
          {isNFT && <Title level={4}>{metadata?.displayName}</Title>}
          <Space align='baseline' size='large'>
            <Label><Hint>To</Hint></Label>
            <AddressInput
              addressValue={transferTo}
              setAddressCallback={(value) => setTransferTo(value)}
              currentWallet={wallet}
              knownAddressKey={WalletConstants.knownAddressKeys.Transfer}
            />
          </Space>
          <Space align='baseline' size='large'>
            <Label><Hint>Amount</Hint></Label>
            <InputBox margin='auto' width={200} value={inputAmount} onChange={({ target: { value } }) => setInputAmount(value)} />
            {!isNFT && <Hint>{selectedToken.symbol}</Hint>}
            <Button type='secondary' shape='round' onClick={useMaxAmount}>max</Button>
          </Space>
          {selectedToken.key === 'one' &&
            <Space align='end' size='large'>
              <Label><Hint /></Label>
              <Title
                level={4}
                style={{ width: 200, textAlign: 'right', marginBottom: 0 }}
              >≈ ${transferFiatAmountFormatted}
              </Title>
              <Hint>USD</Hint>
            </Space>}
          <Space align='baseline' size='large' style={{ marginTop: 16 }}>
            <Label><Hint>Code {wallet.doubleOtp ? '1' : ''}</Hint></Label>
            <OtpBox
              ref={otpRef}
              value={otpInput}
              onChange={setOtpInput}
            />
            <Tooltip title={`from your Google Authenticator, i.e. ${wallet.name}`}>
              <QuestionCircleOutlined />
            </Tooltip>
          </Space>
          {
            wallet.doubleOtp
              ? (
                <Space align='baseline' size='large' style={{ marginTop: 16 }}>
                  <Label><Hint>Code 2</Hint></Label>
                  <OtpBox
                    ref={otp2Ref}
                    value={otp2Input}
                    onChange={setOtp2Input}
                  />
                  <Tooltip title={`from your Google Authenticator, i.e. ${wallet.name} (2nd)`}>
                    <QuestionCircleOutlined />
                  </Tooltip>
                </Space>
                )
              : <></>
          }
        </Space>
        <Row justify='end' style={{ marginTop: 24 }}>
          <Space>
            {stage >= 0 && stage < 3 && <LoadingOutlined />}
            {stage === 3 && <CheckCircleOutlined />}
            <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doSend}>Send</Button>
          </Space>
        </Row>
        <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
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
              <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doRecovery}>Sounds good!</Button>
            </Row>
            <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
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
            <AddressInput
              addressValue={transferTo}
              setAddressCallback={(value) => setTransferTo(value)}
              currentWallet={wallet}
              knownAddressKey={WalletConstants.knownAddressKeys.Recovery}
            />
          </Space>
          <Space align='baseline' size='large' style={{ marginTop: 16 }}>
            <Label><Hint>Code {wallet.doubleOtp ? '1' : ''}</Hint></Label>
            <OtpBox
              ref={otpRef}
              value={otpInput}
              onChange={setOtpInput}
            />
            <Tooltip title={`from your Google Authenticator, i.e. ${wallet.name}`}>
              <QuestionCircleOutlined />
            </Tooltip>
          </Space>
          {
            wallet.doubleOtp
              ? (
                <Space align='baseline' size='large' style={{ marginTop: 16 }}>
                  <Label><Hint>Code 2</Hint></Label>
                  <OtpBox
                    ref={otp2Ref}
                    value={otp2Input}
                    onChange={setOtp2Input}
                  />
                  <Tooltip title={`from your Google Authenticator, i.e. ${wallet.name} (2nd)`}>
                    <QuestionCircleOutlined />
                  </Tooltip>
                </Space>
                )
              : <></>
          }
        </Space>
        <Row justify='end' style={{ marginTop: 24 }}>
          <Space>
            {stage >= 0 && stage < 3 && <LoadingOutlined />}
            <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doSetRecoveryAddress}>Set</Button>
          </Space>
        </Row>
        <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
      </AnimatedSection>
    </>
  )
}

export default Show
