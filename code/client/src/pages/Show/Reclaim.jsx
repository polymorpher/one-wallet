import React, { useEffect, useState } from 'react'
import { Button, Row, Space, Typography, message, Col } from 'antd'
import { CheckCircleOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons'
import { Hint, Label, Warning } from '../../components/Text'
import { AverageRow } from '../../components/Grid'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { useWindowDimensions } from '../../util'
import ShowUtils from './show-util'
import { useSelector } from 'react-redux'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import ONEConstants from '../../../../lib/constants'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import querystring from 'query-string'
import { useLocation } from 'react-router'
const { Title, Text } = Typography

const LabeledRow = ({ label, ultrawide = false, isMobile, wide = !isMobile, children, labelSpan = 4, align = 'baseline' }) => {
  return (
    <AverageRow align={align}>
      <Col xs={labelSpan}>
        <Label ultrawide={ultrawide} wide={wide} style={{ fontSize: isMobile ? '12px' : undefined }}>
          <Hint>{label}</Hint>
        </Label>
      </Col>
      <Col xs={24 - labelSpan}>
        {children}
      </Col>
    </AverageRow>
  )
}

const Reclaim = ({
  address,
  show,
  onClose, // optional
  onSuccess = onClose, // optional
  prefillFrom,
}) => {
  const location = useLocation()
  const qs = querystring.parse(location.search)
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const { majorVersion } = wallet
  const network = useSelector(state => state.wallet.network)

  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const [stage, setStage] = useState(-1)

  const { resetWorker, recoverRandomness } = useRandomWorker()

  const [from, setFrom] = useState({ value: prefillFrom || qs.from || '', label: '' })
  const [trackedTokens, setTrackedTokens] = useState([])
  const [fromWallet, setFromWallet] = useState({})
  const [domain, setDomain] = useState()

  useEffect(() => {
    async function f () {
      const tts = await api.blockchain.getTrackedTokens({ address: from })
      setTrackedTokens(tts)
      const fromWallet = await api.blockchain.getWallet({ address: from })
      setFromWallet(fromWallet)
      const lookup = await api.blockchain.domain.reverseLookup({ address: from })
      setDomain(lookup)
    }
    f()
  }, [from])

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker, onSuccess })

  const doReclaim = async () => {
    const { otp, otp2, invalidOtp2, invalidOtp, dest } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo: { value: from } }, checkAmount: false, checkDest: true,
    }) || {}

    if (invalidOtp || !dest || invalidOtp2) return

    const calls = []

    // reveal(bytes32[] calldata neighbors, uint32 indexWithNonce, bytes32 eotp,
    //         OperationType operationType, TokenType tokenType, address contractAddress, uint256 tokenId, address payable dest, uint256 amount, bytes calldata data)
    //

    const method = 'reveal(bytes32[],uint32,bytes32,uint8,uint8,address,uint256,address,uint256,bytes)'
    try {
      if (domain) {
        // cause old contract to transfer domain
        const call = {
          method,
          dest,
          values: [
            [], 0, '0x', ONEConstants.OperationType.TRANSFER_DOMAIN, ONEConstants.TokenType.NONE, ONEConstants.Domain.DEFAULT_SUBDOMAIN_REGISTRAR,
            ONEUtil.hexString(ONEUtil.hexStringToBytes(ONEConstants.Domain.DEFAULT_RESOLVER, 32)),
            address,
            ONEUtil.hexString(ONEUtil.namehash(domain)),
            '0x'
          ]
        }
        calls.push(call)
      }
      if (trackedTokens.length > 0) {
        // cause old contract to transfer token
        const indices = []
        trackedTokens.forEach((t, i) => indices.push(i))
        const indicesEncodedHex = ONEUtil.abi.encodeParameters(['uint32[]'], indices)
        const call = {
          method,
          dest,
          values: [
            [], 0, '0x', ONEConstants.OperationType.RECOVER_SELECTED_TOKENS, ONEConstants.TokenType.NONE, ONEConstants.EmptyAddress,
            0,
            address,
            0,
            indicesEncodedHex
          ]
        }
        calls.push(call)
      }
    } catch (ex) {
      message.error(`Unable to encode data. Error: ${ex.toString()}`)
      console.error(ex)
      return
    }
    if (calls.length === 0) {
      message.error('Wallet has no domain or tracked token to claim. Try inspect the wallet manually if you believe untracked token is still there?')
      return
    }
    const hexData = ONEUtil.encodeMultiCall(calls)
    const args = { amount: 0, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: ONEConstants.EmptyAddress, tokenId: 1, dest: ONEConstants.EmptyAddress }

    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitHashArgs: { ...args, data: ONEUtil.hexStringToBytes(hexData) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...args, data: hexData },
      ...handlers
    })
  }
  if (!(majorVersion > 10)) {
    return (
      <AnimatedSection
        style={{ maxWidth: 720 }}
        show={show} title={<Title level={2}>Reclaim Assets</Title>} extra={[
          <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
        ]}
      >
        <Warning>Your wallet is too old. Please use a wallet that is at least version 10.1</Warning>
      </AnimatedSection>
    )
  }

  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show} title={<Title level={2}>ReclaimAssets</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        <Text>Reclaim domain, tokens, and collectibles accidentally left behind in an old wallet during an upgrade</Text>
        <LabeledRow isMobile={isMobile} label='From'>
          <AddressInput
            addressValue={from}
            setAddressCallback={setFrom}
            currentWallet={wallet}
            disabled={!!prefillFrom}
          />
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Coins'>
          <Text>{trackedTokens.filter(e => e.tokenType === ONEConstants.TokenType.ERC20).length} types tracked</Text>
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Collectibles'>
          <Text>{trackedTokens.filter(e => util.isNFT(e)).length} types tracked</Text>
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Domain'>
          <Text>{domain || 'None'}</Text>
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Version'>
          <Text>{ONEUtil.getVersion(fromWallet)}</Text>
        </LabeledRow>
      </Space>
      <Row align='middle'>
        <Col span={24}>
          <OtpStack
            walletName={wallet.name}
            doubleOtp={doubleOtp}
            otpState={otpState}
          />
        </Col>
      </Row>
      <Row justify='space-between' style={{ marginTop: 24 }}>
        <Button size='large' type='text' onClick={onClose} danger>Cancel</Button>
        <Space>
          {stage >= 0 && stage < 3 && <LoadingOutlined />}
          {stage === 3 && <CheckCircleOutlined />}
          <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doReclaim}>Confirm</Button>
        </Space>
      </Row>
      <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
    </AnimatedSection>
  )
}

export default Reclaim
