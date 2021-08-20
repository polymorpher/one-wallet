import { Space, Typography } from 'antd'
import WalletAddress from './WalletAddress'
import util, { useWindowDimensions } from '../util'
import React from 'react'
const { Title } = Typography

const WalletTitle = ({ wallet }) => {
  const { isMobile } = useWindowDimensions()
  return (
    <Space size='large' align='baseline'>
      <Title level={2}>{wallet.name}</Title>
      <WalletAddress
        address={wallet.address}
        shorten={util.shouldShortenAddress({
          walletName: wallet.name,
          isMobile
        })}
      />
    </Space>
  )
}
export default WalletTitle
