import { Card, Image, Row, Space, Typography, Col, Button, Carousel, Spin } from 'antd'
import message from '../message'
import { unionWith, differenceBy } from 'lodash'
import walletActions from '../state/modules/wallet/actions'
import { balanceActions } from '../state/modules/balance'
import React, { useState, useEffect } from 'react'
import { AverageRow, TallRow } from './Grid'
import { api } from '../../../lib/api'
import util, { useWindowDimensions } from '../util'
import { Warning, Heading } from './Text'
import { DefaultNFTs, MetadataURITransformer, NFTMetadataTransformer, withKeys } from './TokenAssets'
import { useDispatch, useSelector } from 'react-redux'
import ONEConstants from '../../../lib/constants'
import { FallbackImage } from '../constants/ui'
import styled from 'styled-components'
import { DeleteOutlined, LeftOutlined, PlusCircleOutlined, RightOutlined } from '@ant-design/icons'
import Paths from '../constants/paths'
import { useHistory } from 'react-router'
import ReactPlayer from 'react-player'
import WalletAddress from './WalletAddress'
import TrackNewNFT from './TrackNewNFT'
const { Text, Title } = Typography

export const GridItem = styled(Card.Grid)`
  &:hover{
    opacity: ${props => props['data-full-view'] ? 1.0 : 0.5};
  }
`
const SlickButtonFix = ({ currentSlide, slideCount, children, ...props }) => (
  <span {...props}>{children}</span>
)

export const useMetadata = ({ name, symbol, uri, contractAddress, tokenType, ipfsGateway, forcedContentType } = {}) => {
  uri = util.replaceIPFSLink(MetadataURITransformer(uri), ipfsGateway)
  const [metadata, setMetadata] = useState()
  const [imageType, setImageType] = useState(forcedContentType)

  let displayName = metadata?.name || name
  if (metadata?.properties?.collection) {
    displayName = `${metadata?.name} | ${metadata.properties.collection}`
  }

  if (symbol) {
    displayName = `${displayName} | ${symbol}`
  }

  const animationUrl = metadata?.animation_url || metadata?.properties?.animation_url
  useEffect(() => {
    const f = async function () {
      try {
        const metadata = await api.web.get({ link: uri })
        const transformed = NFTMetadataTransformer({ contractAddress, metadata })
        if (transformed.image && (transformed.image.length - transformed.image.lastIndexOf('.')) > 5 && !forcedContentType) {
          const { 'content-type': contentType } = await api.web.head({ link: util.replaceIPFSLink(transformed.image, ipfsGateway) })
          setImageType(contentType)
        }
        setMetadata(transformed)
      } catch (ex) {
        const identifier = name && symbol ? `${name} (${symbol}) (${uri})` : `${uri}`
        console.error(ex)
        message.error(`Unable to retrieve data for token ${identifier}`)
      }
    }
    f()
  }, [])
  return { metadata, imageType, displayName, animationUrl }
}

