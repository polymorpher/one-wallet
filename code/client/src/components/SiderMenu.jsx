import React, { useState, useEffect } from 'react'
import { useHistory, useRouteMatch } from 'react-router'
import Layout from 'antd/es/layout'
import Image from 'antd/es/image'
import Row from 'antd/es/row'
import Menu from 'antd/es/menu'
import Typography from 'antd/es/typography'
import Divider from 'antd/es/divider'
import Tag from 'antd/es/tag'
import Spin from 'antd/es/spin'
import PlusCircleOutlined from '@ant-design/icons/PlusCircleOutlined'
import UnorderedListOutlined from '@ant-design/icons/UnorderedListOutlined'
import HistoryOutlined from '@ant-design/icons/HistoryOutlined'
import AuditOutlined from '@ant-design/icons/AuditOutlined'
import GithubOutlined from '@ant-design/icons/GithubOutlined'
import InfoCircleOutlined from '@ant-design/icons/InfoCircleOutlined'
import DollarOutlined from '@ant-design/icons/DollarOutlined'
import ToolOutlined from '@ant-design/icons/ToolOutlined'
import HarmonyLogo from '../assets/harmony.svg'
import OneWalletLogo from '../assets/1walletlogo.svg'
import OverviewIcon from '../assets/icons/overview.svg?el'
import AssetsIcon from '../assets/icons/assets.svg?el'
import NFTIcon from '../assets/icons/nft.svg?el'
import SwapIcon from '../assets/icons/swap.svg?el'
import StakeIcon from '../assets/icons/stake.svg?el'
import AuditIcon from '../assets/icons/audit.svg?el'
import RestoreIcon from '../assets/icons/restore.svg?el'
import config from '../config'
import Paths from '../constants/paths'
import styled from 'styled-components'
import { useWindowDimensions } from '../util'
import abbr from '../abbr'
import { useDispatch, useSelector } from 'react-redux'
import { getColorPalette, getPrimaryBorderColor, getPrimaryTextColor } from '../theme'
import WalletConstants from '../constants/wallet'
import { cacheActions } from '../state/modules/cache'
const { Link } = Typography

const SiderLink = styled(Link).attrs((e) => ({
  ...e,
  style: { ...e.style },
  target: '_blank',
  rel: 'noopener noreferrer'
}))`
  &:hover {
    opacity: 0.8;
  }
`

const mobileMenuItemStyle = {
  padding: '0 10px',
  fontSize: 12
}

const LineDivider = ({ children }) => {
  const theme = useSelector(state => state.global.v2ui ? state.global.theme : 'dark')
  const color = getPrimaryBorderColor(theme)
  return (
    <Divider style={{ borderColor: color, opacity: 0.5, color: color, fontSize: 14 }}>
      {children}
    </Divider>
  )
}

