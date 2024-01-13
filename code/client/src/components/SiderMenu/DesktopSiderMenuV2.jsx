import { getColorPalette, useTheme } from '../../theme'
import { useRouteMatch } from 'react-router'
import Paths from '../../constants/paths'
import Layout from 'antd/es/layout'
import Row from 'antd/es/row'
import { SiderLink } from '../Text'
import config from '../../config'
import Image from 'antd/es/image'
import Menu from 'antd/es/menu'
import OverviewIcon from '../../assets/icons/overview.svg'
import AssetsIcon from '../../assets/icons/assets.svg'
import NFTIcon from '../../assets/icons/nft.svg'
import SwapIcon from '../../assets/icons/swap.svg'
import StakeIcon from '../../assets/icons/stake.svg'
import RestoreIcon from '../../assets/icons/restore.svg'
import { LineDivider } from '../StatsInfo'
import React from 'react'
import { Logo, RouteActionMap } from './Common'

export const DeskstopSiderMenuV2 = ({ nav, ...args }) => {
  const theme = useTheme()
  const match = useRouteMatch(Paths.matchStructure)
  const { category, section } = match ? match.params : {}

  const action = RouteActionMap[section] ?? RouteActionMap[category]

  const { primaryTextColor, secondaryTextColor } = getColorPalette(theme)

  return (
    <Layout.Sider collapsed={false} {...args} theme={theme} style={{ color: primaryTextColor }}>
      <Row justify='center'>
        <SiderLink href={config.logoLink}>
          <Image preview={false} src={Logo} style={{ cursor: 'pointer', padding: 32 }} />
        </SiderLink>
      </Row>

      <Row justify='center' style={{ marginBottom: 24 }}><SiderLink href={config.appLink}>{config.appName} {config.version}</SiderLink></Row>

      <Menu theme={theme} mode='inline' onClick={nav} selectedKeys={[action]}>
        {[
          { key: RouteActionMap.show, IconEl: OverviewIcon, label: 'Overview' },
          { key: RouteActionMap.assets, IconEl: AssetsIcon, label: 'Assets' },
          { key: RouteActionMap.nft, IconEl: NFTIcon, label: 'NFTs' },
          { key: RouteActionMap.swap, IconEl: SwapIcon, label: 'Swap' },
          { key: RouteActionMap.stake, IconEl: StakeIcon, label: 'Stake' },
          { key: RouteActionMap.restore, IconEl: RestoreIcon, label: 'Restore' },
        ].map(({ key, IconEl, label }) => <Menu.Item key={key} icon={<IconEl fill={action === 'overview' ? 'currentColor' : secondaryTextColor} />}>{label}</Menu.Item>)}
      </Menu>
      <LineDivider />
      <Menu theme={theme} mode='inline' className='secondary-menu' onClick={nav} selectedKeys={[action]} style={{ color: secondaryTextColor, textTransform: 'uppercase' }}>
        <Menu.Item key='external/pro'><SiderLink href='https://modulo.so'>About Modulo</SiderLink></Menu.Item>
        <Menu.Item key='external/audit'><SiderLink href='https://github.com/polymorpher/one-wallet/tree/master/audits'>Audits</SiderLink></Menu.Item>
        <Menu.Item key='external/wiki'><SiderLink href='https://github.com/polymorpher/one-wallet/wiki'>Wiki</SiderLink></Menu.Item>
        <Menu.Item key='external/bug'><SiderLink href='https://github.com/polymorpher/one-wallet/issues'>Bugs</SiderLink></Menu.Item>
        <Menu.Item key='external/network'><SiderLink href='https://github.com/polymorpher/one-wallet/issues'>Network</SiderLink></Menu.Item>
        <Menu.Item key='internal/tools'>Tools</Menu.Item>
      </Menu>
    </Layout.Sider>
  )
}
