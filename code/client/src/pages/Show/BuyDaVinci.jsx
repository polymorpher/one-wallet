import React, { useState } from 'react'
import util, { useWindowDimensions } from '../../util'
import { Button, Col, message, Row, Space, Typography } from 'antd'
import { api } from '../../../../lib/api'
import { InputBox } from '../../components/Text'
import { NFTGridItem } from '../../components/NFTGrid'
import { AverageRow, TallRow } from '../../components/Grid'
import { useSelector } from 'react-redux'
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons'
import { OtpStack, useOtpState } from '../../components/OtpStack'
import { useRandomWorker } from './randomWorker'
import ShowUtils from './show-util'
import ONEUtil from '../../../../lib/util'
import ONEConstants from '../../../../lib/constants'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
const { Title, Text } = Typography

const DAVINCI_URL_PATTERN = /\/\/davinci.gallery\/view\/(0x[a-zA-Z0-9]+)/
const DAVINCI_CONTRACT = '0x1d89bc60cd482ddfae8208e6a14d6c185c2095a1'
const BuyDaVinci = ({ address, onSuccess, onClose }) => {
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const { isMobile } = useWindowDimensions()
  const [url, setUrl] = useState('')
  const [pendingToken, setPendingToken] = useState(null)
  const price = useSelector(state => state.wallet.price)
  const { formatted, fiatFormatted } = util.computeBalance(pendingToken?.price?.toString() || 0, price)

  const { state: otpState } = useOtpState()
  const { otpInput, otp2Input } = otpState
  const resetOtp = otpState.resetOtp
  const [stage, setStage] = useState(-1)
  const { resetWorker, recoverRandomness } = useRandomWorker()
  const { prepareValidation, ...handlers } = ShowUtils.buildHelpers({ setStage, resetOtp, network, resetWorker, onSuccess })

  const doBuy = async () => {
    const { otp, otp2, invalidOtp2, invalidOtp, dest, amount } = prepareValidation({
      state: { otpInput, otp2Input, doubleOtp: wallet.doubleOtp, transferTo: { value: DAVINCI_CONTRACT }, transferAmount: pendingToken.price },
    }) || {}
    console.log({ otp, otp2, invalidOtp2, invalidOtp, dest, amount })
    if (invalidOtp || !dest || invalidOtp2) return
    let encodedData
    try {
      encodedData = ONEUtil.encodeCalldata('buy(address,address,uint256)', [pendingToken.orderId, address, 1])
    } catch (ex) {
      message.error(`Unable to encode data. Error: ${ex.toString()}`)
      console.error(ex)
      return
    }

    const args = util.callArgs({ dest, amount })
    SmartFlows.commitReveal({
      wallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitHashArgs: { ...args, data: ONEUtil.hexStringToBytes(encodedData) },
      prepareProof: () => setStage(0),
      beforeCommit: () => setStage(1),
      afterCommit: () => setStage(2),
      revealAPI: api.relayer.reveal,
      revealArgs: { ...args, data: encodedData },
      ...handlers
    })
  }

  const reset = () => {
    resetOtp()
    setUrl('')
    setPendingToken(null)
  }
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
    width: '100%',
    height: '100%',
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
    height: 'auto'
  }
  const imageWrapperStyleFullView = {
    maxHeight: '600px',
    width: '100%',
    cursor: 'pointer',
  }

  return (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Text> Paste the URL of a collectible on daVinci  </Text>
      <InputBox margin='auto' width={isMobile ? '100%' : 500} disabled={!!pendingToken} value={url} onChange={({ target: { value } }) => setUrl(value)} />
      <TallRow justify='space-between'>
        <Button size='large' type='text' onClick={onClose} danger>Go Back</Button>
        <Button onClick={checkStatus} type='primary' shape='round' size='large' disabled={!!pendingToken}>Check Status</Button>
      </TallRow>
      {pendingToken &&
        <NFTGridItem
          initFullView
          ipfsImageGateway='https://davinci.gallery/uploads/artwork/{{hash}}'
          forcedContentType='image/jpeg'
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
      {pendingToken &&
        <>
          <Row style={{ marginTop: 16 }}>
            <Col span={isMobile ? 24 : 12}>
              <Title level={3} style={{ marginRight: isMobile ? undefined : 48 }}>Price</Title>
            </Col>
            <Col span={isMobile ? 24 : 12} style={{ textAlign: isMobile ? 'center' : undefined }}>
              <Space>
                <Title level={3}>{formatted}</Title>
                <Text type='secondary'>ONE</Text>
              </Space>
            </Col>
          </Row>
          <Row style={{ textAlign: isMobile ? 'center' : undefined }}>
            {!isMobile && <Col span={isMobile ? 24 : 12} />}
            <Col span={isMobile ? 24 : 12}>
              <Space>
                <Title level={4}>≈ ${fiatFormatted}</Title>
                <Text type='secondary'>USD</Text>
              </Space>
            </Col>
          </Row>
          <OtpStack walletName={wallet.name} doubleOtp={wallet.doubleOtp} otpState={otpState} />
          <TallRow justify='space-between' style={{ marginTop: 24 }}>
            <Button size='large' type='text' onClick={reset} danger>Cancel</Button>
            <Space>
              {stage >= 0 && stage < 3 && <LoadingOutlined />}
              {stage === 3 && <CheckCircleOutlined />}
              <Button type='primary' size='large' shape='round' disabled={stage >= 0} onClick={doBuy}>Buy</Button>
            </Space>
          </TallRow>
          <CommitRevealProgress stage={stage} style={{ marginTop: 32 }} />
        </>}
    </Space>
  )
}

export default BuyDaVinci
