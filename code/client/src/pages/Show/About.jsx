import { TallRow } from '../../components/Grid'
import { Button, Col, message, Popconfirm, Row, Space, Typography } from 'antd'
import humanizeDuration from 'humanize-duration'
import { DeleteOutlined } from '@ant-design/icons'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import util, { useWindowDimensions } from '../../util'
import walletActions from '../../state/modules/wallet/actions'
import storage from '../../storage'
import Paths from '../../constants/paths'
const { Title, Text } = Typography

const About = ({ address }) => {
  const dispatch = useDispatch()
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const { dailyLimit } = wallet
  const price = useSelector(state => state.wallet.price)
  const { formatted: dailyLimitFormatted, fiatFormatted: dailyLimitFiatFormatted } = util.computeBalance(dailyLimit, price)

  const onDeleteWallet = async () => {
    const { root, name } = wallet
    dispatch(walletActions.deleteWallet(address))
    try {
      await storage.removeItem(root)
      message.success(`Wallet ${name} is deleted`)
      history.push(Paths.wallets)
    } catch (ex) {
      console.error(ex)
      message.error(`Failed to delete wallet proofs. Error: ${ex}`)
    }
  }
  return (
    <>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Created On</Title></Col>
        <Col> <Text>{new Date(wallet.effectiveTime).toLocaleString()}</Text> </Col>
      </TallRow>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Expires In</Title></Col>
        <Col> <Text>{humanizeDuration(wallet.duration + wallet.effectiveTime - Date.now(), { units: ['y', 'mo', 'd'], round: true })}</Text> </Col>
      </TallRow>
      <TallRow>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Daily Limit</Title></Col>
        <Col>
          <Space>
            <Text>{dailyLimitFormatted}</Text>
            <Text type='secondary'>ONE</Text>
            <Text>(≈ ${dailyLimitFiatFormatted}</Text>
            <Text type='secondary'>USD)</Text>
          </Space>
        </Col>
      </TallRow>
      {wallet.majorVersion &&
        <TallRow align='middle'>
          <Col span={isMobile ? 24 : 12}> <Title level={3}>Wallet Version</Title></Col>
          <Col>
            <Text>{wallet.majorVersion}.{wallet.minorVersion}</Text>
          </Col>
        </TallRow>}
      <Row style={{ marginTop: 24 }}>
        <Popconfirm title='Are you sure？' onConfirm={onDeleteWallet}>
          <Button type='primary' shape='round' danger size='large' icon={<DeleteOutlined />}>Delete locally</Button>
        </Popconfirm>
      </Row>
    </>
  )
}

export default About
