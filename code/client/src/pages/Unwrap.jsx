import util, { useWindowDimensions } from '../util'
import { useDispatch, useSelector } from 'react-redux'
import querystring from 'query-string'
import React, { useEffect, useState } from 'react'
import { Button, Row, Space, Typography, Image, Spin } from 'antd'
import message from '../message'
import ONEUtil from '../../../lib/util'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import { balanceActions } from '../state/modules/balance'
import Paths from '../constants/paths'
import WalletConstants from '../constants/wallet'
import { api } from '../../../lib/api'
import AnimatedSection from '../components/AnimatedSection'
import AddressInput from '../components/AddressInput'
import { Hint } from '../components/Text'
import BN from 'bn.js'
import ShowUtils, { doRetire } from './Show/show-util'
import WalletAddress from '../components/WalletAddress'
import { GridItem, useMetadata, useNFTs, useTokenBalanceTracker } from '../components/NFTGrid'
import ReactPlayer from 'react-player'
import { FallbackImage } from '../constants/ui'
import ONEConstants from '../../../lib/constants'
import { SmartFlows } from '../../../lib/api/flow'
import ONE from '../../../lib/onewallet'
import { useHistory } from 'react-router'
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import humanizeDuration from 'humanize-duration'
const { Title, Text, Link } = Typography

const shortHumanizeDuration = humanizeDuration.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      y: () => 'y',
      mo: () => 'mo',
      w: () => 'w',
      d: () => 'd',
      h: () => 'h',
      m: () => 'm',
      s: () => 's',
      ms: () => 'ms',
    },
  },
})

const RedPacketTitle = ({ isMobile, address }) => {
  return (
    <Space direction='vertical'>
      <Space size={isMobile ? 'small' : 'large'} align='baseline' direction={isMobile ? 'vertical' : 'horizontal'}>
        <Title level={isMobile ? 4 : 2}><span role='img'>🧧</span> Red Packet</Title>
        <WalletAddress address={address} shorten />
      </Space>
    </Space>
  )
}

const UnwrapNFTGridItem = ({ isMobile, balance, name, symbol, uri, contractAddress, tokenType, style, onClick, selected }) => {
  // eslint-disable-next-line no-unused-vars
  const { metadata, imageType, displayName, animationUrl } = useMetadata({ name, symbol, uri, contractAddress, tokenType })
  const bech32ContractAddress = util.safeOneAddress(contractAddress)
  const abbrBech32ContractAddress = util.ellipsisAddress(bech32ContractAddress)

  let displayBalance = 'None Left'

  if (util.isNonZeroBalance(balance)) {
    if (tokenType === ONEConstants.TokenType.ERC721) {
      displayBalance = <Text style={{ color: 'purple' }}>(Unique) 1 left</Text>
    } else {
      displayBalance = `${balance} left`
    }
  }
  // console.log({ displayName, displayBalance, balance })
  const imageStyle = { objectFit: 'cover', width: '100%', height: isMobile ? undefined : '100%' }
  const wrapperStyle = { height: isMobile ? 'auto' : '224px' }
  return (
    <GridItem style={style} hoverable={false} onClick={onClick}>
      <Row style={{ ...wrapperStyle, border: selected && '2px green solid' }} justify='center'>
        {imageType?.startsWith('video')
          ? <ReactPlayer url={util.replaceIPFSLink(metadata?.image)} style={imageStyle} width={imageStyle.width} height={imageStyle.height || 'auto'} playing muted />
          : <Image
              preview={false}
              // src={animationUrl ? util.replaceIPFSLink(animationUrl) : util.replaceIPFSLink(metadata?.image)}
              src={util.replaceIPFSLink(metadata?.image)}
              fallback={FallbackImage}
              wrapperStyle={wrapperStyle}
              style={imageStyle}
            />}
      </Row>
      <Row justify='space-between' style={{ padding: 8 }}>
        {metadata && <Text style={{ fontSize: 12, lineHeight: '16px' }}>{displayName}</Text>}
        {!metadata &&
          <Text
            style={{ fontSize: 12 }}
            copyable={{ text: abbrBech32ContractAddress }}
          >{util.ellipsisAddress(abbrBech32ContractAddress)}
          </Text>}
        <Text style={{ fontSize: 12, lineHeight: '16px' }}>{displayBalance}</Text>
      </Row>
    </GridItem>
  )
}

