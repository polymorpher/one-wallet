import { TallRow } from '../../components/Grid'
import { Button, Col, Row, Typography } from 'antd'
import util, { useWindowDimensions } from '../../util'
import WalletAddress from '../../components/WalletAddress'
import { WarningOutlined } from '@ant-design/icons'
import React from 'react'
import { useSelector } from 'react-redux'
import Paths from '../../constants/paths'
const { Title } = Typography

const Recovery = ({ address }) => {
  const wallets = useSelector(state => state.wallet.wallets)
  const wallet = wallets[address] || {}
  const { lastResortAddress } = wallet
  const { isMobile } = useWindowDimensions()
  const oneLastResort = util.safeOneAddress(lastResortAddress)
  const oneAddress = util.safeOneAddress(address)
  const showRecovery = () => { history.push(Paths.showAddress(oneAddress, 'recover')) }

  const showSetRecoveryAddress = () => { history.push(Paths.showAddress(oneAddress, 'setRecoveryAddress')) }

  return (
    <>
      <TallRow align='middle'>
        <Col span={isMobile ? 24 : 8}> <Title level={3}>Recovery Address</Title></Col>
        {lastResortAddress && !util.isEmptyAddress(lastResortAddress) &&
          <Col>
            <WalletAddress
              showLabel
              address={oneLastResort}
              shorten
            />
          </Col>}
      </TallRow>
      <Row align='middle'>
        <Col span={isMobile ? 24 : 8}><span /></Col>
        {!util.isRecoveryAddressSet(lastResortAddress) &&
          <Col>
            <Button type='primary' size='large' shape='round' onClick={showSetRecoveryAddress}> Change </Button>
          </Col>}
      </Row>
      <Row style={{ marginTop: 48 }}>
        <Button type='primary' size='large' shape='round' onClick={showRecovery} icon={<WarningOutlined />}>Recover funds</Button>
      </Row>
    </>
  )
}
export default Recovery
