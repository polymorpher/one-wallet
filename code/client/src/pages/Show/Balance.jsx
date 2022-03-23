import Button from 'antd/es/button'
import Col from 'antd/es/col'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import { ExplorerLink } from '../../components/Text'
import util, { useWindowDimensions } from '../../util'
import React from 'react'
import { useSelector } from 'react-redux'
import { HarmonyONE } from '../../components/TokenAssets'
import Paths from '../../constants/paths'
import { useHistory } from 'react-router'
import BuyButton from '../../components/BuyButton'
import humanizeDuration from 'humanize-duration'
import BN from 'bn.js'
import { AverageRow, TallRow } from '../../components/Grid'
const { Title, Text } = Typography

const Balance = ({ address }) => {
  const history = useHistory()
  const oneAddress = util.safeOneAddress(address)
  const wallets = useSelector(state => state.wallet)
  const wallet = wallets[address] || {}
  const network = useSelector(state => state.global.network)
  const balances = useSelector(state => state.balance || {})
  const price = useSelector(state => state.global.price)
  const { balance = 0, tokenBalances = {} } = balances[address] || {}
  const selectedToken = wallet?.selectedToken || HarmonyONE
  const selectedTokenBech32Address = util.safeOneAddress(selectedToken.contractAddress)
  const selectedTokenBalance = selectedToken.key === 'one' ? balance : (tokenBalances[selectedToken.key] || 0)
  const selectedTokenDecimals = selectedToken.decimals
  const { formatted, fiatFormatted } = util.computeBalance(selectedTokenBalance, price, selectedTokenDecimals)
  const { isMobile } = useWindowDimensions()

  const { spendingLimit, spendingInterval = 1 } = wallet
  const { formatted: spendingLimitFormatted, fiatFormatted: spendingLimitFiatFormatted } = util.computeBalance(spendingLimit, price)
  const currentSpendingLimit = new BN(spendingLimit)
  const spendLimitRemaining = util.getMaxSpending(wallet)
  const { formatted: spendLimitRemainingFormatted, fiatFormatted: spendLimitRemainingFiatFormatted } = util.computeBalance(spendLimitRemaining.toString(), price)
  let nextSpendTimeText = '...'
  if (spendingInterval > 1) {
    nextSpendTimeText = humanizeDuration(spendingInterval - (Date.now() % spendingInterval), { largest: 2, round: true })
  }

  const showTransfer = () => { history.push(Paths.showAddress(oneAddress, 'transfer')) }
  return (
    <>
      {selectedToken.key !== 'one' &&
        <Row style={{ marginTop: 16 }} justify={isMobile ? 'center' : undefined}>
          <Space size='large' align='baseline'>
            <Title level={3}>{selectedToken.name}</Title>
            <ExplorerLink style={{ opacity: 0.5 }} copyable={{ text: selectedTokenBech32Address }} href={util.getNetworkExplorerUrl(selectedTokenBech32Address, network)}>
              {util.ellipsisAddress(selectedTokenBech32Address)}
            </ExplorerLink>
          </Space>
        </Row>}

      <Row style={{ marginTop: 16 }}>
        {!isMobile &&
          <Col span={isMobile ? 24 : 12}>
            <Title level={3} style={{ marginRight: isMobile ? undefined : 48 }}>Balance</Title>
          </Col>}
        <Col span={isMobile ? 24 : 12} style={{ textAlign: isMobile ? 'center' : undefined }}>
          <Space>
            <Title level={3}>{formatted}</Title>
            <Text type='secondary'>{selectedToken.symbol}</Text>
          </Space>
        </Col>
      </Row>
      {selectedToken.key === 'one' &&
        <Row style={{ textAlign: isMobile ? 'center' : undefined }}>
          {!isMobile && <Col span={isMobile ? 24 : 12} />}
          <Col span={isMobile ? 24 : 12}>

            <Space>
              <Title level={4}>≈ ${fiatFormatted}</Title>
              <Text type='secondary'>USD</Text>
            </Space>

          </Col>
        </Row>}
      {selectedToken.key === 'one' &&
        <TallRow align='start'>
          <Col span={isMobile ? 24 : 12}>
            <Title level={3}>Spend Limit</Title>
          </Col>
          <Col>
            <Row>
              <Space>
                <Text>{spendingLimitFormatted}</Text>
                <Text type='secondary'>ONE</Text>
                <Text>(≈ ${spendingLimitFiatFormatted}</Text>
                <Text type='secondary'>USD)</Text>
              </Space>
            </Row>
            <Row>
              <Space>
                <Text type='secondary'>per {humanizeDuration(spendingInterval, { largest: 2, round: true })}</Text>
                <Button type='link' onClick={() => history.push(Paths.showAddress(address, 'limit'))}>(change limit)</Button>
              </Space>
            </Row>
          </Col>
        </TallRow>}
      {selectedToken.key === 'one' && spendLimitRemaining.lt(currentSpendingLimit) &&
        <TallRow align='start'>
          <Col span={isMobile ? 24 : 12}> <Title level={3}>Remaining Limit</Title></Col>
          <Col>
            <Row>
              <Space>
                <Text>{spendLimitRemainingFormatted}</Text>
                <Text type='secondary'>ONE</Text>
                <Text>(≈ ${spendLimitRemainingFiatFormatted}</Text>
                <Text type='secondary'>USD)</Text>
              </Space>
            </Row>
            <Row>
              <Text type='secondary'>reset in {nextSpendTimeText}</Text>
            </Row>
          </Col>
        </TallRow>}
      <Row style={{ marginTop: 16, textAlign: isMobile ? 'center' : undefined }}>
        <Col span={isMobile ? 24 : 12} />
        <Col span={isMobile ? 24 : undefined}>
          <Space>
            <Button type='primary' size='large' shape='round' onClick={showTransfer} disabled={!util.isNonZeroBalance(selectedTokenBalance)}> Send </Button>
            {selectedToken.key === 'one' && <BuyButton address={address} token={selectedToken} />}
            {selectedToken.key === 'one' && <Button type='default' size='large' shape='round' onClick={() => history.push(Paths.showAddress(address, 'stake'))} disabled={!util.isNonZeroBalance(selectedTokenBalance)}> Stake </Button>}
          </Space>
        </Col>
      </Row>
    </>
  )
}

export default Balance
