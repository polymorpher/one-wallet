import util, { useWindowDimensions } from '../util'
import { useDispatch, useSelector } from 'react-redux'
import querystring from 'query-string'
import React, { useEffect, useState } from 'react'
import { Button, Row, Space, Typography, message, Select, Image, Spin, Col } from 'antd'
import ONEUtil from '../../../lib/util'
import storage from '../storage'
import walletActions from '../state/modules/wallet/actions'
import Paths from '../constants/paths'
import WalletConstants from '../constants/wallet'
import { api } from '../../../lib/api'
import AnimatedSection from '../components/AnimatedSection'
import AddressInput from '../components/AddressInput'
import { Hint, InputBox, Label } from '../components/Text'
import BN from 'bn.js'
import ShowUtils from './Show/show-util'
import WalletAddress from '../components/WalletAddress'
import { GridItem, useMetadata, useNFTs, useTokenBalanceTracker } from '../components/NFTGrid'
import ReactPlayer from 'react-player'
import { FallbackImage } from '../constants/ui'
import ONEConstants from '../../../lib/constants'
import { isEqual } from 'lodash'
const { Title, Text, Link } = Typography

const RedPacketTitle = ({ isMobile, address }) => {
  return (
    <Space size={isMobile ? 'small' : 'large'} align='baseline' direction={isMobile ? 'vertical' : 'horizontal'}>
      <Title level={isMobile ? 4 : 2}><span role='img'>🧧</span> Red Packet</Title>
      <WalletAddress address={address} shorten />
    </Space>
  )
}

const UnwrapNFTGridItem = ({ isMobile, balance, name, symbol, uri, contractAddress, tokenType, style, onClick, selected }) => {
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
              src={animationUrl ? util.replaceIPFSLink(animationUrl) : util.replaceIPFSLink(metadata?.image)}
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
              onClick={() => onClick(key)}
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

  const dispatch = useDispatch()
  const { isMobile } = useWindowDimensions()
  const price = useSelector(state => state.wallet.price)
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const balances = useSelector(state => state.wallet.balances)
  const [seed, setSeed] = useState()
  const [address, setAddress] = useState()
  const [randomFactor, setRandomFactor] = useState(1)
  const [error, setError] = useState()
  const wallet = wallets[address]
  const balance = balances[address] || 0
  const { formatted, fiatFormatted } = util.computeBalance(balance, price)
  const firstWallet = Object.keys(wallets).map((address) => wallets[address])
    .find((wallet) => util.safeOneAddress(wallet.address) && wallet.network === network && !wallet.temp)
  const defaultDest = firstWallet && { value: firstWallet.address, label: `(${firstWallet.name}) ${util.ellipsisAddress(util.safeOneAddress(firstWallet.address))}` }
  const [dest, setDest] = useState(defaultDest)
  const [nonce, setNonce] = useState(defaultDest)
  const [spendingAmount, setSpendingAmount] = useState()
  const [lastSpendingInterval, setLastSpendingInterval] = useState()
  const maxAmount = wallet ? util.getMaxSpending({ ...wallet, spendingAmount, lastSpendingInterval }) : new BN(0)
  const { formatted: maxAmountFormatted } = util.computeBalance(maxAmount.toString())
  const minAmount = wallet?.spendingLimit ? new BN(wallet.spendingLimit || 0).divn(randomFactor) : new BN(0)
  const { formatted: minAmountFormatted } = util.computeBalance(minAmount.toString())
  const spendingLimitAmount = wallet?.spendingLimit || new BN(0)
  const { formatted: spendingLimitAmountFormatted } = util.computeBalance(spendingLimitAmount)
  const [now, setNow] = useState(Date.now())

  const { nfts, nftMap, loaded } = useNFTs({ address })
  useTokenBalanceTracker({ tokens: nfts, address })
  const tokenBalances = wallet.tokenBalances || {}
  const [selected, setSelected] = useState()

  const [stage, setStage] = useState(-1)
  const operationInterval = 30
  const spendingInterval = Math.floor(wallet.spendingInterval / 1000 || operationInterval)

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
      const nonce = await api.blockchain.getNonce({ address })
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
            data: {
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
            },
            _merge: true
          }
          dispatch(walletActions.updateWallet(wallet))
          dispatch(walletActions.fetchBalance({ address }))
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
    console.log(123)
  }

  if (error) {
    return (
      <AnimatedSection show style={{ maxWidth: 640 }}>
        <Text style={{ marginTop: 32 }}>{error}</Text>
      </AnimatedSection>
    )
  }
  if (!wallet) {
    return (
      <AnimatedSection show style={{ maxWidth: 640 }}>
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

  return (
    <AnimatedSection show style={{ maxWidth: 640 }} title={<RedPacketTitle isMobile={isMobile} address={address} />}>
      <Row style={{ marginTop: 16, width: '100%' }}>
        <Space direction='vertical' style={{ width: '100%' }} size='large'>
          <Space direction='vertical' style={{ width: '100%', textAlign: 'center' }}>
            <Space>
              <Title level={3}>{formatted}</Title>
              <Text type='secondary'>ONE</Text>
              <Hint>≈ ${fiatFormatted} USD</Hint>
            </Space>
            <Text>left to be claimed</Text>
          </Space>
          <UnwrapNFTGrid nfts={nfts} isMobile={isMobile} selected={selected} onClick={(key) => setSelected(key)} tokenBalances={tokenBalances} />
          <Space direction='vertical' size='small'>
            <Hint>Which wallet are you claiming it to?</Hint>
            <AddressInput
              addressValue={dest}
              setAddressCallback={setDest}
              currentWallet={wallet}
            />
            <Hint>Don't have 1wallet? <Link href={Paths.create}>Create now</Link></Hint>
          </Space>
          <Row justify='center' style={{ width: '100%' }}>
            <Space direction='vertical' style={{ textAlign: 'center' }}>
              <Button size='large' type='primary' shape='round' onClick={doClaim} disabled={nonce > 0 || stage >= 0 || !maxAmount.gt(0)}>
                Claim Your Share
              </Button>
              <Hint>{claimText}</Hint>
            </Space>
          </Row>
          {nonce > 0 && <Text>Someone just claimed from this red packet. Please wait for ~{operationInterval - Math.floor(now / 1000) % operationInterval} seconds</Text>}
          {showNextClaim &&
            <>
              <Text>Next claim: in {spendingInterval - Math.floor(now / 1000) % (spendingInterval)} seconds. </Text>
              <Text>Maximum amount: up to {spendingLimitAmountFormatted} ONE</Text>
            </>}
        </Space>
      </Row>
    </AnimatedSection>
  )
}

export default Unwrap
