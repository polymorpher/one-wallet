import { TallRow, AverageRow } from '../../components/Grid'
import { Button, Col, Row, Typography } from 'antd'
import util, { useWindowDimensions } from '../../util'
import WalletAddress from '../../components/WalletAddress'
import { WarningOutlined } from '@ant-design/icons'
import React from 'react'
import { useSelector } from 'react-redux'
import Paths from '../../constants/paths'
import { useHistory } from 'react-router'
import WalletConstants from '../../constants/wallet'
const { Text } = Typography

const Recovery = ({ address }) => {
  const history = useHistory()
  const wallets = useSelector(state => state.wallet)
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
        <Col span={isMobile ? 24 : 6}> <Text>Recovery Address</Text></Col>
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
        <Col span={isMobile ? 24 : 6}><span /></Col>
        {!util.isRecoveryAddressSet(lastResortAddress) &&
          <Col>
            <Button type='primary' size='large' shape='round' onClick={showSetRecoveryAddress}> Change </Button>
          </Col>}
      </Row>
      {util.isRecoveryAddressSet(lastResortAddress) &&
        <AverageRow justify='end'>
          <Button type='primary' size='large' shape='round' onClick={showRecovery} icon={<WarningOutlined />}>Recover funds</Button>
        </AverageRow>}
    </>
  )
}
export default Recovery
