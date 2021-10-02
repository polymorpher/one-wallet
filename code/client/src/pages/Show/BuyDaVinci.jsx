import React, { useState } from 'react'
import { useWindowDimensions } from '../../util'
import { Button, message, Row, Space, Typography } from 'antd'
import { api } from '../../../../lib/api'
import { InputBox } from '../../components/Text'
import { NFTGridItem } from '../../components/NFTGrid'
import { TallRow } from '../../components/Grid'
const { Title, Text } = Typography

const DAVINCI_URL_PATTERN = /\/\/davinci.gallery\/view\/(0x[a-zA-Z0-9]+)/

const BuyDaVinci = ({ address }) => {
  const { isMobile } = useWindowDimensions()
  const [url, setUrl] = useState('')
  const [pendingToken, setPendingToken] = useState(null)

  const checkStatus = async () => {
    const m = url.match(DAVINCI_URL_PATTERN)
    if (!m || !m[1]) {
      message.error('URL is not regonized. It must be in the form of https://davinci.gallery/view/0x....')
      return
    }
    const tokenIdParsed = m[1]
    let token
    try {
      const { orderId, collection, tokenId, tokenType, sellPrice, buyPrice } = await api.daVinci.query(tokenIdParsed)
      token = { contractAddress: collection, tokenId, tokenType, price: sellPrice || buyPrice, orderId }
    } catch (ex) {
      console.error(ex)
      message.error('Unable to retrieve information from daVinci about this collectible')
    }
    try {
      const { name, symbol, uri } = await api.blockchain.getTokenMetadata(token)
      setPendingToken({ ...token, name, symbol, uri })
    } catch (ex) {
      console.error(ex)
      message.error('Unable to retrieve information from blockchain about this collectible')
    }
  }

  const gridItemStyle = {
    padding: 0,
    width: isMobile ? '100%' : '296px',
    height: isMobile ? '100%' : '296px',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    position: 'relative',
  }
  const gridItemStyleFullView = {
    padding: 0,
    width: '100%',
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
  console.log(pendingToken)
  return (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Text> Paste the URL of a collectible on daVinci  </Text>
      <InputBox margin='auto' width={isMobile ? '100%' : 500} disabled={!!pendingToken} value={url} onChange={({ target: { value } }) => setUrl(value)} />
      <TallRow justify='end'>
        <Button onClick={checkStatus} type='primary' shape='round' size='large' disabled={!!pendingToken}>Check Status</Button>
      </TallRow>
      {pendingToken &&
        <NFTGridItem
          ipfsImageGateway='https://davinci.gallery/uploads/artwork/{{hash}}'
          address={address}
          tokenType={pendingToken.tokenType}
          imageWrapperStyle={imageWrapperStyle}
          uri={pendingToken.uri}
          style={gridItemStyle}
          styleFullView={gridItemStyleFullView}
          imageWrapperStyleFullView={imageWrapperStyleFullView}
          name={pendingToken.name}
          contractAddress={pendingToken.contractAddress}
          symbol={pendingToken.symbol}

        />}
    </Space>
  )
}

export default BuyDaVinci
