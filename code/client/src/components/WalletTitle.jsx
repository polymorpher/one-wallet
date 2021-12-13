import { Button, Space, Typography, Row, Spin, Tooltip } from 'antd'
import WalletAddress from './WalletAddress'
import util, { useWindowDimensions } from '../util'
import React, { useEffect, useState } from 'react'
import Paths from '../constants/paths'
import { useHistory } from 'react-router'
import api from '../api'
import { useDispatch, useSelector } from 'react-redux'
import { walletActions } from '../state/modules/wallet'
import { QrcodeOutlined, ScanOutlined, WarningTwoTone } from '@ant-design/icons'
import { Warning } from './Text'
import BN from 'bn.js'
const { Title, Text } = Typography
const WalletTitle = ({ address, onQrCodeClick, onScanClick, noWarning }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const { isMobile } = useWindowDimensions()
  const [domain, setDomain] = useState(wallet.domain)
  const [doubleLinked, setDoubleLinked] = useState(null)
  const hasDomainName = domain && domain !== ''
  const balances = useSelector(state => state.balance)
  const balance = new BN(balances[address].balance || 0)
  useEffect(() => {
    const f = async () => {
      setDoubleLinked(null)
      const lookup = await api.blockchain.domain.reverseLookup({ address })
      setDomain(lookup)
      if (lookup && (wallet.domain !== lookup)) {
        dispatch(walletActions.bindDomain({ address, domain: lookup }))
      }
      if (lookup) {
        const resolved = await api.blockchain.domain.resolve({ name: lookup })
        if (resolved !== address) {
          setDoubleLinked(false)
        } else {
          setDoubleLinked(true)
        }
      }
    }
    f()
  }, [address])

  const onPurchaseDomain = () => {
    const oneAddress = util.safeOneAddress(wallet.address)
    history.push(Paths.showAddress(oneAddress, 'domain'))
  }

  return (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Row justify='space-between' align='top' style={{ marginBottom: isMobile ? 0 : 16 }}>
        <Space size='small' align='baseline' direction='vertical'>
          <Space align='center' size='large'>
            <Title level={isMobile ? 4 : 2} style={{ marginBottom: 0 }}>{wallet.name}</Title>
            <Button style={{ padding: 0, border: 'none' }} size='large' onClick={onQrCodeClick}><QrcodeOutlined style={{ fontSize: 32 }} /></Button>
          </Space>
        </Space>
        <Space>
          <Button style={{ padding: 0, border: 'none' }} size='large' onClick={onScanClick}><ScanOutlined style={{ fontSize: 32 }} /></Button>
        </Space>
      </Row>
      <Space direction={isMobile ? 'vertical' : 'horizontal'} size='small' align='start' style={{ marginLeft: -16 }}>
        <WalletAddress
          address={wallet.address}
          shorten={util.shouldShortenAddress({
            label: wallet.name,
            isMobile
          })}
          alwaysShowOptions
          itemStyle={isMobile ? { fontSize: 24 } : {}}
        />
        {wallet.majorVersion >= 9 && (
          hasDomainName
            ? <Text type='secondary' style={{ paddingLeft: 16 }}> {domain} {doubleLinked === null && <Tooltip title='Verifying domain...'><Spin /></Tooltip>} {doubleLinked === false && <Tooltip title="This domain does not resolve back to the wallet's address, even though the wallet's address maps to the domain"> <WarningTwoTone twoToneColor='#ffcc00' /></Tooltip>}</Text>
            : (balance.gtn(0) &&
              <Button type='link' shape='round' onClick={onPurchaseDomain}>
                (get a domain?)
              </Button>
              )
        )}
      </Space>
      {wallet.temp && !noWarning && <Warning>You are inspecting an old wallet.</Warning>}
      {wallet.recoveryTime && !noWarning && <Warning bodyStyle={{ width: '100%', whiteSpace: 'pre-wrap' }}>You are inspecting a deprecated wallet. Recovery is already performed on this wallet. It is forwarding all assets received to another wallet</Warning>}
    </Space>
  )
}
export default WalletTitle