export const NFTGridItem = ({
  disabled, style, styleFullView, imageWrapperStyle, imageWrapperStyleFullView, tokenType, name, symbol, uri, contractAddress, balance, selected, onSend, tokenId, tokenKey, address, onUntrack,
  ipfsGateway, ipfsImageGateway, initFullView, forcedContentType
}) => {
  const dispatch = useDispatch()
  const { isMobile } = useWindowDimensions()
  const { metadata, imageType, displayName, animationUrl } = useMetadata({ name, symbol, uri, contractAddress, tokenType, ipfsGateway, forcedContentType })
  const [fullView, setFullView] = useState(initFullView)
  const bech32ContractAddress = util.safeOneAddress(contractAddress)
  const abbrBech32ContractAddress = util.ellipsisAddress(bech32ContractAddress)
  const hasBalance = util.isNonZeroBalance(balance)
  const [showUntrack, setShowUntrack] = useState(false)
  let displayBalance = <Text style={{ color: 'red' }}>Not Owned</Text>
  if (hasBalance) {
    if (tokenType === ONEConstants.TokenType.ERC721) {
      displayBalance = <Text style={{ color: 'purple' }}>Uniquely Owned</Text>
    } else {
      displayBalance = `Owned: ${balance}`
    }
  }
  const wrapperStyle = fullView ? imageWrapperStyleFullView : imageWrapperStyle
  const interactable = !disabled && util.isNonZeroBalance(balance)
  const imageStyle = { objectFit: 'cover', width: '100%', height: isMobile ? undefined : '100%' }

  // console.log(util.replaceIPFSLink(metadata?.image))
  return (
    <GridItem
      style={fullView ? styleFullView : style} hoverable={false}
      onClick={() => {
        !fullView && interactable && setFullView(true)
        if (!hasBalance && tokenKey) {
          dispatch(walletActions.untrackTokens({ keys: [tokenKey], address }))
          onUntrack && onUntrack([tokenKey])
        }
      }} data-full-view={fullView}
      onMouseEnter={() => { setShowUntrack(true) }}
      onMouseLeave={() => { setShowUntrack(false) }}
    >
      {showUntrack && !hasBalance && onUntrack &&
        <Row style={{
          height: '100%',
          width: '100%',
          backgroundColor: 'rgba(255,255,255,0.8)',
          position: 'absolute',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'center',
          flexDirection: 'column',
        }}
        >
          <Text style={{ textAlign: 'center' }}><DeleteOutlined style={{ fontSize: 24 }} /><br /><br />Untrack This</Text>
        </Row>}
      {!fullView &&
        <Row style={{ height: wrapperStyle.height || 'auto' }} justify='center'>
          {imageType?.startsWith('video')
            ? <ReactPlayer url={util.replaceIPFSLink(metadata?.image)} style={imageStyle} width={imageStyle.width} height={imageStyle.height || 'auto'} playing muted />
            : <Image
                preview={false}
                src={util.replaceIPFSLink(metadata?.image, ipfsImageGateway) || FallbackImage}
                fallback={FallbackImage}
                wrapperStyle={wrapperStyle}
                style={imageStyle}
              />}
        </Row>}
      {!fullView &&
        <Row justify='space-between' style={{ padding: 8 }}>
          {metadata && <Text style={{ fontSize: 12, lineHeight: '16px' }}>{displayName}</Text>}
          {!metadata &&
            <Text
              style={{ fontSize: 12 }}
              copyable={{ text: abbrBech32ContractAddress }}
            >{util.ellipsisAddress(abbrBech32ContractAddress)}
            </Text>}
          <Text style={{ fontSize: 12, lineHeight: '16px' }}>{displayBalance}</Text>
        </Row>}
      {fullView &&
        <Row style={{ height: wrapperStyle.height || 'auto' }}>
          <Carousel
            style={wrapperStyle} arrows autoplay autoplaySpeed={5000}
            prevArrow={<SlickButtonFix><LeftOutlined /></SlickButtonFix>}
            nextArrow={<SlickButtonFix><RightOutlined /></SlickButtonFix>}
          >
            {imageType?.startsWith('video')
              ? <ReactPlayer url={util.replaceIPFSLink(metadata?.image)} style={imageStyle} playing controls width={imageStyle.width} height={imageStyle.height || 'auto'} />
              : <Image
                  onClick={() => setFullView(false)}
                  preview={false} src={animationUrl ? util.replaceIPFSLink(animationUrl, ipfsImageGateway) : util.replaceIPFSLink(metadata?.image, ipfsImageGateway)} fallback={FallbackImage}
                  wrapperStyle={wrapperStyle} style={{ objectFit: 'contain', width: '100%', height: '100%' }}
                />}
          </Carousel>
        </Row>}
      {fullView && !metadata &&
        <AverageRow align='center' style={{ flexDirection: 'column', height: '100%' }}>
          <Space direction='vertical' align='center' style={{ width: '100%' }}>
            <Text>Loading...<Spin /></Text>
            <Text type='secondary'>(daVinci assets may be very slow)</Text>
            <Button onClick={() => setFullView(false)} danger type='text'>Hide</Button>
          </Space>
        </AverageRow>}
      {fullView && metadata &&
        <div style={{ padding: 16 }}>
          <Space direction='vertical' style={{ marginBottom: 16, width: '100%' }}>
            <Row justify='space-between' style={{ width: '100%' }} align='middle'>
              <Heading>{metadata.name}</Heading>
              {onSend && <Button type='primary' shape='round' size='large' onClick={() => onSend({ ...metadata, displayName })}>Send</Button>}
            </Row>

            <Text>{metadata.description}</Text>
            <AverageRow>
              <Space size='large'>
                {metadata.image && <Button type='link' href={util.replaceIPFSLink(metadata.image)} target='_blank' style={{ padding: 0 }}>Download Asset</Button>}
                {metadata.animation_url && <Button type='link' href={util.replaceIPFSLink(animationUrl)} target='_blank' style={{ padding: 0 }}>Download Animation</Button>}
              </Space>
            </AverageRow>
          </Space>
          {metadata?.properties?.collection &&
            <AverageRow align='middle'>
              <Col span={isMobile ? 24 : 12}> <Title level={3}>Collection</Title></Col>
              <Col>
                <Text>{metadata?.properties?.collection}</Text>
              </Col>
            </AverageRow>}
          {name && symbol &&
            <AverageRow align='middle'>
              <Col span={isMobile ? 24 : 12}> <Title level={3}>Part Of</Title></Col>
              <Col>
                <Space>
                  <Text>{name} ({symbol})</Text>
                </Space>
              </Col>
            </AverageRow>}
          <AverageRow align='middle'>
            <Col span={isMobile ? 24 : 12}> <Title level={3}>Your Ownership</Title></Col>
            <Col>
              <Space>
                <Text>{displayBalance}</Text>
              </Space>
            </Col>
          </AverageRow>
          {metadata?.properties?.creation_time &&
            <AverageRow align='middle'>
              <Col span={isMobile ? 24 : 12}> <Title level={3}>Created On</Title></Col>
              <Col> <Text>{new Date(metadata?.properties?.creation_time).toLocaleString()}</Text> </Col>
            </AverageRow>}
          {metadata?.properties?.artist &&
            <AverageRow align='middle'>
              <Col span={isMobile ? 24 : 12}> <Title level={3}>Creator</Title></Col>
              <Col> <Text>{metadata?.properties?.artist}</Text> </Col>
            </AverageRow>}
          <AverageRow align='middle'>
            <Col span={isMobile ? 24 : 12}> <Title level={3}>Contract</Title></Col>
            <Col> <WalletAddress address={contractAddress} /> </Col>
          </AverageRow>
          {imageType?.startsWith('video') &&
            <AverageRow justify='end'>
              <Button type='link' size='large' onClick={() => setFullView(false)}>Minimize</Button>
            </AverageRow>}
        </div>}
    </GridItem>
  )
}