const UnwrapNFTGrid = ({ nfts, tokenBalances, isMobile, onClick, selected }) => {
  if (!nfts || nfts.length === 0) {
    return <></>
  }

  const gridItemStyle = {
    padding: 0,
    width: isMobile ? '100%' : '256px',
    height: isMobile ? '100%' : '256px',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    cursor: 'pointer'
  }

  return (
    <Space direction='vertical'>
      <Title level={4}>Claim a collectible</Title>
      <Row justify='center' align='top'>
        {nfts.map(nft => {
          const { key, name, symbol, uri, contractAddress, tokenType } = nft
          return (
            <UnwrapNFTGridItem
              isMobile={isMobile}
              tokenType={tokenType}
              uri={uri}
              key={key}
              style={gridItemStyle}
              name={name}
              contractAddress={contractAddress}
              symbol={symbol}
              balance={tokenBalances[key] || 0}
              onClick={() => {
                if (key === selected) {
                  onClick(null)
                } else {
                  if (!new BN(tokenBalances[key]).gtn(0)) {
                    message.error('Collectible is no longer available')
                    return
                  }
                  onClick(key)
                }
              }}
              selected={selected === key}
            />
          )
        })}
      </Row>
    </Space>
  )
}

const Unwrap = () => {
  const [progress, setProgress] = useState(0)
  const [progressStage, setProgressStage] = useState(0)
  const history = useHistory()

  const dispatch = useDispatch()
  const { isMobile } = useWindowDimensions()
  const price = useSelector(state => state.global.price)
  const network = useSelector(state => state.global.network)
  const wallets = useSelector(state => state.wallet)
  const balances = useSelector(state => state.balance || {})
  const [seed, setSeed] = useState()
  const [address, setAddress] = useState()
  const [customMessage, setCustomMessage] = useState()
  const [randomFactor, setRandomFactor] = useState(1)
  const [error, setError] = useState()
  const wallet = wallets[address]
  const { balance = 0, tokenBalances = {} } = balances[address] || {}
  const { formatted, fiatFormatted } = util.computeBalance(balance, price)
  const firstWallet = Object.keys(wallets).map((address) => wallets[address])
    .find((wallet) => util.safeOneAddress(wallet.address) && wallet.network === network && !wallet.temp)
  const defaultDest = firstWallet ? { value: firstWallet.address, label: `(${firstWallet.name}) ${util.ellipsisAddress(util.safeOneAddress(firstWallet.address))}` } : { value: '', label: '' }
  const [transferTo, setTransferTo] = useState(defaultDest)
  const [nonce, setNonce] = useState(defaultDest)
  const [lastOperationTime, setLastOperationTime] = useState(defaultDest)
  const [spendingAmount, setSpendingAmount] = useState()
  const [lastSpendingInterval, setLastSpendingInterval] = useState()
  const maxAmount = BN.min(wallet ? util.getMaxSpending({ ...wallet, spendingAmount, lastSpendingInterval }) : new BN(0), new BN(balance))
  const { formatted: maxAmountFormatted } = util.computeBalance(maxAmount.toString())
  const minAmount = wallet?.spendingLimit ? new BN(wallet.spendingLimit || 0).divn(randomFactor) : new BN(0)
  const { formatted: minAmountFormatted } = util.computeBalance(minAmount.toString())
  const spendingLimitAmount = wallet?.spendingLimit || new BN(0)
  const { formatted: spendingLimitAmountFormatted } = util.computeBalance(spendingLimitAmount)
  const [now, setNow] = useState(Date.now())

  const { nfts, nftMap } = useNFTs({ address })
  useTokenBalanceTracker({ tokens: nfts, address })
  const [selected, setSelected] = useState()

  const [stage, setStage] = useState(-1)
  const operationInterval = 30
  const spendingInterval = Math.floor(wallet?.spendingInterval / 1000 || operationInterval)

  const showNextClaim = maxAmount.lt(spendingLimitAmount) || nonce > 0

  useEffect(() => {
    if (!address) {
      return
    }
    const timer = setInterval(async () => {
      const { spendingAmount, lastSpendingInterval } = await api.blockchain.getSpending({ address })
      setSpendingAmount(spendingAmount)
      setLastSpendingInterval(lastSpendingInterval)
    }, 2500)
    const timer2 = setInterval(async () => {
      const [nonce, lastOperationTime] = await Promise.all([api.blockchain.getNonce({ address }), api.blockchain.getLastOperationTime({ address })])
      setLastOperationTime(lastOperationTime)
      setNonce(nonce)
    }, 2500)
    const timer3 = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(timer)
      clearInterval(timer2)
      clearInterval(timer3)
    }
  }, [address])
  useEffect(() => {
    const qs = querystring.parse(location.search)
    const settingsJson = qs.data && Buffer.from(qs.data, 'base64').toString()
    let seed, address
    try {
      const r = JSON.parse(settingsJson)
      // console.log(r)
      address = r.address
      seed = ONEUtil.hexStringToBytes(r.seed)
      setCustomMessage(r.m)
      setSeed(seed)
      setAddress(address)
      setRandomFactor(r.r || 2)
    } catch (ex) {
      console.error(ex)
      message.error('Unable to parse URL. Please check again')
      setError('The QR Code or URL is broken. Please get a correct one from the sender.')
      return
    }
    const setupWallet = async () => {
      const {
        root,
        effectiveTime,
        duration,
        slotSize,
        lastResortAddress,
        majorVersion,
        minorVersion,
        spendingLimit,
        spendingInterval,
        spendingAmount,
        lastSpendingInterval,
      } = await api.blockchain.getWallet({ address })
      setSpendingAmount(spendingAmount)
      setLastSpendingInterval(lastSpendingInterval)
      const worker = new Worker('ONEWalletWorker.js')
      worker.onmessage = (event) => {
        const { status, current, total, stage, result } = event.data
        if (status === 'working') {
          setProgress(Math.round(current / total * 100))
          setProgressStage(stage)
        }
        if (status === 'done') {
          const { hseed, root: computedRoot, layers, error } = result
          if (error) {
            message.error('Unable to unpack the red packet')
            setError('Bad parameters are provided in the QR Code / URL. Please ask the sender to fix it.')
            return
          }
          if (!ONEUtil.bytesEqual(ONEUtil.hexToBytes(root), computedRoot)) {
            console.error('Roots are not equal', root, ONEUtil.hexString(computedRoot))
            message.error('Verification failed: incorrect secret provided')
            return
          }
          storage.setItem(root, layers)
          const wallet = {
            name: 'Red Packet ' + util.ellipsisAddress(address),
            address,
            root,
            duration,
            effectiveTime,
            lastResortAddress,
            hseed: ONEUtil.hexView(hseed),
            majorVersion,
            minorVersion,
            network,
            randomness: 0,
            hasher: 'sha256',
            spendingLimit,
            spendingInterval,
            temp: effectiveTime + duration,
            _merge: true
          }
          dispatch(walletActions.updateWallet(wallet))
          dispatch(balanceActions.fetchBalance({ address }))
          console.log('Retrieved red packet info', wallet)
          dispatch(walletActions.fetchWallet({ address }))
        }
      }
      console.log('[Unwrap] Posting to worker')
      worker && worker.postMessage({
        seed,
        effectiveTime,
        duration,
        slotSize,
        interval: WalletConstants.interval,
        randomness: 0,
        hasher: 'sha256',
      })
    }
    setupWallet().catch(ex => {
      console.error(ex)
      message.error('Unable to get red wallet information from blockchain')
      setError('Errors communicating with the blockchain. Please try again later and check your Internet connection')
    })
  }, [])

  const { prepareValidation, onRevealSuccess, ...handlers } = ShowUtils.buildHelpers({ setStage, network })
  const doClaim = () => {
    const { dest } = prepareValidation({ state: { transferTo }, checkAmount: false, checkOtp: false })
    if (!dest) {
      return
    }
    // fake random
    let amount
    if (maxAmount.gt(minAmount)) {
      amount = parseFloat(minAmountFormatted) + Math.random() * (parseFloat(maxAmountFormatted) - parseFloat(minAmountFormatted))
      amount = ONEUtil.toFraction(amount).toString()
    } else {
      amount = maxAmount.toString()
    }

    const calls = []
    calls.push({ method: '', amount, dest })
    if (selected) {
      if (!new BN(tokenBalances[selected]).gtn(0)) {
        message.error('The selected collectible is no longer available. Please unselect it')
        return
      }
      const nft = nftMap[selected]
      if (nft.tokenType === ONEConstants.TokenType.ERC721) {
        calls.push({ dest: nft.contractAddress, method: 'safeTransferFrom(address,address,uint256,bytes)', values: [address, dest, nft.tokenId, '0x'] })
      } else if (nft.tokenType === ONEConstants.TokenType.ERC1155) {
        calls.push({ dest: nft.contractAddress, method: 'safeTransferFrom(address,address,uint256,uint256,bytes)', values: [address, dest, nft.tokenId, 1, '0x'] })
      }
    }
    const hexData = ONEUtil.encodeMultiCall(calls)
    // generate otp
    const otp = ONEUtil.decodeOtp(ONEUtil.genOTP({ seed }))
    const args = { amount: 0, operationType: ONEConstants.OperationType.CALL, tokenType: ONEConstants.TokenType.NONE, contractAddress: ONEConstants.EmptyAddress, tokenId: 1, dest: ONEConstants.EmptyAddress }

    // console.log({ otp })
    SmartFlows.commitReveal({
      wallet,
      otp,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitHashArgs: { ...args, data: ONEUtil.hexStringToBytes(hexData) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...args, data: hexData },
      ...handlers,
      onRevealSuccess: (txId, messages) => {
        onRevealSuccess(txId, messages)
        message.success('Claim completed. Redirecting to your wallet...')
        history.push(Paths.showAddress(dest))
      }
    })
  }

  if (error) {
    return (
      <AnimatedSection show>
        <Text style={{ marginTop: 32 }}>{error}</Text>
      </AnimatedSection>
    )
  }
  if (!wallet) {
    return (
      <AnimatedSection show>
        <Row style={{ marginTop: 16 }} justify='center'>
          <Space direction='vertical'>
            <Space><Spin /><Text style={{ marginTop: 32 }}>Loading Red Packet....</Text></Space>
            <Text>Stage: {progressStage}/2 | Progress: {progress}/100</Text>
          </Space>
        </Row>
      </AnimatedSection>
    )
  }

  let claimText = maxAmount.gt(minAmount) ? `${minAmountFormatted} to ${maxAmountFormatted} ONE` : `${maxAmountFormatted} ONE`
  if (!maxAmount.gt(new BN(0))) {
    claimText = `${spendingLimitAmountFormatted} ONE`
  }
  if (nfts.length > 0 && selected) {
    claimText += ' and the selected collectible'
  }

  const outOfOperations = nonce > 0 && (Math.floor(now / 1000) - lastOperationTime) < 30

  const inWaitBuffer = (wallet?.majorVersion === 12) && (!(wallet?.minorVersion >= 3)) && (Math.floor(now / 1000) % 30 > 25)

  const expired = wallet.effectiveTime + wallet.duration < now

  return (
    <AnimatedSection show title={<RedPacketTitle isMobile={isMobile} address={address} />}>
      <Row style={{ marginTop: isMobile && 16, width: '100%' }}>
        <Space direction='vertical' style={{ width: '100%' }} size='large'>
          <Space size='small'><Text>Packed by</Text> <WalletAddress address={wallet?.lastResortAddress} showLabel shorten /></Space>
          {customMessage && <Row justify='center'> <Text italic>"{customMessage}"</Text></Row>}

          <Space direction='vertical' style={{ width: '100%', textAlign: 'center' }}>
            <Space>
              <Title style={{ textDecoration: expired && 'line-through' }} level={3}>{formatted}</Title>
              <Text style={{ textDecoration: expired && 'line-through' }} type='secondary'>ONE</Text>
              <Hint style={{ textDecoration: expired && 'line-through' }}>≈ ${fiatFormatted} USD</Hint>
            </Space>
            {!expired && <Text>left to be claimed</Text>}
            {expired &&
              <Space direction='vertical' size='small'>
                <Title level={3}>Expired!</Title>
                <Text>Expired on {new Date(wallet.effectiveTime + wallet.duration).toLocaleString()} :(</Text>
                {(new BN(balance).gtn(0)) && <Button shape='round' onClick={() => doRetire({ address, network })}>Return Assets</Button>}
              </Space>}
            {!expired && <Text type='secondary'>Expires in {shortHumanizeDuration(wallet.effectiveTime + wallet.duration - now, { round: true, delimiter: ' ', spacer: '' })}</Text>}

          </Space>
          <UnwrapNFTGrid nfts={nfts} isMobile={isMobile} selected={selected} onClick={(key) => setSelected(key)} tokenBalances={tokenBalances} />
          <Space direction='vertical' size='small'>
            <Hint>To which wallet?</Hint>
            <AddressInput
              addressValue={transferTo}
              setAddressCallback={setTransferTo}
              currentWallet={wallet}
            />
            <Hint>Don't have 1wallet? <Link href={Paths.create}>Create now</Link></Hint>
          </Space>
          <Row justify='center' style={{ width: '100%' }}>
            <Space direction='vertical' style={{ textAlign: 'center' }}>
              <Space>
                {stage >= 0 && stage < 3 && <LoadingOutlined />}
                {stage === 3 && <CheckCircleOutlined />}
                <Button size='large' type='primary' shape='round' onClick={doClaim} disabled={outOfOperations || stage >= 0 || inWaitBuffer || expired || !maxAmount.gt(0)}>
                  Claim Yours
                </Button>
              </Space>
              <Hint>{claimText}</Hint>
            </Space>
          </Row>
          {inWaitBuffer && !outOfOperations && <Text>Preparing for the next claim. Wait for {operationInterval - Math.floor(now / 1000) % operationInterval} seconds</Text>}
          {outOfOperations && <Text>Someone just claimed from this red packet. Please wait for ~{operationInterval - Math.floor(now / 1000) % operationInterval} seconds</Text>}
          {showNextClaim &&
            <>
              <Text>Next available claim: in {spendingInterval - Math.floor(now / 1000) % (spendingInterval)} seconds. </Text>
              <Text>Maximum amount: up to {spendingLimitAmountFormatted} ONE</Text>
            </>}
        </Space>
      </Row>
    </AnimatedSection>
  )
}

export default Unwrap