const MobileSiderMenu = ({ action, nav, ...args }) => {
  const theme = useSelector(state => state.global.v2ui ? state.global.theme : 'dark')
  return (
    <Menu
      theme={theme}
      mode='horizontal'
      onClick={nav}
      selectedKeys={[action]}
    >
      <Menu.Item key='create' style={mobileMenuItemStyle} icon={<PlusCircleOutlined />}>Create</Menu.Item>
      <Menu.Item key='wallets' style={mobileMenuItemStyle} icon={<UnorderedListOutlined />}>Wallets</Menu.Item>
      <Menu.Item key='restore' style={mobileMenuItemStyle} icon={<HistoryOutlined />}>Restore</Menu.Item>
      <Menu.Item key='grant' style={mobileMenuItemStyle} icon={<DollarOutlined />}><SiderLink style={{ color: null }} href='https://harmony.one/wallet'>Grants</SiderLink></Menu.Item>
      <Menu.Item key='bug' style={mobileMenuItemStyle} icon={<GithubOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/issues'>Bug Report</SiderLink></Menu.Item>
      <Menu.Item key='audit' style={mobileMenuItemStyle} icon={<AuditOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
      <Menu.Item key='wiki' style={mobileMenuItemStyle} icon={<InfoCircleOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
      <Menu.Item key='tools' style={mobileMenuItemStyle} icon={<ToolOutlined />}>Tools</Menu.Item>
    </Menu>
  )
}

const StatsInfo = () => {
  const v2ui = useSelector(state => state.global.v2ui)
  const statsCached = useSelector(state => state.cache.global.stats)
  const [stats, setStats] = useState(null)
  const dispatch = useDispatch()

  useEffect(() => {
    setStats(statsCached)
  }, [statsCached])

  useEffect(() => {
    const { timeUpdated } = statsCached || {}
    if (!timeUpdated || (Date.now() - timeUpdated > WalletConstants.globalStatsCacheDuration)) {
      dispatch(cacheActions.fetchGlobalStats())
    } else {
      setStats(statsCached)
    }
  }, [])

  return (
    <>
      <LineDivider>Global Usage</LineDivider>
      {stats
        ? (
          <Row style={{ marginBottom: 16 }} justify='center'>
            <Row style={{ marginBottom: 8 }}>
              <Tag color='dimgray' style={{ margin: 0, width: 64, borderRadius: 0, textAlign: 'center' }}>wallets</Tag>
              <Tag color='lightseagreen' style={{ width: 80, borderRadius: 0, textAlign: 'center' }}>{stats.count.toLocaleString()}</Tag>
            </Row>
            <Row>
              <Tag color='dimgray' style={{ margin: 0, width: 64, borderRadius: 0, textAlign: 'center' }}>balance</Tag>
              <Tag color='steelblue' style={{ width: 80, borderRadius: 0, textAlign: 'center' }}>{abbr(stats.totalAmount, 0)} ONE</Tag>
            </Row>
          </Row>)
        : (
          <Row justify='center'>
            <Spin />
          </Row>)}
      {!v2ui && <LineDivider />}
    </>
  )
}

const DeskstopSiderMenu = ({ action, nav, ...args }) => {
  const history = useHistory()
  const theme = useSelector(state => state.global.v2ui ? (state.global.theme ?? 'light') : 'dark')

  return (
    <Layout.Sider collapsed={false} {...args} theme={theme}>
      {/* <Image src='/assets/harmony.svg' /> */}
      <Row justify='center'>
        <SiderLink href='https://harmony.one/'>
          <Image preview={false} src={HarmonyLogo} style={{ cursor: 'pointer', padding: 32 }} onClick={() => history.push('/')} />
        </SiderLink>
      </Row>

      <Row justify='center' style={{ marginBottom: 24 }}><SiderLink style={{ color: getPrimaryTextColor(theme) }} href='https://harmony.one/1wallet'>{config.appName} {config.version}</SiderLink></Row>

      <StatsInfo />

      <Menu theme={theme} mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='create' icon={<PlusCircleOutlined />}>Create</Menu.Item>
        <Menu.Item key='wallets' icon={<UnorderedListOutlined />}>Wallets</Menu.Item>
        <Menu.Item key='restore' icon={<HistoryOutlined />}>Restore</Menu.Item>
      </Menu>
      <LineDivider />
      <Menu theme={theme} mode='inline' selectable={false}>
        <Menu.Item key='grant' icon={<DollarOutlined />}><SiderLink style={{ color: null }} href='https://harmony.one/wallet'>Grants</SiderLink></Menu.Item>
        <Menu.Item key='bug' icon={<GithubOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/issues'>Bug Report</SiderLink></Menu.Item>
        <Menu.Item key='audit' icon={<AuditOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
        <Menu.Item key='wiki' icon={<InfoCircleOutlined />}><SiderLink style={{ color: null }} href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
      </Menu>
      <LineDivider />
      <Menu theme={theme} mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='tools' icon={<ToolOutlined />}>Tools</Menu.Item>
      </Menu>
    </Layout.Sider>
  )
}

const DeskstopSiderMenuV2 = ({ action, nav, ...args }) => {
  const history = useHistory()
  const theme = useSelector(state => state.global.v2ui ? (state.global.theme ?? 'light') : 'dark')

  const { primaryTextColor, secondaryTextColor } = getColorPalette(theme)

  return (
    <Layout.Sider collapsed={false} {...args} theme={theme} style={{ color: primaryTextColor }}>
      <Row justify='center'>
        <SiderLink href='https://harmony.one/'>
          <Image preview={false} src={OneWalletLogo} style={{ cursor: 'pointer', padding: 32 }} onClick={() => history.push('/')} />
        </SiderLink>
      </Row>

      <Row justify='center' style={{ marginBottom: 24 }}><SiderLink href='https://harmony.one/1wallet'>{config.appName} {config.version}</SiderLink></Row>

      <Menu theme={theme} mode='inline' onClick={nav} selectedKeys={[action]}>
        <Menu.Item key='overview' icon={<OverviewIcon fill={action === 'overview' ? 'currentColor' : secondaryTextColor} />}>Overview</Menu.Item>
        <Menu.Item key='assets' icon={<AssetsIcon fill={action === 'assets' ? 'currentColor' : secondaryTextColor} />}>Assets</Menu.Item>
        <Menu.Item key='nft' icon={<NFTIcon fill={action === 'nft' ? 'currentColor' : secondaryTextColor} />}>NFTs</Menu.Item>
        <Menu.Item key='swap' icon={<SwapIcon fill={action === 'swap' ? 'currentColor' : secondaryTextColor} />}>Swap</Menu.Item>
        <Menu.Item key='stake' icon={<StakeIcon fill={action === 'stake' ? 'currentColor' : secondaryTextColor} />}>Stake</Menu.Item>
        <Menu.Item key='restore' icon={<RestoreIcon fill={action === 'restore' ? 'currentColor' : secondaryTextColor} />}>Restore</Menu.Item>
      </Menu>
      <LineDivider />
      <Menu theme={theme} mode='inline' selectable={false}>
        <Menu.Item key='audit' icon={<AuditIcon fill={secondaryTextColor} />}><SiderLink href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
      </Menu>
      <LineDivider />
      <Menu theme={theme} mode='inline' onClick={nav} selectedKeys={[action]} style={{ color: secondaryTextColor }}>
        <Menu.Item key='tools'>Tools</Menu.Item>
        <Menu.Item key='bug'><SiderLink href='https://github.com/polymorpher/one-wallet/issues'>Bug Report</SiderLink></Menu.Item>
        <Menu.Item key='wiki'><SiderLink href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
      </Menu>

      <StatsInfo />
    </Layout.Sider>
  )
}

const SiderMenu = ({ ...args }) => {
  const { isMobile } = useWindowDimensions()
  const history = useHistory()
  const match = useRouteMatch('/:action')
  const { action } = match ? match.params : {}
  const v2ui = useSelector(state => state.global.v2ui)
  args.action = action
  args.nav = ({ key }) => {
    history.push(Paths[key])
  }

  return (
    isMobile
      ? <MobileSiderMenu {...args} />
      : (v2ui ? <DeskstopSiderMenuV2 {...args} /> : <DeskstopSiderMenu {...args} />)
  )
}

export default SiderMenu
