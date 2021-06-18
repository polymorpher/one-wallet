import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useRouteMatch, Redirect, useLocation, matchPath } from 'react-router'
import Paths from '../constants/paths'
import WalletConstants from '../constants/wallet'
import walletActions from '../state/modules/wallet/actions'
import util from '../util'
import ONEUtil from '../../../lib/util'
import ONE from '../../../lib/onewallet'
import api from '../api'
import { message, Space, Row, Col, Typography, Button, Steps, Popconfirm, Tooltip } from 'antd'
import { DeleteOutlined, WarningOutlined, CloseOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import humanizeDuration from 'humanize-duration'
import AnimatedSection from '../components/AnimatedSection'

import { Hint, InputBox } from '../components/Text'
import { isInteger } from 'lodash'
import storage from '../storage'
const { Title, Text } = Typography
const { Step } = Steps
const TallRow = styled(Row)`
  margin-top: 32px;
  margin-bottom: 32px;
`

const Label = styled.div`
  width: 64px;
`

const Show = () => {
  const history = useHistory()
  const location = useLocation()
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const match = useRouteMatch(Paths.show)
  const { address, action } = match ? match.params : {}
  const selectedAddress = useSelector(state => state.wallet.selected)
  const wallet = wallets[address] || {}
  const [section, setSection] = useState(action)
  const [stage, setStage] = useState(0)

  // const section =

  useEffect(() => {
    if (!wallet) {
      return history.push(Paths.wallets)
    }
    if (address && (address !== selectedAddress)) {
      dispatch(walletActions.selectWallet(address))
    }
  }, [])
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address] || 0
  const price = useSelector(state => state.wallet.price)
  const { formatted, fiatFormatted } = util.computeBalance(balance, price)
  const { dailyLimit, lastResortAddress } = wallet
  const { formatted: dailyLimitFormatted, fiatFormatted: dailyLimitFiatFormatted } = util.computeBalance(dailyLimit, price)

  useEffect(() => {
    const m = matchPath(location.pathname, { path: Paths.show })
    const { action } = m ? m.params : {}
    setSection(action)
  }, [location])

  const showTransfer = () => { history.push(Paths.showAddress(address, 'transfer')) }
  const showRecovery = () => { history.push(Paths.showAddress(address, 'recover')) }
  const showStats = () => { history.push(Paths.showAddress(address)) }
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
    if (balance > dailyLimit) {
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
  const doSend = async () => {
    if (!transferTo) {
      return message.error('Transfer destination address is invalid')
    }
    if (!transferAmount) {
      return message.error('Transfer amount is invalid')
    }
    const parsedOtp = parseInt(otpInput)
    if (!isInteger(parsedOtp) || !(parsedOtp < 1000000)) {
      message.error('Google Authenticator code is not valid')
      return
    }
    console.log(wallet)
    const { hseed, root, effectiveTime } = wallet
    const layers = await storage.getItem(root)
    if (!layers) {
      console.log(layers)
      message.error('Cannot find pre-computed proofs for this wallet. Storage might be corrupted. Please restore the wallet from Google Authenticator.')
      return
    }

    const otp = ONEUtil.encodeNumericalOtp(parsedOtp)
    const eotp = ONE.computeEOTP({ otp, hseed: ONEUtil.hexToBytes(hseed) })
    const index = ONEUtil.timeToIndex({ effectiveTime })
    const neighbors = ONE.selectMerkleNeighbors({ layers, index })
    const neighbor = neighbors[0]
    const commitHash = ONE.computeTransferHash({
      neighbor,
      index,
      eotp,
      dest: transferTo,
      amount: transferAmount,
    })
    setStage(1)
    try {
      const commitTx = await api.relayer.commit({ address, hash: commitHash })
      console.log('commitTx', commitTx)
    } catch (ex) {
      console.error(ex)
      message.error('Failed to commit the transaction. Please try again. Error: ' + ex.toString())
      setStage(0)
      return
    }
    setStage(2)
    let numAttemptsRemaining = WalletConstants.maxTransferAttempts - 1
    const tryReveal = () => setTimeout(async () => {
      try {
        // TODO: should reveal only when commit is confirmed and viewable on-chain. This should be fixed before releasing it to 1k+ users
        const revealTx = await api.relayer.revealTransfer({
          neighbors,
          index,
          eotp,
          dest: transferTo,
          amount: transferAmount,
          address
        })
        console.log('revealTx', revealTx)
        setStage(3)
        message.success('Transfer completed! View transaction on block explorer')
      } catch (ex) {
        console.trace(ex)
        if (numAttemptsRemaining <= 0) {
          message.error('Failed to finalize transfer. Please try again later.')
          setStage(0)
          return
        }
        message.error(`Failed to finalize transfer. Trying ${numAttemptsRemaining} more time`)
        numAttemptsRemaining -= 1
        tryReveal()
      }
    }, 5000)
    tryReveal()
  }

  // UI Rendering below
  if (!wallet) {
    return <Redirect to={Paths.wallets} />
  }
  const title = (
    <Space size='large'>
      <Title level={2}>{wallet.name}</Title>
      <Hint copyable>{address}</Hint>
    </Space>
  )
  return (
    <Space size='large' wrap align='start'>
      <AnimatedSection
        show={!section}
        title={title}
        style={{ minWidth: 480, minHeight: 320 }}
      >
        <Row style={{ marginTop: 16 }}>
          <Col span={12}>
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
          <Col span={12} />
          <Col>
            <Space>
              <Title level={4}>≈ ${fiatFormatted}</Title>
              <Text type='secondary'>USD</Text>
            </Space>
          </Col>
        </Row>
        <Row style={{ marginTop: 16 }}>
          <Col span={12} />
          <Col>
            <Button type='primary' size='large' shape='round' onClick={showTransfer}> Send </Button>
          </Col>
        </Row>
        <TallRow align='middle'>
          <Col span={12}> <Title level={3}>Created On</Title></Col>
          <Col> <Text>{new Date(wallet.effectiveTime).toLocaleString()}</Text> </Col>
        </TallRow>
        <TallRow align='middle'>
          <Col span={12}> <Title level={3}>Expires In</Title></Col>
          <Col> <Text>{humanizeDuration(wallet.duration, { units: ['y', 'mo', 'd'], round: true })}</Text> </Col>
        </TallRow>
        <TallRow>
          <Col span={12}> <Title level={3}>Daily Limit</Title></Col>
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
          <Col span={12}> <Title level={3}>Recovery Address</Title></Col>
          <Col>
            <Space>
              <Tooltip title={lastResortAddress}>
                <Text copyable={lastResortAddress && { text: lastResortAddress }}>{util.ellipsisAddress(lastResortAddress) || 'Not set'}</Text>
              </Tooltip>
            </Space>
          </Col>
        </TallRow>
        <Row style={{ marginTop: 48 }}>
          <Button type='link' style={{ padding: 0 }} size='large' onClick={showRecovery} icon={<WarningOutlined />}>I lost my Google Authenticator</Button>
        </Row>
        <Row style={{ marginTop: 24 }}>
          <Popconfirm title='Are you sure？' onConfirm={onDeleteWallet}>
            <Button type='link' style={{ color: 'red', padding: 0 }} size='large' icon={<DeleteOutlined />}>Delete this wallet locally</Button>
          </Popconfirm>

        </Row>
      </AnimatedSection>
      <AnimatedSection
        style={{ minWidth: 700 }}
        show={section === 'transfer'} title={<Title level={2}>Transfer</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={showStats} />
        ]}
      >
        <Space direction='vertical' size='large'>
          <Space align='end' size='large'>
            <Label><Hint>To</Hint></Label>
            <InputBox margin='auto' width={440} value={transferTo} onChange={({ target: { value } }) => setTransferTo(value)} placeholder='0x...' />
          </Space>
          <Space align='end' size='large'>
            <Label><Hint>Amount</Hint></Label>
            <InputBox margin='auto' width={200} value={inputAmount} onChange={({ target: { value } }) => setInputAmount(value)} />
            <Hint>ONE</Hint>
            <Button type='secondary' onClick={useMaxAmount}>max</Button>
          </Space>
          <Space align='end' size='large'>
            <Label><Hint /></Label>
            <Title level={4} style={{ width: 200, textAlign: 'right', marginBottom: 0 }}>≈ ${transferFiatAmountFormatted}</Title>
            <Hint>USD</Hint>
          </Space>
          <Space align='end' size='large'>
            <Label><Hint>Code</Hint></Label>
            <InputBox margin='auto' width={96} value={otpInput} onChange={({ target: { value } }) => setOtpInput(value)} />
            <Hint>(6-digit code from Google Authenticator)</Hint>
          </Space>
        </Space>
        <Row justify='end' style={{ marginTop: 48 }}>
          {stage < 3 && <Button type='primary' size='large' shape='round' disabled={stage > 0} onClick={doSend}>Send</Button>}
          {stage === 3 && <Button type='secondary' size='large' shape='round' onClick={restart}>Restart</Button>}
        </Row>
        {stage > 0 && (
          <Row style={{ marginTop: 32 }}>
            <Steps current={stage}>
              <Step title='Prepare' description='Preparing signatures and proofs' />
              <Step title='Commit' description='Submitting transaction signature to blockchain' />
              <Step title='Finalize' description='Revealing proofs to complete transaction' />
            </Steps>
          </Row>)}
      </AnimatedSection>
      <AnimatedSection show={section === 'recover'}>
        <Text>Recover</Text>
      </AnimatedSection>
    </Space>
  )
}
export default Show
