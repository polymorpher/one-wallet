import React, { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory, useRouteMatch, Redirect } from 'react-router'
import Paths from '../constants/paths'
import walletActions from '../state/modules/wallet/actions'
import util from '../util'
import { Card, message, Space, Row, Col, Typography, Button } from 'antd'
import styled from 'styled-components'
import humanizeDuration from 'humanize-duration'
const { Title, Text } = Typography

const HoverableText = styled(Text)`
  &:hover{
    cursor: pointer;
  }
`

const TallRow = styled(Row)`
  margin-top: 32px;
  margin-bottom: 32px;
`

const FlexDiv = styled.div`
  display: flex;
`

const Show = () => {
  const history = useHistory()
  const dispatch = useDispatch()
  const wallets = useSelector(state => state.wallet.wallets)
  const match = useRouteMatch(Paths.show)
  const { address } = match ? match.params : {}
  const selectedAddress = useSelector(state => state.wallet.selected)
  const wallet = wallets[address] || {}
  useEffect(() => {
    if (!wallet) {
      return history.push(Paths.wallets)
    }
    if (address && (address !== selectedAddress)) {
      dispatch(walletActions.selectWallet(address))
    }
  }, [])
  const balances = useSelector(state => state.wallet.balances)
  const balance = balances[address] || 0
  const price = useSelector(state => state.wallet.price)
  const { formatted, fiatFormatted } = util.computeBalance(balance, price)

  const showTransfer = () => {

  }

  const showRecovery = () => {

  }

  if (!wallet) {
    return <Redirect to={Paths.wallets} />
  }
  const title = (
    <Space size='large'>
      <Title level={2}>{wallet.name}</Title>
      <HoverableText
        type='secondary' onClick={() => {
          navigator.clipboard.writeText(address)
          message.info('Copied address to clipboard')
        }}
      >{address}
      </HoverableText>
    </Space>
  )
  return (
    <Space size='large' wrap align='start'>
      <Card
        title={title}
        style={{ minWidth: 480, minHeight: 320, padding: 24 }}
      >
        <Row style={{ marginTop: 16 }}>
          <Col span={12}>
            <Title level={3} style={{ marginRight: 48 }}>Balance</Title>
          </Col>
          <Col>
            <Space>
              <Title level={3}>{formatted}</Title>
              <Text type='secondary'>ONE</Text>
            </Space>
          </Col>
        </Row>
        <Row>
          <Col span={12} />
          <Col>
            <Space>
              <Title level={4}>≈ ${fiatFormatted}</Title>
              <Text type='secondary'>USD</Text>
            </Space>
          </Col>
        </Row>
        <Row style={{ marginTop: 16 }}>
          <Col span={12} />
          <Col>
            <Button type='primary' size='large' shape='round' onClick={showTransfer}> Send </Button>
          </Col>
        </Row>
        <TallRow align='middle'>
          <Col span={12}> <Title level={3}>Created On</Title></Col>
          <Col> <Text>{new Date(wallet.effectiveTime).toLocaleString()}</Text> </Col>
        </TallRow>
        <TallRow align='middle'>
          <Col span={12}> <Title level={3}>Expires In</Title></Col>
          <Col> <Text>{humanizeDuration(wallet.duration, { units: ['y', 'mo', 'd'], round: true })}</Text> </Col>
        </TallRow>
        <Row style={{ marginTop: 48 }}>
          <Button type='link' style={{ color: 'red', padding: 0 }} size='large' onClick={showRecovery}> Help! I lost my Google Authenticator</Button>
        </Row>
      </Card>
    </Space>
  )
}
export default Show
