import { Button, Col, Row, Space, Typography } from 'antd'
import { ExplorerLink } from '../../components/Text'
import util, { useWindowDimensions } from '../../util'
import React from 'react'
import { useSelector } from 'react-redux'
import { HarmonyONE } from '../../components/TokenAssets'
import Paths from '../../constants/paths'
const { Title, Text } = Typography

const Balance = ({ address }) => {
  const oneAddress = util.safeOneAddress(address)
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.wallet.network)
  const balances = useSelector(state => state.wallet.balances)
  const price = useSelector(state => state.wallet.price)
  const tokenBalances = wallet.tokenBalances || []
  const selectedToken = wallet?.selectedToken || HarmonyONE
  const selectedTokenBech32Address = util.safeOneAddress(selectedToken.contractAddress)
  const selectedTokenBalance = selectedToken.key === 'one' ? (balances[address] || 0) : (tokenBalances[selectedToken.key] || 0)
  const selectedTokenDecimals = selectedToken.decimals
  const { formatted, fiatFormatted } = util.computeBalance(selectedTokenBalance, price, selectedTokenDecimals)
  const { isMobile } = useWindowDimensions()
  const showTransfer = () => { history.push(Paths.showAddress(oneAddress, 'transfer')) }
  return (
    <>
      {selectedToken.key !== 'one' &&
        <Row style={{ marginTop: 16 }}>
          <Space size='large' align='baseline'>
            <Title level={3}>{selectedToken.name}</Title>
            <ExplorerLink style={{ opacity: 0.5 }} copyable={{ text: selectedTokenBech32Address }} href={util.getNetworkExplorerUrl(selectedTokenBech32Address, network)}>
              {util.ellipsisAddress(selectedTokenBech32Address)}
            </ExplorerLink>
          </Space>
        </Row>}
      <Row style={{ marginTop: 16 }}>
        <Col span={isMobile ? 24 : 12}>
          <Title level={3} style={{ marginRight: 48 }}>Balance</Title>
        </Col>
        <Col>
          <Space>
            <Title level={3}>{formatted}</Title>
            <Text type='secondary'>{selectedToken.symbol}</Text>
          </Space>
        </Col>
      </Row>
      {selectedToken.key === 'one' &&
        <Row>
          <Col span={isMobile ? 24 : 12} />
          <Col>
            <Space>
              <Title level={4}>≈ ${fiatFormatted}</Title>
              <Text type='secondary'>USD</Text>
            </Space>
          </Col>
        </Row>}
      <Row style={{ marginTop: 16 }}>
        <Col span={isMobile ? 24 : 12} />
        <Col>
          <Button type='primary' size='large' shape='round' onClick={showTransfer} disabled={!util.isNonZeroBalance(selectedTokenBalance)}> Send </Button>
        </Col>
      </Row>
    </>
  )
}

export default Balance
