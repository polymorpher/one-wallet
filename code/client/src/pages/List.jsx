import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { values, sum } from 'lodash'
import { Card, Row, Space, Typography, message, Col } from 'antd'
import util from '../util'
import { useHistory, useLocation } from 'react-router'
import Paths from '../constants/paths'
import BN from 'bn.js'
const { Text, Title } = Typography

const WalletCard = ({ wallet }) => {
  const history = useHistory()
  const location = useLocation()
  const { address, name } = wallet
  const dispatch = useDispatch()
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address]
  const price = useSelector(state => state.wallet.price)
  const { formatted, fiatFormatted } = util.computeBalance(balance, price)

  useEffect(() => {
    dispatch(walletActions.fetchBalance({ address }))
  }, [location])

  return (
    <Card
      onClick={() => history.push(Paths.showAddress(address))}
      title={<Title level={2}>{name}</Title>}
      hoverable style={{ borderRadius: 20, width: 360, height: 196 }}
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
  const network = useSelector(state => state.wallet.network)
  const totalBalance = Object.keys(balances).filter(a => wallets[a].network === network).map(a => balances[a])
    .reduce((a, b) => a.add(new BN(b, 10)), new BN(0)).toString()
  const { formatted, fiatFormatted } = util.computeBalance(totalBalance, price)
  return (
    <>
      <Row gutter={[24, 24]}>
        {values(wallets).filter(w => w.network === network).map(w => <Col key={w.address}><WalletCard wallet={w} /></Col>)}
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
