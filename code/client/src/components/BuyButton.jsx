import { useSelector } from 'react-redux'
import React, { useCallback, useState } from 'react'
import util, { useWindowDimensions } from '../util'
import { Button, Typography, Modal, Select, Space, Row, Col } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import message from '../message'
import TransakSDK from '@transak/transak-sdk'
import config from '../config'
import styled from 'styled-components'
const { Text } = Typography

const Flag = styled.img`
  object-fit: contain;
  height: 16px;
  width: 100%;
`

export const CurrencyChooser = ({ visible, confirm, onClose }) => {
  const [currency, setCurrency] = useState(config.transak.currencies[0])
  const countries = config.transak.countries.map(e => e.toLowerCase())
  const onOk = () => {
    confirm(currency)
    onClose()
  }
  return (
    <Modal visible={visible} okText='Confirm' cancelText={null} onCancel={onClose} onOk={onOk} okButtonProps={{ shape: 'round' }} cancelButtonProps={{ shape: 'round' }} title='Buy ONE'>
      <Space direction='vertical' size='large'>

        <Text>1wallet does not process your fiat transaction. Payment is handled by Harmony's fiat gateway partners.</Text>
        <Space align='center'>
          <Text>Select your fiat currency:</Text>
          <Select
            suffixIcon={<SearchOutlined />}
            style={{ width: 200 }} dropdownMatchSelectWidth bordered={false} showSearch onChange={setCurrency}
            value={currency}
            onSearch={(v) => setCurrency(v)}
          >
            {config.transak.currencies.map((c, i) => {
              return (
                <Select.Option key={c} value={c}>
                  <Row align='center'>
                    <Col span={12}><Flag src={`/flags/${countries[i]}.svg`} /></Col>
                    <Col span={12}><Text>{c}</Text></Col>
                  </Row>
                </Select.Option>
              )
            })}
          </Select>
        </Space>
        <Text>* Purchase via USD will become available soon.</Text>
      </Space>
    </Modal>
  )
}

export const useBuyCrypto = ({ address }) => {
  const { isMobile } = useWindowDimensions()
  const network = useSelector(state => state.wallet.network)
  const buy = useCallback((currency) => {
    return new Promise((resolve, reject) => {
      const isTest = !config.networks[network]?.production
      const env = isTest ? 'staging' : 'production'
      const c = config.transak[env]
      const transak = new TransakSDK({
        apiKey: c.apiKey, // Your API Key
        environment: c.environment, // STAGING/PRODUCTION
        cryptoCurrencyCode: 'ONE', // only crypto supported at this time
        // cryptoCurrencyList: 'ONE', // only crypto supported at this time
        disableWalletAddressForm: true,

        // isDisableCrypto: true,
        // cryptoCurrencyList: 'ONE', // only crypto supported at this time
        walletAddress: util.safeOneAddress(address), // Your customer's wallet address
        fiatCurrency: currency.toUpperCase(), // USD is not supported at this time
        // countryCode: 'AU', // USD is not supported at this time
        // redirectURL: c.redirectURL || window.location.href,
        hostURL: c.hostURL || window.location.origin,
        widgetHeight: '600px',
        widgetWidth: isMobile ? '100%' : '450px',
        hideMenu: true,
      })
      transak.init()
      transak.on(transak.ALL_EVENTS, (data) => {
        console.log(data)
      })
      transak.on(transak.TRANSAK_ORDER_CANCELLED, (data) => {
        reject(new Error('Order Cancelled'))
      })
      transak.on(transak.TRANSAK_ORDER_FAILED, (data) => {
        reject(new Error(`Purchase Failed. Details: ${JSON.stringify(data || {})}`))
      })
      transak.on(transak.EVENTS.TRANSAK_WIDGET_CLOSE, (orderData) => {
        resolve()
        transak.close()
      })

      // This will trigger when the user marks payment is made.
      transak.on(transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, (orderData) => {
        resolve(orderData)
        transak.close()
      })
    })
  }, [address, network])

  return { buy }
}

const BuyButton = ({ address, token, children, onClick, onComplete, ...props }) => {
  const [currencyChooserVisible, setCurrencyChooserVisible] = useState(false)
  const { buy } = useBuyCrypto({ address })
  if (!util.isONE(token)) {
    return <></>
  }
  const doBuy = async (currency) => {
    onClick && onClick()
    try {
      const orderData = await buy(currency)
      if (orderData) {
        message.success('Order successful! You will receive confirmation by email')
      }
    } catch (ex) {
      message.error(ex.toString())
    }
    onComplete && onComplete()
  }
  return (
    <>
      <CurrencyChooser visible={currencyChooserVisible} confirm={doBuy} onClose={() => setCurrencyChooserVisible(false)} />
      <Button type='default' size='large' shape='round' onClick={() => setCurrencyChooserVisible(true)} {...props}>{children || 'Buy'}</Button>
    </>
  )
}

export default BuyButton
