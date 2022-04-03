import React, { useState } from 'react'
import util, { autoWalletNameHint} from '../../util'
import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import message from '../../message'
import { api } from '../../../../lib/api'
import { InputBox } from '../../components/Text'
import { NFTGridItem } from '../../components/NFTGrid'
import { TallRow } from '../../components/Grid'
import { useSelector } from 'react-redux'
import { OtpStack} from '../../components/OtpStack'
import ShowUtils from './show-util'
import ONEUtil from '../../../../lib/util'
import { SmartFlows } from '../../../../lib/api/flow'
import ONE from '../../../../lib/onewallet'
import { CommitRevealProgress } from '../../components/CommitRevealProgress'
import { useOps } from '../../components/Common'
const { Title, Text } = Typography

const DAVINCI_URL_PATTERN = /\/\/davinci.gallery\/view\/(0x[a-zA-Z0-9]+)/
const DAVINCI_CONTRACT = '0x1d89bc60cd482ddfae8208e6a14d6c185c2095a1'
const BuyDaVinci = ({ address, onSuccess, onClose }) => {
  const {
    wallet, forwardWallet, network, stage, setStage,
    resetWorker, recoverRandomness, otpState, isMobile,
  } = useOps({ address })

  const [url, setUrl] = useState('')
  const [pendingToken, setPendingToken] = useState(null)
  const price = useSelector(state => state.global.price)
  const { formatted, fiatFormatted } = util.computeBalance(pendingToken?.price?.toString() || 0, price)
  const { otpInput, otp2Input, resetOtp } = otpState
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
      forwardWallet,
      otp,
      otp2,
      recoverRandomness,
      commitHashGenerator: ONE.computeGeneralOperationHash,
      commitRevealArgs: { ...args, data: ONEUtil.hexStringToBytes(encodedData) },
      revealAPI: api.relayer.reveal,
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
          <OtpStack shouldAutoFocus walletName={autoWalletNameHint(wallet)} doubleOtp={wallet.doubleOtp} otpState={otpState} onComplete={doBuy} action='buy now' />
          <TallRow justify='space-between' style={{ marginTop: 24 }}>
            <Button size='large' type='text' onClick={reset} danger>Cancel</Button>
          </TallRow>
          <CommitRevealProgress stage={stage} />
        </>}
    </Space>
  )
}

export default BuyDaVinci
