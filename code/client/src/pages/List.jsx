import React, { useEffect } from 'react'
import ONEUtil from '../../../lib/util'
import { useSelector, useDispatch } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { values, sum } from 'lodash'
import { Card, Row, Space, Typography, message } from 'antd'
import util from '../util'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
const { Text, Link, Title } = Typography

const computeBalance = (balance, price) => {
  const ones = ONEUtil.toOne(balance || 0)
  const formatted = util.formatNumber(ones)
  const fiat = (price || 0) * parseFloat(ones)
  const fiatFormatted = util.formatNumber(fiat)
  return { balance, formatted, fiat, fiatFormatted }
}

const WalletCard = ({ wallet }) => {
  const history = useHistory()
  const { address, name } = wallet
  const dispatch = useDispatch()
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address]
  const price = useSelector(state => state.wallet.price)
  const { formatted, fiatFormatted } = computeBalance(balance, price)

  useEffect(() => {
    dispatch(walletActions.fetchBalance({ address }))
  }, [])

  return (
    <Card
      onClick={() => history.push(Paths.showAddress(address))}
      title={<Title level={2}>{name}</Title>}
      hoverable style={{ borderRadius: 20, width: 320, height: 196 }}
      extra={<Space style={{ alignItems: 'baseline' }}><Title level={3} style={{ marginBottom: 0 }}>{formatted}</Title><Text type='secondary'>ONE</Text></Space>}
    >
      <Space direction='vertical' size='large'>
        <Space><Title level={4}>≈ ${fiatFormatted}</Title><Text type='secondary'>USD</Text></Space>
        <Text
          ellipsis={{ tooltip: address }} style={{ width: 196 }} onClick={() => {
            navigator.clipboard.writeText(address)
            message.info('Copied address to clipboard')
          }}
        >{address}
        </Text>
      </Space>
    </Card>
  )
}

const List = () => {
  const wallets = useSelector(state => state.wallet.wallets)
  const balances = useSelector(state => state.wallet.balances)
  const price = useSelector(state => state.wallet.price)
  const totalBalance = sum(values(balances))
  const { formatted, fiatFormatted } = computeBalance(totalBalance, price)

  return (
    <>
      <Row>
        {values(wallets).map(w => <WalletCard key={w.address} wallet={w} />)}
      </Row>
      <Row style={{ marginTop: 36 }}>
        <Space direction='vertical'>
          <Space><Title level={3} style={{ marginRight: 48 }}>Total Balance</Title><Title level={3}>{formatted}</Title><Text type='secondary'>ONE</Text></Space>
          <Space><Title level={3} style={{ marginRight: 48, opacity: 0 }}>Total Balance</Title><Title level={4}>≈ ${fiatFormatted}</Title><Text type='secondary'>USD</Text></Space>
        </Space>
      </Row>
    </>
  )
}
export default List
