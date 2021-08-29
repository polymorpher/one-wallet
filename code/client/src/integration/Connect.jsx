import { Button, message, Row, Space, Typography, Select, Col, Tooltip } from 'antd'
import AnimatedSection from '../components/AnimatedSection'
import { AverageRow } from '../components/Grid'
import { Li, Ul } from '../components/Text'
import React, { useState } from 'react'
import { useSelector } from 'react-redux'
import { SearchOutlined } from '@ant-design/icons'
import util from '../util'
import { useHistory } from 'react-router'
const { Title, Text, Paragraph } = Typography
const ConnectWallet = ({ caller, callback }) => {
  const history = useHistory()
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const walletList = Object.keys(wallets).map(e => wallets[e]).filter(e => e.network === network)
  const [selectedAddress, setSelectedAddress] = useState(walletList.length === 0
    ? {}
    : { value: walletList[0].address, label: `(${walletList[0].name}) ${util.ellipsisAddress(util.safeOneAddress(walletList[0].address))}` })
  const connect = () => {
    if (!selectedAddress.value) {
      return message.error('No address is selected')
    }
    if (!callback) {
      message.error('The app did not specify a callback URL. Please contact the app developer.')
      return
    }
    window.location.href = callback + `?address=${selectedAddress.value}&success=1`
  }
  const cancel = () => {
    if (!callback) {
      message.error('The app did not specify a callback URL. Please contact the app developer.')
      return
    }
    window.location.href = callback + '?success=0'
  }
  return (
    <AnimatedSection
      show
      style={{ minHeight: 320, maxWidth: 720 }}
      title='Request: Connect a Wallet'
    >
      <AverageRow>
        <Space direction='vertical'>
          <Title level={3}>"{caller}" wants to connect to your 1wallet</Title>
          <Text>
            <Paragraph>The app will be able to:</Paragraph>
            <Ul>
              <Li><span role='img' aria-label='-'>✅</span> View the address of the connected wallet </Li>
            </Ul>
            <Paragraph>The app cannot:</Paragraph>
            <Ul>
              <Li><span role='img' aria-label='-'>❌</span> Do anything without your permission (e.g. transferring funds, sign transactions, ...)</Li>
            </Ul>
          </Text>
        </Space>
      </AverageRow>

      <AverageRow>
        <Text>Select a wallet you want to connect:</Text>
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
      <Row justify='space-between' />
      <AverageRow justify='space-between'>
        <Button size='large' type='text' onClick={cancel}>Cancel</Button>
        <Button type='primary' size='large' shape='round' onClick={connect}>Connect</Button>
      </AverageRow>

    </AnimatedSection>
  )
}

export default ConnectWallet
