import Button from 'antd/es/button'
import CloseOutlined from '@ant-design/icons/CloseOutlined'
import React, { useEffect, useState } from 'react'
import AnimatedSection from '../../../components/AnimatedSection'
import { Warning, Title, Link, Text } from '../../../components/Text'
import { retryUpgrade } from '../show-util'
import util, { useWindowDimensions } from '../../../util'
import { useHistory } from 'react-router'
import { useWallet } from '../../../components/Common'
import Col from 'antd/es/col'
import Space from 'antd/es/space'
import Row from 'antd/es/row'
import Spin from 'antd/es/spin'
import Paths from '../../../constants/paths'
import BN from 'bn.js'
import { TallRow } from '../../../components/Grid'
import { api } from '../../../../../lib/api'
import flatten from 'lodash/fp/flatten'
import { useSelector } from 'react-redux'
const StakeCommon = ({ children, address, titleSuffix, onClose }) => {
  const history = useHistory()
  const { isMobile } = useWindowDimensions()
  const { dispatch, wallet, network } = useWallet({ address })
  if (network !== 'harmony-mainnet') {
    return (
      <AnimatedSection
        wide title={<Title level={isMobile ? 5 : 2}>Staking{titleSuffix ? ` - ${titleSuffix}` : ''}</Title>}
        extra={[<Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />]}
      >
        <Warning>Staking is available only on Harmony Mainnet. Please change your network (on top right of the window)</Warning>
      </AnimatedSection>
    )
  }

  if (!util.canStake(wallet)) {
    return (
      <AnimatedSection
        wide title={<Title level={isMobile ? 5 : 2}>Staking{titleSuffix ? ` - ${titleSuffix}` : ''}</Title>}
        extra={[<Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />]}
      >
        <Warning>Staking requires wallet version {'>='} 16. Please <Link onClick={() => retryUpgrade({ dispatch, history, address: wallet.address })}>upgrade your wallet</Link></Warning>
      </AnimatedSection>
    )
  }

  return (
    <AnimatedSection
      wide title={<Title level={isMobile ? 5 : 2}>Staking{titleSuffix ? ` - ${titleSuffix}` : ''}</Title>}
      extra={[<Button key='close' type='text' icon={<CloseOutlined />} onClick={onClose} />]}
    >
      {children}
    </AnimatedSection>
  )
}

const RewardPanel = ({ totalReward, address, isMobile, showCollectReward }) => {
  const history = useHistory()
  const [reward, setTotalReward] = useState(totalReward)
  const price = useSelector(state => state.global.price)
  useEffect(() => {
    async function init () {
      if (!totalReward) {
        const result = await api.staking.getDelegations({ address })
        const totalReward = result.map(e => String(e.reward)).reduce((a, b) => a.add(new BN(b)), new BN(0))
        setTotalReward(util.computeBalance(totalReward.toString(), price))
      }
    }
    init()
  }, [address])
  return (
    <TallRow align='start'>
      <Col span={isMobile ? 24 : 12}>
        <Title level={5}>Total accumulated reward</Title>
      </Col>
      <Col>
        <Space direction='vertical' size='large'>
          <Row>
            <Space>
              <Text>{reward ? util.formatNumber(reward.formatted) : <Spin />}</Text>
              <Text type='secondary'>ONE</Text>
              <Text>(≈ ${reward ? reward.fiatFormatted : <Spin />}</Text>
              <Text type='secondary'>USD)</Text>
            </Space>
          </Row>
          {showCollectReward &&
            <Row>
              <Space>
                <Button
                  type='primary' size='large' shape='round'
                  onClick={() => history.push(Paths.showAddress(address, 'collectStakeReward'))}
                  disabled={!reward || new BN(reward.balance).eqn(0)}
                > Collect Reward
                </Button>
              </Space>
            </Row>}
        </Space>
      </Col>
    </TallRow>
  )
}

export { StakeCommon, RewardPanel }
