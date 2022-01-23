import React, { useEffect, useState } from 'react'
import { useSelector, useDispatch, batch } from 'react-redux'
import walletActions from '../state/modules/wallet/actions'
import { balanceActions } from '../state/modules/balance'
import values from 'lodash/fp/values'
import omit from 'lodash/fp/omit'
import Card from 'antd/es/card'
import Row from 'antd/es/row'
import Space from 'antd/es/space'
import Typography from 'antd/es/typography'
import Col from 'antd/es/col'
import Tag from 'antd/es/tag'
import message from '../message'
import util, { useWindowDimensions } from '../util'
import { useHistory } from 'react-router'
import Paths from '../constants/paths'
import BN from 'bn.js'
import ONEConstants from '../../../lib/constants'
import * as Sentry from '@sentry/browser'
import { cleanStorage, deleteWalletLocally } from '../storage/util'
import AnimatedSection from '../components/AnimatedSection'
import Button from 'antd/es/button'
import { Hint } from '../components/Text'
const { Text, Title } = Typography

const walletShortName = (fullName) => {
  if (!fullName) {
    return null
  }
  const walletNameParts = fullName.split(' ')

  return walletNameParts.length > 1 ? `${walletNameParts[0]}...` : fullName
}

const WalletCard = ({ wallet }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const { address, name } = wallet
  const oneAddress = util.safeOneAddress(address)
  const walletBalance = useSelector(state => state?.balance[address] || {})
  const price = useSelector(state => state.global.price)
  const { formatted, fiatFormatted } = util.computeBalance(walletBalance.balance || 0, price)
  const walletOutdated = util.isWalletOutdated(wallet)

  return (
    <Card
      onClick={() => history.push(Paths.showAddress(oneAddress))}
      title={<Title level={2}>{walletShortName(name)}</Title>}
      hoverable style={{ borderRadius: 20, minWidth: 200, width: (isMobile ? '100%' : 360), height: 196 }}
      extra={<Space style={{ alignItems: 'baseline' }}><Title level={3} style={{ marginBottom: 0 }}>{formatted}</Title><Text type='secondary'>ONE</Text></Space>}
    >
      <Space direction='vertical' size='large'>
        <Space>
          <Title level={4}>≈ ${fiatFormatted}</Title>
          <Text type='secondary'>USD</Text>
        </Space>
        <Text
          ellipsis={{ tooltip: oneAddress }} style={{ width: 196 }} onClick={() => {
            navigator.clipboard.writeText(oneAddress)
            message.info('Copied address to clipboard')
          }}
        >
          {oneAddress}
        </Text>
        {
          (walletOutdated || util.isEmptyAddress(wallet.lastResortAddress)) &&
            <Tag color='warning' style={{ position: 'absolute', bottom: isMobile ? 32 : 16, right: 16 }}>
              outdated
            </Tag>
        }
        {
          wallet.recoveryTime &&
            <Tag color='error' style={{ position: 'absolute', bottom: isMobile ? 32 : 16, right: 16 }}>
              deprecated
            </Tag>
        }
      </Space>
    </Card>
  )
}

const List = () => {
  const history = useHistory()
  const { isMobile } = useWindowDimensions()
  const wallets = useSelector(state => state.wallet)
  const balances = useSelector(state => state.balance || {})
  const price = useSelector(state => state.global.price)
  const network = useSelector(state => state.global.network)
  const dispatch = useDispatch()
  const totalBalance = Object.keys(balances)
    .filter(a => wallets[a] && wallets[a].network === network && !wallets[a].temp)
    .map(a => balances[a])
    .reduce((a, b) => a.add(new BN(b?.balance || 0, 10)), new BN(0)).toString()
  const { formatted, fiatFormatted } = util.computeBalance(totalBalance, price)
  const titleLevel = isMobile ? 4 : 3
  const [purged, setPurged] = useState(false)

  const purge = (wallet) => {
    Sentry.withScope(scope => {
      scope.setContext('wallet', omit(['hseed'], wallet))
      Sentry.captureMessage('purge1')
    })
    deleteWalletLocally({ wallet, wallets, dispatch, silent: true })
  }

  useEffect(() => {
    if (purged || !wallets || Object.keys(wallets).length === 0) {
      return
    }
    async function scanWalletsForPurge () {
      await cleanStorage({ wallets })
      const now = Date.now()
      setPurged(true)
      Object.keys(wallets || {}).forEach((address) => {
        const wallet = wallets[address]
        if (!wallet) {
          return
        }
        if (address === 'undefined') {
          // leftover stale wallet due to buggy code
          dispatch(walletActions.deleteWallet('undefined'))
          return
        }
        if (
          (wallet?.temp && wallet.temp < now) ||
          address === ONEConstants.EmptyAddress ||
          !wallet.network
        ) {
          purge(wallet)
        }
      })
    }
    scanWalletsForPurge()
  }, [wallets])

  useEffect(() => {
    batch(() => {
      values(wallets).filter(w => isMatchingWallet(w)).forEach(({ address }) => {
        dispatch(walletActions.fetchWallet({ address }))
        dispatch(balanceActions.fetchBalance({ address }))
      })
    })
  }, [])

  const isMatchingWallet = (w) => {
    return w.network === network &&
      !w.temp &&
      w.address !== ONEConstants.EmptyAddress
  }

  const matchedWallets = values(wallets).filter(w => isMatchingWallet(w))

  if (!matchedWallets.length) {
    return (
      <AnimatedSection
        show
        style={{ maxWidth: 720 }}
      >
        <Hint>
          No wallet found on this device, you can either{' '}
          <Button type='link' onClick={() => history.push(Paths.create)} style={{ padding: 0 }}>create one</Button>
          {' '}now or{' '}
          <Button type='link' onClick={() => history.push(Paths.restore)} style={{ padding: 0 }}> restore one </Button>
          {' '}you had before.
        </Hint>
      </AnimatedSection>
    )
  }

  return (
    <Space direction='vertical' style={{ width: '100%' }}>
      <Row gutter={[24, 24]}>
        {matchedWallets.map((w, i) => <Col span={isMobile && 24} key={`${w.address}-${i}`}><WalletCard wallet={w} /></Col>)}
      </Row>
      <Row style={{ marginTop: 36 }}>
        <Space direction='vertical'>
          <Space align='baseline' style={{ justifyContent: 'space-between', marginLeft: isMobile ? '24px' : undefined }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48 }}>Total Balance</Title>
            <Title level={titleLevel}>{formatted}</Title><Text type='secondary'>ONE</Text>
          </Space>
          <Space align='baseline' style={{ justifyContent: 'space-between', marginLeft: isMobile ? '24px' : undefined }}>
            <Title level={titleLevel} style={{ marginRight: isMobile ? 16 : 48, opacity: 0 }}>Total Balance</Title>
            <Title style={{ whiteSpace: 'nowrap' }} level={titleLevel}>≈ ${fiatFormatted}</Title><Text type='secondary'>USD</Text>
          </Space>
        </Space>
      </Row>
    </Space>
  )
}
export default List
