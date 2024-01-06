import Button from 'antd/es/button'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import Row from 'antd/es/row'
import Spin from 'antd/es/spin'
import Tooltip from 'antd/es/tooltip'
import WalletAddress from './WalletAddress'
import util, { useWindowDimensions } from '../util'
import React, { useEffect, useState } from 'react'
import Paths from '../constants/paths'
import { useHistory } from 'react-router'
import api from '../api'
import { useDispatch, useSelector } from 'react-redux'
import { walletActions } from '../state/modules/wallet'
import ScanOutlined from '@ant-design/icons/ScanOutlined'
import WarningTwoTone from '@ant-design/icons/WarningTwoTone'
import { Warning } from './Text'
import BN from 'bn.js'
import Image from 'antd/es/image'
import WCLogo from '../../assets/wc.png'
import { ClickableIconWrapper } from './Buttons'

const { Title, Text } = Typography
const WalletTitle = ({ address, onScanClick, noWarning }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const { isMobile } = useWindowDimensions()
  const [domain, setDomain] = useState(wallet.domain)
  const [doubleLinked, setDoubleLinked] = useState(null)
  const hasDomainName = domain && domain !== ''
  const balances = useSelector(state => state.balance || {})
  const balance = new BN(balances[address]?.balance || 0)
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

  const onTransferDomain = () => {
    const oneAddress = util.safeOneAddress(wallet.address)
    history.push(Paths.showAddress(oneAddress, 'domainTransfer'))
  }

  return (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Row justify='space-between' align='middle' style={{ marginBottom: isMobile ? 0 : 16 }}>
        <Space align='center' size='large' style={{ lineHeight: 0 }}>
          <Title level={isMobile ? 4 : 2} style={{ marginBottom: 0 }}>{wallet.name}</Title>
          <Tooltip title='Connect the wallet with dApp'>
            <ClickableIconWrapper>
              <Image
                preview={false} src={WCLogo} style={{ height: 48 }}
                onClick={() => history.push(Paths.doAuth('walletconnect', address))}
              />
            </ClickableIconWrapper>
          </Tooltip>
        </Space>
        <ClickableIconWrapper onClick={onScanClick}><ScanOutlined style={{ fontSize: 32 }} /></ClickableIconWrapper>
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
            ? <Text type='secondary' style={{ paddingLeft: 16 }}> {domain} {doubleLinked ? <Button type='link' onClick={onTransferDomain}>(transfer)</Button> : <></>} {doubleLinked === null && <Tooltip title='Verifying domain...'><Spin /></Tooltip>} {doubleLinked === false && <Tooltip title="This domain does not resolve back to the wallet's address, even though the wallet's address maps to the domain"> <WarningTwoTone twoToneColor='#ffcc00' /></Tooltip>}</Text>
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