export const useNFTs = ({ address, withDefault }) => {
  const wallet = useSelector(state => state.wallet.wallets[address] || {})
  const walletOutdated = !util.canWalletSupportToken(wallet)
  const trackedTokens = (wallet?.trackedTokens || []).filter(util.isNFT)
  const untrackedTokenKeys = (wallet.untrackedTokens || [])

  const [currentTrackedTokens, setCurrentTrackedTokens] = useState((trackedTokens || []).filter(e => untrackedTokenKeys.find(k => k === e.key) === undefined))
  const [tokenMap, setTokenMap] = useState({})
  const [disabled, setDisabled] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!address) {
      return
    }
    if (walletOutdated) {
      return
    }
    setDisabled(false)
    const f = async () => {
      let tts = await api.blockchain.getTrackedTokens({ address })
      if (withDefault) {
        tts = [...DefaultNFTs, ...tts]
      }
      tts = tts.filter(util.isNFT)
      tts = withKeys(tts)
      tts = unionWith(tts, trackedTokens, (a, b) => a.key === b.key)
      await Promise.all(tts.map(async tt => {
        // if (tt.name && tt.symbol && tt.uri) { return }
        try {
          const { name, symbol, uri } = await api.blockchain.getTokenMetadata(tt)
          Object.assign(tt, { name, symbol, uri })
        } catch (ex) {
          console.error(ex)
        }
      }))
      setCurrentTrackedTokens(tts)
      const map = {}
      tts.forEach(tt => {
        map[tt.key] = tt
      })
      setTokenMap(map)
      setLoaded(true)
    }
    f()
  }, [walletOutdated, address])

  return { nfts: currentTrackedTokens, nftMap: tokenMap, disabled, loaded, setCurrentTrackedTokens }
}

