import { useDispatch, useSelector } from 'react-redux'
import React, { useCallback, useEffect, useState } from 'react'
import ONEConstants from '../../../lib/constants'
import util, { useWindowDimensions } from '../util'
import { Button, Card, Typography, Space, Row, Spin, Popconfirm } from 'antd'
import message from '../message'
import TransakSDK from '@transak/transak-sdk'
import { useHistory } from 'react-router'
import config from '../config'
import { HarmonyONE } from './TokenAssets'
const { Title, Text } = Typography

export const useBuyCrypto = ({ address }) => {
  const { isMobile } = useWindowDimensions()
  const network = useSelector(state => state.wallet.network)
  const buy = useCallback(() => {
    return new Promise((resolve, reject) => {
      const isTest = !config.networks[network]?.production
      const env = isTest ? 'staging' : 'production'
      const c = config.transak[env]
      const transak = new TransakSDK({
        apiKey: c.apiKey, // Your API Key
        environment: c.environment, // STAGING/PRODUCTION
        cryptoCurrencyCode: 'ONE', // only crypto supported at this time
        walletAddress: util.safeOneAddress(address), // Your customer's wallet address
        // defaultFiatCurrency: c.defaultCurrency, // USD is not supported at this time
        // countryCode: 'AU', // USD is not supported at this time
        // redirectURL: c.redirectURL || window.location.href,
        hostURL: c.hostURL || window.location.origin,
        widgetHeight: '650px',
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
  const { buy } = useBuyCrypto({ address })
  if (!util.isONE(token)) {
    return <></>
  }
  const doBuy = async () => {
    onClick && onClick()
    try {
      const orderData = await buy()
      if (orderData) {
        message.success('Order successful! You will receive confirmation by email')
      }
    } catch (ex) {
      message.error(ex.toString())
    }
    onComplete && onComplete()
  }
  return <Button type='default' size='large' shape='round' onClick={doBuy} {...props}>{children || 'Buy'}</Button>
}

export default BuyButton
