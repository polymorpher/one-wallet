import { TallRow, AverageRow } from '../../components/Grid'
import { Button, Col, message, Popconfirm, Row, Space, Tooltip, Typography } from 'antd'
import humanizeDuration from 'humanize-duration'
import { DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import util, { useWindowDimensions } from '../../util'
import walletActions from '../../state/modules/wallet/actions'
import storage from '../../storage'
import Paths from '../../constants/paths'
import { useHistory } from 'react-router'
import WalletAddress from '../../components/WalletAddress'
const { Title, Text } = Typography

const About = ({ address }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const backlinks = wallet.backlinks || []
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
      <>
        {backlinks.map((backlink, i) =>
          <TallRow align='middle' key={`backlink-${i}}`}>
            <Col span={isMobile ? 24 : 12}>
              <Space style={{ display: i > 0 && 'none' }}>
                <Title level={3}>
                  Linked Addresses
                </Title>
                <Tooltip title='These 1wallet addresses are controlled by this wallet. They will forward all funds and tokens received to this wallet.'>
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>

            </Col>
            <Col>
              <WalletAddress address={backlink} shorten addressStyle={{ padding: 0 }} />
            </Col>
          </TallRow>)}
      </>
      {!util.isEmptyAddress(wallet.forwardAddress) &&
        <TallRow align='middle'>
          <Col span={isMobile ? 24 : 12}>
            <Space>
              <Title level={3}>
                Linked To
              </Title>
              <Tooltip title='This wallet is controlled by the 1wallet linked to it.'>
                <QuestionCircleOutlined />
              </Tooltip>
            </Space>
          </Col>
          <Col>
            <WalletAddress address={wallet.forwardAddress} shorten addressStyle={{ padding: 0 }} />
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
