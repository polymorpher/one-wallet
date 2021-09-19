import { Button, Space, Typography, Row } from 'antd'
import WalletAddress from './WalletAddress'
import util, { useWindowDimensions } from '../util'
import React, { useEffect, useState } from 'react'
import Paths from '../constants/paths'
import { useHistory } from 'react-router'
import api from '../api'
import { useDispatch, useSelector } from 'react-redux'
import { walletActions } from '../state/modules/wallet'
import { QrcodeOutlined, ScanOutlined } from '@ant-design/icons'
const { Title, Text } = Typography
const WalletTitle = ({ address, onQrCodeClick, onScanClick }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const { isMobile } = useWindowDimensions()
  const [domain, setDomain] = useState(wallet.domain)
  const hasDomainName = domain && domain !== ''

  useEffect(() => {
    const f = async () => {
      const lookup = await api.blockchain.domain.reverseLookup({ address })
      setDomain(lookup)
      if (lookup && (wallet.domain !== lookup)) {
        dispatch(walletActions.bindDomain({ address, domain: lookup }))
      }
    }
    f()
  }, [])

  const onPurchaseDomain = () => {
    const oneAddress = util.safeOneAddress(wallet.address)
    history.push(Paths.showAddress(oneAddress, 'domain'))
  }

  return (
    <Row justify='space-between' align='top' style={{ marginBottom: isMobile ? 0 : 16 }}>
      <Space size='small' align='baseline' direction='vertical'>
        <Space align='center' size='large'>
          <Title level={isMobile ? 4 : 2} style={{ marginBottom: 0 }}>{wallet.name}</Title>
          <Button style={{ padding: 0, border: 'none' }} size='large' onClick={onQrCodeClick}><QrcodeOutlined style={{ fontSize: 32 }} /></Button>
        </Space>

        <Space direction='horizontal' size='small' align='start' style={{ marginLeft: -16 }}>
          <WalletAddress
            address={wallet.address}
            shorten={util.shouldShortenAddress({
              label: wallet.name,
              isMobile
            })}
          />
          {wallet.majorVersion >= 9 && (
            hasDomainName
              ? <Text type='secondary' style={{ paddingLeft: 16 }}>{domain}</Text>
              : (
                <Button type='link' shape='round' onClick={onPurchaseDomain}>
                  (get a domain?)
                </Button>
                )
          )}
        </Space>
      </Space>
      <Space>
        <Button style={{ padding: 0, border: 'none' }} size='large' onClick={onScanClick}><ScanOutlined style={{ fontSize: 32 }} /></Button>
      </Space>

    </Row>
  )
}
export default WalletTitle
