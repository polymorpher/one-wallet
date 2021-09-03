import { Button, message, Space, Typography, } from 'antd'
import AnimatedSection from '../components/AnimatedSection'
import { AverageRow } from '../components/Grid'
import { Li, Ul } from '../components/Text'
import React, { useState } from 'react'
import { WalletSelector } from './Common'
const { Title, Text, Paragraph } = Typography
const ConnectWallet = ({ caller, callback }) => {
  const [selectedAddress, setSelectedAddress] = useState({})
  const connect = () => {
    if (!selectedAddress.value) {
      return message.error('No address is selected')
    }
    window.location.href = callback + `?address=${selectedAddress.value}&success=1`
  }
  const cancel = () => {
    window.location.href = callback + '?success=0'
  }
  return (
    <AnimatedSection
      show
      style={{ minHeight: 320, maxWidth: 720 }}
    >
      <AverageRow>
        <Space direction='vertical'>
          <Title level={3}>"{caller}" wants to connect to your 1wallet</Title>
          <Text>
            <Paragraph>The app will be able to:</Paragraph>
            <Ul>
              <Li><span role='img' aria-label='-'>✅</span> View the address of the connected wallet</Li>
            </Ul>
            <Paragraph>The app cannot:</Paragraph>
            <Ul>
              <Li><span role='img' aria-label='-'>❌</span> Do anything without your permission (e.g. transferring funds, sign transactions, ...)</Li>
            </Ul>
          </Text>
        </Space>
      </AverageRow>
      <WalletSelector onAddressSelected={setSelectedAddress} />
      <AverageRow justify='space-between'>
        <Button size='large' type='text' onClick={cancel} danger>Cancel</Button>
        <Button type='primary' size='large' shape='round' onClick={connect} disabled={!selectedAddress.value}>Connect</Button>
      </AverageRow>

    </AnimatedSection>
  )
}

export default ConnectWallet
