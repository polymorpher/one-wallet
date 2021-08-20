import { Button, Space, Typography } from 'antd'
import WalletAddress from './WalletAddress'
import util, { useWindowDimensions } from '../util'
import React, { useState } from 'react'
import DomainPurchaseModal from './DomainPurchaseModal'
import { useSelector } from 'react-redux'
import { HarmonyONE } from './TokenAssets'
const { Title, Text } = Typography

const WalletTitle = ({ wallet }) => {
  const { isMobile } = useWindowDimensions()
  const balances = useSelector(state => state.wallet.balances)
  const [showDomainPurchaseModal, setShowDomainPurchaseModal] = useState(false)
  const selectedToken = wallet?.selectedToken || HarmonyONE
  const tokenBalances = wallet.tokenBalances || []
  const selectedTokenBalance = selectedToken.key === 'one' ? (balances[wallet.address] || 0) : (tokenBalances[selectedToken.key] || 0)
  const domainName = wallet.domain
  const hasDomainName = domainName && domainName !== ''

  return (
    <Space size='large' align='baseline'>
      <Title level={2}>{wallet.name}</Title>
      <DomainPurchaseModal
        selectedTokenBalance={selectedTokenBalance}
        walletAddress={wallet.address}
        isModalVisible={showDomainPurchaseModal}
        dismissModal={() => setShowDomainPurchaseModal(false)}
      />
      {
        hasDomainName
          ? <></>
          : (
            <Button type='primary' onClick={() => setShowDomainPurchaseModal(true)}>
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
