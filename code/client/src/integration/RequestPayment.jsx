import { Button, message, Row, Space, Typography, Select, Col, Tooltip } from 'antd'
import BN from 'bn.js'
import AnimatedSection from '../components/AnimatedSection'
import { AverageRow } from '../components/Grid'
import { Hint } from '../components/Text'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { SearchOutlined } from '@ant-design/icons'
import util from '../util'
import WalletAddress from '../components/WalletAddress'
import Send from '../pages/Show/Send'
import { handleAddressError } from '../handler'
import { HarmonyONE } from '../components/TokenAssets'
const { Title, Text, Paragraph } = Typography
const RequestPaymennt = ({ caller, callback, amount, dest, from }) => {
  dest = util.safeNormalizedAddress(dest)
  const network = useSelector(state => state.wallet.network)
  const balances = useSelector(state => state.wallet.balances)
  const price = useSelector(state => state.wallet.price)
  const wallets = useSelector(state => state.wallet.wallets)
  const walletList = Object.keys(wallets).map(e => wallets[e]).filter(e => e.network === network)
  const selectedWallet = from && wallets[from]
  const defaultUserAddress = (walletList.length === 0 ? {} : { value: walletList[0].address, label: `(${walletList[0].name}) ${util.ellipsisAddress(util.safeOneAddress(walletList[0].address))}` })
  const [selectedAddress, setSelectedAddress] = useState(from ? (selectedWallet || {}) : defaultUserAddress)
  const { formatted: amountFormatted, fiatFormatted: amountFiatFormatted } = util.computeBalance(amount, price)
  const [showSend, setShowSend] = useState(false)
  const checkCallback = () => {
    if (!callback) {
      message.error('The app did not specify a callback URL. Please contact the app developer.')
      return false
    }
    return true
  }
  const next = () => {
    if (!selectedAddress.value) {
      return message.error('No address is selected')
    }
    const normalizedAddress = util.safeExec(util.normalizedAddress, [selectedAddress.value], handleAddressError)
    if (!normalizedAddress) {
      return message.error(`normalizedAddress=${normalizedAddress}`)
    }
    const balance = balances[selectedAddress.value]
    if (!(new BN(amount).lte(new BN(balance)))) {
      const { formatted: balanceFormatted } = util.computeBalance(balance)
      return message.error(`Insufficient balance (${balanceFormatted} ONE) in the selected wallet`)
    }
    if (!checkCallback()) return
    setShowSend(true)
  }
  const cancel = () => {
    if (!checkCallback()) return
    window.location.href = callback + '?success=0'
  }
  const onSendClose = () => {
    setShowSend(false)
  }
  const onSuccess = (txId) => {
    if (!checkCallback()) return
    window.location.href = callback + `?success=1&txId=${txId}`
  }

  return (
    <>
      <AnimatedSection
        show
        style={{ minHeight: 320, maxWidth: 720 }}
      >
        <AverageRow>
          <Space direction='vertical'>
            <Title level={3}>"{caller}" wants you to pay </Title>
            <Title level={3}>{amountFormatted} ONE <Hint>(≈ ${amountFiatFormatted} USD)</Hint></Title>
            <Paragraph>To: <WalletAddress showLabel address={dest} /></Paragraph>
          </Space>
        </AverageRow>
        {from && !selectedWallet &&
          <AverageRow>
            <Space direction='vertical'>
              <Paragraph>The app wants you to pay from address:</Paragraph>
              <Paragraph> <WalletAddress showLabel address={from} /></Paragraph>
              <Paragraph>However, you do not have that 1wallet address. Please go back to the app, and choose an 1wallet address that you own. If you do own that 1wallet address but it is not appearing in your wallets, you need restore the wallet first using "Restore" feature with your Google Authenticator.</Paragraph>
            </Space>
          </AverageRow>}
        {from && selectedWallet &&
          <AverageRow>
            <Paragraph>Paying from: <WalletAddress showLabel address={from} /></Paragraph>
          </AverageRow>}
        {!from &&
          <>
            <AverageRow>
              <Text>Select a wallet you want to use:</Text>
            </AverageRow>
            <AverageRow>
              <Select
                suffixIcon={<SearchOutlined />}
                placeholder='one1......'
                labelInValue
                bordered={false}
                showSearch
                style={{
                  width: '100%',
                  borderBottom: '1px dashed black'
                }}
                value={selectedAddress}
                onBlur={() => {}}
                onSearch={() => {}}
              >
                {walletList.map(wallet => {
                  const { address, name } = wallet
                  const oneAddress = util.safeOneAddress(address)
                  const displayText = `(${name}) ${util.ellipsisAddress(oneAddress)}`
                  return (
                    <Select.Option key={displayText} value={displayText} style={{ padding: 0 }}>
                      <Row align='left'>
                        <Col span={24}>
                          <Tooltip title={oneAddress}>
                            <Button
                              block
                              type='text'
                              style={{ textAlign: 'left', height: '50px' }}
                              onClick={() => {
                                setSelectedAddress({ value: address, label: displayText })
                              }}
                            >
                              {displayText}
                            </Button>
                          </Tooltip>
                        </Col>
                      </Row>
                    </Select.Option>
                  )
                })}
              </Select>
            </AverageRow>
          </>}
        {!showSend &&
          <AverageRow justify='space-between'>
            <Button size='large' type='text' onClick={cancel} danger>Cancel</Button>
            <Button
              type='primary' size='large' shape='round' onClick={next}
              disabled={!(selectedAddress.value)}
            >Next
            </Button>
          </AverageRow>}

      </AnimatedSection>
      {showSend &&
        <Send
          address={selectedAddress.value} show={showSend} onClose={onSendClose} onSuccess={onSuccess}
          prefillAmount={amountFormatted} prefillDest={dest} overrideToken={HarmonyONE}
        />}
    </>
  )
}

export default RequestPaymennt
