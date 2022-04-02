import React, { useEffect, useState } from 'react'
import Button from 'antd/es/button'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import Col from 'antd/es/col'
import message from '../../message'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import { Warning, LabeledRow } from '../../components/Text'
import { AverageRow } from '../../components/Grid'
import AddressInput from '../../components/AddressInput'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { autoWalletNameHint, useWindowDimensions } from '../../util'
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
import ONENames from '../../../../lib/names'
const { Title, Text } = Typography

const Reclaim = ({
  address,
  onClose, // optional
  onSuccess = onClose, // optional
  prefillFrom,
}) => {
  const location = useLocation()

  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const { majorVersion } = wallet
  const network = useSelector(state => state.global.network)

  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp

  const [stage, setStage] = useState(-1)

  const { resetWorker, recoverRandomness } = useRandomWorker()

  const [from, setFrom] = useState({ value: prefillFrom || '', label: prefillFrom ? util.safeOneAddress(prefillFrom) : '' })
  const [trackedTokens, setTrackedTokens] = useState([])
  const [fromWallet, setFromWallet] = useState({})
  const [domain, setDomain] = useState()
  const [pending, setPending] = useState(true)
  const [addressInputDisabled, setAddressInputDisabled] = useState(!!prefillFrom)

  useEffect(() => {
    async function f () {
      if (!from.value) {
        return
      }
      setPending(true)
      const [tts, fromWallet, lookup] = await Promise.all([
        api.blockchain.getTrackedTokens({ address: from.value }),
        api.blockchain.getWallet({ address: from.value }),
        api.blockchain.domain.reverseLookup({ address: from.value })
      ])
      setTrackedTokens(tts)
      setFromWallet(fromWallet)
      setDomain(lookup)
      setPending(false)
    }
    f()
  }, [from])

  useEffect(() => {
    const qs = querystring.parse(location.search)
    if (qs.from && !prefillFrom) {
      setFrom({ value: qs.from, label: util.safeOneAddress(qs.from) })
      setAddressInputDisabled(true)
    }
  }, [location])

  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker, onSuccess })

  const doReclaim = async () => {
    if (stage >= 0) {
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, dest } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo: from }, checkAmount: false, checkDest: true,
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
        const call2 = {
          method: 'setName(string)',
          dest: ONEConstants.Domain.DEFAULT_REVERSE_REGISTRAR,
          values: [domain]
        }
        calls.push(call2)
      }
      if (trackedTokens.length > 0) {
        // cause old contract to transfer token
        const indices = []
        trackedTokens.forEach((t, i) => indices.push(i))
        const indicesEncodedHex = ONEUtil.abi.encodeParameters(['uint32[]'], [indices])
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
    const args = { ...ONEConstants.NullOperationParams, operationType: ONEConstants.OperationType.CALL, tokenId: 1 }

    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitRevealArgs: { ...args, data: ONEUtil.hexStringToBytes(hexData) },
      revealAPI: api.relayer.reveal,
      ...handlers
    })
  }
  if (!(majorVersion > 10)) {
    return (
      <AnimatedSection
        style={{ maxWidth: 720 }}
        title={<Title level={2}>Reclaim Assets</Title>} extra={[
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
      title={<Title level={2}>Reclaim Assets</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        <Text>Reclaim domain, tokens, and collectibles accidentally left behind in an old wallet during an upgrade</Text>
        <LabeledRow isMobile={isMobile} label='Claim From'>
          <AddressInput
            addressValue={from}
            setAddressCallback={setFrom}
            currentWallet={wallet}
            disabled={addressInputDisabled}
          />
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Coins' pending={pending}>
          <Text>{trackedTokens.filter(e => e.tokenType === ONEConstants.TokenType.ERC20).length} types tracked</Text>
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Collectibles' pending={pending}>
          <Text>{trackedTokens.filter(e => util.isNFT(e)).length} types tracked</Text>
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Domain' pending={pending}>
          <Text>{domain || 'None'}</Text>
        </LabeledRow>
        <LabeledRow isMobile={isMobile} label='Version' pending={pending}>
          <Text>{ONEUtil.getVersion(fromWallet)}</Text>
        </LabeledRow>
      </Space>
      <AverageRow align='middle'>
        <Col span={24}>
          <OtpStack
            shouldAutoFocus
            walletName={autoWalletNameHint(wallet)}
            doubleOtp={doubleOtp}
            otpState={otpState}
            onComplete={doReclaim}
            action='confirm'
          />
        </Col>
      </AverageRow>
      <CommitRevealProgress stage={stage} />
    </AnimatedSection>
  )
}

export default Reclaim
