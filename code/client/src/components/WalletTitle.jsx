import { Button, Space, Typography } from 'antd'
import WalletAddress from './WalletAddress'
import util, { useWindowDimensions } from '../util'
import React from 'react'
import Paths from '../constants/paths'
import { useHistory } from 'react-router'
const { Title, Text } = Typography

const WalletTitle = ({ wallet }) => {
  const history = useHistory()
  const { isMobile } = useWindowDimensions()
  const domainName = wallet.domain
  const hasDomainName = domainName && domainName !== ''

  const onPurchaseDomain = () => {
    const oneAddress = util.safeOneAddress(wallet.address)
    history.push(Paths.showAddress(oneAddress, 'purchaseDomain'))
  }

  return (
    <Space size='large' align='baseline'>
      <Title level={2}>{wallet.name}</Title>
      {
        hasDomainName
          ? <></>
          : (
            <Button type='primary' onClick={onPurchaseDomain}>
              Buy Domain
            </Button>
            )
      }
      <Space direction='vertical' size='small' align='start'>
        {
          hasDomainName ? <Text type='secondary'>{domainName}</Text> : <></>
        }
        <WalletAddress
          address={wallet.address}
          shorten={util.shouldShortenAddress({
            walletName: wallet.name,
            isMobile
          })}
        />
      </Space>
    </Space>
  )
}
export default WalletTitle