export const useTokenBalanceTracker = ({ tokens, address }) => {
  const dispatch = useDispatch()
  useEffect(() => {
    if (!address) {
      return
    }
    (tokens || []).forEach(tt => {
      const { tokenType, tokenId, contractAddress, key } = tt
      dispatch(balanceActions.fetchTokenBalance({ address, tokenType, tokenId, contractAddress, key }))
    })
  }, [tokens, address])
}

export const NFTGrid = ({ address, onTrackNew }) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const wallet = useSelector(state => state.wallet.wallets[address])
  const walletBalance = useSelector(state => state?.balance[address] || {})
  const selectedToken = util.isNFT(wallet.selectedToken) && wallet.selectedToken
  const tokenBalances = walletBalance.tokenBalances || {}
  const trackedTokens = (wallet.trackedTokens || []).filter(util.isNFT)
  const [showTrackNew, setShowTrackNew] = useState(false)

  const { nfts: currentTrackedTokens, disabled, setCurrentTrackedTokens } = useNFTs({ address, withDefault: true })
  useTokenBalanceTracker({ tokens: currentTrackedTokens, address })
  const { isMobile } = useWindowDimensions()

  const gridItemStyle = {
    padding: 0,
    width: isMobile ? '100%' : '296px',
    height: isMobile ? '100%' : '296px',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    cursor: 'pointer',
    color: disabled && 'grey',
    opacity: disabled && 0.5,
    position: 'relative',
  }
  const gridItemStyleFullView = {
    padding: 0,
    width: '100%',
    minHeight: '256px',
    display: 'flex',
    flexDirection: 'column',
  }
  const imageWrapperStyle = {
    height: isMobile ? 'auto' : '264px'
  }
  const imageWrapperStyleFullView = {
    maxHeight: '600px',
    width: '100%',
    cursor: 'pointer',
  }

  useEffect(() => {
    const newTokens = differenceBy(currentTrackedTokens, trackedTokens, e => e.key)
    dispatch(walletActions.trackTokens({ address, tokens: newTokens }))
  }, [currentTrackedTokens])

  const onSend = (key) => (metadata) => {
    if (!key) return
    const token = currentTrackedTokens.find(t => t.key === key)
    dispatch(walletActions.setSelectedToken({ token: { metadata, ...token }, address }))
    const oneAddress = util.safeOneAddress(address)
    history.push(Paths.showAddress(oneAddress, 'transfer'))
  }

  return (
    <>
      {disabled && <Warning style={{ marginTop: 16, marginBottom: 16 }}>Your wallet is too outdated. Please create a new wallet to use tokens or NFTs.</Warning>}
      <TallRow justify='center'>
        {currentTrackedTokens.map(tt => {
          const { name, symbol, key, uri, contractAddress, tokenType } = tt
          const balance = tokenBalances[key]
          return (
            <NFTGridItem
              address={address}
              tokenType={tokenType}
              tokenKey={key}
              imageWrapperStyle={imageWrapperStyle}
              disabled={disabled}
              selected={selectedToken.key === key}
              uri={uri}
              key={key}
              style={gridItemStyle}
              styleFullView={gridItemStyleFullView}
              imageWrapperStyleFullView={imageWrapperStyleFullView}
              name={name}
              contractAddress={contractAddress}
              symbol={symbol}
              balance={balance}
              onSend={onSend(key)}
              onUntrack={(keys) => {
                setCurrentTrackedTokens(tts => tts.filter(tt => (keys || []).find(k => k === tt.key) === undefined))
              }}
            />
          )
        })}

        <GridItem style={{ ...gridItemStyle, minHeight: 128 }} onClick={() => setShowTrackNew(true)}>
          <Text style={{ textAlign: 'center' }}><PlusCircleOutlined style={{ fontSize: 24 }} /><br /><br />Track Another</Text>
        </GridItem>
        {showTrackNew && <TrackNewNFT address={address} onClose={() => setShowTrackNew(false)} onTracked={(tt) => setCurrentTrackedTokens(tts => [...tts, tt])} />}
      </TallRow>
    </>
  )
}
