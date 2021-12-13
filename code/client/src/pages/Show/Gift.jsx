import { useSelector } from 'react-redux'
import React, { useEffect, useState } from 'react'
import { Button, Row, Space, Typography, Select, Image, Tooltip } from 'antd'
import {
  CloseOutlined,
  CloseCircleOutlined,
  PlusCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons'
import { Hint, InputBox, Label } from '../../components/Text'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import AnimatedSection from '../../components/AnimatedSection'
import util, { generateOtpSeed, useWindowDimensions } from '../../util'
import BN from 'bn.js'
import ShowUtils from './show-util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import ONEUtil from '../../../../lib/util'
import { api } from '../../../../lib/api'
import ONEConstants from '../../../../lib/constants'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import humanizeDuration from 'humanize-duration'
import { useMetadata, useNFTs, useTokenBalanceTracker } from '../../components/NFTGrid'
import { TallRow } from '../../components/Grid'
import WalletConstants from '../../constants/wallet'
import { handleAPIError } from '../../handler'
import WalletCreateProgress from '../../components/WalletCreateProgress'
import config from '../../config'
import qrcode from 'qrcode'
const { Title, Text, Link } = Typography

const Share = ({ seed, redPacketAddress, address, network, isMobile, onClose, message, randomFactor }) => {
  const [qrCodeData, setQRCodeData] = useState()
  const [url, setUrl] = useState()
  useEffect(() => {
    const settings = { seed: ONEUtil.hexString(seed), address: redPacketAddress, network, r: randomFactor }
    if (message) {
      settings.m = message
    }
    const b64 = Buffer.from(JSON.stringify(settings)).toString('base64')
    const url = `${config.rootUrl}/unwrap?data=${encodeURIComponent(b64)}`
    setUrl(url)
    qrcode.toDataURL(url, { errorCorrectionLevel: 'low', width: isMobile ? 192 : 256 })
      .then(data => setQRCodeData(data)).catch(ex => {
        console.error(ex)
        message.error('Something went wrong with generating QR code for red packet')
      })
  }, [])
  return (
    <Row justify='center'>
      <Space direction='vertical' style={{ alignItems: 'center' }}>
        <Title level={2}>Your red packet is ready!</Title>
        <Text>Share the QR code or the link below. Anyone with the link or the code can claim the red packet.</Text>
        {!qrCodeData && <Text>Generating QR Code...</Text>}
        <Image
          src={qrCodeData}
          preview={false}
          width={isMobile ? 192 : 256}
        />
        {url && <Link href={url} target='_blank' copyable rel='noreferrer' ellipsis style={{ width: 256 }}>{url}</Link>}
        <Button type='primary' shape='round' style={{ marginTop: 32 }} onClick={() => onClose && onClose()}>Make Another</Button>
      </Space>
    </Row>
  )
}

const SimpleNFTRow = ({ isMobile, nft, amount, balance, onClick, onAmountChange, onDelete }) => {
  const { displayName } = useMetadata(nft)
  if (!nft || !displayName) {
    return <></>
  }
  return (
    <Space onClick={onClick} style={{ width: '100%', flexWrap: 'wrap' }}>
      {!onAmountChange && amount !== undefined && <Hint>{amount} × </Hint>}
      {onAmountChange && <><InputBox $decimal margin='auto' style={{ borderBottom: '1px solid black' }} width={64} value={amount} onChange={({ target: { value } }) => onAmountChange(value)} /> <Hint> × </Hint> </>}
      <Text>{displayName}</Text>
      {onDelete && <CloseCircleOutlined style={{ marginLeft: 32 }} onClick={onDelete} />}
      {amount !== undefined && balance !== undefined && !(balance.gte(new BN(amount))) && <Text type='danger'>Insufficient Balance</Text>}
    </Space>
  )
}
const sections = {
  prepare: 0,
  share: 1
}
const Gift = ({
  address,
  onSuccess, // optional
  prefilledTotalAmount, // string, ONE
  prefilledClaimLimit, // string, ONE
  prefilledClaimInterval // int, non-zero
}) => {
  const { isMobile } = useWindowDimensions()
  const price = useSelector(state => state.wallet.price)
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const balances = useSelector(state => state.balance)
  const wallet = wallets[address] || {}
  const [stage, setStage] = useState(-1)
  const doubleOtp = wallet.doubleOtp
  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input, resetOtp } = otpState

  const [section, setSection] = useState(sections.prepare)
  const [editingSetting, setEditingSetting] = useState(false)
  const [randomFactor, setRandomFactor] = useState(2)
  const [message, setMessage] = useState()
  const { tokenBalances = {} } = balances[address]

  const [totalAmountInput, setTotalAmountInput] = useState(prefilledTotalAmount || 3) // ONEs, string
  const [claimLimitInput, setClaimLimitInput] = useState(prefilledClaimLimit || 1) // ONEs, string
  const [claimInterval, setClaimInterval] = useState(prefilledClaimInterval || 60) // seconds, int
  const [selectedNFTs, setSelectedNFTs] = useState([])
  const { nfts, nftMap, loaded } = useNFTs({ address })
  useTokenBalanceTracker({ tokens: nfts, address })
  const [nftAmounts, setNftAmounts] = useState([])
  const {
    balance: transferAmount,
    fiatFormatted: transferFiatAmountFormatted
  } = util.toBalance(totalAmountInput || 0, price)

  // generated stuff
  const [confirmedMakingPacket, setConfirmedMakingPacket] = useState(false)
  const [deploying, setDeploying] = useState(false)
  const [seed] = useState(generateOtpSeed())
  const [layers, setLayers] = useState()
  const [root, setRoot] = useState()
  const [worker, setWorker] = useState()
  const [slotSize] = useState(1)
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const [redPacketAddress, setRedPacketAddress] = useState() // '0x12345678901234567890'
  const [effectiveTime, setEffectiveTime] = useState()

  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { prepareValidation, onRevealSuccess, ...handlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker })

  useEffect(() => {
    const worker = new Worker('/ONEWalletWorker.js')
    worker.onmessage = async (event) => {
      const { status, current, total, stage, result } = event.data
      if (status === 'working') {
        // console.log(`Completed ${(current / total * 100).toFixed(2)}%`)
        setProgress(Math.round(current / total * 100))
        setProgressStage(stage)
      }
      if (status === 'done') {
        const { root, layers } = result
        setLayers(layers)
        setRoot(root)
      }
    }
    setWorker(worker)
  }, [])

  useEffect(() => {
    const f = async () => {
      if (!root || !layers) {
        return
      }
      try {
        const { address: newAddress } = await api.relayer.create({
          root: ONEUtil.hexString(root),
          height: layers.length,
          interval: WalletConstants.interval / 1000,
          t0: effectiveTime / WalletConstants.interval,
          lifespan: WalletConstants.redPacketDuration / WalletConstants.interval,
          slotSize,
          lastResortAddress: address,
          spendingLimit: ONEUtil.toFraction(claimLimitInput).toString(),
          spendingInterval: claimInterval,
        })
        setRedPacketAddress(newAddress)
      } catch (ex) {
        handleAPIError(ex)
        setConfirmedMakingPacket(false)
      }
      setDeploying(false)
    }
    f()
  }, [root, layers, claimLimitInput, claimInterval])

  useEffect(() => {
    if (confirmedMakingPacket && worker) {
      setDeploying(true)
      // console.log('Posting to worker. Security parameters:', securityParameters)
      const t = Math.floor(Date.now() / WalletConstants.interval) * WalletConstants.interval
      setEffectiveTime(t)
      worker && worker.postMessage({
        seed,
        effectiveTime: t,
        duration: WalletConstants.redPacketDuration,
        slotSize,
        interval: WalletConstants.interval,
        randomness: 0,
        hasher: 'sha256'
      })
    }
  }, [confirmedMakingPacket, worker])

  const createRedPacket = () => {
    if (!redPacketAddress) {
      message.error('INTERNAL ERROR: must make red packet 1wallet first')
      return
    }
    const { otp, otp2, invalidOtp2, invalidOtp, amount: totalAmount } = prepareValidation({ state: { otpInput, otp2Input, doubleOtp, transferAmount }, checkDest: false }) || {}
    if (invalidOtp || invalidOtp2) return
    const { spendingLimit, valid: spendingLimitValid } = util.toBalance(claimLimitInput)
    if (!spendingLimitValid || !(new BN(spendingLimit).gt(0))) {
      message.error('Invalid spending limit')
      return
    }
    if (!(claimInterval > 0)) {
      message.error('Invalid claim interval')
      return
    }
    for (let i = 0; i < selectedNFTs.length; i++) {
      if (!(nftAmounts[i] > 0)) {
        message.error(`Invalid amount for collectible at position ${i} `)
        return
      }
      const tokenBalance = new BN(tokenBalances[selectedNFTs[i]])
      if (!(tokenBalance.gte(new BN(nftAmounts[i])))) {
        message.error(`Insufficient token balance at position ${i}`)
        return
      }
    }
    const calls = []
    calls.push({ method: '', amount: totalAmount, dest: redPacketAddress })
    for (let i = 0; i < selectedNFTs.length; i++) {
      const nft = nftMap[selectedNFTs[i]]
      const dest = nft.contractAddress
      if (nft.tokenType === ONEConstants.TokenType.ERC721) {
        calls.push({ dest, method: 'safeTransferFrom(address,address,uint256,bytes)', values: [address, redPacketAddress, nft.tokenId, '0x'] })
      } else if (nft.tokenType === ONEConstants.TokenType.ERC1155) {
        calls.push({ dest, method: 'safeTransferFrom(address,address,uint256,uint256,bytes)', values: [address, redPacketAddress, nft.tokenId, nftAmounts[i], '0x'] })
      } else {
        message.error(`Invalid token type ${nft.tokenType} for token at position ${i}`)
        return
      }
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
      ...handlers,
      onRevealSuccess: (txId) => {
        onRevealSuccess(txId)
        setSection(sections.share)
      }
    })
  }

  const confirmMakingRedPacket = () => {
    setConfirmedMakingPacket(true)
  }

  if (section === sections.share) {
    return (
      <>
        <Share network={network} isMobile={isMobile} address={address} redPacketAddress={redPacketAddress} seed={seed} onClose={() => setSection(sections.prepare)} randomFactor={randomFactor} message={message} />
      </>
    )
  }

  if (section === sections.prepare) {
    return (
      <>
        <Space direction='vertical' size='large'>
          <Text>Create a red packet with some ONEs and collectibles (NFTs) inside. You can share the red packet as a QR code or a link. Others can claim ONEs and collectibles in the red packet by scanning the QR code or visiting the link</Text>
          <Space align='baseline' size='large'>
            <Label ultraWide><Hint>Total Amount</Hint></Label>
            <Space direction={isMobile ? 'vertical' : 'horizontal'} align='end'>
              <InputBox
                $decimal
                margin='auto' width={200} value={totalAmountInput}
                onChange={({ target: { value } }) => setTotalAmountInput(value)}
                disabled={!!prefilledTotalAmount} suffix='ONE'
              />
              <Hint>≈ ${transferFiatAmountFormatted} USD</Hint>
            </Space>
          </Space>
          <Space align='baseline' size='large'>
            <Label ultraWide><Hint>Per Claim Limit</Hint></Label>
            <InputBox
              $decimal
              margin='auto' width={200} value={claimLimitInput}
              onChange={({ target: { value } }) => setClaimLimitInput(value)} disabled={!!prefilledClaimLimit}
              suffix='ONE'
            />
          </Space>
          <Space direction='vertical'>
            <Space align='baseline' size='large'>
              <Label ultraWide><Hint>Claim Interval</Hint></Label>
              <InputBox
                $num
                margin='auto' width={200} value={claimInterval}
                onChange={({ target: { value } }) => setClaimInterval(parseInt(value || 0))}
                disabled={!!prefilledClaimLimit} suffix='seconds'
              />
            </Space>
            {claimInterval > 60 &&
              <Row justify='end'>
                <Hint>≈ {humanizeDuration(claimInterval * 1000, { largest: 2, round: true })}</Hint>
              </Row>}
          </Space>
          <Space align='baseline' size='large' direction={isMobile ? 'vertical' : 'horizontal'}>
            <Label ultraWide><Hint>Add Collectibles</Hint></Label>
            <Space direction='vertical'>
              {selectedNFTs.map((key, i) => (
                key &&
                  <SimpleNFTRow
                    key={key}
                    balance={new BN(tokenBalances[key])}
                    nft={nftMap[key]}
                    amount={nftAmounts[i]}
                    onAmountChange={v => {
                      setNftAmounts(amounts => [...amounts.slice(0, i), parseInt(v || 0), ...amounts.slice(i + 1)])
                    }}
                    onDelete={() => {
                      setSelectedNFTs(s => [...s.slice(0, i), ...s.slice(i + 1)])
                      setNftAmounts(s => [...s.slice(0, i), ...s.slice(i + 1)])
                    }}
                  />
              ))}
              <Select
                placeholder={<Space><PlusCircleOutlined /><Hint>Add More...</Hint></Space>}
                labelInValue
                style={{
                  width: isMobile ? '100%' : 256,
                  borderBottom: '1px dashed black',
                }}
                bordered={false}
              >
                {loaded && nfts.map((nft) => {
                  const { key } = nft
                  if (!key) {
                    return undefined
                  }
                  if (selectedNFTs.includes(key)) {
                    return undefined
                  }
                  const onClick = () => {
                    if (!key) {
                      return
                    }
                    setSelectedNFTs(s => [...s, key])
                    setNftAmounts(s => [...s, 1])
                  }
                  return (
                    <Select.Option key={key} value={key}>
                      <SimpleNFTRow nft={nftMap[key]} onClick={onClick} />
                    </Select.Option>
                  )
                })}
              </Select>
            </Space>
          </Space>
          {!redPacketAddress &&
            <Row justify='space-between'>
              <Button type='link' size='large' style={{ padding: 0 }} onClick={() => setEditingSetting(!editingSetting)}>{editingSetting ? 'Close' : 'Advanced Settings'}</Button>
              <Button
                disabled={deploying} type='primary' shape='round' size='large'
                onClick={confirmMakingRedPacket}
              >Create Red Packet
              </Button>
            </Row>}
          {editingSetting &&
            <Row align='top'>
              <Space direction='vertical' size='large'>
                <Space>
                  <Label ultraWide>
                    Random Factor
                  </Label>
                  <Tooltip title='Recipients may claim a random amount of ONE between (per claim limit / random factor) and (per claim limit)  '>
                    <QuestionCircleOutlined />
                  </Tooltip>
                  <InputBox $decimal margin='auto' value={randomFactor} onChange={({ target: { value } }) => setRandomFactor(parseFloat(value || 0))} />
                </Space>
                <Space>
                  <Label ultraWide>
                    Special Message
                  </Label>
                  <Tooltip title='Custom message you want every recipient to see'>
                    <QuestionCircleOutlined />
                  </Tooltip>
                  <InputBox margin='auto' placeholder='...' value={message} onChange={({ target: { value } }) => setMessage(value)} />
                </Space>
              </Space>
            </Row>}
          {redPacketAddress &&
            <>
              <TallRow>
                <OtpStack walletName={wallet.name} doubleOtp={doubleOtp} otpState={otpState} onComplete={createRedPacket} action='confirm transfer assets' />
              </TallRow>
            </>}
          <Hint>
            The collectibles you selected plus {totalAmountInput} ONE will be transferred to the red packet. The red packet is controlled by your wallet. You can reclaim the remaining funds and collectibles at any time. The red packet will automatically expire in 5 days.
          </Hint>
          {deploying && <WalletCreateProgress
            title='Preparing red packet...' subtitle='Encrypting your red packet'
            progress={progress} isMobile={isMobile} progressStage={progressStage}
                        />}
          {redPacketAddress && <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />}
        </Space>
      </>
    )
  }
}

export default Gift

export const GiftModule = ({
  address,
  show,
  onClose, // optional
  onSuccess, // optional
  prefilledTotalAmount, // string, ONE
  prefilledClaimLimit, // string, ONE
  prefilledClaimInterval // int, non-zero
}) => {
  return (
    <AnimatedSection
      style={{ maxWidth: 720 }}
      show={show} title={<Title level={2}>Send Gift</Title>} extra={[
        <Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />
      ]}
    >
      <Gift
        address={address}
        prefilledTotalAmount={prefilledTotalAmount} prefilledClaimLimit={prefilledClaimLimit} prefilledClaimInterval={prefilledClaimInterval}
        onSuccess={onSuccess}
      />
    </AnimatedSection>
  )
}
