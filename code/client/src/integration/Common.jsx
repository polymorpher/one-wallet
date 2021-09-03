import { AverageRow } from '../components/Grid'
import { Button, Col, Row, Select, Space, Tooltip, Typography } from 'antd'
import WalletAddress from '../components/WalletAddress'
import { SearchOutlined } from '@ant-design/icons'
import util from '../util'
import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
const { Text, Paragraph } = Typography

export const WalletSelector = ({ from, onAddressSelected }) => {
  const network = useSelector(state => state.wallet.network)
  const wallets = useSelector(state => state.wallet.wallets)
  const walletList = Object.keys(wallets).map(e => wallets[e]).filter(e => e.network === network)
  const selectedWallet = from && wallets[from]
  const buildAddressObject = wallet => wallet && wallet.address && ({ value: wallet.address, label: `(${wallet.name}) ${util.ellipsisAddress(util.safeOneAddress(wallet.address))}` })
  const defaultUserAddress = (walletList.length === 0 ? {} : buildAddressObject(walletList[0]))
  const [selectedAddress, setSelectedAddress] = useState(selectedWallet ? buildAddressObject(selectedWallet) : defaultUserAddress)
  useEffect(() => {
    onAddressSelected && onAddressSelected(selectedAddress)
  }, [selectedAddress])

  return (
    <>
      {from && !selectedWallet &&
        <AverageRow>
          <Space direction='vertical'>
            <Paragraph>The app wants you to use your 1wallet at this address:</Paragraph>
            <Paragraph> <WalletAddress showLabel address={from} /></Paragraph>
            <Paragraph>However, you do not have that 1wallet address in this device. Please go back to the app, and choose an 1wallet address that you own. If you do own that 1wallet address but it is not appearing in your wallets, you need restore the wallet first using "Restore" feature with your Google Authenticator.</Paragraph>
          </Space>
        </AverageRow>}
      {from && selectedWallet &&
        <AverageRow>
          <Space direction='vertical'>
            <Paragraph>Running from</Paragraph>
            <Paragraph><WalletAddress showLabel address={from} /></Paragraph>
          </Space>
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
    </>
  )
}
