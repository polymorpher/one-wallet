import { TallRow } from '../../components/Grid'
import { Button, Col, Popconfirm, Row, Space, Tooltip, Typography } from 'antd'
import humanizeDuration from 'humanize-duration'
import { DeleteOutlined, QuestionCircleOutlined } from '@ant-design/icons'
import React, { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import util, { useWindowDimensions } from '../../util'
import walletActions from '../../state/modules/wallet/actions'
import Paths from '../../constants/paths'
import { useHistory } from 'react-router'
import WalletAddress from '../../components/WalletAddress'
import { deleteWalletLocally } from '../../storage/util'

const { Title, Text } = Typography

const About = ({ address }) => {
  const dispatch = useDispatch()
  const history = useHistory()
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const backlinks = wallet.backlinks || []
  const { spendingLimit, spendingInterval } = wallet
  const price = useSelector(state => state.wallet.price)
  const { formatted: spendingLimitFormatted, fiatFormatted: spendingLimitFiatFormatted } = util.computeBalance(spendingLimit, price)
  const [selectedLink, setSelectedLink] = useState()
  const [inspecting, setInspecting] = useState()
  const oldInfos = wallet.oldInfos || []

  const inspect = async (backlink) => {
    const tempWallet = {
      ...wallet,
      address: backlink,
      temp: wallet.effectiveTime + wallet.duration,
    }
    setInspecting(true)
    dispatch(walletActions.updateWallet(tempWallet))
  }

  useEffect(() => {
    if (inspecting && selectedLink && wallets[selectedLink]) {
      // location.href = Paths.showAddress(selectedLink)
      history.push(Paths.showAddress(selectedLink, 'coins'))
    }
  }, [wallets, inspecting, setInspecting])

  const reclaim = async (backlink) => {
    history.push(Paths.showAddress(address, 'reclaim') + `?from=${backlink}`)
  }

  return (
    <>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>{oldInfos.length > 0 ? 'Renewed on' : 'Created On'}</Title></Col>
        <Col> <Text>{new Date(wallet.effectiveTime).toLocaleString()}</Text> </Col>
      </TallRow>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Expires In</Title></Col>
        <Col>
          <Space>
            <Text>{humanizeDuration(wallet.duration + wallet.effectiveTime - Date.now(), { units: ['y', 'mo', 'd'], round: true })}</Text>
            {util.isExpiringSoon(wallet) && <Button shape='round' onClick={() => history.push(Paths.showAddress(address, 'extend'))}>Extend</Button>}
          </Space>
        </Col>
      </TallRow>
      <TallRow align='baseline'>
        <Col span={isMobile ? 24 : 12}> <Title level={3}>Spend Limit</Title></Col>
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
            <Text type='secondary'>per {humanizeDuration(spendingInterval, { largest: 2, round: true })}</Text>
          </Row>
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
          <TallRow style={{ alignItems: 'baseline' }} key={`backlink-${i}}`}>
            <Col span={isMobile ? 24 : 12}>
              <Space style={{ display: i > 0 && 'none' }}>
                <Title level={3}>
                  Upgraded From
                </Title>
                <Tooltip title='These 1wallets are controlled by your wallet. They forward all assets to your wallet.'>
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            </Col>
            <Col>
              <WalletAddress address={backlink} shorten addressStyle={{ padding: 0 }} onClick={(t) => setSelectedLink(t && backlink)} />
            </Col>
            <Col span={isMobile ? 24 : 12} />
            <Col>
              {selectedLink === backlink &&
                <Row style={{ marginTop: 8 }}>
                  <Button shape='round' style={{ marginRight: 8 }} onClick={() => inspect(backlink)}>Inspect</Button>
                  <Button shape='round' onClick={() => reclaim(backlink)}>Reclaim</Button>
                </Row>}
            </Col>
          </TallRow>)}
        {backlinks.length > 0 &&
          <TallRow>
            <Col span={isMobile ? 24 : 12}> </Col>
            <Col style={{ flex: 1 }}>
              <Text>(click wallet to take control actions)</Text>
            </Col>
          </TallRow>}
      </>
      {!util.isEmptyAddress(wallet.forwardAddress) &&
        <TallRow style={{ alignItems: 'baseline' }}>
          <Col span={isMobile ? 24 : 12}>
            <Space>
              <Title level={3}>
                Controlled By
              </Title>
              <Tooltip title='This wallet is controlled by the 1wallet linked to it.'>
                <QuestionCircleOutlined />
              </Tooltip>
            </Space>
          </Col>
          <Col>
            <WalletAddress address={wallet.forwardAddress} shorten addressStyle={{ padding: 0 }} onClick={(t) => setSelectedLink(t && wallet.forwardAddress)} />
          </Col>
          <Col span={isMobile ? 24 : 12} />
          <Col>
            {wallet.forwardAddress && selectedLink === wallet.forwardAddress &&
              <Row style={{ marginTop: 8 }}>
                <Button shape='round' style={{ marginRight: 8 }} onClick={() => history.push(Paths.showAddress(wallet.forwardAddress))}>Go To</Button>
              </Row>}
          </Col>
        </TallRow>}
      <Row style={{ marginTop: 24 }}>
        <Popconfirm title='Are you sure？' onConfirm={() => deleteWalletLocally({ wallet, wallets, dispatch, history })}>
          <Button type='primary' shape='round' danger size='large' icon={<DeleteOutlined />}>Delete locally</Button>
        </Popconfirm>
      </Row>
    </>
  )
}

export default About
