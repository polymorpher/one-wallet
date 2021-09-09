import { Card, Image, Row, Space, Typography, Col, Button, message, Carousel } from 'antd'
import { unionWith, differenceBy } from 'lodash'
import walletActions from '../state/modules/wallet/actions'
import React, { useState, useEffect } from 'react'
import { AverageRow, TallRow } from './Grid'
import { api } from '../../../lib/api'
import util, { useWindowDimensions } from '../util'
import { Warning, Heading } from './Text'
import { withKeys } from './TokenAssets'
import { useDispatch, useSelector } from 'react-redux'
import ONEConstants from '../../../lib/constants'
import { FallbackImage } from '../constants/ui'
import styled from 'styled-components'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import Paths from '../constants/paths'
import { useHistory } from 'react-router'
const { Text, Title } = Typography

const GridItem = styled(Card.Grid)`
  
  &:hover{
    opacity: ${props => props['data-full-view'] ? 1.0 : 0.5};
  }
`
const SlickButtonFix = ({ currentSlide, slideCount, children, ...props }) => (
  <span {...props}>{children}</span>
)

const NFTGridItem = ({ disabled, style, styleFullView, imageWrapperStyle, imageWrapperStyleFullView, tokenType, name, symbol, uri, contractAddress, balance, selected, onSend }) => {
  const { isMobile } = useWindowDimensions()
  const [fullView, setFullView] = useState(false)
  const bech32ContractAddress = util.safeOneAddress(contractAddress)
  const abbrBech32ContractAddress = util.ellipsisAddress(bech32ContractAddress)

  uri = util.replaceIPFSLink(uri)
  // console.log({ uri })
  const [metadata, setMetadata] = useState()
  useEffect(() => {
    const f = async function () {
      try {
        const metadata = await api.web.get({ link: uri })
        setMetadata(metadata)
      } catch (ex) {
        const identifier = name && symbol ? `${name} (${symbol}) (${uri})` : `${uri}`
        message.error(`Unable to retrieve data for token ${identifier}`)
      }
    }
    f()
  }, [])
  let displayName = metadata?.name || name
  if (metadata?.properties?.collection) {
    displayName = `${metadata?.name} | ${metadata.properties.collection}`
  }
  if (symbol) {
    displayName = `${displayName} | ${symbol}`
  }
  let displayBalance = 'No Longer Owned'
  if (util.isNonZeroBalance(balance)) {
    if (tokenType === ONEConstants.TokenType.ERC721) {
      displayBalance = <Text style={{ color: 'purple' }}>Uniquely Owned</Text>
    } else {
      displayBalance = `Owned: ${balance}`
    }
  }
  const animationUrl = metadata?.animation_url || metadata?.properties?.animation_url

  const wrapperStyle = fullView ? imageWrapperStyleFullView : imageWrapperStyle

  const interactable = !disabled && util.isNonZeroBalance(balance)

  return (
    <GridItem style={fullView ? styleFullView : style} hoverable={false} onClick={() => !fullView && interactable && setFullView(true)} data-full-view={fullView}>
      {!fullView &&
        <Row>
          <Col span={24}>
            <Image
              preview={false}
              src={util.replaceIPFSLink(metadata?.image) || FallbackImage}
              fallback={FallbackImage}
              wrapperStyle={wrapperStyle}
              style={{ objectFit: 'cover', width: '100%', height: isMobile ? undefined : '100%' }}
            />
          </Col>
        </Row>}
      {!fullView &&
        <Row justify='space-between' style={{ padding: 8 }}>
          <Col span={12}>
            {metadata && <Text style={{ fontSize: 12, lineHeight: '16px' }}>{displayName}</Text>}
          </Col>
          <Col span={12}>
            {!metadata &&
              <Text
                style={{ fontSize: 12 }}
                copyable={{ text: abbrBech32ContractAddress }}
              >{util.ellipsisAddress(abbrBech32ContractAddress)}
              </Text>}
            <Text style={{ fontSize: 12, lineHeight: '16px' }}>{displayBalance}</Text>
          </Col>
        </Row>}
      {fullView &&
        <Row style={{ height: wrapperStyle.height || 'auto' }}>
          <Carousel
            style={wrapperStyle} arrows autoplay autoplaySpeed={5000}
            prevArrow={<SlickButtonFix><LeftOutlined /></SlickButtonFix>}
            nextArrow={<SlickButtonFix><RightOutlined /></SlickButtonFix>}
          >
            <Image
              onClick={() => setFullView(false)}
              preview={false} src={util.replaceIPFSLink(metadata?.image)} fallback={FallbackImage}
              wrapperStyle={wrapperStyle} style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            />
            {animationUrl &&
              <Image
                onClick={() => setFullView(false)}
                preview={false} src={util.replaceIPFSLink(animationUrl)} fallback={FallbackImage}
                wrapperStyle={wrapperStyle} style={{ objectFit: 'contain', width: '100%', height: '100%' }}
              />}
          </Carousel>
        </Row>}
      {fullView && metadata &&
        <div style={{ padding: 16 }}>
          <Space direction='vertical' style={{ marginBottom: 16, width: '100%' }}>
            <Row justify='space-between' style={{ width: '100%' }} align='middle'>
              <Heading>{metadata.name}</Heading>
              <Button type='primary' shape='round' size='large' onClick={() => onSend({ ...metadata, displayName })}>Send</Button>
            </Row>

            <Text>{metadata.description}</Text>
            <AverageRow>
              <Space size='large'>
                {metadata.image && <Button type='link' href={util.replaceIPFSLink(metadata.image)} target='_blank' style={{ padding: 0 }}>Download Image</Button>}
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
        </div>}
    </GridItem>
  )
}

export const NFTGrid = ({ address }) => {
  const history = useHistory()
  const dispatch = useDispatch()
  const wallet = useSelector(state => state.wallet.wallets[address])
  const selectedToken = util.isNFT(wallet.selectedToken) && wallet.selectedToken
  const tokenBalances = wallet.tokenBalances || {}
  const trackedTokens = (wallet.trackedTokens || []).filter(util.isNFT)
  const walletOutdated = !util.canWalletSupportToken(wallet)
  const [currentTrackedTokens, setCurrentTrackedTokens] = useState(trackedTokens || [])
  const [disabled, setDisabled] = useState(true)
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
    opacity: disabled && 0.5
  }
  const gridItemStyleFullView = {
    padding: 0,
    width: '100%',
    // minHeight: '800px',
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
    if (walletOutdated) {
      return
    }
    setDisabled(false)
    const f = async () => {
      let tts = await api.blockchain.getTrackedTokens({ address })
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
    }
    f()
  }, [walletOutdated])

  useEffect(() => {
    (currentTrackedTokens || []).forEach(tt => {
      const { tokenType, tokenId, contractAddress, key } = tt
      dispatch(walletActions.fetchTokenBalance({ address, tokenType, tokenId, contractAddress, key }))
    })
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
              tokenType={tokenType}
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
            />
          )
        })}
      </TallRow>
    </>
  )
}
